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
  const coarseStep = 16;
  for (let pos = searchStart; pos <= maxPos; pos += coarseStep) {
    const score = dotAt(signal, pos, kernel);
    if (score > bestScore) {
      bestScore = score;
      bestPos = pos;
    }
  }
  const refineStart = Math.max(searchStart, bestPos - coarseStep);
  const refineEnd = Math.min(maxPos, bestPos + coarseStep);
  for (let pos = refineStart; pos <= refineEnd; pos++) {
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
  const startSearchA = Math.max(searchStart, roughStart - measurement.syncStart.length);
  const startSearchB = Math.min(searchEnd - measurement.syncStart.length - 1, roughStart + measurement.syncStart.length);
  const start = findSync(signal, measurement.syncStart, startSearchA, startSearchB);
  const expectedEndPos = start.pos + measurement.syncStart.length + Math.round(measurement.spec.gapSec * sr) + measurement.mainLength + Math.round(measurement.spec.gapSec * sr);
  const endSearchA = Math.max(start.pos + measurement.mainLength / 2, expectedEndPos - measurement.syncEnd.length * 2);
  const endSearchB = Math.min(searchEnd - measurement.syncEnd.length - 1, expectedEndPos + measurement.syncEnd.length * 2);
  const end = findSync(signal, measurement.syncEnd, endSearchA, endSearchB);
  return { start, end };
}

function sliceAndNormalizeMain(signal, measurement, options = {}) {
  const sr = measurement.spec.sampleRate;
  const { start, end } = detectSyncPair(signal, measurement, options);
  const detectedMainStart = start.pos + measurement.syncStart.length + Math.round(measurement.spec.gapSec * sr);
  const detectedMainEnd = end.pos - Math.round(measurement.spec.gapSec * sr);
  const detectedLength = Math.max(1, detectedMainEnd - detectedMainStart);
  const main = signal.slice(detectedMainStart, detectedMainEnd);
  const normalized = resampleLinear(main, sr, sr * (measurement.mainLength / detectedLength));
  const resampled = resampleLinear(normalized, sr, sr);
  const fixed = new Float32Array(measurement.mainLength);
  fixed.set(resampled.subarray(0, Math.min(measurement.mainLength, resampled.length)));
  return { main: fixed, startSample: detectedMainStart, endSample: detectedMainEnd };
}

export function generateTestTapeProgram(spec = TEST_TAPE_PROGRAM_SPEC) {
  const response = generateResponseMeasurement(spec.response);
  const transport = generateTransportMeasurement(spec.transport);
  const sr = spec.sampleRate;
  const inter = Math.round(spec.interSegmentSec * sr);
  const total = response.length + inter + transport.length;
  const mono = new Float32Array(total);
  mono.set(response.mono, 0);
  mono.set(transport.mono, response.length + inter);
  return {
    kind: "test-tape-program",
    spec,
    sampleRate: sr,
    mono,
    bufferLike: buildStereoBufferLike(sr, mono),
    response,
    transport,
    segments: {
      responseStart: 0,
      responseLength: response.length,
      transportStart: response.length + inter,
      transportLength: transport.length,
    },
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

function smoothLogSeries(values) {
  const out = new Array(values.length).fill(0);
  for (let i = 0; i < values.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - 2); j <= Math.min(values.length - 1, i + 2); j++) {
      sum += values[j];
      count += 1;
    }
    out[i] = sum / Math.max(1, count);
  }
  return out;
}

