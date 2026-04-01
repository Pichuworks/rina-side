import { buildFrequencyGridHz } from "./modules/player-profile/frequency-grid.js";
import { interpolateLogValue, smoothLogCurve } from "./modules/player-profile/response-curve.js";

const TWO_PI = Math.PI * 2;

export const RESPONSE_MEASUREMENT_SPEC = {
  sampleRate: 48000,
  preSilenceSec: 0.5,
  syncSec: 0.25,
  gapSec: 0.08,
  mainSec: 20.0,
  postSilenceSec: 0.5,
  startHz: 20,
  endHz: 18000,
  amplitude: 0.72,
  pointsPerOctave: 24,
  smoothingOctaves: 1 / 12,
  toneHz: 1000,
  toneSec: 1.25,
  fitLevelsDb: [-20, -12, -6, -3],
  validationLevelDb: -9,
};

export const TRANSPORT_MEASUREMENT_SPEC = {
  sampleRate: 48000,
  preSilenceSec: 0.5,
  syncSec: 0.25,
  gapSec: 0.08,
  mainSec: 30.0,
  postSilenceSec: 0.5,
  toneHz: 3150,
  amplitude: 0.72,
};

export const TEST_TAPE_PROGRAM_SPEC = {
  sampleRate: 48000,
  interSegmentSec: 2.0,
  response: RESPONSE_MEASUREMENT_SPEC,
  transport: TRANSPORT_MEASUREMENT_SPEC,
};

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return (state / 0xFFFFFFFF) * 2 - 1;
  };
}

function createWindowedNoise(length, seed) {
  const rng = createRng(seed);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const env = Math.sin((Math.PI * i) / Math.max(1, length - 1)) ** 2;
    out[i] = rng() * env;
  }
  return out;
}

function applyEdgeFade(data, sampleRate, fadeSec = 0.02) {
  const fadeLen = Math.min(Math.floor(sampleRate * fadeSec), Math.floor(data.length / 2));
  for (let i = 0; i < fadeLen; i++) {
    const fade = 0.5 - 0.5 * Math.cos((Math.PI * i) / Math.max(1, fadeLen - 1));
    data[i] *= fade;
    data[data.length - 1 - i] *= fade;
  }
}

function buildSyncProbe(sync) {
  const probeLength = Math.min(4096, Math.max(1024, Math.floor(sync.length / 2)));
  const probeOffset = Math.floor((sync.length - probeLength) / 2);
  return {
    kernel: sync.slice(probeOffset, probeOffset + probeLength),
    offset: probeOffset,
  };
}

function buildStereoBufferLike(sampleRate, mono) {
  const left = mono.slice();
  const right = mono.slice();
  return {
    numberOfChannels: 2,
    sampleRate,
    length: mono.length,
    getChannelData(channel) {
      return channel === 0 ? left : right;
    },
  };
}

function scaleAmplitude(baseAmplitude, levelDb) {
  return baseAmplitude * Math.pow(10, levelDb / 20);
}

function buildLeveledSpec(spec, levelDb) {
  return {
    ...spec,
    amplitude: scaleAmplitude(spec.amplitude, levelDb),
    inputDb: levelDb,
  };
}

export function generateResponseMeasurement(spec = RESPONSE_MEASUREMENT_SPEC) {
  const sr = spec.sampleRate;
  const pre = Math.round(spec.preSilenceSec * sr);
  const sync = Math.round(spec.syncSec * sr);
  const gap = Math.round(spec.gapSec * sr);
  const main = Math.round(spec.mainSec * sr);
  const post = Math.round(spec.postSilenceSec * sr);
  const startSync = createWindowedNoise(sync, 0x51a2c3d4);
  const endSync = createWindowedNoise(sync, 0x19cf02ab);
  const sweep = new Float32Array(main);
  const L = spec.mainSec / Math.log(spec.endHz / spec.startHz);
  for (let i = 0; i < main; i++) {
    const t = i / sr;
    const phase = TWO_PI * spec.startHz * L * (Math.exp(t / L) - 1);
    sweep[i] = Math.sin(phase) * spec.amplitude;
  }
  applyEdgeFade(sweep, sr);
  const total = pre + sync + gap + main + gap + sync + post;
  const mono = new Float32Array(total);
  mono.set(startSync, pre);
  mono.set(sweep, pre + sync + gap);
  mono.set(endSync, pre + sync + gap + main + gap);
  return {
    kind: "response",
    spec,
    mono,
    bufferLike: buildStereoBufferLike(sr, mono),
    syncStart: startSync,
    syncEnd: endSync,
    mainStart: pre + sync + gap,
    mainLength: main,
    expectedTotal: total,
    referenceMain: sweep,
  };
}

function generateToneMeasurement(spec) {
  const sr = spec.sampleRate;
  const pre = Math.round(spec.preSilenceSec * sr);
  const sync = Math.round(spec.syncSec * sr);
  const gap = Math.round(spec.gapSec * sr);
  const main = Math.round(spec.toneSec * sr);
  const post = Math.round(spec.postSilenceSec * sr);
  const startSync = createWindowedNoise(sync, (0x1256abcd + Math.round((spec.inputDb || 0) * 17)) >>> 0);
  const endSync = createWindowedNoise(sync, (0x8f30a731 + Math.round((spec.inputDb || 0) * 29)) >>> 0);
  const tone = new Float32Array(main);
  for (let i = 0; i < main; i++) {
    tone[i] = Math.sin((TWO_PI * spec.toneHz * i) / sr) * spec.amplitude;
  }
  applyEdgeFade(tone, sr);
  const total = pre + sync + gap + main + gap + sync + post;
  const mono = new Float32Array(total);
  mono.set(startSync, pre);
  mono.set(tone, pre + sync + gap);
  mono.set(endSync, pre + sync + gap + main + gap);
  return {
    kind: "tone",
    spec,
    mono,
    bufferLike: buildStereoBufferLike(sr, mono),
    syncStart: startSync,
    syncEnd: endSync,
    mainStart: pre + sync + gap,
    mainLength: main,
    expectedTotal: total,
    referenceMain: tone,
  };
}

export function generateTransportMeasurement(spec = TRANSPORT_MEASUREMENT_SPEC) {
  const sr = spec.sampleRate;
  const pre = Math.round(spec.preSilenceSec * sr);
  const sync = Math.round(spec.syncSec * sr);
  const gap = Math.round(spec.gapSec * sr);
  const main = Math.round(spec.mainSec * sr);
  const post = Math.round(spec.postSilenceSec * sr);
  const startSync = createWindowedNoise(sync, 0x1256abcd);
  const endSync = createWindowedNoise(sync, 0x8f30a731);
  const tone = new Float32Array(main);
  for (let i = 0; i < main; i++) {
    tone[i] = Math.sin((TWO_PI * spec.toneHz * i) / sr) * spec.amplitude;
  }
  applyEdgeFade(tone, sr);
  const total = pre + sync + gap + main + gap + sync + post;
  const mono = new Float32Array(total);
  mono.set(startSync, pre);
  mono.set(tone, pre + sync + gap);
  mono.set(endSync, pre + sync + gap + main + gap);
  return {
    kind: "transport",
    spec,
    mono,
    bufferLike: buildStereoBufferLike(sr, mono),
    syncStart: startSync,
    syncEnd: endSync,
    mainStart: pre + sync + gap,
    mainLength: main,
    expectedTotal: total,
    referenceMain: tone,
  };
}

