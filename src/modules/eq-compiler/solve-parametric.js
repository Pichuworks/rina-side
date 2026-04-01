/**
 * solve-parametric.js
 *
 * Full parametric EQ solver: simultaneously optimizes
 * freq, Q, gain, and filter type for N bands.
 *
 * Algorithm:
 *   1. Peak/dip detection on target delta curve → initial band placement
 *   2. Gradient descent joint optimization
 *   3. Quantize gain to device step size
 */

const TWO_PI = 2 * Math.PI;

// ── Biquad filter response at frequency ─────────────────────

function peakingResponse(freq, centerHz, q, gainDb) {
  if (!gainDb) return 0;
  const logDist = Math.log2(freq / centerHz);
  const sigma = 1 / Math.max(0.1, q * 1.5);
  return gainDb * Math.exp(-(logDist * logDist) / (2 * sigma * sigma));
}

function lowShelfResponse(freq, centerHz, q, gainDb) {
  if (!gainDb) return 0;
  if (freq <= centerHz * 0.25) return gainDb;
  if (freq >= centerHz * 4) return 0;
  const t = Math.log2(freq / centerHz) / 2; // normalized [-1, 1] in transition
  const shaped = 0.5 * (1 - Math.tanh(t * Math.max(0.5, q) * 2));
  return gainDb * shaped;
}

function highShelfResponse(freq, centerHz, q, gainDb) {
  if (!gainDb) return 0;
  if (freq >= centerHz * 4) return gainDb;
  if (freq <= centerHz * 0.25) return 0;
  const t = Math.log2(freq / centerHz) / 2;
  const shaped = 0.5 * (1 + Math.tanh(t * Math.max(0.5, q) * 2));
  return gainDb * shaped;
}

function bandResponse(freq, band) {
  const { centerHz, q, gainDb, filterType } = band;
  if (filterType === "lowShelf") return lowShelfResponse(freq, centerHz, q, gainDb);
  if (filterType === "highShelf") return highShelfResponse(freq, centerHz, q, gainDb);
  return peakingResponse(freq, centerHz, q, gainDb);
}

function totalEqResponse(freqs, bands) {
  return freqs.map((f) => {
    let sum = 0;
    for (const band of bands) sum += bandResponse(f, band);
    return sum;
  });
}

function computeWeightedError(target, predicted, weights, mask) {
  let sum = 0;
  for (let i = 0; i < target.length; i++) {
    if (!mask[i]) continue;
    const w = weights[i] ?? 0;
    if (w <= 0) continue;
    const err = (predicted[i] ?? 0) - (target[i] ?? 0);
    sum += err * err * w;
  }
  return sum;
}

// ── Peak/dip detection ──────────────────────────────────────

function findPeaksAndDips(targetDb, freqs, weights, mask, maxCount) {
  const features = [];
  // Smooth the target first
  const smoothed = [...targetDb];
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < smoothed.length - 1; i++) {
      smoothed[i] = smoothed[i] * 0.5 + (smoothed[i - 1] + smoothed[i + 1]) * 0.25;
    }
  }
  // Find local extrema
  for (let i = 2; i < smoothed.length - 2; i++) {
    if (!mask[i] || (weights[i] ?? 0) <= 0) continue;
    const v = smoothed[i];
    const neighbors = (smoothed[i - 2] + smoothed[i - 1] + smoothed[i + 1] + smoothed[i + 2]) / 4;
    const prominence = Math.abs(v - neighbors);
    if (prominence < 1.0) continue; // skip minor ripples
    const isPeak = v > smoothed[i - 1] && v > smoothed[i + 1];
    const isDip = v < smoothed[i - 1] && v < smoothed[i + 1];
    if (isPeak || isDip) {
      features.push({
        index: i,
        freqHz: freqs[i],
        gainDb: v,
        prominence,
        type: isPeak ? "peak" : "dip",
      });
    }
  }
  // Sort by prominence, take top N
  features.sort((a, b) => b.prominence - a.prominence);
  return features.slice(0, maxCount);
}

// ── Initial band placement ──────────────────────────────────

function initializeBands(targetDb, freqs, weights, mask, numBands, constraints) {
  const features = findPeaksAndDips(targetDb, freqs, weights, mask, numBands);
  const bands = [];
  const usedFreqs = new Set();

  // Place bands at detected features
  for (const feat of features) {
    if (bands.length >= numBands) break;
    bands.push({
      centerHz: Math.max(constraints.minFreq, Math.min(constraints.maxFreq, feat.freqHz)),
      q: 1.0,
      gainDb: Math.max(constraints.minGain, Math.min(constraints.maxGain, feat.gainDb)),
      filterType: "peak",
    });
    usedFreqs.add(Math.round(feat.freqHz));
  }

  // Fill remaining bands spread across the spectrum
  while (bands.length < numBands) {
    const idx = Math.round(((bands.length + 0.5) / numBands) * (freqs.length - 1));
    const freq = freqs[Math.min(idx, freqs.length - 1)];
    bands.push({
      centerHz: Math.max(constraints.minFreq, Math.min(constraints.maxFreq, freq)),
      q: 1.0,
      gainDb: 0,
      filterType: "peak",
    });
  }

  // First band → lowShelf candidate, last → highShelf candidate
  if (bands.length >= 2) {
    bands.sort((a, b) => a.centerHz - b.centerHz);
    // Check if low shelf makes sense
    const lowTarget = targetDb.slice(0, Math.min(20, targetDb.length));
    const lowAvg = lowTarget.reduce((s, v) => s + v, 0) / lowTarget.length;
    if (Math.abs(lowAvg) > 1.5) bands[0].filterType = "lowShelf";
    // Check if high shelf makes sense
    const hiTarget = targetDb.slice(-Math.min(20, targetDb.length));
    const hiAvg = hiTarget.reduce((s, v) => s + v, 0) / hiTarget.length;
    if (Math.abs(hiAvg) > 1.5) bands[bands.length - 1].filterType = "highShelf";
  }

  return bands;
}

