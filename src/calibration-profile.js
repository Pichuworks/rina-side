function interpolateLogDb(frequenciesHz, valuesDb, targetHz) {
  if (!frequenciesHz?.length || !valuesDb?.length) return 0;
  if (targetHz <= frequenciesHz[0]) return valuesDb[0] || 0;
  const last = frequenciesHz.length - 1;
  if (targetHz >= frequenciesHz[last]) return valuesDb[last] || 0;
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (frequenciesHz[mid] > targetHz) hi = mid;
    else lo = mid;
  }
  const f0 = Math.max(1e-6, frequenciesHz[lo]);
  const f1 = Math.max(f0 + 1e-6, frequenciesHz[hi]);
  const t = Math.log(targetHz / f0) / Math.log(f1 / f0);
  const a = valuesDb[lo] || 0;
  const b = valuesDb[hi] || 0;
  return a + (b - a) * t;
}

function normalizeChannel(channel) {
  if (!channel) return { frequenciesHz: [], correctionDb: [] };
  const frequenciesHz = channel.frequenciesHz || channel.freqHz || [];
  const correctionDb = channel.correctionDb || channel.recordImprintDb || channel.referenceDb || [];
  return { frequenciesHz, correctionDb };
}

function normalizeCurveProfile(raw, fallbackType, fallbackName) {
  if (!raw || typeof raw !== "object") throw new Error("Invalid profile JSON");
  const channels = raw.channels || {};
  const left = normalizeChannel(channels.L || channels.left);
  const right = normalizeChannel(channels.R || channels.right || channels.L || channels.left);
  if (!left.frequenciesHz.length || !left.correctionDb.length) throw new Error("Profile has no correction curve");
  return {
    type: raw.type || fallbackType,
    name: raw.name || raw.meta?.name || raw.title || fallbackName,
    createdAt: raw.createdAt || raw.meta?.createdAt || null,
    channels: { L: left, R: right },
    speedOffsetPercent: Number(raw.speedOffsetPercent || raw.transport?.speedOffsetPercent || 0),
    wowFlutterFloorPercentRms: Number(raw.wowFlutterFloorPercentRms || raw.transport?.wowFlutterFloorPercentRms || 0),
  };
}

export function normalizeCalibrationProfile(raw) {
  return normalizeCurveProfile(raw, "deck.playback-correction-profile", "Calibration Profile");
}

export function getProfileCorrectionDb(profile, freqHz, channel = "L") {
  const selected = profile?.channels?.[channel] || profile?.channels?.L;
  if (!selected) return 0;
  return interpolateLogDb(selected.frequenciesHz, selected.correctionDb, freqHz);
}

function invertChannel(channel) {
  return {
    frequenciesHz: [...(channel?.frequenciesHz || [])],
    correctionDb: (channel?.correctionDb || []).map((value) => -value),
  };
}

export function invertCalibrationProfile(profile, overrides = {}) {
  if (!profile) return null;
  return {
    ...profile,
    ...overrides,
    channels: {
      L: invertChannel(profile.channels?.L),
      R: invertChannel(profile.channels?.R || profile.channels?.L),
    },
  };
}

export function profileSignature(profile) {
  if (!profile) return "none";
  return JSON.stringify({
    type: profile.type,
    name: profile.name,
    L: profile.channels?.L,
    R: profile.channels?.R,
    speedOffsetPercent: profile.speedOffsetPercent || 0,
  });
}

function buildHermitianSpectrum(profile, sampleRate, channel, fftSize) {
  const spectrum = new Float64Array(fftSize);
  const nyquist = fftSize / 2;
  for (let k = 0; k <= nyquist; k++) {
    const freq = k === 0 ? 1 : (k * sampleRate) / fftSize;
    const gainDb = getProfileCorrectionDb(profile, freq, channel);
    const amp = Math.pow(10, gainDb / 20);
    spectrum[k] = amp;
    if (k > 0 && k < nyquist) spectrum[fftSize - k] = amp;
  }
  return spectrum;
}

function inverseRealDft(spectrum) {
  const size = spectrum.length;
  const out = new Float32Array(size);
  for (let n = 0; n < size; n++) {
    let sum = 0;
    for (let k = 0; k < size; k++) sum += spectrum[k] * Math.cos((2 * Math.PI * k * n) / size);
    out[n] = sum / size;
  }
  return out;
}

function shiftToCausal(data) {
  const size = data.length;
  const half = size >> 1;
  const out = new Float32Array(size);
  for (let i = 0; i < size; i++) out[i] = data[(i - half + size) % size];
  return out;
}

export function buildLinearPhaseImpulse(profile, sampleRate, fftSize = 4096) {
  const leftSpectrum = buildHermitianSpectrum(profile, sampleRate, "L", fftSize);
  const rightSpectrum = buildHermitianSpectrum(profile, sampleRate, "R", fftSize);
  const left = shiftToCausal(inverseRealDft(leftSpectrum));
  const right = shiftToCausal(inverseRealDft(rightSpectrum));
  return {
    left,
    right,
    length: fftSize,
    delaySamples: fftSize >> 1,
  };
}

function normalizeManifestChannel(channel) {
  if (!channel) return null;
  const frequenciesHz = channel.frequenciesHz || channel.freqHz || [];
  const referenceDb = channel.referenceDb || channel.correctionDb || [];
  if (!frequenciesHz.length || !referenceDb.length) return null;
  return { frequenciesHz, referenceDb };
}

export function normalizeReferenceTestManifest(raw) {
  if (!raw || typeof raw !== "object") throw new Error("Invalid manifest JSON");
  if (raw.type !== "side.reference-test-tape-manifest") throw new Error("Not a reference tape manifest");
  const channels = raw.channels || {};
  return {
    version: raw.version || 1,
    type: raw.type,
    name: raw.name || "Reference Test Tape",
    createdAt: raw.createdAt || null,
    stimulus: {
      kind: raw.stimulus?.kind || "response",
      sampleRate: Number(raw.stimulus?.sampleRate || 48000),
      startHz: Number(raw.stimulus?.startHz || 20),
      endHz: Number(raw.stimulus?.endHz || 18000),
      durationSec: Number(raw.stimulus?.durationSec || 0),
      nominalOnTapeToneHz: Number(raw.stimulus?.nominalOnTapeToneHz || 0),
    },
    writerProfile: {
      name: raw.writerProfile?.name || "",
      createdAt: raw.writerProfile?.createdAt || null,
      speedOffsetPercent: Number(raw.writerProfile?.speedOffsetPercent || 0),
      wowFlutterFloorPercentRms: Number(raw.writerProfile?.wowFlutterFloorPercentRms || 0),
    },
    channels: {
      L: normalizeManifestChannel(channels.L || channels.left),
      R: normalizeManifestChannel(channels.R || channels.right || channels.L || channels.left),
    },
  };
}
