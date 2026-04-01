/**
 * solve-parametric-full.js
 *
 * Solves for optimal PEQ parameters: frequency, Q, gain, filter type.
 * Uses peak/dip detection for initialization + iterative gradient descent.
 *
 * Input: target delta curve (dB), weights, usable mask, PEQ config
 * Output: array of { freq, q, gain, type } for each band
 */

const TWO_PI = 2 * Math.PI;

// ── Biquad filter response at a given frequency ──────────────

function peakingResponse(freq, centerHz, q, gainDb) {
  if (Math.abs(gainDb) < 0.001) return 0;
  const w0 = TWO_PI * centerHz;
  const w = TWO_PI * freq;
  const ratio = w / w0;
  const logDist = Math.log2(ratio);
  const bandwidth = 1 / Math.max(0.1, q);
  const x = logDist / (bandwidth * 0.5);
  return gainDb * Math.exp(-0.5 * x * x);
}

function shelfResponse(freq, centerHz, q, gainDb, isLow) {
  if (Math.abs(gainDb) < 0.001) return 0;
  const ratio = freq / centerHz;
  const logRatio = Math.log2(ratio);
  const slope = Math.max(0.3, q) * 2;
  if (isLow) {
    // Low shelf: full gain below center, rolls off above
    return gainDb / (1 + Math.pow(Math.max(ratio, 0.001), slope));
  }
  // High shelf: full gain above center, rolls off below
  return gainDb / (1 + Math.pow(Math.max(1 / ratio, 0.001), slope));
}

function bandResponse(freq, band) {
  if (band.type === "lowShelf" || band.type === "low_shelf") return shelfResponse(freq, band.freq, band.q, band.gain, true);
  if (band.type === "highShelf" || band.type === "high_shelf") return shelfResponse(freq, band.freq, band.q, band.gain, false);
  return peakingResponse(freq, band.freq, band.q, band.gain);
}

function totalResponse(freqGrid, bands) {
  return freqGrid.map((freq) => {
    let sum = 0;
    for (const band of bands) sum += bandResponse(freq, band);
    return sum;
  });
}

function weightedError(target, predicted, weights, mask) {
  let sum = 0;
  for (let i = 0; i < target.length; i++) {
    if (!mask[i]) continue;
    const w = weights[i] ?? 0;
    if (w <= 0) continue;
    const diff = (predicted[i] ?? 0) - (target[i] ?? 0);
    sum += diff * diff * w;
  }
  return sum;
}

// ── Peak/dip detection for initialization ────────────────────

function findPeaksAndDips(freqGrid, targetDb, weights, mask, maxCount) {
  const features = [];
  const smoothed = [...targetDb];

  // Simple 5-point moving average
  for (let pass = 0; pass < 2; pass++) {
    const prev = [...smoothed];
    for (let i = 2; i < smoothed.length - 2; i++) {
      smoothed[i] = (prev[i - 2] + prev[i - 1] + prev[i] + prev[i + 1] + prev[i + 2]) / 5;
    }
  }

  for (let i = 1; i < freqGrid.length - 1; i++) {
    if (!mask[i] || (weights[i] ?? 0) <= 0) continue;
    const prev = smoothed[i - 1];
    const curr = smoothed[i];
    const next = smoothed[i + 1];
    const isPeak = curr > prev && curr > next && curr > 1;
    const isDip = curr < prev && curr < next && curr < -1;
    if (isPeak || isDip) {
      features.push({
        index: i,
        freq: freqGrid[i],
        magnitude: Math.abs(curr),
        db: curr,
        weight: weights[i] ?? 0,
      });
    }
  }

  // Also check endpoints for shelf candidates
  const firstUsable = mask.findIndex(Boolean);
  const lastUsable = mask.lastIndexOf(true);
  if (firstUsable >= 0 && Math.abs(smoothed[firstUsable]) > 1.5) {
    features.push({ index: firstUsable, freq: freqGrid[firstUsable], magnitude: Math.abs(smoothed[firstUsable]), db: smoothed[firstUsable], weight: weights[firstUsable] ?? 0, isEdge: "low" });
  }
  if (lastUsable >= 0 && Math.abs(smoothed[lastUsable]) > 1.5) {
    features.push({ index: lastUsable, freq: freqGrid[lastUsable], magnitude: Math.abs(smoothed[lastUsable]), db: smoothed[lastUsable], weight: weights[lastUsable] ?? 0, isEdge: "high" });
  }

  // Sort by importance (magnitude × weight)
  features.sort((a, b) => (b.magnitude * b.weight) - (a.magnitude * a.weight));
  return features.slice(0, maxCount);
}

