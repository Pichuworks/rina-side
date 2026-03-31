import { resampleLinear } from "../../deck-calibration.js";
import { STANDARD_SAMPLE_RATE, PROGRAM_FRAME_SIZE, PROGRAM_HOP_SIZE } from "../player-profile/constants.js";
import { combineConfidence, confidenceFromEnergy, confidenceFromVariation } from "../player-profile/confidence.js";
import { buildFrequencyGridHz } from "../player-profile/frequency-grid.js";
import { dbFromAmplitude, smoothLogCurve, weightedAverage } from "../player-profile/response-curve.js";

// ── FFT (radix-2, in-place) ──────────────────────────────────

function fftReal(re, im) {
  const n = re.length;
  // bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    while (j & bit) { j ^= bit; bit >>= 1; }
    j ^= bit;
    if (i < j) {
      let tmp = re[i]; re[i] = re[j]; re[j] = tmp;
      tmp = im[i]; im[i] = im[j]; im[j] = tmp;
    }
  }
  // Cooley-Tukey
  for (let len = 2; len <= n; len *= 2) {
    const half = len / 2;
    const angle = -2 * Math.PI / len;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let curRe = 1, curIm = 0;
      for (let j = 0; j < half; j++) {
        const a = i + j;
        const b = a + half;
        const tRe = curRe * re[b] - curIm * im[b];
        const tIm = curRe * im[b] + curIm * re[b];
        re[b] = re[a] - tRe;
        im[b] = im[a] - tIm;
        re[a] += tRe;
        im[a] += tIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────

function extractStereo(audioBuffer, sampleRate = STANDARD_SAMPLE_RATE) {
  const channels = Math.max(1, audioBuffer.numberOfChannels || 1);
  const leftIn = audioBuffer.getChannelData(0);
  const rightIn = audioBuffer.getChannelData(Math.min(1, channels - 1));
  return {
    left: audioBuffer.sampleRate === sampleRate ? leftIn.slice() : resampleLinear(leftIn, audioBuffer.sampleRate, sampleRate),
    right: audioBuffer.sampleRate === sampleRate ? rightIn.slice() : resampleLinear(rightIn, audioBuffer.sampleRate, sampleRate),
    sampleRate,
  };
}

// Pre-compute Hann window (reused across all frames)
let cachedWindow = null;
let cachedWindowSize = 0;
function getHannWindow(length) {
  if (cachedWindowSize === length && cachedWindow) return cachedWindow;
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) out[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / Math.max(1, length - 1));
  cachedWindow = out;
  cachedWindowSize = length;
  return out;
}

/**
 * Build a lookup table: for each grid frequency, which FFT bin(s) to
 * interpolate and with what weights.
 *
 * Returns array of { binLo, binHi, wLo, wHi } for each grid point.
 */
function buildGridBinMap(gridHz, fftSize, sampleRate) {
  const binWidth = sampleRate / fftSize;
  const maxBin = fftSize / 2;
  return gridHz.map((freq) => {
    const exactBin = freq / binWidth;
    const binLo = Math.max(0, Math.min(maxBin - 1, Math.floor(exactBin)));
    const binHi = Math.min(maxBin, binLo + 1);
    const frac = exactBin - binLo;
    return { binLo, binHi, wLo: 1 - frac, wHi: frac };
  });
}

function magnitudeFromBins(re, im, map) {
  const magLo = Math.sqrt(re[map.binLo] * re[map.binLo] + im[map.binLo] * im[map.binLo]);
  const magHi = Math.sqrt(re[map.binHi] * re[map.binHi] + im[map.binHi] * im[map.binHi]);
  return magLo * map.wLo + magHi * map.wHi;
}

// ── Core analysis (FFT-based) ────────────────────────────────

function analyseTrackChannel(reference, recorded, sampleRate, gridHz) {
  const N = PROGRAM_FRAME_SIZE;
  const window = getHannWindow(N);
  const binMap = buildGridBinMap(gridHz, N, sampleRate);

  // Accumulators
  const weightedSums = new Float64Array(gridHz.length);
  const weightTotals = new Float64Array(gridHz.length);
  const valuesPerFreq = gridHz.map(() => []);

  // Reusable FFT buffers
  const refRe = new Float64Array(N);
  const refIm = new Float64Array(N);
  const recRe = new Float64Array(N);
  const recIm = new Float64Array(N);

  const minLen = Math.min(reference.length, recorded.length);

  for (let start = 0; start + N <= minLen; start += PROGRAM_HOP_SIZE) {
    // Window and copy into FFT buffers
    for (let i = 0; i < N; i++) {
      const w = window[i];
      refRe[i] = reference[start + i] * w;
      recRe[i] = recorded[start + i] * w;
    }
    refIm.fill(0);
    recIm.fill(0);

    // FFT both frames
    fftReal(refRe, refIm);
    fftReal(recRe, recIm);

    // Extract magnitudes at grid frequencies via bin interpolation
    for (let f = 0; f < gridHz.length; f++) {
      const map = binMap[f];
      const refMag = magnitudeFromBins(refRe, refIm, map);
      const recMag = magnitudeFromBins(recRe, recIm, map);
      const refDb = dbFromAmplitude(refMag);
      const recDb = dbFromAmplitude(recMag);
      const deltaDb = dbFromAmplitude((recMag + 1e-12) / (refMag + 1e-12));
      const conf = combineConfidence(
        confidenceFromEnergy(refDb, -72, -24),
        confidenceFromEnergy(recDb, -78, -24),
      );
      if (conf <= 0) continue;
      weightedSums[f] += deltaDb * conf;
      weightTotals[f] += conf;
      valuesPerFreq[f].push(deltaDb);
    }
  }

  // Aggregate
  const responseDb = new Array(gridHz.length).fill(0);
  const confidence = new Array(gridHz.length).fill(0);
  for (let i = 0; i < gridHz.length; i++) {
    responseDb[i] = weightTotals[i] > 0 ? weightedSums[i] / weightTotals[i] : 0;
    const localValues = valuesPerFreq[i];
    const variance = localValues.length
      ? localValues.reduce((sum, value) => sum + ((value - responseDb[i]) ** 2), 0) / localValues.length
      : Infinity;
    const std = Number.isFinite(variance) ? Math.sqrt(variance) : 99;
    const stability = confidenceFromVariation(std, 1.25, 6.0);
    const coverage = weightTotals[i] > 0 ? Math.min(1, weightTotals[i] / 12) : 0;
    confidence[i] = Math.max(0, Math.min(1, weightedAverage([stability, coverage], [0.6, 0.4])));
  }

  return {
    responseDb: smoothLogCurve(gridHz, responseDb),
    confidence: smoothLogCurve(gridHz, confidence).map((value) => Math.max(0, Math.min(1, value))),
  };
}

// ── Public API ───────────────────────────────────────────────

export function extractProgramStereo(audioBuffer) {
  return extractStereo(audioBuffer, STANDARD_SAMPLE_RATE);
}

export function analyseProgramTransfer(referenceStereo, recordedStereo) {
  const gridHz = buildFrequencyGridHz();
  const left = analyseTrackChannel(referenceStereo.left, recordedStereo.left, referenceStereo.sampleRate, gridHz);
  const right = analyseTrackChannel(referenceStereo.right, recordedStereo.right, referenceStereo.sampleRate, gridHz);
  return {
    frequencyGridHz: gridHz,
    responseDb: {
      L: left.responseDb,
      R: right.responseDb,
    },
    confidence: {
      L: left.confidence,
      R: right.confidence,
    },
  };
}