// ── Gradient descent ────────────────────────────────────────

function optimizeBands(bands, targetDb, freqs, weights, mask, constraints, maxIter = 300) {
  const eps = { freq: 0.01, q: 0.02, gain: 0.01 }; // finite difference step
  const lr = { freq: 0.002, q: 0.003, gain: 0.01 };  // learning rates
  let current = bands.map((b) => ({ ...b }));
  let currentError = computeWeightedError(targetDb, totalEqResponse(freqs, current), weights, mask);

  for (let iter = 0; iter < maxIter; iter++) {
    // Decay learning rate
    const decay = 1 / (1 + iter * 0.005);

    for (let b = 0; b < current.length; b++) {
      const band = current[b];
      const predicted = totalEqResponse(freqs, current);

      // Gradient for centerHz (in log space)
      const logFreq = Math.log2(band.centerHz);
      band.centerHz = Math.pow(2, logFreq + eps.freq);
      const errFreqPlus = computeWeightedError(targetDb, totalEqResponse(freqs, current), weights, mask);
      band.centerHz = Math.pow(2, logFreq - eps.freq);
      const errFreqMinus = computeWeightedError(targetDb, totalEqResponse(freqs, current), weights, mask);
      const gradFreq = (errFreqPlus - errFreqMinus) / (2 * eps.freq);
      band.centerHz = Math.pow(2, Math.max(Math.log2(constraints.minFreq), Math.min(Math.log2(constraints.maxFreq), logFreq - gradFreq * lr.freq * decay)));

      // Gradient for Q (in log space)
      const logQ = Math.log2(band.q);
      band.q = Math.pow(2, logQ + eps.q);
      const errQPlus = computeWeightedError(targetDb, totalEqResponse(freqs, current), weights, mask);
      band.q = Math.pow(2, logQ - eps.q);
      const errQMinus = computeWeightedError(targetDb, totalEqResponse(freqs, current), weights, mask);
      const gradQ = (errQPlus - errQMinus) / (2 * eps.q);
      band.q = Math.pow(2, Math.max(Math.log2(constraints.minQ), Math.min(Math.log2(constraints.maxQ), logQ - gradQ * lr.q * decay)));

      // Gradient for gain
      band.gainDb += eps.gain;
      const errGainPlus = computeWeightedError(targetDb, totalEqResponse(freqs, current), weights, mask);
      band.gainDb -= 2 * eps.gain;
      const errGainMinus = computeWeightedError(targetDb, totalEqResponse(freqs, current), weights, mask);
      const gradGain = (errGainPlus - errGainMinus) / (2 * eps.gain);
      band.gainDb = Math.max(constraints.minGain, Math.min(constraints.maxGain, band.gainDb + eps.gain - gradGain * lr.gain * decay));
    }

    const newError = computeWeightedError(targetDb, totalEqResponse(freqs, current), weights, mask);
    if (Math.abs(currentError - newError) < 1e-8) break; // converged
    currentError = newError;
  }

  return current;
}

// ── Public API ──────────────────────────────────────────────

export function solveParametric(targetDeltaDb, weights, usableMask, eqModel, frequencyGridHz) {
  const numBands = eqModel.bands?.length || 10;
  const sampleBand = eqModel.bands?.[0] || {};
  const constraints = {
    minFreq: sampleBand.minFreq || 30,
    maxFreq: sampleBand.maxFreq || 16000,
    minQ: sampleBand.minQ || 0.2,
    maxQ: sampleBand.maxQ || 20,
    minGain: (sampleBand.minStep || -9) * (sampleBand.gainStepDb || 1),
    maxGain: (sampleBand.maxStep || 9) * (sampleBand.gainStepDb || 1),
    gainStepDb: sampleBand.gainStepDb || 0.5,
  };

  // Handle doubled stereo input (L+R concatenated)
  const halfLen = frequencyGridHz.length / 2;
  const isDoubled = halfLen === Math.floor(halfLen) && halfLen > 50;
  const monoLen = isDoubled ? halfLen : frequencyGridHz.length;
  const monoTarget = targetDeltaDb.slice(0, monoLen);
  const monoWeights = weights.slice(0, monoLen);
  const monoMask = usableMask.slice(0, monoLen);
  const monoFreqs = frequencyGridHz.slice(0, monoLen);

  // Initialize and optimize
  const initialBands = initializeBands(monoTarget, monoFreqs, monoWeights, monoMask, numBands, constraints);
  const optimized = optimizeBands(initialBands, monoTarget, monoFreqs, monoWeights, monoMask, constraints);

  // Quantize gain to device step
  const quantized = optimized.map((band) => {
    const step = constraints.gainStepDb;
    const qGain = Math.round(band.gainDb / step) * step;
    return {
      ...band,
      gainDb: Math.max(constraints.minGain, Math.min(constraints.maxGain, qGain)),
    };
  });

  // Build output
  const predictedMono = totalEqResponse(monoFreqs, quantized);
  const predictedEqDb = isDoubled ? [...predictedMono, ...predictedMono] : predictedMono;

  const eqSteps = quantized.map((band, i) => ({
    bandId: eqModel.bands?.[i]?.id || `band${i}`,
    value: band.gainDb / constraints.gainStepDb,
    centerHz: Math.round(band.centerHz),
    q: Number(band.q.toFixed(2)),
    gainDb: Number(band.gainDb.toFixed(1)),
    filterType: band.filterType,
  }));

  return { eqSteps, predictedEqDb };
}