// ── Gradient descent ─────────────────────────────────────────

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function optimizeBands(freqGrid, targetDb, weights, mask, bands, config) {
  const { minFreq = 30, maxFreq = 16000, minQ = 0.2, maxQ = 20, minGain = -9, maxGain = 9 } = config;
  let current = bands.map((b) => ({ ...b }));
  let bestError = weightedError(targetDb, totalResponse(freqGrid, current), weights, mask);
  let bestBands = current.map((b) => ({ ...b }));

  const iterations = 200;
  let lr = 0.5; // learning rate

  for (let iter = 0; iter < iterations; iter++) {
    const predicted = totalResponse(freqGrid, current);
    const residual = freqGrid.map((_, i) => (targetDb[i] ?? 0) - (predicted[i] ?? 0));

    for (let b = 0; b < current.length; b++) {
      const band = current[b];
      const epsilon = 0.01;

      // Gradient for gain
      const bandResp = freqGrid.map((f) => bandResponse(f, band));
      let gradGain = 0;
      for (let i = 0; i < freqGrid.length; i++) {
        if (!mask[i] || (weights[i] ?? 0) <= 0) continue;
        gradGain += -2 * residual[i] * bandResp[i] * (weights[i] ?? 0);
      }
      band.gain = clamp(band.gain - lr * gradGain * 0.001, minGain, maxGain);

      // Gradient for freq (numerical)
      const freqPlus = { ...band, freq: band.freq * (1 + epsilon) };
      const freqMinus = { ...band, freq: band.freq * (1 - epsilon) };
      let gradFreq = 0;
      for (let i = 0; i < freqGrid.length; i++) {
        if (!mask[i] || (weights[i] ?? 0) <= 0) continue;
        const dResp = bandResponse(freqGrid[i], freqPlus) - bandResponse(freqGrid[i], freqMinus);
        gradFreq += -2 * residual[i] * dResp * (weights[i] ?? 0);
      }
      band.freq = clamp(band.freq - lr * gradFreq * 0.05, minFreq, maxFreq);

      // Gradient for Q (numerical)
      const qPlus = { ...band, q: band.q + epsilon };
      const qMinus = { ...band, q: Math.max(0.1, band.q - epsilon) };
      let gradQ = 0;
      for (let i = 0; i < freqGrid.length; i++) {
        if (!mask[i] || (weights[i] ?? 0) <= 0) continue;
        const dResp = bandResponse(freqGrid[i], qPlus) - bandResponse(freqGrid[i], qMinus);
        gradQ += -2 * residual[i] * dResp * (weights[i] ?? 0);
      }
      band.q = clamp(band.q - lr * gradQ * 0.002, minQ, maxQ);
    }

    const error = weightedError(targetDb, totalResponse(freqGrid, current), weights, mask);
    if (error < bestError) {
      bestError = error;
      bestBands = current.map((b) => ({ ...b }));
    }

    // Decay learning rate
    if (iter % 50 === 49) lr *= 0.7;
  }

  return bestBands;
}

// ── Public API ───────────────────────────────────────────────

/**
 * Solve for optimal PEQ parameters.
 *
 * @param {number[]} targetDeltaDb - combined L+R delta curve
 * @param {number[]} weights
 * @param {boolean[]} usableMask
 * @param {object} eqModel - must have kind "parametric", with bands config
 * @param {number[]} frequencyGridHz - combined L+R frequency grid
 * @returns {{ eqSteps: Array, predictedEqDb: number[] }}
 */
export function solveParametricFull(targetDeltaDb, weights, usableMask, eqModel, frequencyGridHz) {
  const bandCount = eqModel.bands?.length || 10;
  const config = {
    minFreq: eqModel.minFreq ?? 30,
    maxFreq: eqModel.maxFreq ?? 16000,
    minQ: eqModel.minQ ?? 0.2,
    maxQ: eqModel.maxQ ?? 20,
    minGain: eqModel.bands?.[0]?.minStep ?? -9,
    maxGain: eqModel.bands?.[0]?.maxStep ?? 9,
  };

  // Use single-channel portion (first half of combined L+R)
  const halfLen = Math.floor(targetDeltaDb.length / 2);
  const monoTarget = halfLen > 0 ? targetDeltaDb.slice(0, halfLen) : targetDeltaDb;
  const monoWeights = halfLen > 0 ? weights.slice(0, halfLen) : weights;
  const monoMask = halfLen > 0 ? usableMask.slice(0, halfLen) : usableMask;
  const monoGrid = halfLen > 0 ? frequencyGridHz.slice(0, halfLen) : frequencyGridHz;

  // Initialize bands from peak/dip detection
  const features = findPeaksAndDips(monoGrid, monoTarget, monoWeights, monoMask, bandCount);
  const initialBands = [];

  for (let i = 0; i < bandCount; i++) {
    if (i < features.length) {
      const f = features[i];
      const type = f.isEdge === "low" ? "lowShelf" : f.isEdge === "high" ? "highShelf" : "peaking";
      initialBands.push({
        id: eqModel.bands?.[i]?.id || `band_${i}`,
        freq: f.freq,
        q: 1.0,
        gain: clamp(f.db, config.minGain, config.maxGain),
        type,
      });
    } else {
      // Extra bands: space evenly in log scale, zero gain
      const ratio = i / Math.max(1, bandCount - 1);
      const freq = config.minFreq * Math.pow(config.maxFreq / config.minFreq, ratio);
      initialBands.push({
        id: eqModel.bands?.[i]?.id || `band_${i}`,
        freq,
        q: 1.0,
        gain: 0,
        type: "peaking",
      });
    }
  }

  // Optimize
  const optimized = optimizeBands(monoGrid, monoTarget, monoWeights, monoMask, initialBands, config);

  // Quantize gains to step size
  const gainStep = eqModel.bands?.[0]?.gainStepDb || 0.1;
  for (const band of optimized) {
    band.gain = Math.round(band.gain / gainStep) * gainStep;
    band.gain = Number(band.gain.toFixed(2));
    band.freq = Math.round(band.freq);
    band.q = Number(band.q.toFixed(2));
  }

  // Build predicted EQ curve for full combined grid
  const predictedMono = totalResponse(monoGrid, optimized);
  // Duplicate for L+R combined grid
  const predictedEqDb = halfLen > 0 ? [...predictedMono, ...predictedMono] : predictedMono;

  return {
    eqSteps: optimized.map((band) => ({
      bandId: band.id,
      value: band.gain,
      freq: band.freq,
      q: band.q,
      type: band.type,
    })),
    predictedEqDb,
    bands: optimized,
  };
}
