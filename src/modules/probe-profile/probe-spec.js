import {
  PROBE_AMPLITUDE,
  PROBE_ESS_DURATION_SEC,
  PROBE_ESS_END_HZ,
  PROBE_ESS_START_HZ,
  PROBE_GAP_SEC,
  PROBE_KIND,
  PROBE_POST_SILENCE_SEC,
  PROBE_PRE_SILENCE_SEC,
  PROBE_SYNC_DURATION_SEC,
  STANDARD_SAMPLE_RATE,
} from "../player-profile/constants.js";

const TWO_PI = Math.PI * 2;

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

function buildLogSweep(sampleRate, durationSec, startHz, endHz, amplitude) {
  const length = Math.round(sampleRate * durationSec);
  const out = new Float32Array(length);
  const L = durationSec / Math.log(endHz / startHz);
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const phase = TWO_PI * startHz * L * (Math.exp(t / L) - 1);
    out[i] = Math.sin(phase) * amplitude;
  }
  applyEdgeFade(out, sampleRate);
  return out;
}

function buildStereoBufferLike(left, right, sampleRate) {
  return {
    numberOfChannels: 2,
    sampleRate,
    length: left.length,
    getChannelData(channel) {
      return channel === 0 ? left : right;
    },
  };
}

export function createProbeManifest(overrides = {}) {
  const sampleRate = overrides.sampleRate || STANDARD_SAMPLE_RATE;
  const startHz = overrides.startHz || PROBE_ESS_START_HZ;
  const endHz = overrides.endHz || PROBE_ESS_END_HZ;
  const durationSec = overrides.durationSec || PROBE_ESS_DURATION_SEC;
  const syncSec = overrides.syncSec || PROBE_SYNC_DURATION_SEC;
  const gapSec = overrides.gapSec || PROBE_GAP_SEC;
  const preSilenceSec = overrides.preSilenceSec || PROBE_PRE_SILENCE_SEC;
  const postSilenceSec = overrides.postSilenceSec || PROBE_POST_SILENCE_SEC;
  const syncLength = Math.round(syncSec * sampleRate);
  const essLength = Math.round(durationSec * sampleRate);
  const preSilenceLength = Math.round(preSilenceSec * sampleRate);
  const postSilenceLength = Math.round(postSilenceSec * sampleRate);
  const gapLength = Math.round(gapSec * sampleRate);
  const definitions = [
    { id: "sync", kind: "sync", length: syncLength },
    { id: "dual-mono-ess", kind: "ess", mode: "dual", length: essLength },
    { id: "l-only-ess", kind: "ess", mode: "L", length: essLength },
    { id: "r-only-ess", kind: "ess", mode: "R", length: essLength },
  ];
  let cursor = preSilenceLength;
  const segments = definitions.map((segment) => {
    const next = { ...segment, start: cursor, end: cursor + segment.length };
    cursor += segment.length + gapLength;
    return next;
  });
  const totalLength = preSilenceLength + postSilenceLength + definitions.reduce((sum, segment) => sum + segment.length, 0) + gapLength * (definitions.length - 1);
  return {
    kind: PROBE_KIND,
    sampleRate,
    startHz,
    endHz,
    durationSec,
    amplitude: overrides.amplitude || PROBE_AMPLITUDE,
    preSilenceSec,
    postSilenceSec,
    gapSec,
    syncSec,
    segments,
    totalLength,
  };
}

export function generateProbeSequence(manifest = createProbeManifest()) {
  const sr = manifest.sampleRate;
  const left = new Float32Array(manifest.totalLength);
  const right = new Float32Array(manifest.totalLength);
  const sync = createWindowedNoise(Math.round(manifest.syncSec * sr), 0x51a2c3d4);
  const sweep = buildLogSweep(sr, manifest.durationSec, manifest.startHz, manifest.endHz, manifest.amplitude);
  for (const segment of manifest.segments) {
    if (segment.id === "sync") {
      left.set(sync, segment.start);
      right.set(sync, segment.start);
    } else if (segment.id === "dual-mono-ess") {
      left.set(sweep, segment.start);
      right.set(sweep, segment.start);
    } else if (segment.id === "l-only-ess") {
      left.set(sweep, segment.start);
    } else if (segment.id === "r-only-ess") {
      right.set(sweep, segment.start);
    }
  }
  return {
    manifest,
    referenceSweep: sweep,
    sync,
    bufferLike: buildStereoBufferLike(left, right, sr),
  };
}
