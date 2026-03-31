import { PROBE_SYNC_MIN_SCORE } from "../player-profile/constants.js";

function dotAt(signal, pos, kernel) {
  let dot = 0;
  let aPow = 0;
  let bPow = 0;
  for (let i = 0; i < kernel.length; i++) {
    const a = signal[pos + i] || 0;
    const b = kernel[i];
    dot += a * b;
    aPow += a * a;
    bPow += b * b;
  }
  return dot / Math.sqrt((aPow + 1e-12) * (bPow + 1e-12));
}

export function findProbeSync(signal, kernel) {
  const maxPos = Math.max(0, signal.length - kernel.length - 1);
  let bestPos = 0;
  let bestScore = -Infinity;
  const coarseStep = 16;
  for (let pos = 0; pos <= maxPos; pos += coarseStep) {
    const score = dotAt(signal, pos, kernel);
    if (score > bestScore) {
      bestScore = score;
      bestPos = pos;
    }
  }
  const start = Math.max(0, bestPos - coarseStep);
  const end = Math.min(maxPos, bestPos + coarseStep);
  for (let pos = start; pos <= end; pos++) {
    const score = dotAt(signal, pos, kernel);
    if (score > bestScore) {
      bestScore = score;
      bestPos = pos;
    }
  }
  if (bestScore < PROBE_SYNC_MIN_SCORE) {
    const error = new Error("Failed to locate probe sync");
    error.code = "PROBE_SYNC_FAILED";
    throw error;
  }
  return { offsetSamples: bestPos, score: bestScore };
}