export function monoFromAudioBuffer(audioBuffer) {
  const channels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const mono = new Float32Array(length);
  for (let c = 0; c < channels; c++) {
    const src = audioBuffer.getChannelData(c);
    for (let i = 0; i < length; i++) mono[i] += src[i] / channels;
  }
  return mono;
}

function stereoFromAudioBuffer(audioBuffer) {
  const channels = Math.max(1, audioBuffer.numberOfChannels || 1);
  const left = audioBuffer.getChannelData(0).slice();
  const right = audioBuffer.getChannelData(Math.min(1, channels - 1)).slice();
  return {
    left,
    right,
    sampleRate: audioBuffer.sampleRate,
  };
}

function averageStereo(left, right) {
  const length = Math.min(left.length, right.length);
  const mono = new Float32Array(length);
  for (let i = 0; i < length; i++) mono[i] = (left[i] + right[i]) * 0.5;
  return mono;
}

export function resampleLinear(input, fromRate, toRate) {
  if (fromRate === toRate) return input.slice();
  const ratio = toRate / fromRate;
  const outLength = Math.max(1, Math.round(input.length * ratio));
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const pos = i / ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const a = input[Math.max(0, Math.min(input.length - 1, idx))];
    const b = input[Math.max(0, Math.min(input.length - 1, idx + 1))];
    out[i] = a + (b - a) * frac;
  }
  return out;
}

function meanAbs(data, start, length) {
  const end = Math.min(data.length, start + length);
  let sum = 0;
  for (let i = start; i < end; i++) sum += Math.abs(data[i]);
  return sum / Math.max(1, end - start);
}

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

function findSync(signal, kernel, searchStart, searchEnd) {
  const maxPos = Math.max(searchStart, Math.min(searchEnd, signal.length - kernel.length - 1));
  let bestPos = searchStart;
  let bestScore = -Infinity;
  for (let pos = searchStart; pos <= maxPos; pos++) {
    const score = dotAt(signal, pos, kernel);
    if (score > bestScore) {
      bestScore = score;
      bestPos = pos;
    }
  }
  return { pos: bestPos, score: bestScore };
}

function detectSyncPair(signal, measurement, options = {}) {
  const sr = measurement.spec.sampleRate;
  const searchStart = Math.max(0, Math.floor(options.searchStart || 0));
  const searchEnd = Math.min(signal.length, Math.floor(options.searchEnd || signal.length));
  const startProbe = buildSyncProbe(measurement.syncStart);
  const endProbe = buildSyncProbe(measurement.syncEnd);
  const gapSamples = Math.round((measurement.spec.gapSec || 0) * sr);
  const baseline = meanAbs(signal, 0, Math.max(512, Math.round(sr * 0.15)));
  const threshold = Math.max(0.015, baseline * 6);
  let roughStart = -1;
  for (let i = searchStart; i < searchEnd; i++) {
    if (Math.abs(signal[i]) >= threshold) {
      roughStart = i;
      break;
    }
  }
  if (roughStart < 0) throw new Error("Failed to locate measurement start");
  const startBacktrack = measurement.syncStart.length * 2 + gapSamples + Math.round(sr * 0.12);
  const startLead = measurement.syncStart.length * 1.5;
  const startSearchA = Math.max(searchStart, Math.round(roughStart - startBacktrack));
  const startSearchB = Math.min(searchEnd - startProbe.kernel.length - 1, Math.round(roughStart + startLead));
  const startMatch = findSync(signal, startProbe.kernel, startSearchA, startSearchB);
  const start = { pos: startMatch.pos - startProbe.offset, score: startMatch.score };
  const expectedEndPos = start.pos + measurement.syncStart.length + gapSamples + measurement.mainLength + gapSamples;
  const endSearchA = Math.max(start.pos + measurement.mainLength / 2, expectedEndPos - measurement.syncEnd.length * 2);
  const endSearchB = Math.min(searchEnd - endProbe.kernel.length - 1, expectedEndPos + measurement.syncEnd.length * 2);
  const endMatch = findSync(signal, endProbe.kernel, endSearchA, endSearchB);
  const end = { pos: endMatch.pos - endProbe.offset, score: endMatch.score };
  if (start.score < 0.03 || end.score < 0.03) {
    throw new Error("Failed to confidently locate measurement sync");
  }
  return { start, end };
}

function detectMainBounds(signal, measurement, options = {}) {
  const sr = measurement.spec.sampleRate;
  const { start, end } = detectSyncPair(signal, measurement, options);
  const gapSamples = Math.round(measurement.spec.gapSec * sr);
  const detectedMainStart = start.pos + measurement.syncStart.length + gapSamples;
  const detectedMainEnd = end.pos - gapSamples;
  if (detectedMainEnd <= detectedMainStart) throw new Error("Invalid measurement bounds");
  if (measurement.kind === "response") {
    const detectedLength = detectedMainEnd - detectedMainStart;
    const probeLength = Math.max(2048, Math.min(Math.round(sr * 0.25), detectedLength));
    const mainProbeStart = detectedMainStart + Math.max(0, Math.floor((detectedLength - probeLength) / 2));
    const mainLevel = meanAbs(signal, mainProbeStart, probeLength);
    const gapBeforeLevel = meanAbs(signal, start.pos + measurement.syncStart.length, gapSamples);
    const gapAfterLevel = meanAbs(signal, detectedMainEnd, gapSamples);
    const gapLevel = Math.max(gapBeforeLevel, gapAfterLevel, 1e-6);
    const requiredRatio = options.relaxedValidation ? 0 : 1.5;
    if (requiredRatio > 0 && mainLevel < gapLevel * requiredRatio) {
      throw new Error("Measurement main segment failed energy validation");
    }
  }
  return { startSample: detectedMainStart, endSample: detectedMainEnd };
}

function normalizeMainSlice(signal, measurement, startSample, endSample) {
  const sr = measurement.spec.sampleRate;
  const detectedLength = Math.max(1, endSample - startSample);
  const main = signal.slice(startSample, endSample);
  const normalized = resampleLinear(main, sr, sr * (measurement.mainLength / detectedLength));
  const fixed = new Float32Array(measurement.mainLength);
  fixed.set(normalized.subarray(0, Math.min(measurement.mainLength, normalized.length)));
  return fixed;
}

function sliceAndNormalizeMain(signal, measurement, options = {}) {
  const bounds = detectMainBounds(signal, measurement, options);
  return {
    main: normalizeMainSlice(signal, measurement, bounds.startSample, bounds.endSample),
    startSample: bounds.startSample,
    endSample: bounds.endSample,
  };
}

