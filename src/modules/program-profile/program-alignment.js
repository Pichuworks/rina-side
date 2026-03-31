import { PROGRAM_ALIGN_MIN_SCORE } from "../player-profile/constants.js";

const ENV_FRAME = 2048;
const ENV_HOP = 512;

function monoAverage(left, right) {
  const length = Math.min(left.length, right.length);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) out[i] = (left[i] + right[i]) * 0.5;
  return out;
}

function rmsEnvelope(signal, frame = ENV_FRAME, hop = ENV_HOP) {
  const out = [];
  for (let start = 0; start + frame <= signal.length; start += hop) {
    let sum = 0;
    for (let i = start; i < start + frame; i++) sum += signal[i] * signal[i];
    out.push(Math.sqrt(sum / frame));
  }
  return out;
}

/**
 * Find onset frame — the first point where the envelope exceeds
 * `threshold × peak`. Uses a small look-ahead to skip isolated clicks.
 */
function findEnvelopeOnset(envelope, threshold = 0.05, lookAhead = 3) {
  let peak = 0;
  for (let i = 0; i < envelope.length; i++) {
    if (envelope[i] > peak) peak = envelope[i];
  }
  if (peak < 1e-8) return 0;
  const th = peak * threshold;
  for (let i = 0; i < envelope.length - lookAhead; i++) {
    let count = 0;
    for (let j = 0; j < lookAhead; j++) {
      if (envelope[i + j] > th) count++;
    }
    if (count >= 2) return i;
  }
  return 0;
}

function normalizedCorrelation(a, b, offset) {
  let dot = 0;
  let aPow = 0;
  let bPow = 0;
  const startA = Math.max(0, -offset);
  const startB = Math.max(0, offset);
  const length = Math.min(a.length - startA, b.length - startB);
  if (length <= 0) return -1;
  for (let i = 0; i < length; i++) {
    const x = a[startA + i];
    const y = b[startB + i];
    dot += x * y;
    aPow += x * x;
    bPow += y * y;
  }
  return dot / Math.sqrt((aPow + 1e-12) * (bPow + 1e-12));
}

export function alignProgramPair(referenceStereo, recordedStereo) {
  const refMono = monoAverage(referenceStereo.left, referenceStereo.right);
  const recMono = monoAverage(recordedStereo.left, recordedStereo.right);
  const refEnv = rmsEnvelope(refMono);
  const recEnv = rmsEnvelope(recMono);

  // ── onset-guided search ────────────────────────────────────
  // Estimate rough offset from onset positions, then do fine
  // correlation search around that estimate. This handles cases
  // where the recording has many seconds of leading/trailing silence.
  const refOnset = findEnvelopeOnset(refEnv);
  const recOnset = findEnvelopeOnset(recEnv);
  const estimatedOffset = recOnset - refOnset;

  // Search ±radius around the estimated offset.
  // Also always include a ±200 window around 0 as fallback.
  const fineRadius = 250;
  const searchMin = Math.min(-fineRadius, estimatedOffset - fineRadius);
  const searchMax = Math.max(fineRadius, estimatedOffset + fineRadius);
  // Clamp to signal bounds
  const envLen = Math.max(refEnv.length, recEnv.length);
  const lo = Math.max(-envLen + 1, searchMin);
  const hi = Math.min(envLen - 1, searchMax);

  let bestOffsetFrames = 0;
  let bestScore = -Infinity;
  for (let offset = lo; offset <= hi; offset++) {
    const score = normalizedCorrelation(refEnv, recEnv, offset);
    if (score > bestScore) {
      bestScore = score;
      bestOffsetFrames = offset;
    }
  }

  if (bestScore < PROGRAM_ALIGN_MIN_SCORE) {
    const error = new Error(
      `Alignment score ${bestScore.toFixed(3)} < ${PROGRAM_ALIGN_MIN_SCORE} `
      + `(onset ref=${refOnset} rec=${recOnset} est=${estimatedOffset} best=${bestOffsetFrames})`
    );
    error.code = "PROGRAM_ALIGN_FAILED";
    error.detail = { bestScore, estimatedOffset, bestOffsetFrames, refOnset, recOnset };
    throw error;
  }
  return {
    sampleOffset: bestOffsetFrames * ENV_HOP,
    alignmentScore: bestScore,
  };
}

export function trimAlignedStereo(referenceStereo, recordedStereo, sampleOffset) {
  const refStart = Math.max(0, -sampleOffset);
  const recStart = Math.max(0, sampleOffset);
  const length = Math.min(referenceStereo.left.length - refStart, recordedStereo.left.length - recStart);
  return {
    reference: {
      left: referenceStereo.left.slice(refStart, refStart + length),
      right: referenceStereo.right.slice(refStart, refStart + length),
    },
    recorded: {
      left: recordedStereo.left.slice(recStart, recStart + length),
      right: recordedStereo.right.slice(recStart, recStart + length),
    },
  };
}
