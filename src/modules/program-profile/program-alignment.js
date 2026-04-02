import { PROGRAM_ALIGN_MIN_SCORE } from "../player-profile/constants.js";

const ENV_FRAME = 2048;
const ENV_HOP = 512;
const STRETCH_SEARCH_STEPS = 17;
const STRETCH_MIN_SCALE = 0.85;
const STRETCH_MAX_SCALE = 1.15;

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

function findEnvelopeTail(envelope, threshold = 0.05, lookBehind = 3) {
  let peak = 0;
  for (let i = 0; i < envelope.length; i++) {
    if (envelope[i] > peak) peak = envelope[i];
  }
  if (peak < 1e-8) return Math.max(0, envelope.length - 1);
  const th = peak * threshold;
  for (let i = envelope.length - 1; i >= lookBehind - 1; i--) {
    let count = 0;
    for (let j = 0; j < lookBehind; j++) {
      if (envelope[i - j] > th) count++;
    }
    if (count >= 2) return i;
  }
  return Math.max(0, envelope.length - 1);
}

function resampleByFactor(signal, factor) {
  if (!Number.isFinite(factor) || factor <= 0) throw new Error("Invalid resample factor");
  if (Math.abs(factor - 1) < 1e-6) return signal.slice();
  const outLength = Math.max(1, Math.round(signal.length * factor));
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const pos = i / factor;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const a = signal[Math.max(0, Math.min(signal.length - 1, idx))];
    const b = signal[Math.max(0, Math.min(signal.length - 1, idx + 1))];
    out[i] = a + (b - a) * frac;
  }
  return out;
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

function alignEnvelopePair(refEnv, recEnv) {
  const refOnset = findEnvelopeOnset(refEnv);
  const recOnset = findEnvelopeOnset(recEnv);
  const estimatedOffset = recOnset - refOnset;
  const fineRadius = 250;
  const searchMin = Math.min(-fineRadius, estimatedOffset - fineRadius);
  const searchMax = Math.max(fineRadius, estimatedOffset + fineRadius);
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

  return {
    refOnset,
    recOnset,
    estimatedOffset,
    bestOffsetFrames,
    bestScore,
  };
}

function buildStretchCandidates(refEnv, recEnv) {
  const refOnset = findEnvelopeOnset(refEnv);
  const recOnset = findEnvelopeOnset(recEnv);
  const refTail = findEnvelopeTail(refEnv);
  const recTail = findEnvelopeTail(recEnv);
  const refSpan = Math.max(1, refTail - refOnset);
  const recSpan = Math.max(1, recTail - recOnset);
  const rawSpanScale = refSpan / recSpan;
  const spanScale = Math.max(STRETCH_MIN_SCALE, Math.min(STRETCH_MAX_SCALE, rawSpanScale));
  const radius = Math.min(0.06, Math.max(0.01, Math.abs(spanScale - 1) + 0.01));
  const candidates = new Set([1, spanScale]);
  for (let i = 0; i < STRETCH_SEARCH_STEPS; i++) {
    const t = STRETCH_SEARCH_STEPS === 1 ? 0.5 : (i / (STRETCH_SEARCH_STEPS - 1));
    const scale = spanScale * (1 + (((t * 2) - 1) * radius));
    if (Number.isFinite(scale) && scale > STRETCH_MIN_SCALE && scale < STRETCH_MAX_SCALE) {
      candidates.add(Number(scale.toFixed(6)));
    }
  }
  return [...candidates];
}

export function alignProgramPair(referenceStereo, recordedStereo) {
  const refMono = monoAverage(referenceStereo.left, referenceStereo.right);
  const recMono = monoAverage(recordedStereo.left, recordedStereo.right);
  const refEnv = rmsEnvelope(refMono);
  const recEnv = rmsEnvelope(recMono);

  let bestScale = 1;
  let bestAligned = null;
  for (const scale of buildStretchCandidates(refEnv, recEnv)) {
    const scaledRecEnv = resampleByFactor(recEnv, scale);
    const aligned = alignEnvelopePair(refEnv, scaledRecEnv);
    if (!bestAligned || aligned.bestScore > bestAligned.bestScore) {
      bestScale = scale;
      bestAligned = aligned;
    }
  }

  if (!bestAligned || bestAligned.bestScore < PROGRAM_ALIGN_MIN_SCORE) {
    const error = new Error(
      `Alignment score ${(bestAligned?.bestScore ?? -1).toFixed(3)} < ${PROGRAM_ALIGN_MIN_SCORE} `
      + `(onset ref=${bestAligned?.refOnset ?? 0} rec=${bestAligned?.recOnset ?? 0} `
      + `est=${bestAligned?.estimatedOffset ?? 0} best=${bestAligned?.bestOffsetFrames ?? 0} `
      + `scale=${bestScale.toFixed(6)})`
    );
    error.code = "PROGRAM_ALIGN_FAILED";
    error.detail = {
      bestScore: bestAligned?.bestScore ?? -1,
      estimatedOffset: bestAligned?.estimatedOffset ?? 0,
      bestOffsetFrames: bestAligned?.bestOffsetFrames ?? 0,
      refOnset: bestAligned?.refOnset ?? 0,
      recOnset: bestAligned?.recOnset ?? 0,
      timeScale: bestScale,
    };
    throw error;
  }

  return {
    sampleOffset: bestAligned.bestOffsetFrames * ENV_HOP,
    alignmentScore: bestAligned.bestScore,
    timeScale: bestScale,
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