export function generateTestTapeProgram(spec = TEST_TAPE_PROGRAM_SPEC) {
  const sr = spec.sampleRate;
  const inter = Math.round(spec.interSegmentSec * sr);
  const fitLevels = [...(spec.response.fitLevelsDb || RESPONSE_MEASUREMENT_SPEC.fitLevelsDb || [])];
  const validationLevelDb = Number(
    spec.response.validationLevelDb ?? RESPONSE_MEASUREMENT_SPEC.validationLevelDb ?? -9,
  );
  const responseSegments = [];
  const orderedLevels = [
    ...fitLevels.map((inputDb) => ({ inputDb, role: "fit" })),
    { inputDb: validationLevelDb, role: "validate" },
  ];
  for (const { inputDb, role } of orderedLevels) {
    const leveled = buildLeveledSpec(spec.response, inputDb);
    const tone = generateToneMeasurement(leveled);
    const sweep = generateResponseMeasurement(leveled);
    responseSegments.push({
      id: `tone_${inputDb}`,
      analysisKind: "tone",
      role,
      inputDb,
      measurement: tone,
    });
    responseSegments.push({
      id: `sweep_${inputDb}`,
      analysisKind: "response",
      role,
      inputDb,
      measurement: sweep,
    });
  }
  const transport = generateTransportMeasurement(spec.transport);
  const pieces = [];
  for (const descriptor of responseSegments) pieces.push(descriptor.measurement.mono);
  pieces.push(transport.mono);
  const total = pieces.reduce((sum, piece, index) => sum + piece.length + (index > 0 ? inter : 0), 0);
  const mono = new Float32Array(total);
  let cursor = 0;
  const segmentMeta = [];
  for (let i = 0; i < responseSegments.length; i++) {
    const descriptor = responseSegments[i];
    if (i > 0) cursor += inter;
    mono.set(descriptor.measurement.mono, cursor);
    segmentMeta.push({
      ...descriptor,
      start: cursor,
      length: descriptor.measurement.mono.length,
    });
    cursor += descriptor.measurement.mono.length;
  }
  cursor += inter;
  mono.set(transport.mono, cursor);
  const transportSegment = {
    analysisKind: "transport",
    start: cursor,
    length: transport.mono.length,
    measurement: transport,
  };
  return {
    kind: "test-tape-program",
    spec,
    sampleRate: sr,
    mono,
    bufferLike: buildStereoBufferLike(sr, mono),
    transport,
    responseSegments: segmentMeta,
    transportSegment,
    fitLevelsDb: fitLevels,
    validationLevelDb,
  };
}

function goertzelMagnitude(data, center, length, freqHz, sampleRate) {
  const half = Math.floor(length / 2);
  const start = Math.max(0, center - half);
  const end = Math.min(data.length, start + length);
  const coeff = 2 * Math.cos((TWO_PI * freqHz) / sampleRate);
  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  for (let i = start; i < end; i++) {
    const local = i - start;
    const w = 0.5 - 0.5 * Math.cos((TWO_PI * local) / Math.max(1, end - start - 1));
    s0 = data[i] * w + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  const power = s1 * s1 + s2 * s2 - coeff * s1 * s2;
  return Math.sqrt(Math.max(power, 1e-18));
}

function goertzelComplex(data, center, length, freqHz, sampleRate) {
  const half = Math.floor(length / 2);
  const start = Math.max(0, center - half);
  const end = Math.min(data.length, start + length);
  let real = 0;
  let imag = 0;
  for (let i = start; i < end; i++) {
    const local = i - start;
    const w = 0.5 - 0.5 * Math.cos((TWO_PI * local) / Math.max(1, end - start - 1));
    const phase = (TWO_PI * freqHz * local) / sampleRate;
    const sample = data[i] * w;
    real += sample * Math.cos(phase);
    imag -= sample * Math.sin(phase);
  }
  return { real, imag };
}

function divideComplex(a, b) {
  const denom = (b.real * b.real) + (b.imag * b.imag) + 1e-18;
  return {
    real: ((a.real * b.real) + (a.imag * b.imag)) / denom,
    imag: ((a.imag * b.real) - (a.real * b.imag)) / denom,
  };
}

function unwrapPhase(phases) {
  if (!phases.length) return [];
  const out = new Array(phases.length);
  out[0] = phases[0];
  for (let i = 1; i < phases.length; i++) {
    let value = phases[i];
    let delta = value - out[i - 1];
    while (delta > Math.PI) {
      value -= TWO_PI;
      delta -= TWO_PI;
    }
    while (delta < -Math.PI) {
      value += TWO_PI;
      delta += TWO_PI;
    }
    out[i] = value;
  }
  return out;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) * 0.5;
}

function summarizeGroupDelayResidual(frequenciesHz, residualMs, minHz = 100, maxHz = 16000) {
  if (!frequenciesHz?.length || !residualMs?.length) return null;
  const indices = [];
  for (let i = 0; i < frequenciesHz.length; i++) {
    if (frequenciesHz[i] >= minHz && frequenciesHz[i] <= maxHz && Number.isFinite(residualMs[i])) indices.push(i);
  }
  if (!indices.length) return null;
  let sumSq = 0;
  let maxAbs = 0;
  let maxFreq = frequenciesHz[indices[0]];
  for (const index of indices) {
    const value = residualMs[index];
    sumSq += value * value;
    const abs = Math.abs(value);
    if (abs > maxAbs) {
      maxAbs = abs;
      maxFreq = frequenciesHz[index];
    }
  }
  return {
    rmsMs: Math.sqrt(sumSq / Math.max(1, indices.length)),
    maxAbsMs: maxAbs,
    maxAbsFreqHz: maxFreq,
  };
}

function fitPhaseLine(frequenciesHz, phaseRad, minHz = 100, maxHz = 8000) {
  const points = [];
  for (let i = 0; i < frequenciesHz.length; i++) {
    const freq = frequenciesHz[i];
    const phase = phaseRad[i];
    if (freq >= minHz && freq <= maxHz && Number.isFinite(phase)) {
      points.push({ omega: TWO_PI * freq, phase });
    }
  }
  if (!points.length) return { slope: 0, intercept: 0 };
  let sumOmega = 0;
  let sumPhase = 0;
  let sumOmegaPhase = 0;
  let sumOmegaSq = 0;
  for (const point of points) {
    sumOmega += point.omega;
    sumPhase += point.phase;
    sumOmegaPhase += point.omega * point.phase;
    sumOmegaSq += point.omega * point.omega;
  }
  const n = points.length;
  const denom = (n * sumOmegaSq) - (sumOmega * sumOmega);
  const slope = Math.abs(denom) > 1e-18
    ? ((n * sumOmegaPhase) - (sumOmega * sumPhase)) / denom
    : 0;
  const intercept = (sumPhase - (slope * sumOmega)) / Math.max(1, n);
  return { slope, intercept };
}