function analyseResponseMono(mono, measurement, detectOptions = {}) {
  const sr = measurement.spec.sampleRate;
  const { main, startSample, endSample } = sliceAndNormalizeMain(mono, measurement, detectOptions);
  const points = 72;
  const freqs = [];
  const measuredDb = [];
  const correctionDb = [];
  for (let i = 0; i < points; i++) {
    const ratio = i / Math.max(1, points - 1);
    const freq = measurement.spec.startHz * Math.pow(measurement.spec.endHz / measurement.spec.startHz, ratio);
    const t = Math.log(freq / measurement.spec.startHz) / Math.log(measurement.spec.endHz / measurement.spec.startHz);
    const center = Math.round(t * (measurement.mainLength - 1));
    const cycles = Math.max(8, Math.min(64, Math.round((sr / Math.max(freq, 1)) * 10)));
    const refMag = goertzelMagnitude(measurement.referenceMain, center, cycles, freq, sr);
    const recMag = goertzelMagnitude(main, center, cycles, freq, sr);
    const response = 20 * Math.log10((recMag + 1e-12) / (refMag + 1e-12));
    freqs.push(freq);
    measuredDb.push(response);
    correctionDb.push(-response);
  }
  const smoothedMeasured = smoothLogSeries(measuredDb);
  const smoothedCorrection = smoothLogSeries(correctionDb).map((value) => Math.max(-12, Math.min(12, value)));
  return {
    kind: "response",
    sampleRate: sr,
    measuredAt: new Date().toISOString(),
    startSample,
    endSample,
    frequenciesHz: freqs,
    measuredDb: smoothedMeasured,
    correctionDb: smoothedCorrection,
    profile: {
      version: 1,
      type: "side.deck-calibration",
      createdAt: new Date().toISOString(),
      sampleRate: sr,
      stimulus: {
        kind: "log-sweep",
        startHz: measurement.spec.startHz,
        endHz: measurement.spec.endHz,
        durationSec: measurement.spec.mainSec,
      },
      channels: {
        L: { frequenciesHz: freqs, correctionDb: smoothedCorrection },
        R: { frequenciesHz: freqs, correctionDb: smoothedCorrection },
      },
    },
  };
}

export function analyseResponseMeasurement(audioBuffer, measurement = generateResponseMeasurement()) {
  const sr = measurement.spec.sampleRate;
  const mono = resampleLinear(monoFromAudioBuffer(audioBuffer), audioBuffer.sampleRate, sr);
  return analyseResponseMono(mono, measurement);
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

function analyseTransportMono(mono, measurement, detectOptions = {}) {
  const sr = measurement.spec.sampleRate;
  const { main, startSample, endSample } = sliceAndNormalizeMain(mono, measurement, detectOptions);
  const windowLength = Math.round(sr * 0.25);
  const hop = Math.round(sr * 0.05);
  const estimates = [];
  for (let start = 0; start + windowLength <= main.length; start += hop) {
    const segment = main.subarray(start, start + windowLength);
    const freq = estimateFrequencyFromZeroCrossings(segment, sr);
    if (freq && Number.isFinite(freq)) estimates.push(freq);
  }
  if (!estimates.length) throw new Error("Failed to estimate transport frequency");
  const mean = estimates.reduce((sum, value) => sum + value, 0) / estimates.length;
  const variance = estimates.reduce((sum, value) => sum + (value - mean) ** 2, 0) / estimates.length;
  const std = Math.sqrt(variance);
  const min = Math.min(...estimates);
  const max = Math.max(...estimates);
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
    seriesHz: estimates,
  };
}

export function analyseTransportMeasurement(audioBuffer, measurement = generateTransportMeasurement()) {
  const sr = measurement.spec.sampleRate;
  const mono = resampleLinear(monoFromAudioBuffer(audioBuffer), audioBuffer.sampleRate, sr);
  return analyseTransportMono(mono, measurement);
}

export function analyseTestTapeProgram(audioBuffer, program = generateTestTapeProgram()) {
  const sr = program.sampleRate;
  const mono = resampleLinear(monoFromAudioBuffer(audioBuffer), audioBuffer.sampleRate, sr);
  const response = analyseResponseMono(mono, program.response);
  const expectedTransportStart = response.startSample
    + program.response.expectedTotal
    + Math.round(program.spec.interSegmentSec * sr);
  const transport = analyseTransportMono(mono, program.transport, {
    searchStart: Math.max(0, expectedTransportStart - Math.round(sr * 1.5)),
    searchEnd: Math.min(mono.length, expectedTransportStart + program.transport.expectedTotal + Math.round(sr * 2)),
  });
  return {
    kind: "test-tape-program",
    measuredAt: new Date().toISOString(),
    response,
    transport,
  };
}
