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

function normalizeLevelCurves(levelCurves) {
  if (!Array.isArray(levelCurves)) return [];
  return levelCurves
    .map((curve) => {
      const frequenciesHz = curve?.frequenciesHz || curve?.freqHz || [];
      const correctionDb = curve?.correctionDb || curve?.recordImprintDb || curve?.referenceDb || [];
      if (!frequenciesHz.length || !correctionDb.length) return null;
      return {
        inputDb: Number(curve.inputDb || 0),
        role: curve.role || "fit",
        frequenciesHz,
        correctionDb,
        phaseRad: Array.isArray(curve?.phaseRad) ? curve.phaseRad : [],
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.inputDb - b.inputDb);
}

function pickRepresentativeCurve(channel, levelCurves) {
  if (channel?.frequenciesHz?.length && channel?.correctionDb?.length) {
    return {
      frequenciesHz: channel.frequenciesHz,
      correctionDb: channel.correctionDb,
      phaseRad: Array.isArray(channel.phaseRad) ? channel.phaseRad : [],
    };
  }
  if (!levelCurves.length) return { frequenciesHz: [], correctionDb: [], phaseRad: [] };
  const preferred = levelCurves.find((curve) => curve.role === "validate");
  if (preferred) {
    return {
      frequenciesHz: preferred.frequenciesHz,
      correctionDb: preferred.correctionDb,
      phaseRad: preferred.phaseRad || [],
    };
  }
  const mid = levelCurves[Math.floor(levelCurves.length / 2)];
  return {
    frequenciesHz: mid.frequenciesHz,
    correctionDb: mid.correctionDb,
    phaseRad: mid.phaseRad || [],
  };
}

function normalizeChannel(channel) {
  const levelCurves = normalizeLevelCurves(channel?.levelCurves);
  const representative = pickRepresentativeCurve(channel, levelCurves);
  return {
    frequenciesHz: representative.frequenciesHz,
    correctionDb: representative.correctionDb,
    phaseRad: representative.phaseRad,
    levelCurves,
  };
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

export function getProfilePhaseRad(profile, freqHz, channel = "L") {
  const selected = profile?.channels?.[channel] || profile?.channels?.L;
  if (!selected?.phaseRad?.length) return 0;
  return interpolateLogDb(selected.frequenciesHz, selected.phaseRad, freqHz);
}

export function getProfileLevelCurves(profile, channel = "L") {
  const selected = profile?.channels?.[channel] || profile?.channels?.L;
  return selected?.levelCurves || [];
}

export function hasDynamicCalibrationProfile(profile) {
  return getProfileLevelCurves(profile, "L").length > 1;
}

function stripChannelCompensation(channel, { applyEq = true, applyClarity = true } = {}) {
  const frequenciesHz = [...(channel?.frequenciesHz || [])];
  const zeroCorrection = frequenciesHz.map(() => 0);
  const zeroPhase = frequenciesHz.map(() => 0);
  return {
    ...channel,
    frequenciesHz,
    correctionDb: applyEq ? [...(channel?.correctionDb || [])] : zeroCorrection,
    phaseRad: applyClarity ? [...(channel?.phaseRad || [])] : zeroPhase,
    levelCurves: (channel?.levelCurves || []).map((curve) => {
      const curveFreqHz = [...(curve?.frequenciesHz || [])];
      return {
        ...curve,
        frequenciesHz: curveFreqHz,
        correctionDb: applyEq ? [...(curve?.correctionDb || [])] : curveFreqHz.map(() => 0),
        phaseRad: applyClarity ? [...(curve?.phaseRad || [])] : curveFreqHz.map(() => 0),
      };
    }),
  };
}

export function deriveCompensationProfile(profile, { applyEq = true, applyClarity = true } = {}) {
  if (!profile || (!applyEq && !applyClarity)) return null;
  if (applyEq && applyClarity) return profile;
  return {
    ...profile,
    channels: {
      L: stripChannelCompensation(profile.channels?.L, { applyEq, applyClarity }),
      R: stripChannelCompensation(profile.channels?.R || profile.channels?.L, { applyEq, applyClarity }),
    },
  };
}

function invertChannel(channel) {
  return {
    frequenciesHz: [...(channel?.frequenciesHz || [])],
    correctionDb: (channel?.correctionDb || []).map((value) => -value),
    phaseRad: (channel?.phaseRad || []).map((value) => -value),
    levelCurves: (channel?.levelCurves || []).map((curve) => ({
      inputDb: curve.inputDb,
      role: curve.role || "fit",
      frequenciesHz: [...(curve?.frequenciesHz || [])],
      correctionDb: (curve?.correctionDb || []).map((value) => -value),
      phaseRad: (curve?.phaseRad || []).map((value) => -value),
    })),
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
    const angle = (inverse ? 2 : -2) * Math.PI / len;
    const wLenCos = Math.cos(angle);
    const wLenSin = Math.sin(angle);
    for (let start = 0; start < n; start += len) {
      let wCos = 1;
      let wSin = 0;
      for (let i = 0; i < len / 2; i++) {
        const u = start + i;
        const v = u + (len >> 1);
        const vReal = (real[v] * wCos) - (imag[v] * wSin);
        const vImag = (real[v] * wSin) + (imag[v] * wCos);
        real[v] = real[u] - vReal;
        imag[v] = imag[u] - vImag;
        real[u] += vReal;
        imag[u] += vImag;
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

function buildHermitianSpectrum(profile, sampleRate, channel, fftSize, delaySamples) {
  const real = new Float64Array(fftSize);
  const imag = new Float64Array(fftSize);
  const nyquist = fftSize / 2;
  const limitDb = Math.max(0, Number(profile?.applicationLimitDb || profile?.maxCorrectionDb || 12));
  for (let k = 0; k <= nyquist; k++) {
    const freq = k === 0 ? 1 : (k * sampleRate) / fftSize;
    const gainDb = Math.max(-limitDb, Math.min(limitDb, getProfileCorrectionDb(profile, freq, channel)));
    const amp = Math.pow(10, gainDb / 20);
    const phase = -getProfilePhaseRad(profile, freq, channel);
    const shiftPhase = (-2 * Math.PI * k * delaySamples) / fftSize;
    const totalPhase = phase + shiftPhase;
    real[k] = amp * Math.cos(totalPhase);
    imag[k] = amp * Math.sin(totalPhase);
    if (k > 0 && k < nyquist) {
      real[fftSize - k] = real[k];
      imag[fftSize - k] = -imag[k];
    }
  }
  return { real, imag };
}

export function buildLinearPhaseImpulse(profile, sampleRate, fftSize = 4096) {
  const delaySamples = fftSize >> 1;
  const leftSpectrum = buildHermitianSpectrum(profile, sampleRate, "L", fftSize, delaySamples);
  const rightSpectrum = buildHermitianSpectrum(profile, sampleRate, "R", fftSize, delaySamples);
  fftComplexInPlace(leftSpectrum.real, leftSpectrum.imag, true);
  fftComplexInPlace(rightSpectrum.real, rightSpectrum.imag, true);
  const left = Float32Array.from(leftSpectrum.real);
  const right = Float32Array.from(rightSpectrum.real);
  return {
    left,
    right,
    length: fftSize,
    delaySamples,
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