function fftComplexInPlace(real, imag, inverse = false) {
  const n = real.length;
  let j = 0;
  for (let i = 0; i < n; i++) {
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
    let bit = n >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (inverse ? TWO_PI : -TWO_PI) / len;
    const wLenCos = Math.cos(angle);
    const wLenSin = Math.sin(angle);
    for (let start = 0; start < n; start += len) {
      let wCos = 1;
      let wSin = 0;
      for (let i = 0; i < len / 2; i++) {
        const uIndex = start + i;
        const vIndex = uIndex + (len / 2);
        const vReal = (real[vIndex] * wCos) - (imag[vIndex] * wSin);
        const vImag = (real[vIndex] * wSin) + (imag[vIndex] * wCos);
        real[vIndex] = real[uIndex] - vReal;
        imag[vIndex] = imag[uIndex] - vImag;
        real[uIndex] += vReal;
        imag[uIndex] += vImag;
        const nextCos = (wCos * wLenCos) - (wSin * wLenSin);
        const nextSin = (wCos * wLenSin) + (wSin * wLenCos);
        wCos = nextCos;
        wSin = nextSin;
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n; i++) {
      real[i] /= n;
      imag[i] /= n;
    }
  }
}

function estimateTransientSpreadMs(frequenciesHz, measuredDb, phaseRad, sampleRate) {
  if (!frequenciesHz?.length || !measuredDb?.length || !phaseRad?.length) return null;
  const fftSize = 4096;
  const real = new Float64Array(fftSize);
  const imag = new Float64Array(fftSize);
  for (let bin = 0; bin <= fftSize / 2; bin++) {
    const freq = (bin * sampleRate) / fftSize;
    const ampDb = interpolateLogValue(frequenciesHz, measuredDb, Math.max(freq, frequenciesHz[0]));
    const amp = Math.pow(10, ampDb / 20);
    const phase = interpolateLogValue(frequenciesHz, phaseRad, Math.max(freq, frequenciesHz[0]));
    const r = amp * Math.cos(phase);
    const im = amp * Math.sin(phase);
    real[bin] = r;
    imag[bin] = im;
    if (bin > 0 && bin < fftSize / 2) {
      real[fftSize - bin] = r;
      imag[fftSize - bin] = -im;
    }
  }
  fftComplexInPlace(real, imag, true);
  let totalEnergy = 0;
  let peakIndex = 0;
  let peakEnergy = 0;
  const energy = new Float64Array(fftSize);
  for (let i = 0; i < fftSize; i++) {
    const value = real[i];
    const e = value * value;
    energy[i] = e;
    totalEnergy += e;
    if (e > peakEnergy) {
      peakEnergy = e;
      peakIndex = i;
    }
  }
  if (totalEnergy <= 1e-18) return null;
  const centerIndex = Math.floor(fftSize / 2);
  const shiftedEnergy = new Float64Array(fftSize);
  for (let i = 0; i < fftSize; i++) {
    const srcIndex = (i + peakIndex - centerIndex + fftSize) % fftSize;
    shiftedEnergy[i] = energy[srcIndex];
  }
  peakIndex = centerIndex;
  let coveredEnergy = shiftedEnergy[peakIndex];
  let left = peakIndex;
  let right = peakIndex;
  while (coveredEnergy / totalEnergy < 0.9 && (left > 0 || right < fftSize - 1)) {
    const nextLeft = left > 0 ? shiftedEnergy[left - 1] : -1;
    const nextRight = right < fftSize - 1 ? shiftedEnergy[right + 1] : -1;
    if (nextLeft >= nextRight && left > 0) {
      left -= 1;
      coveredEnergy += shiftedEnergy[left];
    } else if (right < fftSize - 1) {
      right += 1;
      coveredEnergy += shiftedEnergy[right];
    } else {
      break;
    }
  }
  return ((right - left + 1) / sampleRate) * 1000;
}

function buildResponseFrequencies(measurement) {
  return buildFrequencyGridHz(
    measurement.spec.startHz,
    measurement.spec.endHz,
    measurement.spec.pointsPerOctave || 24,
  );
}

function analyseResponseChannel(main, measurement, frequenciesHz) {
  const sr = measurement.spec.sampleRate;
  const measuredDb = [];
  const phaseRad = [];
  for (const freq of frequenciesHz) {
    const t = Math.log(freq / measurement.spec.startHz) / Math.log(measurement.spec.endHz / measurement.spec.startHz);
    const center = Math.round(t * (measurement.mainLength - 1));
    const windowLength = Math.max(8, Math.round((sr / Math.max(freq, 1)) * 10));
    const ref = goertzelComplex(measurement.referenceMain, center, windowLength, freq, sr);
    const rec = goertzelComplex(main, center, windowLength, freq, sr);
    const ratio = divideComplex(rec, ref);
    const refMag = Math.hypot(ref.real, ref.imag);
    const recMag = Math.hypot(rec.real, rec.imag);
    const response = 20 * Math.log10((recMag + 1e-12) / (refMag + 1e-12));
    measuredDb.push(response);
    phaseRad.push(Math.atan2(ratio.imag, ratio.real));
  }
  const smoothedMeasured = smoothLogCurve(
    frequenciesHz,
    measuredDb,
    measurement.spec.smoothingOctaves || (1 / 12),
  );
  const unwrappedPhaseRad = unwrapPhase(phaseRad);
  const smoothedPhaseRad = smoothLogCurve(
    frequenciesHz,
    unwrappedPhaseRad,
    Math.max(1 / 6, measurement.spec.smoothingOctaves || (1 / 12)),
  );
  const anchorHz = Number(measurement.spec.anchorHz || measurement.spec.toneHz || 1000);
  const anchorDb = interpolateLogValue(frequenciesHz, smoothedMeasured, anchorHz);
  const anchoredMeasured = smoothedMeasured.map((value) => value - anchorDb);
  const anchoredCorrection = anchoredMeasured.map((value) => -value);
  const phaseLine = fitPhaseLine(frequenciesHz, smoothedPhaseRad, 100, 8000);
  const debiasedPhaseRad = smoothedPhaseRad.map((phase, index) => (
    phase - ((phaseLine.slope * TWO_PI * frequenciesHz[index]) + phaseLine.intercept)
  ));
  const rawGroupDelaySec = new Array(frequenciesHz.length).fill(0);
  for (let i = 0; i < frequenciesHz.length; i++) {
    const prev = Math.max(0, i - 1);
    const next = Math.min(frequenciesHz.length - 1, i + 1);
    const omegaA = TWO_PI * frequenciesHz[prev];
    const omegaB = TWO_PI * frequenciesHz[next];
    const phaseA = debiasedPhaseRad[prev];
    const phaseB = debiasedPhaseRad[next];
    const deltaOmega = Math.max(1e-9, omegaB - omegaA);
    rawGroupDelaySec[i] = -((phaseB - phaseA) / deltaOmega);
  }
  const residualGroupDelayMs = rawGroupDelaySec.map((value) => value * 1000);
  const groupDelaySummary = summarizeGroupDelayResidual(frequenciesHz, residualGroupDelayMs, 500, 8000);
  const transientSpreadMs = estimateTransientSpreadMs(
    frequenciesHz,
    anchoredMeasured,
    debiasedPhaseRad,
    sr,
  );
  return {
    measuredDb: anchoredMeasured,
    correctionDb: anchoredCorrection,
    anchorHz,
    anchorDb,
    phaseRad: debiasedPhaseRad,
    residualGroupDelayMs,
    clarity: {
      groupDelayResidualRmsMs: groupDelaySummary ? Number(groupDelaySummary.rmsMs.toFixed(3)) : null,
      groupDelayResidualMaxMs: groupDelaySummary ? Number(groupDelaySummary.maxAbsMs.toFixed(3)) : null,
      groupDelayResidualMaxFreqHz: groupDelaySummary ? Number(groupDelaySummary.maxAbsFreqHz.toFixed(0)) : null,
      transientSpreadMs: Number.isFinite(transientSpreadMs) ? Number(transientSpreadMs.toFixed(3)) : null,
    },
  };
}

function analyseToneChannel(main, measurement) {
  const sr = measurement.spec.sampleRate;
  const center = Math.round((measurement.mainLength - 1) * 0.5);
  const windowLength = Math.max(256, Math.min(measurement.mainLength, Math.round(sr * 0.4)));
  const half = Math.floor(windowLength / 2);
  const start = Math.max(0, center - half);
  const end = Math.min(main.length, start + windowLength);
  const estimatedFreqHz = estimateFrequencyFromZeroCrossings(main.subarray(start, end), sr) || measurement.spec.toneHz;
  const refMag = goertzelMagnitude(measurement.referenceMain, center, windowLength, measurement.spec.toneHz, sr);
  const recMag = goertzelMagnitude(main, center, windowLength, estimatedFreqHz, sr);
  let harmonicPower = 0;
  const harmonics = [];
  for (let harmonic = 2; harmonic <= 5; harmonic++) {
    const freq = estimatedFreqHz * harmonic;
    if (freq >= (sr * 0.5)) break;
    const mag = goertzelMagnitude(main, center, windowLength, freq, sr);
    harmonicPower += mag * mag;
    harmonics.push({
      harmonic,
      freqHz: freq,
      magnitude: mag,
    });
  }
  const thdRatio = recMag > 1e-12 ? Math.sqrt(harmonicPower) / recMag : 0;
  return {
    measuredDb: 20 * Math.log10((recMag + 1e-12) / (refMag + 1e-12)),
    estimatedFreqHz,
    thdPercent: thdRatio * 100,
    thdDb: 20 * Math.log10(Math.max(thdRatio, 1e-12)),
    harmonics,
  };
}

function analyseResponseStereo(stereo, measurement, detectOptions = {}) {
  const syncMono = averageStereo(stereo.left, stereo.right);
  const { startSample, endSample } = detectMainBounds(syncMono, measurement, detectOptions);
  const frequenciesHz = buildResponseFrequencies(measurement);
  const leftMain = normalizeMainSlice(stereo.left, measurement, startSample, endSample);
  const rightMain = normalizeMainSlice(stereo.right, measurement, startSample, endSample);
  const left = analyseResponseChannel(leftMain, measurement, frequenciesHz);
  const right = analyseResponseChannel(rightMain, measurement, frequenciesHz);
  return {
    kind: "response",
    sampleRate: measurement.spec.sampleRate,
    measuredAt: new Date().toISOString(),
    startSample,
    endSample,
    frequenciesHz,
    channels: {
      L: left,
      R: right,
    },
    profile: {
      version: 1,
      type: "side.deck-calibration",
      createdAt: new Date().toISOString(),
      sampleRate: measurement.spec.sampleRate,
      stimulus: {
        kind: "log-sweep",
        startHz: measurement.spec.startHz,
        endHz: measurement.spec.endHz,
        durationSec: measurement.spec.mainSec,
        anchorHz: Number(measurement.spec.anchorHz || measurement.spec.toneHz || 1000),
      },
      channels: {
        L: { frequenciesHz, correctionDb: left.correctionDb, phaseRad: left.phaseRad },
        R: { frequenciesHz, correctionDb: right.correctionDb, phaseRad: right.phaseRad },
      },
    },
  };
}

function analyseToneStereo(stereo, measurement, detectOptions = {}) {
  const syncMono = averageStereo(stereo.left, stereo.right);
  const { startSample, endSample } = detectMainBounds(syncMono, measurement, detectOptions);
  const leftMain = normalizeMainSlice(stereo.left, measurement, startSample, endSample);
  const rightMain = normalizeMainSlice(stereo.right, measurement, startSample, endSample);
  return {
    kind: "tone",
    sampleRate: measurement.spec.sampleRate,
    measuredAt: new Date().toISOString(),
    inputDb: Number(measurement.spec.inputDb || 0),
    role: measurement.spec.role || "fit",
    startSample,
    endSample,
    toneHz: measurement.spec.toneHz,
    channels: {
      L: analyseToneChannel(leftMain, measurement),
      R: analyseToneChannel(rightMain, measurement),
    },
  };
}

function buildSegmentSearchWindow(segment, sampleRate, totalLength) {
  const margin = Math.round(sampleRate * 1.2);
  return {
    searchStart: Math.max(0, segment.start - margin),
    searchEnd: Math.min(totalLength, segment.start + segment.length + margin),
  };
}

function buildAnchoredSegmentSearchWindow(segment, sampleRate, totalLength, anchorOffsetSamples = 0) {
  const margin = Math.round(sampleRate * 2.0);
  const anchoredStart = Math.max(0, Math.round(segment.start + anchorOffsetSamples));
  return {
    searchStart: Math.max(0, anchoredStart - margin),
    searchEnd: Math.min(totalLength, anchoredStart + segment.length + margin),
  };
}

function detectProgramAnchorOffset(mono, firstSegment, sampleRate) {
  if (!firstSegment?.measurement) return 0;
  const { start } = detectSyncPair(mono, firstSegment.measurement, {
    searchStart: 0,
    searchEnd: mono.length,
  });
  const expectedSyncOffset = Math.round((firstSegment.measurement.spec?.preSilenceSec || 0) * sampleRate);
  return start.pos - (firstSegment.start + expectedSyncOffset);
}

function interpolateLevelCurve(curves, targetDb) {
  if (!curves?.length) return null;
  if (targetDb <= curves[0].inputDb) return curves[0];
  if (targetDb >= curves[curves.length - 1].inputDb) return curves[curves.length - 1];
  for (let i = 0; i < curves.length - 1; i++) {
    const left = curves[i];
    const right = curves[i + 1];
    if (targetDb >= left.inputDb && targetDb <= right.inputDb) {
      const span = Math.max(1e-9, right.inputDb - left.inputDb);
      const t = (targetDb - left.inputDb) / span;
      return {
        inputDb: targetDb,
        role: "interpolated",
        frequenciesHz: left.frequenciesHz,
        measuredDb: left.measuredDb?.map((value, index) => value + (((right.measuredDb || [])[index] ?? value) - value) * t) || [],
        correctionDb: left.correctionDb.map((value, index) => value + ((right.correctionDb[index] || value) - value) * t),
        phaseRad: left.phaseRad?.map((value, index) => value + (((right.phaseRad || [])[index] ?? value) - value) * t) || [],
        residualGroupDelayMs: left.residualGroupDelayMs?.map((value, index) => value + (((right.residualGroupDelayMs || [])[index] ?? value) - value) * t) || [],
      };
    }
  }
  return curves[curves.length - 1];
}

function curveFitError(actual, predicted) {
  if (!actual?.correctionDb?.length || !predicted?.correctionDb?.length) return null;
  let sumSq = 0;
  let maxAbs = 0;
  let maxFreq = actual.frequenciesHz?.[0] || 0;
  const count = Math.min(actual.correctionDb.length, predicted.correctionDb.length);
  for (let i = 0; i < count; i++) {
    const delta = actual.correctionDb[i] - predicted.correctionDb[i];
    sumSq += delta * delta;
    const abs = Math.abs(delta);
    if (abs > maxAbs) {
      maxAbs = abs;
      maxFreq = actual.frequenciesHz?.[i] || maxFreq;
    }
  }
  return {
    rmsDb: Math.sqrt(sumSq / Math.max(1, count)),
    maxAbsDb: maxAbs,
    maxAbsFreqHz: maxFreq,
  };
}

function pickRepresentativeCurve(curves, validationCurve, fallbackLevelDb) {
  if (validationCurve) return validationCurve;
  if (!curves.length) return null;
  const target = Number.isFinite(fallbackLevelDb) ? fallbackLevelDb : curves[Math.floor(curves.length / 2)].inputDb;
  let best = curves[0];
  let bestDist = Math.abs(curves[0].inputDb - target);
  for (let i = 1; i < curves.length; i++) {
    const dist = Math.abs(curves[i].inputDb - target);
    if (dist < bestDist) {
      best = curves[i];
      bestDist = dist;
    }
  }
  return best;
}

export function analyseResponseMeasurement(audioBuffer, measurement = generateResponseMeasurement()) {
  const sr = measurement.spec.sampleRate;
  const stereo = stereoFromAudioBuffer(audioBuffer);
  return analyseResponseStereo({
    left: resampleLinear(stereo.left, stereo.sampleRate, sr),
    right: resampleLinear(stereo.right, stereo.sampleRate, sr),
  }, measurement);
}

function estimateFrequencyFromZeroCrossings(data, sampleRate) {
  const crossings = [];
  for (let i = 1; i < data.length; i++) {
    const a = data[i - 1];
    const b = data[i];
    if (a <= 0 && b > 0) {
      const frac = Math.abs(a) / Math.max(1e-9, Math.abs(a) + Math.abs(b));
      crossings.push(i - 1 + frac);
    }
  }
  if (crossings.length < 2) return null;
  const duration = (crossings[crossings.length - 1] - crossings[0]) / sampleRate;
  return duration > 0 ? (crossings.length - 1) / duration : null;
}

function stabilizeTransportEstimates(estimates, nominalHz) {
  if (estimates.length < 5) return estimates;
  const radius = 3;
  return estimates.map((value, index) => {
    const start = Math.max(0, index - radius);
    const end = Math.min(estimates.length, index + radius + 1);
    const neighborhood = estimates.slice(start, end);
    const center = median(neighborhood);
    const absDev = neighborhood.map((sample) => Math.abs(sample - center));
    const mad = median(absDev);
    const sigma = mad * 1.4826;
    const thresholdHz = Math.max(3, nominalHz * 0.01, sigma * 6);
    return Math.abs(value - center) > thresholdHz ? center : value;
  });
}

function analyseTransportMono(mono, measurement, detectOptions = {}) {
  const sr = measurement.spec.sampleRate;
  const { startSample, endSample } = detectMainBounds(mono, measurement, detectOptions);
  const trimSamples = Math.min(
    Math.round(sr * 0.25),
    Math.max(0, Math.floor((endSample - startSample - 1) / 4)),
  );
  const main = mono.slice(startSample + trimSamples, endSample - trimSamples);
  const windowLength = Math.round(sr * 0.25);
  const hop = Math.round(sr * 0.05);
  const estimates = [];
  for (let start = 0; start + windowLength <= main.length; start += hop) {
    const segment = main.subarray(start, start + windowLength);
    const freq = estimateFrequencyFromZeroCrossings(segment, sr);
    if (freq && Number.isFinite(freq)) estimates.push(freq);
  }
  if (!estimates.length) throw new Error("Failed to estimate transport frequency");
  const stabilized = stabilizeTransportEstimates(estimates, measurement.spec.toneHz);
  const mean = stabilized.reduce((sum, value) => sum + value, 0) / stabilized.length;
  const variance = stabilized.reduce((sum, value) => sum + (value - mean) ** 2, 0) / stabilized.length;
  const std = Math.sqrt(variance);
  const min = Math.min(...stabilized);
  const max = Math.max(...stabilized);
  return {
    kind: "transport",
    measuredAt: new Date().toISOString(),
    startSample,
    endSample,
    nominalHz: measurement.spec.toneHz,
    meanHz: mean,
    speedErrorPercent: ((mean - measurement.spec.toneHz) / measurement.spec.toneHz) * 100,
    wowFlutterPercentRms: (std / measurement.spec.toneHz) * 100,
    wowFlutterPercentPkPk: ((max - min) / measurement.spec.toneHz) * 100,
    seriesHz: stabilized,
  };
}

export function analyseTransportMeasurement(audioBuffer, measurement = generateTransportMeasurement()) {
  const sr = measurement.spec.sampleRate;
  const mono = resampleLinear(monoFromAudioBuffer(audioBuffer), audioBuffer.sampleRate, sr);
  return analyseTransportMono(mono, measurement);
}

export function analyseTestTapeProgram(audioBuffer, program = generateTestTapeProgram()) {
  const sr = program.sampleRate;
  const stereo = stereoFromAudioBuffer(audioBuffer);
  const resampledStereo = {
    left: resampleLinear(stereo.left, stereo.sampleRate, sr),
    right: resampleLinear(stereo.right, stereo.sampleRate, sr),
  };
  const mono = averageStereo(resampledStereo.left, resampledStereo.right);
  const responseSegments = [];
  const toneSegments = [];
  const anchorOffsetSamples = detectProgramAnchorOffset(
    mono,
    program.responseSegments?.[0],
    sr,
  );

  for (const segment of program.responseSegments || []) {
    const detectOptions = buildAnchoredSegmentSearchWindow(
      segment,
      sr,
      mono.length,
      anchorOffsetSamples,
    );
    detectOptions.relaxedValidation = true;
    if (segment.analysisKind === "tone") {
      const result = analyseToneStereo(resampledStereo, segment.measurement, detectOptions);
      toneSegments.push({
        ...result,
        id: segment.id,
        role: segment.role,
        inputDb: segment.inputDb,
      });
      continue;
    }
    const result = analyseResponseStereo(resampledStereo, segment.measurement, detectOptions);
    responseSegments.push({
      ...result,
      id: segment.id,
      role: segment.role,
      inputDb: segment.inputDb,
    });
  }

  const fitCurvesL = responseSegments
    .filter((segment) => segment.role === "fit")
    .map((segment) => ({
      inputDb: segment.inputDb,
      role: segment.role,
      frequenciesHz: segment.frequenciesHz,
      measuredDb: segment.channels?.L?.measuredDb || [],
      correctionDb: segment.channels?.L?.correctionDb || [],
      phaseRad: segment.channels?.L?.phaseRad || [],
      residualGroupDelayMs: segment.channels?.L?.residualGroupDelayMs || [],
      clarity: segment.channels?.L?.clarity || null,
    }))
    .sort((a, b) => a.inputDb - b.inputDb);
  const fitCurvesR = responseSegments
    .filter((segment) => segment.role === "fit")
    .map((segment) => ({
      inputDb: segment.inputDb,
      role: segment.role,
      frequenciesHz: segment.frequenciesHz,
      measuredDb: segment.channels?.R?.measuredDb || [],
      correctionDb: segment.channels?.R?.correctionDb || [],
      phaseRad: segment.channels?.R?.phaseRad || [],
      residualGroupDelayMs: segment.channels?.R?.residualGroupDelayMs || [],
      clarity: segment.channels?.R?.clarity || null,
    }))
    .sort((a, b) => a.inputDb - b.inputDb);
  const validationSegment = responseSegments.find((segment) => segment.role === "validate") || null;
  const validationCurveL = validationSegment ? {
    inputDb: validationSegment.inputDb,
    role: validationSegment.role,
    frequenciesHz: validationSegment.frequenciesHz,
    measuredDb: validationSegment.channels?.L?.measuredDb || [],
    correctionDb: validationSegment.channels?.L?.correctionDb || [],
    phaseRad: validationSegment.channels?.L?.phaseRad || [],
    residualGroupDelayMs: validationSegment.channels?.L?.residualGroupDelayMs || [],
    clarity: validationSegment.channels?.L?.clarity || null,
  } : null;
  const validationCurveR = validationSegment ? {
    inputDb: validationSegment.inputDb,
    role: validationSegment.role,
    frequenciesHz: validationSegment.frequenciesHz,
    measuredDb: validationSegment.channels?.R?.measuredDb || [],
    correctionDb: validationSegment.channels?.R?.correctionDb || [],
    phaseRad: validationSegment.channels?.R?.phaseRad || [],
    residualGroupDelayMs: validationSegment.channels?.R?.residualGroupDelayMs || [],
    clarity: validationSegment.channels?.R?.clarity || null,
  } : null;
  const predictedValidationL = validationCurveL ? interpolateLevelCurve(fitCurvesL, validationCurveL.inputDb) : null;
  const predictedValidationR = validationCurveR ? interpolateLevelCurve(fitCurvesR, validationCurveR.inputDb) : null;
  const representativeCurveL = pickRepresentativeCurve(
    fitCurvesL,
    validationCurveL,
    program.validationLevelDb,
  );
  const representativeCurveR = pickRepresentativeCurve(
    fitCurvesR,
    validationCurveR,
    program.validationLevelDb,
  );
  const toneMap = {
    L: toneSegments.map((segment) => ({
      inputDb: segment.inputDb,
      role: segment.role,
      measuredDb: segment.channels?.L?.measuredDb || 0,
      thdPercent: Number(segment.channels?.L?.thdPercent || 0),
      thdDb: Number(segment.channels?.L?.thdDb || 0),
    })),
    R: toneSegments.map((segment) => ({
      inputDb: segment.inputDb,
      role: segment.role,
      measuredDb: segment.channels?.R?.measuredDb || 0,
      thdPercent: Number(segment.channels?.R?.thdPercent || 0),
      thdDb: Number(segment.channels?.R?.thdDb || 0),
    })),
  };
  const response = {
    kind: "response",
    sampleRate: sr,
    measuredAt: new Date().toISOString(),
    frequenciesHz: representativeCurveL?.frequenciesHz || representativeCurveR?.frequenciesHz || [],
    channels: {
      L: {
        measuredDb: representativeCurveL?.measuredDb || [],
        correctionDb: representativeCurveL?.correctionDb || [],
        phaseRad: representativeCurveL?.phaseRad || [],
        residualGroupDelayMs: representativeCurveL?.residualGroupDelayMs || [],
        clarity: representativeCurveL?.clarity || null,
        levelCurves: fitCurvesL,
        validationCurve: validationCurveL,
      },
      R: {
        measuredDb: representativeCurveR?.measuredDb || [],
        correctionDb: representativeCurveR?.correctionDb || [],
        phaseRad: representativeCurveR?.phaseRad || [],
        residualGroupDelayMs: representativeCurveR?.residualGroupDelayMs || [],
        clarity: representativeCurveR?.clarity || null,
        levelCurves: fitCurvesR,
        validationCurve: validationCurveR,
      },
    },
    responseSegments,
    toneSegments,
    dynamicModel: {
      fitLevelsDb: [...(program.fitLevelsDb || [])],
      validationLevelDb: Number(program.validationLevelDb || 0),
      validationErrorDb: {
        L: validationCurveL && predictedValidationL ? curveFitError(validationCurveL, predictedValidationL) : null,
        R: validationCurveR && predictedValidationR ? curveFitError(validationCurveR, predictedValidationR) : null,
      },
      toneMap,
    },
    profile: {
      version: 2,
      type: "side.deck-calibration",
      createdAt: new Date().toISOString(),
      sampleRate: sr,
      stimulus: {
        kind: "multi-level-log-sweep",
        startHz: program.spec.response.startHz,
        endHz: program.spec.response.endHz,
        durationSec: program.spec.response.mainSec,
        toneHz: program.spec.response.toneHz,
        anchorHz: Number(program.spec.response.anchorHz || program.spec.response.toneHz || 1000),
        fitLevelsDb: [...(program.fitLevelsDb || [])],
        validationLevelDb: Number(program.validationLevelDb || 0),
      },
      dynamicModel: {
        fitLevelsDb: [...(program.fitLevelsDb || [])],
        validationLevelDb: Number(program.validationLevelDb || 0),
        validationErrorDb: {
          L: validationCurveL && predictedValidationL ? curveFitError(validationCurveL, predictedValidationL) : null,
          R: validationCurveR && predictedValidationR ? curveFitError(validationCurveR, predictedValidationR) : null,
        },
        toneMap,
      },
      channels: {
        L: {
          frequenciesHz: representativeCurveL?.frequenciesHz || [],
          correctionDb: representativeCurveL?.correctionDb || [],
          phaseRad: representativeCurveL?.phaseRad || [],
          levelCurves: fitCurvesL.map((curve) => ({
            inputDb: curve.inputDb,
            role: curve.role,
            frequenciesHz: curve.frequenciesHz,
            correctionDb: curve.correctionDb,
            phaseRad: curve.phaseRad,
          })),
        },
        R: {
          frequenciesHz: representativeCurveR?.frequenciesHz || [],
          correctionDb: representativeCurveR?.correctionDb || [],
          phaseRad: representativeCurveR?.phaseRad || [],
          levelCurves: fitCurvesR.map((curve) => ({
            inputDb: curve.inputDb,
            role: curve.role,
            frequenciesHz: curve.frequenciesHz,
            correctionDb: curve.correctionDb,
            phaseRad: curve.phaseRad,
          })),
        },
      },
    },
  };
  const transport = analyseTransportMono(
    mono,
    program.transportSegment.measurement,
    buildAnchoredSegmentSearchWindow(
      program.transportSegment,
      sr,
      mono.length,
      anchorOffsetSamples,
    ),
  );
  return {
    kind: "test-tape-program",
    measuredAt: new Date().toISOString(),
    response,
    transport,
  };
}

// ── Standard calibration tape analyzer ──────────────────────
// For tapes with discrete frequency tones (e.g. AIWA 125Hz+1kHz+8kHz)

const STANDARD_TAPE_PRESETS = {
  "aiwa-3freq": {
    name: "AIWA 125Hz + 1kHz + 8kHz",
    frequencies: [125, 1000, 8000],
    nominalDb: 0, // all tones at same nominal level
  },
  "abex-3freq": {
    name: "ABEX 125Hz + 1kHz + 8kHz",
    frequencies: [125, 1000, 8000],
    nominalDb: 0,
  },
  "abex-teac-3freq": {
    name: "ABEX/TEAC 125Hz + 1kHz + 6.3kHz",
    frequencies: [125, 1000, 6300],
    nominalDb: 0,
  },
  "mrl-4freq": {
    name: "MRL 315Hz + 1kHz + 10kHz + 16kHz",
    frequencies: [315, 1000, 10000, 16000],
    nominalDb: 0,
  },
  "victor-3freq": {
    name: "Victor 63Hz + 1kHz + 10kHz",
    frequencies: [63, 1000, 10000],
    nominalDb: 0,
  },
};

export { STANDARD_TAPE_PRESETS };

function goertzelPower(data, freqHz, sampleRate, start, length) {
  const end = Math.min(data.length, start + length);
  const coeff = 2 * Math.cos((TWO_PI * freqHz) / sampleRate);
  let s1 = 0, s2 = 0;
  for (let i = start; i < end; i++) {
    const s0 = data[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - coeff * s1 * s2));
}

function detectToneSegments(mono, sampleRate, targetFreqs, frameSize = 8192, hopSize = 2048) {
  // For each target frequency, find the time segment where it's dominant
  const segments = targetFreqs.map(() => ({ startFrame: -1, endFrame: -1, frames: [] }));

  for (let start = 0; start + frameSize <= mono.length; start += hopSize) {
    const frameIdx = start / hopSize;
    // Measure energy at each target frequency
    const powers = targetFreqs.map((f) => goertzelPower(mono, f, sampleRate, start, frameSize));
    const totalPower = powers.reduce((s, p) => s + p, 0);
    if (totalPower < 1e-10) continue;

    // Find dominant frequency in this frame
    let maxPower = 0, maxIdx = -1;
    for (let i = 0; i < powers.length; i++) {
      if (powers[i] > maxPower) { maxPower = powers[i]; maxIdx = i; }
    }
    // Dominance test: this frequency has >60% of total energy
    if (maxIdx >= 0 && maxPower / totalPower > 0.6) {
      segments[maxIdx].frames.push({ frameStart: start, power: maxPower });
    }
  }

  // For each frequency, find the longest contiguous run
  for (let i = 0; i < segments.length; i++) {
    const frames = segments[i].frames;
    if (!frames.length) continue;
    // Find start/end of the stable region (skip first/last 10% for transients)
    const trimCount = Math.max(1, Math.floor(frames.length * 0.1));
    const stable = frames.slice(trimCount, frames.length - trimCount);
    if (stable.length) {
      segments[i].startFrame = stable[0].frameStart;
      segments[i].endFrame = stable[stable.length - 1].frameStart + frameSize;
      segments[i].stableFrames = stable;
    }
  }

  return segments;
}

export function analyseStandardCalibrationTape(audioBuffer, preset) {
  const sr = audioBuffer.sampleRate;
  const channels = Math.max(1, audioBuffer.numberOfChannels || 1);
  const left = audioBuffer.getChannelData(0);
  const right = audioBuffer.getChannelData(Math.min(1, channels - 1));
  const mono = new Float32Array(left.length);
  for (let i = 0; i < left.length; i++) mono[i] = (left[i] + right[i]) * 0.5;

  const targetFreqs = preset.frequencies;
  const segments = detectToneSegments(mono, sr, targetFreqs);

  // Measure level at each frequency using the stable segments
  const measuredDbL = [];
  const measuredDbR = [];
  const detectedFreqs = [];
  const missingFreqs = [];

  for (let i = 0; i < targetFreqs.length; i++) {
    const seg = segments[i];
    if (!seg.stableFrames?.length) {
      missingFreqs.push(targetFreqs[i]);
      measuredDbL.push(null);
      measuredDbR.push(null);
      detectedFreqs.push(targetFreqs[i]);
      continue;
    }
    // Average power across stable frames for L and R separately
    let sumL = 0, sumR = 0, count = 0;
    for (const frame of seg.stableFrames) {
      const len = 8192;
      sumL += goertzelPower(left, targetFreqs[i], sr, frame.frameStart, Math.min(len, left.length - frame.frameStart));
      sumR += goertzelPower(right, targetFreqs[i], sr, frame.frameStart, Math.min(len, right.length - frame.frameStart));
      count++;
    }
    const avgL = count > 0 ? sumL / count : 0;
    const avgR = count > 0 ? sumR / count : 0;
    measuredDbL.push(20 * Math.log10(Math.max(avgL, 1e-12)));
    measuredDbR.push(20 * Math.log10(Math.max(avgR, 1e-12)));
    detectedFreqs.push(targetFreqs[i]);
  }

  // Normalize to 1kHz reference (or closest frequency)
  const refIdx = targetFreqs.indexOf(1000) >= 0 ? targetFreqs.indexOf(1000) : 0;
  const refL = measuredDbL[refIdx] ?? 0;
  const refR = measuredDbR[refIdx] ?? 0;
  const relativeDbL = measuredDbL.map((v) => v != null ? v - refL : null);
  const relativeDbR = measuredDbR.map((v) => v != null ? v - refR : null);

  // Build full correction curve via log interpolation
  const gridHz = buildFrequencyGridHz(20, 20000, 24);
  const correctionL = gridHz.map((f) => -interpolateDiscretePoints(detectedFreqs, relativeDbL, f));
  const correctionR = gridHz.map((f) => -interpolateDiscretePoints(detectedFreqs, relativeDbR, f));

  return {
    kind: "standard-calibration-tape",
    preset: preset.name,
    frequencies: detectedFreqs,
    measuredDbL: relativeDbL,
    measuredDbR: relativeDbR,
    missingFreqs,
    frequenciesHz: gridHz,
    channels: {
      L: { measuredDb: relativeDbL.map((v) => v ?? 0), correctionDb: correctionL },
      R: { measuredDb: relativeDbR.map((v) => v ?? 0), correctionDb: correctionR },
    },
    profile: {
      type: "deck.playback-correction-profile",
      name: `Playback Cal (${preset.name})`,
      createdAt: new Date().toISOString(),
      channels: {
        L: { frequenciesHz: gridHz, correctionDb: correctionL },
        R: { frequenciesHz: gridHz, correctionDb: correctionR },
      },
    },
  };
}

function interpolateDiscretePoints(freqs, dbValues, targetHz) {
  const validPairs = [];
  for (let i = 0; i < freqs.length; i++) {
    if (dbValues[i] != null && Number.isFinite(dbValues[i])) validPairs.push({ freq: freqs[i], db: dbValues[i] });
  }
  if (!validPairs.length) return 0;
  if (validPairs.length === 1) return validPairs[0].db;
  if (targetHz <= validPairs[0].freq) return validPairs[0].db;
  if (targetHz >= validPairs[validPairs.length - 1].freq) return validPairs[validPairs.length - 1].db;
  for (let i = 0; i < validPairs.length - 1; i++) {
    if (targetHz >= validPairs[i].freq && targetHz <= validPairs[i + 1].freq) {
      const t = Math.log(targetHz / validPairs[i].freq) / Math.log(validPairs[i + 1].freq / validPairs[i].freq);
      return validPairs[i].db + (validPairs[i + 1].db - validPairs[i].db) * t;
    }
  }
  return 0;
}
