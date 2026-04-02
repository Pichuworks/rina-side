import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { decodeAudioFileToBufferLike, createAudioBufferFromBufferLike } from "./audio-buffer-like.js";
import { extractW1Audio, isW1File } from "./w1-helper.js";
import { IconAdd, IconAutoAwesome, IconFileOpen, IconSave, IconPlay, IconStop, IconExport, IconHelp, IconClearSide, IconClearAll, IconPalette, IconInfo, IconTool } from "./Icons.jsx";
import Player from "./Player.jsx";
import SideWaveform from "./SideWaveform.jsx";
import SideSpectrogram from "./SideSpectrogram.jsx";
import { TOOL_PLUGINS } from "./tool-plugins/index.js";
import {
  normalizeCalibrationProfile,
  buildLinearPhaseImpulse,
  invertCalibrationProfile,
  profileSignature,
  hasDynamicCalibrationProfile,
  getProfileLevelCurves,
  deriveCompensationProfile,
} from "./calibration-profile.js";
import { APP_VERSION, APP_GITHUB, LANGS, I18N, t, RINA_SMILE } from "./i18n.js";
import useSignalOutput, { SIGNAL_OUTPUT_PRESETS } from "./hooks/useSignalOutput.js";
import useDeckCalibration from "./hooks/useDeckCalibration.js";
import usePlayerProfile from "./hooks/usePlayerProfile.js";

// ═══════════════════════════════════════════════════════════════
// SIDE — Sequential Interleaved Dubbing Engine
// 阿佐谷202室 磁带転写ツール
// Ver 0.9 Release Candidate II
// by 天使天才天王寺璃奈 (Angel, Genius, Tennoji Rina)
// ═══════════════════════════════════════════════════════════════


function themeName(key, lang) {
  const names = THEME_NAMES[key];
  return names ? (names[lang] || names["zh-CN"] || key) : key;
}
// ── Constants ────────────────────────────────────────────────
// ── Character Themes ────────────────────────────────────────
const THEMES = {
  default: { accent: "#D4859A", bg: "#E8ECF2", bgCard: "#F4F6FA", bgDeep: "#DCE2EA", border: "#C8CED8", accentDim: "#F2D6DE", group: "" },
  keke: { accent: "#49BDF0", bg: "#F2F7FA", bgCard: "#FAFCFF", bgDeep: "#E4EEF5", border: "#C8D8E4", accentDim: "#CCE8FA", group: "liella" },
  omgkawaiiangel: { accent: "#8FDDF7", bg: "#FAF7FD", bgCard: "#FFFDFF", bgDeep: "#EEE9F6", border: "#DDD4E8", accentDim: "#EAF8FE", sideA: "#8FDDF7", sideB: "#F2A8E2", accentInk: "#557A95", warning: "#F0A4D2", group: "ngo" },
  amechan: { accent: "#B54857", bg: "#F4F1F3", bgCard: "#FBFAFB", bgDeep: "#E8E2E6", border: "#D4CBD1", accentDim: "#F0D8DD", sideA: "#B54857", sideB: "#70758F", accentInk: "#883030", warning: "#B29663", group: "ngo" },
  tomori: { accent: "#77BBDD", bg: "#F2F6F9", bgCard: "#FAFCFF", bgDeep: "#E4EDF4", border: "#C8D5DF", accentDim: "#D0E5F3", group: "mygo" },
  raana: { accent: "#77DD77", bg: "#F2F8F2", bgCard: "#FAFFFA", bgDeep: "#E2EEE2", border: "#C5D8C5", accentDim: "#C8F0C8", group: "mygo" },
  soyo: { accent: "#FFDD88", bg: "#FAF8F2", bgCard: "#FFFEF8", bgDeep: "#F2EEDD", border: "#DDD8C8", accentDim: "#F5EDC8", group: "mygo" },
  anon: { accent: "#FF8899", bg: "#FAF3F4", bgCard: "#FFFAFB", bgDeep: "#F2E6E8", border: "#E0D0D4", accentDim: "#FFD8DF", group: "mygo" },
  taki: { accent: "#7777AA", bg: "#F4F3F8", bgCard: "#FBFAFF", bgDeep: "#E6E3F0", border: "#D0CDD9", accentDim: "#D4D0E8", group: "mygo" },
  sakiko: { accent: "#7799CC", bg: "#F2F5F9", bgCard: "#FAFBFF", bgDeep: "#E4ECF4", border: "#C8D2DF", accentDim: "#CCDCF0", group: "mujica" },
  mutsumi: { accent: "#779977", bg: "#F3F7F3", bgCard: "#FAFFF9", bgDeep: "#E4EDE3", border: "#C8D5C6", accentDim: "#CCE0CC", group: "mujica" },
  nyamu: { accent: "#AA4477", bg: "#F8F2F5", bgCard: "#FFFAFC", bgDeep: "#F0E4EA", border: "#DDD0D6", accentDim: "#E8C4D6", group: "mujica" },
  hatsuka: { accent: "#BB9955", bg: "#F8F6F0", bgCard: "#FFFDF8", bgDeep: "#EFEBDF", border: "#D8D2C2", accentDim: "#E8DCC0", group: "mujica" },
  uika: { accent: "#335566", bg: "#F0F4F6", bgCard: "#F8FBFC", bgDeep: "#E0E8EC", border: "#C4D0D6", accentDim: "#BCCDD8", group: "mujica" },
  mana: { accent: "#E8A68F", bg: "#FBF6F2", bgCard: "#FFFDFC", bgDeep: "#F2E8E1", border: "#E3D3C8", accentDim: "#F7DDD0", sideA: "#E8A68F", sideB: "#C7B48C", accentInk: "#9A5E4C", warning: "#D9B15E", group: "sumimi" },
  nozomu: { accent: "#D4600A", bg: "#F8F4EE", bgCard: "#FFFBF7", bgDeep: "#EDE5D8", border: "#D8CCBC", accentDim: "#F2DCC0", sideA: "#D4600A", sideB: "#6A7A8F", accentInk: "#8A3A08", warning: "#B89040", group: "crisiris" },
  eri: { accent: "#800020", bg: "#F6EFF1", bgCard: "#FFFDFB", bgDeep: "#ECDDE2", bgHover: "#F3E6EA", border: "#D6BEC6", accentDim: "#E8CDD5", sideA: "#800020", sideB: "#D9A11E", accentInk: "#5E1021", accentContrast: "#F7E8C1", warning: "#B06A1F", text: "#34292C", textDim: "#75656A", group: "crisiris" },
};  

const THEME_ORDER = [
  "default",
  "keke",
  "omgkawaiiangel", "amechan",
  "tomori", "raana", "soyo", "anon", "taki",
  "sakiko", "mutsumi", "nyamu", "hatsuka", "uika",
  "mana",
  "nozomu", "eri",
];

const THEME_NAMES = {
  default: { "zh-CN": "天王寺璃奈", ja: "天王寺 璃奈", en: "Rina Tennoji" },
  keke: { "zh-CN": "唐可可", ja: "唐 可可", en: "Keke Tang" },
  omgkawaiiangel: { "zh-CN": "超绝最可爱天使酱", ja: "超絶最かわてんしちゃん", en: "OMGkawaiiAngel" },
  amechan: { "zh-CN": "糖糖", ja: "あめちゃん", en: "Ame-chan" },
  tomori: { "zh-CN": "高松灯", ja: "高松 燈", en: "Tomori Takamatsu" },
  raana: { "zh-CN": "要乐奈", ja: "要 楽奈", en: "Rana Kaname" },
  soyo: { "zh-CN": "长崎爽世", ja: "長崎 そよ", en: "Soyo Nagasaki" },
  anon: { "zh-CN": "千早爱音", ja: "千早 愛音", en: "Anon Chihaya" },
  taki: { "zh-CN": "椎名立希", ja: "椎名 立希", en: "Taki Shiina" },
  sakiko: { "zh-CN": "丰川祥子", ja: "豊川 祥子", en: "Sakiko Togawa" },
  mutsumi: { "zh-CN": "若叶睦", ja: "若葉 睦", en: "Mutsumi Wakaba" },
  nyamu: { "zh-CN": "祐天寺若麦", ja: "祐天寺 にゃむ", en: "Nyamu Yutenji" },
  hatsuka: { "zh-CN": "三角初华", ja: "三角 初華", en: "Uika Misumi" },
  uika: { "zh-CN": "八幡海铃", ja: "八幡 海鈴", en: "Umiri Yahata" },
  mana: { "zh-CN": "纯田真奈", ja: "純田 まな", en: "Mana Sumita" },
  nozomu: { "zh-CN": "星街望", ja: "星街 望", en: "Nozomu Hoshimachi" },
  eri: { "zh-CN": "高桥绘理", ja: "高橋 絵理", en: "Eri Takahashi" },
};

// Derive SIDE A/B colors from accent: A = accent, B = accent hue-rotated ~150° + desaturated
function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6; else if (mx === g) h = ((b - r) / d + 2) / 6; else h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s * 100, l * 100];
}
function mixHex(a, b, t) {
  const ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16);
  const mix = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return `#${mix(ar, br)}${mix(ag, bg)}${mix(ab, bb)}`;
}
function getContrastColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 170 ? "#2D2D38" : "#FFFFFF";
}
function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100; const a = s * Math.min(l, 1 - l);
  const f = n => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1))); };
  return `#${[f(0), f(8), f(4)].map(v => v.toString(16).padStart(2, "0")).join("")}`;
}
function deriveSideColors(accent) {
  const [h, s, l] = hexToHsl(accent);
  return { sideA: accent, sideB: hslToHex((h + 150) % 360, Math.max(s * 0.6, 20), Math.min(Math.max(l, 40), 60)) };
}
function deriveAccentInk(accent) {
  return mixHex(accent, "#1F2430", 0.6);
}
function deriveWarningColor(accent) {
  const warmed = mixHex(accent, "#C97A5A", 0.62);
  const [h, s, l] = hexToHsl(warmed);
  return hslToHex(h, Math.max(42, s * 0.88), Math.min(Math.max(l, 50), 60));
}
function deriveTapeTypeColors(accent) {
  return {
    TYPE_I: mixHex("#8F5A33", accent, 0.28),
    TYPE_II: mixHex("#3A9FB3", accent, 0.22),
    TYPE_IV: mixHex("#585E74", accent, 0.34),
  };
}

const TAPE_PRESETS = {
  C46: { label: "C-46", sideMinutes: 23 }, C60: { label: "C-60", sideMinutes: 30 },
  C54: { label: "C-54", sideMinutes: 27 },
  C90: { label: "C-90", sideMinutes: 45 }, C120: { label: "C-120", sideMinutes: 60 },
};
const TAPE_TYPES = {
  TYPE_I: { label: "Type I (Normal)", peakDb: -3, desc: "TDK D, Maxell UR" },
  TYPE_II: { label: "Type II (Chrome)", peakDb: -1, desc: "TDK SA, Maxell XLII" },
  TYPE_IV: { label: "Type IV (Metal)", peakDb: 0, desc: "TDK MA, Maxell MX" },
};
const TAPE_SIM_PROFILES = {
  TAPE_I: {
    drive: 1.55,
    headBumpHz: 105,
    headBumpDb: 1.6,
    preEmphasisHz: 3400,
    preEmphasisDb: 1.8,
    deEmphasisHz: 5600,
    deEmphasisDb: -3.1,
    bandwidthHz: 12500,
    compThreshold: -16,
    compRatio: 1.45,
    hissLevel: 0.007,
  },
  TAPE_II: {
    drive: 1.38,
    headBumpHz: 100,
    headBumpDb: 1.15,
    preEmphasisHz: 3800,
    preEmphasisDb: 1.15,
    deEmphasisHz: 6200,
    deEmphasisDb: -2.2,
    bandwidthHz: 14500,
    compThreshold: -15,
    compRatio: 1.32,
    hissLevel: 0.0045,
  },
  TAPE_IV: {
    drive: 1.24,
    headBumpHz: 95,
    headBumpDb: 0.75,
    preEmphasisHz: 4200,
    preEmphasisDb: 0.7,
    deEmphasisHz: 7000,
    deEmphasisDb: -1.4,
    bandwidthHz: 17500,
    compThreshold: -14,
    compRatio: 1.2,
    hissLevel: 0.0025,
  },
};
const TAPE_TRANSPORT_PROFILE = {
  baseDelayMs: 1.8,
  wowDepthMs: 0.035,
  wowStepSec: 0.18,
  flutterHz: 7.2,
  flutterDepthMs: 0.006,
};
const DECK_SIM_PROFILES = {
  off: {
    wowMul: 1.0,
    flutterMul: 1.0,
    wowStepSec: 0.18,
    playbackBandwidthHz: 22050,
    crosstalk: 0.0,
    hissMul: 1.0,
  },
  portable: {
    wowMul: 1.8,
    flutterMul: 1.6,
    wowStepSec: 0.22,
    playbackBandwidthHz: 12800,
    crosstalk: 0.12,
    hissMul: 1.35,
  },
  deck_2: {
    wowMul: 1.0,
    flutterMul: 1.0,
    wowStepSec: 0.17,
    playbackBandwidthHz: 16000,
    crosstalk: 0.05,
    hissMul: 1.0,
  },
  deck_3: {
    wowMul: 0.65,
    flutterMul: 0.65,
    wowStepSec: 0.15,
    playbackBandwidthHz: 18500,
    crosstalk: 0.025,
    hissMul: 0.72,
  },
};
const TONE_SIM_PROFILES = {
  default: {
    headBumpDb: 0,
    preEmphasisDb: 0,
    deEmphasisDb: 0,
    bandwidthMul: 1.0,
    driveMul: 1.0,
    compRatioMul: 1.0,
    compThresholdDb: 0,
  },
  cool: {
    headBumpDb: -0.5,
    preEmphasisDb: 0.6,
    deEmphasisDb: 0.6,
    bandwidthMul: 1.08,
    driveMul: 0.9,
    compRatioMul: 0.92,
    compThresholdDb: 1.0,
  },
  warm: {
    headBumpDb: 0.7,
    preEmphasisDb: -0.5,
    deEmphasisDb: -0.8,
    bandwidthMul: 0.92,
    driveMul: 1.12,
    compRatioMul: 1.08,
    compThresholdDb: -1.0,
  },
};
const TUBE_SIM_PROFILE = {
  drive: 1.02,
  asymmetry: 0.03,
  lowpassHz: 9600,
  outputTrim: 0.99,
};
const VINYL_SIM_PROFILE = {
  bassHz: 170,
  bassDb: 0.9,
  wearHz: 3400,
  wearDb: -2.4,
  lowpassHz: 12800,
  highpassHz: 26,
  warpBaseDelayMs: 2.4,
  warpDepthMs: 0.14,
  warpStepSec: 0.14,
  eccentricityHz: 0.56,
  eccentricityDepthMs: 0.09,
  surfaceLevel: 0.0032,
  crackleLevel: 0.06,
  rumbleLevel: 0.0025,
};
const VINYL_ERA_PROFILES = {
  modern: {
    lowpassMul: 1.04,
    wearHz: 5200,
    wearDb: -0.4,
    humLevel: 0.00003,
    narrow: 0.025,
    grooveDrive: 0.014,
    knockLevel: 0.0005,
  },
  classic: {
    lowpassMul: 0.88,
    wearHz: 3600,
    wearDb: -2.1,
    humLevel: 0.00008,
    narrow: 0.075,
    grooveDrive: 0.04,
    knockLevel: 0.0011,
  },
  vintage: {
    lowpassMul: 0.74,
    wearHz: 2500,
    wearDb: -3.5,
    humLevel: 0.00016,
    narrow: 0.135,
    grooveDrive: 0.072,
    knockLevel: 0.0018,
  },
  effect: {
    lowpassMul: 0.68,
    wearHz: 2100,
    wearDb: -4.4,
    humLevel: 0.0012,
    narrow: 0.18,
    grooveDrive: 0.11,
    knockLevel: 0.005,
  },
};
const VINYL_CRACKLE_PROFILES = {
  off: { dust: 0, scratch: 0, click: 0 },
  low: { dust: 0.75, scratch: 0.7, click: 1.0 },
  mid: { dust: 1.35, scratch: 1.35, click: 1.85 },
  high: { dust: 2.1, scratch: 2.1, click: 3.0 },
};
const DEFAULT_GAP = 3.0;
const SILENCE_THRESHOLD = 0.005;
const SILENCE_MIN_DUR = 0.3;

// ── Audio helpers ────────────────────────────────────────────
function encodeWAV(ab, bitsPerSample = 16) {
  const nCh = ab.numberOfChannels, sr = ab.sampleRate, nS = ab.length;
  const byPS = bitsPerSample / 8;
  const ds = nS * nCh * byPS, buf = new ArrayBuffer(44 + ds), dv = new DataView(buf);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, "RIFF"); dv.setUint32(4, 36 + ds, true); ws(8, "WAVE"); ws(12, "fmt ");
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, nCh, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * nCh * byPS, true); dv.setUint16(32, nCh * byPS, true);
  dv.setUint16(34, bitsPerSample, true); ws(36, "data"); dv.setUint32(40, ds, true);
  const chs = []; for (let c = 0; c < nCh; c++) chs.push(ab.getChannelData(c));
  let off = 44;
  if (bitsPerSample === 16) {
    for (let i = 0; i < nS; i++) for (let c = 0; c < nCh; c++) {
      const s = Math.max(-1, Math.min(1, chs[c][i]));
      dv.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true); off += 2;
    }
  } else { // 24-bit
    for (let i = 0; i < nS; i++) for (let c = 0; c < nCh; c++) {
      const s = Math.max(-1, Math.min(1, chs[c][i]));
      const v = s < 0 ? Math.round(s * 0x800000) : Math.round(s * 0x7FFFFF);
      dv.setUint8(off, v & 0xFF); dv.setUint8(off + 1, (v >> 8) & 0xFF); dv.setUint8(off + 2, (v >> 16) & 0xFF); off += 3;
    }
  }
  return new Blob([buf], { type: "audio/wav" });
}
function createSoftSatCurve(drive = 1.0, samples = 2048) {
  const curve = new Float32Array(samples);
  const amount = Math.max(0.01, drive);
  const norm = Math.tanh(amount);
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    curve[i] = Math.tanh(amount * x) / norm;
  }
  return curve;
}
function createTubeCurve(drive = 1.0, asymmetry = 0.15, samples = 2048) {
  const curve = new Float32Array(samples);
  const amount = Math.max(0.01, drive);
  const bias = Math.max(-0.45, Math.min(0.45, asymmetry));
  let peak = 1e-9;
  for (let i = 0; i < samples; i++) {
    const x = (i / (samples - 1)) * 2 - 1;
    const shifted = x + bias * (1 - x * x);
    const shaped = Math.tanh(amount * shifted);
    curve[i] = shaped;
    peak = Math.max(peak, Math.abs(shaped));
  }
  for (let i = 0; i < samples; i++) curve[i] /= peak;
  return curve;
}
function createWhiteNoiseBuffer(ctx, durationSec) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}
function createSmoothRandomBuffer(ctx, durationSec, stepSec = 0.1) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const step = Math.max(1, Math.floor(stepSec * ctx.sampleRate));
  const anchors = [];
  for (let i = 0; i <= Math.ceil(length / step); i++) anchors.push(Math.random() * 2 - 1);
  anchors.push(anchors[0]);
  let peak = 1e-9;
  for (let i = 0; i < length; i++) {
    const phase = i / step;
    const base = Math.floor(phase);
    const frac = phase - base;
    const prev = anchors[base];
    const next = anchors[base + 1];
    const smooth = frac * frac * (3 - 2 * frac);
    const value = prev + (next - prev) * smooth;
    data[i] = value;
    peak = Math.max(peak, Math.abs(value));
  }
  for (let i = 0; i < length; i++) data[i] /= peak;
  return buffer;
}
function createCrackleBuffer(ctx, durationSec) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const addBurst = (index, amp, width) => {
    for (let i = 0; i < width; i++) {
      const pos = index + i;
      if (pos >= length) break;
      const x = i / Math.max(1, width - 1);
      const env = Math.exp(-8 * x);
      data[pos] += (Math.random() * 2 - 1) * amp * env;
    }
  };
  const dustCount = Math.floor(durationSec * 30);
  const clickCount = Math.floor(durationSec * 8);
  for (let i = 0; i < dustCount; i++) {
    addBurst(
      Math.floor(Math.random() * length),
      0.05 + Math.random() * 0.04,
      8 + Math.floor(Math.random() * 14)
    );
  }
  for (let i = 0; i < clickCount; i++) {
    addBurst(
      Math.floor(Math.random() * length),
      0.16 + Math.random() * 0.12,
      22 + Math.floor(Math.random() * 48)
    );
  }
  return buffer;
}
function createBurstNoiseBuffer(ctx, durationSec, eventRate, ampMin, ampMax, widthMin, widthMax) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const count = Math.floor(durationSec * eventRate);
  for (let i = 0; i < count; i++) {
    const start = Math.floor(Math.random() * length);
    const width = widthMin + Math.floor(Math.random() * Math.max(1, widthMax - widthMin + 1));
    const amp = ampMin + Math.random() * (ampMax - ampMin);
    for (let j = 0; j < width; j++) {
      const pos = start + j;
      if (pos >= length) break;
      const x = j / Math.max(1, width - 1);
      const env = Math.exp(-10 * x);
      data[pos] += (Math.random() * 2 - 1) * amp * env;
    }
  }
  return buffer;
}
function createMechanicalKnockBuffer(ctx, durationSec, level = 0.004) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const interval = Math.max(1, Math.floor(ctx.sampleRate * 1.8));
  for (let start = 0; start < length; start += interval) {
    const width = Math.min(Math.floor(ctx.sampleRate * 0.018), length - start);
    for (let i = 0; i < width; i++) {
      const pos = start + i;
      if (pos >= length) break;
      const x = i / Math.max(1, width - 1);
      const body = Math.sin(x * Math.PI) * Math.exp(-6 * x);
      data[pos] += (Math.random() * 2 - 1) * level * body;
    }
  }
  return buffer;
}
function buildToneTubeStage(ctx, inputNode, toneProfileKey, tubeEnabled) {
  const toneProfile = TONE_SIM_PROFILES[toneProfileKey] || TONE_SIM_PROFILES.default;
  if (toneProfileKey === "default" && !tubeEnabled) {
    return { output: inputNode, nodes: [] };
  }

  let current = inputNode;
  const nodes = [];

  if (tubeEnabled) {
    const tubeInput = ctx.createGain();
    tubeInput.gain.value = TUBE_SIM_PROFILE.drive;
    const tubeSaturator = ctx.createWaveShaper();
    tubeSaturator.curve = createTubeCurve(TUBE_SIM_PROFILE.drive, TUBE_SIM_PROFILE.asymmetry);
    tubeSaturator.oversample = "4x";
    const tubeLowpass = ctx.createBiquadFilter();
    tubeLowpass.type = "lowpass";
    tubeLowpass.frequency.value = TUBE_SIM_PROFILE.lowpassHz;
    tubeLowpass.Q.value = 0.4;
    const tubeTrim = ctx.createGain();
    tubeTrim.gain.value = TUBE_SIM_PROFILE.outputTrim;
    current.connect(tubeInput);
    tubeInput.connect(tubeSaturator);
    tubeSaturator.connect(tubeLowpass);
    tubeLowpass.connect(tubeTrim);
    current = tubeTrim;
    nodes.push(tubeInput, tubeSaturator, tubeLowpass, tubeTrim);
  }

  if (toneProfileKey !== "default") {
    const lowShelf = ctx.createBiquadFilter();
    lowShelf.type = "lowshelf";
    lowShelf.frequency.value = 160;
    lowShelf.gain.value = toneProfile.headBumpDb;

    const preEmphasis = ctx.createBiquadFilter();
    preEmphasis.type = "highshelf";
    preEmphasis.frequency.value = 4200;
    preEmphasis.gain.value = toneProfile.preEmphasisDb;

    const saturator = ctx.createWaveShaper();
    saturator.curve = createSoftSatCurve(toneProfile.driveMul);
    saturator.oversample = "4x";

    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -18 + toneProfile.compThresholdDb;
    glue.knee.value = 8;
    glue.ratio.value = 1.18 * toneProfile.compRatioMul;
    glue.attack.value = 0.004;
    glue.release.value = 0.11;

    const deEmphasis = ctx.createBiquadFilter();
    deEmphasis.type = "highshelf";
    deEmphasis.frequency.value = 5400;
    deEmphasis.gain.value = toneProfile.deEmphasisDb;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 18000 * toneProfile.bandwidthMul;
    lowpass.Q.value = 0.25;

    current.connect(lowShelf);
    lowShelf.connect(preEmphasis);
    preEmphasis.connect(saturator);
    saturator.connect(glue);
    glue.connect(deEmphasis);
    deEmphasis.connect(lowpass);
    current = lowpass;
    nodes.push(lowShelf, preEmphasis, saturator, glue, deEmphasis, lowpass);
  }

  return { output: current, nodes };
}
function buildTapeSimulation(ctx, inputNode, mode, deckProfileKey) {
  const profile = TAPE_SIM_PROFILES[mode];
  const transportProfile = TAPE_TRANSPORT_PROFILE;
  const deckProfile = DECK_SIM_PROFILES[deckProfileKey] || DECK_SIM_PROFILES.off;
  const bus = ctx.createGain();
  bus.gain.value = 0.96;

  const headBump = ctx.createBiquadFilter();
  headBump.type = "lowshelf";
  headBump.frequency.value = profile.headBumpHz;
  headBump.gain.value = profile.headBumpDb;

  const preEmphasis = ctx.createBiquadFilter();
  preEmphasis.type = "highshelf";
  preEmphasis.frequency.value = profile.preEmphasisHz;
  preEmphasis.gain.value = profile.preEmphasisDb;

  const saturator = ctx.createWaveShaper();
  saturator.curve = createSoftSatCurve(profile.drive);
  saturator.oversample = "4x";

  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = profile.compThreshold;
  glue.knee.value = 8;
  glue.ratio.value = profile.compRatio;
  glue.attack.value = 0.003;
  glue.release.value = 0.12;

  const deEmphasis = ctx.createBiquadFilter();
  deEmphasis.type = "highshelf";
  deEmphasis.frequency.value = profile.deEmphasisHz;
  deEmphasis.gain.value = profile.deEmphasisDb;

  const bandwidth = ctx.createBiquadFilter();
  bandwidth.type = "lowpass";
  bandwidth.frequency.value = Math.min(profile.bandwidthHz, deckProfile.playbackBandwidthHz);
  bandwidth.Q.value = 0.3;

  const transport = ctx.createDelay(0.03);
  transport.delayTime.value = transportProfile.baseDelayMs / 1000;

  const deckSplitter = ctx.createChannelSplitter(2);
  const deckMerger = ctx.createChannelMerger(2);
  const leftDirect = ctx.createGain();
  const rightDirect = ctx.createGain();
  const leftLeak = ctx.createGain();
  const rightLeak = ctx.createGain();
  leftDirect.gain.value = 1 - deckProfile.crosstalk;
  rightDirect.gain.value = 1 - deckProfile.crosstalk;
  leftLeak.gain.value = deckProfile.crosstalk;
  rightLeak.gain.value = deckProfile.crosstalk;

  inputNode.connect(headBump);
  headBump.connect(preEmphasis);
  preEmphasis.connect(saturator);
  saturator.connect(glue);
  glue.connect(deEmphasis);
  deEmphasis.connect(bandwidth);
  bandwidth.connect(transport);
  transport.connect(deckSplitter);
  deckSplitter.connect(leftDirect, 0);
  deckSplitter.connect(leftLeak, 0);
  deckSplitter.connect(rightLeak, 1);
  deckSplitter.connect(rightDirect, 1);
  leftDirect.connect(deckMerger, 0, 0);
  rightLeak.connect(deckMerger, 0, 0);
  rightDirect.connect(deckMerger, 0, 1);
  leftLeak.connect(deckMerger, 0, 1);
  deckMerger.connect(bus);

  const wowSource = ctx.createBufferSource();
  wowSource.buffer = createSmoothRandomBuffer(ctx, 11, deckProfile.wowStepSec);
  wowSource.loop = true;
  const wowDepth = ctx.createGain();
  wowDepth.gain.value = (transportProfile.wowDepthMs * deckProfile.wowMul) / 1000;
  wowSource.connect(wowDepth);
  wowDepth.connect(transport.delayTime);
  wowSource.start();

  const flutter = ctx.createOscillator();
  flutter.type = "sine";
  flutter.frequency.value = transportProfile.flutterHz;
  const flutterDepth = ctx.createGain();
  flutterDepth.gain.value = (transportProfile.flutterDepthMs * deckProfile.flutterMul) / 1000;
  flutter.connect(flutterDepth);
  flutterDepth.connect(transport.delayTime);
  flutter.start();

  const hissSource = ctx.createBufferSource();
  hissSource.buffer = createWhiteNoiseBuffer(ctx, 6);
  hissSource.loop = true;
  const hissHighpass = ctx.createBiquadFilter();
  hissHighpass.type = "highpass";
  hissHighpass.frequency.value = 3800;
  const hissLowpass = ctx.createBiquadFilter();
  hissLowpass.type = "lowpass";
  hissLowpass.frequency.value = 12000;
  const hissGain = ctx.createGain();
  hissGain.gain.value = profile.hissLevel * deckProfile.hissMul;
  hissSource.connect(hissHighpass);
  hissHighpass.connect(hissLowpass);
  hissLowpass.connect(hissGain);
  hissGain.connect(bus);
  hissSource.start();

  return {
    output: bus,
    auxSources: [wowSource, flutter, hissSource],
    nodes: [
      bus,
      headBump,
      preEmphasis,
      saturator,
      glue,
      deEmphasis,
      bandwidth,
      transport,
      deckSplitter,
      deckMerger,
      leftDirect,
      rightDirect,
      leftLeak,
      rightLeak,
      wowDepth,
      flutterDepth,
      hissHighpass,
      hissLowpass,
      hissGain,
    ],
  };
}
function buildVinylSimulation(ctx, inputNode, eraKey, crackleKey, currentProgress = 0, remainingDur = 30) {
  const profile = VINYL_SIM_PROFILE;
  const eraProfile = VINYL_ERA_PROFILES[eraKey] || VINYL_ERA_PROFILES.modern;
  const crackleProfile = VINYL_CRACKLE_PROFILES[crackleKey] || VINYL_CRACKLE_PROFILES.low;
  const bus = ctx.createGain();
  bus.gain.value = 0.95;

  const warp = ctx.createDelay(0.03);
  warp.delayTime.value = profile.warpBaseDelayMs / 1000;

  const bass = ctx.createBiquadFilter();
  bass.type = "lowshelf";
  bass.frequency.value = profile.bassHz;
  bass.gain.value = profile.bassDb;

  const wear = ctx.createBiquadFilter();
  wear.type = "highshelf";
  wear.frequency.value = eraProfile.wearHz || profile.wearHz;
  wear.gain.value = eraProfile.wearDb;

  const grooveWet = ctx.createGain();
  grooveWet.gain.value = eraProfile.grooveDrive * currentProgress;
  const grooveShape = ctx.createWaveShaper();
  grooveShape.curve = createTubeCurve(1.05, 0.04, 2048);
  grooveShape.oversample = "4x";
  const grooveTone = ctx.createBiquadFilter();
  grooveTone.type = "highshelf";
  grooveTone.frequency.value = 3200;
  grooveTone.gain.value = 1.2;
  const grooveDry = ctx.createGain();
  grooveDry.gain.value = 1.0;
  const grooveMix = ctx.createGain();

  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = profile.lowpassHz * eraProfile.lowpassMul;
  lowpass.Q.value = 0.4;

  const highpass = ctx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = profile.highpassHz;
  highpass.Q.value = 0.5;

  const stereoSplit = ctx.createChannelSplitter(2);
  const stereoMerge = ctx.createChannelMerger(2);
  const leftDirect = ctx.createGain();
  const rightDirect = ctx.createGain();
  const leftLeak = ctx.createGain();
  const rightLeak = ctx.createGain();
  leftDirect.gain.value = 1 - eraProfile.narrow;
  rightDirect.gain.value = 1 - eraProfile.narrow;
  leftLeak.gain.value = eraProfile.narrow;
  rightLeak.gain.value = eraProfile.narrow;

  inputNode.connect(warp);
  warp.connect(bass);
  bass.connect(wear);
  wear.connect(grooveDry);
  wear.connect(grooveWet);
  grooveWet.connect(grooveShape);
  grooveShape.connect(grooveTone);
  grooveDry.connect(grooveMix);
  grooveTone.connect(grooveMix);
  grooveMix.connect(lowpass);
  lowpass.connect(highpass);
  highpass.connect(stereoSplit);
  stereoSplit.connect(leftDirect, 0);
  stereoSplit.connect(leftLeak, 0);
  stereoSplit.connect(rightLeak, 1);
  stereoSplit.connect(rightDirect, 1);
  leftDirect.connect(stereoMerge, 0, 0);
  rightLeak.connect(stereoMerge, 0, 0);
  rightDirect.connect(stereoMerge, 0, 1);
  leftLeak.connect(stereoMerge, 0, 1);
  stereoMerge.connect(bus);

  if (remainingDur > 0.25) {
    grooveWet.gain.linearRampToValueAtTime(
      eraProfile.grooveDrive,
      ctx.currentTime + Math.max(0.25, remainingDur)
    );
  }

  const warpSource = ctx.createBufferSource();
  warpSource.buffer = createSmoothRandomBuffer(ctx, 13, profile.warpStepSec);
  warpSource.loop = true;
  const warpDepth = ctx.createGain();
  warpDepth.gain.value = profile.warpDepthMs / 1000;
  warpSource.connect(warpDepth);
  warpDepth.connect(warp.delayTime);
  warpSource.start();

  const eccentricity = ctx.createOscillator();
  eccentricity.type = "sine";
  eccentricity.frequency.value = profile.eccentricityHz;
  const eccentricityDepth = ctx.createGain();
  eccentricityDepth.gain.value = profile.eccentricityDepthMs / 1000;
  eccentricity.connect(eccentricityDepth);
  eccentricityDepth.connect(warp.delayTime);
  eccentricity.start();

  const surfaceSource = ctx.createBufferSource();
  surfaceSource.buffer = createWhiteNoiseBuffer(ctx, 7);
  surfaceSource.loop = true;
  const surfaceHighpass = ctx.createBiquadFilter();
  surfaceHighpass.type = "highpass";
  surfaceHighpass.frequency.value = 1800;
  const surfaceLowpass = ctx.createBiquadFilter();
  surfaceLowpass.type = "lowpass";
  surfaceLowpass.frequency.value = 9000;
  const surfaceGain = ctx.createGain();
  surfaceGain.gain.value = profile.surfaceLevel;
  surfaceSource.connect(surfaceHighpass);
  surfaceHighpass.connect(surfaceLowpass);
  surfaceLowpass.connect(surfaceGain);
  surfaceGain.connect(bus);
  surfaceSource.start();

  const dustSource = ctx.createBufferSource();
  dustSource.buffer = createBurstNoiseBuffer(ctx, 11, 26, 0.01, 0.035, 4, 10);
  dustSource.loop = true;
  const dustHighpass = ctx.createBiquadFilter();
  dustHighpass.type = "highpass";
  dustHighpass.frequency.value = 2600;
  const dustGain = ctx.createGain();
  dustGain.gain.value = 0.02 * crackleProfile.dust;
  dustSource.connect(dustHighpass);
  dustHighpass.connect(dustGain);
  dustGain.connect(bus);
  dustSource.start();

  const scratchSource = ctx.createBufferSource();
  scratchSource.buffer = createBurstNoiseBuffer(ctx, 13, 1.2, 0.05, 0.12, 120, 420);
  scratchSource.loop = true;
  const scratchBandpass = ctx.createBiquadFilter();
  scratchBandpass.type = "bandpass";
  scratchBandpass.frequency.value = 3200;
  scratchBandpass.Q.value = 0.7;
  const scratchGain = ctx.createGain();
  scratchGain.gain.value = 0.028 * crackleProfile.scratch;
  scratchSource.connect(scratchBandpass);
  scratchBandpass.connect(scratchGain);
  scratchGain.connect(bus);
  scratchSource.start();

  const crackleSource = ctx.createBufferSource();
  crackleSource.buffer = createCrackleBuffer(ctx, 11);
  crackleSource.loop = true;
  const crackleHighpass = ctx.createBiquadFilter();
  crackleHighpass.type = "highpass";
  crackleHighpass.frequency.value = 1600;
  const crackleGain = ctx.createGain();
  crackleGain.gain.value = profile.crackleLevel * crackleProfile.click;
  crackleSource.connect(crackleHighpass);
  crackleHighpass.connect(crackleGain);
  crackleGain.connect(bus);
  crackleSource.start();

  const rumbleSource = ctx.createBufferSource();
  rumbleSource.buffer = createWhiteNoiseBuffer(ctx, 8);
  rumbleSource.loop = true;
  const rumbleLowpass = ctx.createBiquadFilter();
  rumbleLowpass.type = "lowpass";
  rumbleLowpass.frequency.value = 80;
  const rumbleGain = ctx.createGain();
  rumbleGain.gain.value = profile.rumbleLevel;
  rumbleSource.connect(rumbleLowpass);
  rumbleLowpass.connect(rumbleGain);
  rumbleGain.connect(bus);
  rumbleSource.start();

  const humFundamental = ctx.createOscillator();
  humFundamental.type = "sine";
  humFundamental.frequency.value = 60;
  const humFirst = ctx.createOscillator();
  humFirst.type = "sine";
  humFirst.frequency.value = 120;
  const humGainA = ctx.createGain();
  const humGainB = ctx.createGain();
  humGainA.gain.value = eraProfile.humLevel;
  humGainB.gain.value = eraProfile.humLevel * 0.55;
  humFundamental.connect(humGainA);
  humFirst.connect(humGainB);
  humGainA.connect(bus);
  humGainB.connect(bus);
  humFundamental.start();
  humFirst.start();

  const knockSource = ctx.createBufferSource();
  knockSource.buffer = createMechanicalKnockBuffer(ctx, 12, eraProfile.knockLevel);
  knockSource.loop = true;
  const knockLowpass = ctx.createBiquadFilter();
  knockLowpass.type = "lowpass";
  knockLowpass.frequency.value = 180;
  const knockGain = ctx.createGain();
  knockGain.gain.value = 1.0;
  knockSource.connect(knockLowpass);
  knockLowpass.connect(knockGain);
  knockGain.connect(bus);
  knockSource.start();

  return {
    output: bus,
    auxSources: [
      warpSource,
      eccentricity,
      surfaceSource,
      dustSource,
      scratchSource,
      crackleSource,
      rumbleSource,
      humFundamental,
      humFirst,
      knockSource,
    ],
    nodes: [
      bus,
      warp,
      bass,
      wear,
      grooveWet,
      grooveShape,
      grooveTone,
      grooveDry,
      grooveMix,
      lowpass,
      highpass,
      stereoSplit,
      stereoMerge,
      leftDirect,
      rightDirect,
      leftLeak,
      rightLeak,
      warpDepth,
      eccentricityDepth,
      surfaceHighpass,
      surfaceLowpass,
      surfaceGain,
      dustHighpass,
      dustGain,
      scratchBandpass,
      scratchGain,
      crackleHighpass,
      crackleGain,
      rumbleLowpass,
      rumbleGain,
      humGainA,
      humGainB,
      knockLowpass,
      knockGain,
    ],
  };
}

// Format tag colors
const FMT_COLORS = {
  FLAC: { bg: "#2D6A4F", fg: "#fff" }, WAV: { bg: "#1B4965", fg: "#fff" }, AIFF: { bg: "#1B4965", fg: "#fff" },
  AIF: { bg: "#1B4965", fg: "#fff" }, MP3: { bg: "#E07A5F", fg: "#fff" }, AAC: { bg: "#D4859A", fg: "#fff" },
  OGG: { bg: "#7B6B8A", fg: "#fff" }, OPUS: { bg: "#7B6B8A", fg: "#fff" }, M4A: { bg: "#D4859A", fg: "#fff" },
  APE: { bg: "#3A5A40", fg: "#fff" }, WV: { bg: "#3A5A40", fg: "#fff" }, DSD: { bg: "#5C4033", fg: "#fff" },
};
function fmtColor(fmt) { return FMT_COLORS[fmt] || { bg: "var(--bg-deep)", fg: "var(--text-dim)" }; }

function detectSilence(ab) {
  const d = ab.getChannelData(0), sr = ab.sampleRate; let h = 0, tl = 0;
  for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > SILENCE_THRESHOLD) { h = i / sr; break; }
  for (let i = d.length - 1; i >= 0; i--) if (Math.abs(d[i]) > SILENCE_THRESHOLD) { tl = (d.length - 1 - i) / sr; break; }
  return { headSilence: Math.max(0, h), tailSilence: Math.max(0, tl) };
}
function getPeak(ab) { let p = 0; for (let c = 0; c < ab.numberOfChannels; c++) { const d = ab.getChannelData(c); for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > p) p = a; } } return p; }
function getRMS(ab) { let s = 0, n = 0; for (let c = 0; c < ab.numberOfChannels; c++) { const d = ab.getChannelData(c); for (let i = 0; i < d.length; i++) { s += d[i] * d[i]; n++; } } return Math.sqrt(s / n); }
function toDb(v) { return v > 0 ? 20 * Math.log10(v) : -Infinity; }
function readExtended80(dv, off) {
  const raw = dv.getUint16(off, false);
  if (raw === 0) return 0;
  const sign = (raw & 0x8000) !== 0 ? -1 : 1;
  const exp = (raw & 0x7FFF) - 16383;
  const hi = dv.getUint32(off + 2, false);
  const lo = dv.getUint32(off + 6, false);
  const mant = Number((BigInt(hi) << 32n) | BigInt(lo));
  return sign * mant * (2 ** (exp - 63));
}
function detectSourceAudioMeta(filename, buf) {
  const ext = (filename.match(/\.([^.]+)$/) || [])[1]?.toLowerCase();
  const meta = { sampleRate: null, channels: null, bitDepth: null };
  if (!buf || !(buf instanceof ArrayBuffer)) return meta;
  const dv = new DataView(buf);
  try {
    if ((ext === "wav" || ext === "wave") && buf.byteLength >= 44) {
      for (let off = 12; off + 8 <= buf.byteLength;) {
        const id = String.fromCharCode(dv.getUint8(off), dv.getUint8(off + 1), dv.getUint8(off + 2), dv.getUint8(off + 3));
        const size = dv.getUint32(off + 4, true);
        if (id === "fmt " && off + 8 + size <= buf.byteLength && size >= 16) {
          meta.channels = dv.getUint16(off + 10, true);
          meta.sampleRate = dv.getUint32(off + 12, true);
          meta.bitDepth = dv.getUint16(off + 22, true);
          return meta;
        }
        off += 8 + size + (size % 2);
      }
    }
    if ((ext === "aif" || ext === "aiff") && buf.byteLength >= 12) {
      for (let off = 12; off + 8 <= buf.byteLength;) {
        const id = String.fromCharCode(dv.getUint8(off), dv.getUint8(off + 1), dv.getUint8(off + 2), dv.getUint8(off + 3));
        const size = dv.getUint32(off + 4, false);
        if (id === "COMM" && off + 8 + size <= buf.byteLength && size >= 18) {
          meta.channels = dv.getUint16(off + 8, false);
          meta.bitDepth = dv.getUint16(off + 14, false);
          meta.sampleRate = Math.round(readExtended80(dv, off + 16));
          return meta;
        }
        off += 8 + size + (size % 2);
      }
    }
    if (ext === "flac" && buf.byteLength >= 42) {
      let off = 4;
      while (off + 4 <= buf.byteLength) {
        const header = dv.getUint8(off);
        const isLast = (header & 0x80) !== 0;
        const type = header & 0x7F;
        const size = (dv.getUint8(off + 1) << 16) | (dv.getUint8(off + 2) << 8) | dv.getUint8(off + 3);
        off += 4;
        if (type === 0 && off + size <= buf.byteLength && size >= 18) {
          const b10 = dv.getUint8(off + 10);
          const b11 = dv.getUint8(off + 11);
          const b12 = dv.getUint8(off + 12);
          const b13 = dv.getUint8(off + 13);
          meta.sampleRate = (b10 << 12) | (b11 << 4) | (b12 >> 4);
          meta.channels = ((b12 & 0x0E) >> 1) + 1;
          meta.bitDepth = (((b12 & 0x01) << 4) | (b13 >> 4)) + 1;
          return meta;
        }
        off += size;
        if (isLast) break;
      }
    }
  } catch { }
  return meta;
}
// Pre-downsample AudioBuffer to N min/max peak pairs per channel — O(samples) once at load
function downsamplePeaks(ab, N = 4096) {
  const result = [];
  for (let c = 0; c < Math.min(ab.numberOfChannels, 2); c++) {
    const data = ab.getChannelData(c);
    const step = Math.max(1, Math.floor(data.length / N));
    const peaks = new Float32Array(N * 2); // [min0,max0,min1,max1,...]
    for (let i = 0; i < N; i++) {
      const start = Math.floor(i * data.length / N);
      const end = Math.min(start + step, data.length);
      let mn = 0, mx = 0;
      for (let j = start; j < end; j++) { if (data[j] < mn) mn = data[j]; if (data[j] > mx) mx = data[j]; }
      peaks[i * 2] = mn; peaks[i * 2 + 1] = mx;
    }
    result.push(peaks);
  }
  return result;
}
function computeSpectrogramPreview(ab, frames = Math.max(96, Math.min(320, Math.round(ab.duration * 10))), bands = 80) {
  const sampleRate = ab.sampleRate;
  const maxHz = Math.min(22050, sampleRate / 2);
  const minHz = 40;
  const winSize = 1536;
  const half = Math.floor(winSize / 2);
  const data = ab.getChannelData(0);
  const len = data.length;
  const window = new Float32Array(winSize);
  for (let i = 0; i < winSize; i++) window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (winSize - 1)));
  const freqs = Array.from({ length: bands }, (_, i) => minHz * Math.pow(maxHz / minHz, i / Math.max(1, bands - 1)));
  const coeffs = freqs.map(f => 2 * Math.cos((2 * Math.PI * f) / sampleRate));
  const valuesDb = new Float32Array(frames * bands);
  for (let fi = 0; fi < frames; fi++) {
    const center = Math.floor((fi / Math.max(1, frames - 1)) * Math.max(0, len - 1));
    let start = Math.max(0, center - half);
    if (start + winSize > len) start = Math.max(0, len - winSize);
    for (let bi = 0; bi < bands; bi++) {
      const coeff = coeffs[bi];
      let s0 = 0, s1 = 0, s2 = 0;
      for (let n = 0; n < winSize; n++) {
        const sample = (data[start + n] || 0) * window[n];
        s0 = sample + coeff * s1 - s2;
        s2 = s1;
        s1 = s0;
      }
      const power = s1 * s1 + s2 * s2 - coeff * s1 * s2;
      const db = 10 * Math.log10(power / winSize + 1e-12);
      valuesDb[fi * bands + bi] = db;
    }
  }
  return { frames, bands, maxHz, valuesDb };
}
function fmtTime(s) { if (!s || s < 0) return "0:00"; return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`; }
function fmtTimeMs(s) { if (!s || s < 0) return "0:00.0"; return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`; }
let _id = 0; const uid = () => `t_${++_id}_${Date.now()}`;
const PROJECT_FILE_VERSION = "0.4";
const AUDIO_BUNDLE_KIND = "side-audio-bundle";
const AUDIO_BUNDLE_MAGIC = "SIDEPKG1";
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

async function sha256Hex(buffer) {
  const digest = await window.crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function buildAudioBundleBlob(manifest, fileEntries) {
  const magicBytes = TEXT_ENCODER.encode(AUDIO_BUNDLE_MAGIC);
  const manifestBytes = TEXT_ENCODER.encode(JSON.stringify(manifest));
  const header = new ArrayBuffer(magicBytes.length + 4);
  const headerBytes = new Uint8Array(header);
  headerBytes.set(magicBytes, 0);
  new DataView(header).setUint32(magicBytes.length, manifestBytes.length, true);
  return new Blob(
    [header, manifestBytes, ...fileEntries.map((entry) => entry.dataBuffer)],
    { type: "application/octet-stream" }
  );
}

function parseAudioBundleBuffer(buffer) {
  const magicBytes = TEXT_ENCODER.encode(AUDIO_BUNDLE_MAGIC);
  const minLength = magicBytes.length + 4;
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < minLength) throw new Error("Invalid bundle header");
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < magicBytes.length; i++) {
    if (bytes[i] !== magicBytes[i]) throw new Error("Invalid bundle header");
  }
  const manifestLength = new DataView(buffer).getUint32(magicBytes.length, true);
  const manifestStart = minLength;
  const manifestEnd = manifestStart + manifestLength;
  if (manifestLength <= 0 || manifestEnd > buffer.byteLength) throw new Error("Invalid bundle manifest");
  const manifest = JSON.parse(TEXT_DECODER.decode(bytes.subarray(manifestStart, manifestEnd)));
  return { manifest, payloadStart: manifestEnd };
}

const HeaderControls = React.memo(function HeaderControls({ lang, setLang, theme, setTheme, onOpenTools, T }) {
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  return (
    <>
      <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
        {Object.entries(LANGS).map(([k, l]) => (
          <button key={k} onClick={() => setLang(k)} style={{
            ...btnTab, fontSize: 12, padding: "5px 10px", minWidth: 36, textAlign: "center",
            background: lang === k ? "var(--accent)" : "var(--bg-card)", color: lang === k ? "var(--accent-contrast)" : "var(--text-dim)"
          }}>{l.label}</button>
        ))}
        <button onClick={onOpenTools} style={{ ...btnTab, fontSize: 12, padding: "5px 10px", background: "var(--bg-card)", color: "var(--text-dim)" }} title={T("tools")}>
          <IconTool size={16} />
        </button>
        <div style={{ position: "relative" }}>
          <button onClick={() => setShowThemePicker(p => !p)} style={{
            ...btnTab, fontSize: 12, padding: "5px 10px",
            background: showThemePicker ? "var(--accent)" : "var(--bg-card)",
            color: showThemePicker ? "var(--accent-contrast)" : "var(--text-dim)"
          }} title={T("theme")}>
            <IconPalette size={16} />
          </button>
          {showThemePicker && <div onClick={() => setShowThemePicker(false)} style={{ position: "fixed", inset: 0, zIndex: 50 }} />}
          {showThemePicker && <div style={{
            position: "absolute", right: 0, top: "100%", marginTop: 6, zIndex: 51,
            background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 6px",
            boxShadow: "0 8px 28px rgba(0,0,0,0.12)", width: "max-content", minWidth: 220, maxWidth: "min(320px, calc(100vw - 32px))", maxHeight: "70vh", overflowY: "auto"
          }}>
            {(() => {
              let lastGrp = "";
              return THEME_ORDER.map(k => {
                const t = THEMES[k];
                const sep = t.group && t.group !== lastGrp;
                lastGrp = t.group;
                return (<div key={k}>
                  {sep && <div style={{ borderTop: "1px solid var(--border)", margin: "4px 6px" }} />}
                  <button onClick={() => { setTheme(k); setShowThemePicker(false); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "6px 10px",
                      border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13,
                      background: theme === k ? "var(--accent-dim)" : "transparent",
                      color: theme === k ? "var(--accent-ink)" : "var(--text)"
                    }}>
                    <span style={{
                      width: 14, height: 14, borderRadius: "50%", background: t.accent, flexShrink: 0,
                      border: theme === k ? "2px solid var(--accent-ink)" : "2px solid transparent"
                    }} />
                    <span style={{ flex: 1, textAlign: "left", whiteSpace: "nowrap" }}>{themeName(k, lang)}</span>
                    {theme === k && <span style={{ fontSize: 10 }}>✓</span>}
                  </button>
                </div>);
              });
            })()}
          </div>}
        </div>
        <button onClick={() => setShowHelp(true)} style={{ ...btnTab, fontSize: 12, padding: "5px 10px", background: "var(--bg-card)", color: "var(--text-dim)" }} title={T("help")}>
          <IconHelp size={16} />
        </button>
        <button onClick={() => setShowAbout(true)} style={{ ...btnTab, fontSize: 12, padding: "5px 10px", background: "var(--bg-card)", color: "var(--text-dim)" }} title={T("about")}>
          <IconInfo size={16} />
        </button>
      </div>

      {showHelp && (
        <div
          onClick={() => setShowHelp(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "var(--bg)", borderRadius: 12, maxWidth: 560, width: "min(560px, calc(100vw - 32px))", maxHeight: "80vh", overflow: "hidden",
              border: "1px solid var(--border)", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", fontSize: 14, lineHeight: 1.8, color: "var(--text)", display: "flex", flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <span style={{ fontSize: 16, color: "var(--accent-ink)" }}>
                {lang === "ja" ? "S.I.D.E ヘルプ" : lang === "en" ? "S.I.D.E Help" : "S.I.D.E 帮助"}
              </span>
              <button onClick={() => setShowHelp(false)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-dim)" }}>✕</button>
            </div>

            <div className="modalScroll" style={{ padding: "18px 24px 22px", overflowY: "auto", overflowX: "hidden", minHeight: 0 }}>
              {lang === "zh-CN" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <p>
                    <b>S</b>equential <b>I</b>nterleaved <b>D</b>ubbing <b>E</b>ngine<br />
                    把数字音频文件编排到磁带 A/B 面，导出可直接送入卡座录制的 WAV 文件。<br />
                    <span style={{ color: "var(--text-dim)", fontSize: 12 }}>璃奈觉得，把音乐放进磁带这件事，是值得认真对待的。</span>
                  </p>
                  <div style={{ fontSize: 12, color: "var(--text-dim)", display: "flex", flexDirection: "column", gap: 10 }}>
                    <p><b>// 基本流程</b><br />
                      先确认当前选中的 SIDE，再添加文件。可以点「添加文件」，也可以直接把音频拖进来。<br />
                      支持格式：MP3 / FLAC / WAV / OGG / AAC / AIFF / M4A。<br />
                      FLAC 和 AIFF 会优先读取原始文件头的采样率和位深。只有在浏览器无法直接解码时，才会调用 ffmpeg.wasm 进行格式转换。<br />
                      顺序可以拖动调整。↑↓ 可以微调。→A / →B 可以把音轨移到另一面。</p>
                    <p><b>// 磁带规格</b><br />
                      选择磁带型号（C-46 / C-54 / C-60 / C-90 / C-120 / 自定义）和类型（Type I / II / IV）。<br />
                      磁带类型会影响响度归一化的目标电平。Type II 和 Type IV 可以录制更高的电平。这不是小事。</p>
                    <p><b>// 编排</b><br />
                      「自动分面」会按时长重新分配，让 A/B 两面的容量尽量接近。<br />
                      曲间间隔可以手动填写。开启「智能间隔检测」后，会自动扣除音轨首尾已有的静音，只计算实际需要的间隔长度。<br />
                      采样率和位深按每一面单独决定。音轨旁边会显示转换方向和目标值，请注意确认。<br />
                      Auto 采样率 = 该面音轨中最高的采样率。Auto 位深 = 有无损格式时为 24bit，否则 16bit。</p>
                    <p><b>// 预览</b><br />
                      按整面时间线播放。曲间间隔、归一化增益、尾部填充都会计算在内。<br />
                      进度条和音轨节点可以跳转。支持暂停、继续、上下曲。<br />
                      电平表有五种显示模式：VFD 峰值 / VU 表头 / FFT 频谱 / 波形 / 声谱图。</p>
                    <p><b>// 介质模拟</b><br />
                      这部分只作用于预览，不会影响导出的 WAV 文件。<br />
                      <b>模拟</b>：Type I / II / IV 磁带，或黑胶。模拟对应介质的频响特性。<br />
                      <b>卡座</b>：随身听 / 二磁头 / 三磁头。不同档次的 transport 特性不同。<br />
                      <b>音色</b>：中性 / 偏冷 / 偏暖。对整体频谱做倾向性调整。<br />
                      <b>管级</b>：加入轻微的电子管谐波着色和高频圆润感。<br />
                      <b>年代</b>（黑胶）：现代 / 经典 / 复古 / 重效果。控制磨损程度和频响衰减。<br />
                      <b>爆豆</b>（黑胶）：click/pop 噪声的密度。</p>
                    <p><b>// 导出</b><br />
                      导出为 WAV 文件。连接卡座线路输入，直接录制即可。<br />
                      需要降采样或位深转换的音轨，导出前会弹出确认提示。<br />
                      尾部填充：自动补足静音，使总时长对齐磁带标称容量。</p>
                    <p><b>// 歌单</b><br />
                      可以导出和导入 JSON 格式的歌单。导入后为占位模式。<br />
                      也可以导出和导入带音频文件的曲包。导入后会直接恢复完整曲目。<br />
                      重新添加校验一致的音频文件时，系统会识别为重复文件并提示。</p>
                    <p><b>// 波形 / 声谱图</b><br />
                      每一面下方可以切换显示静态波形或 FFT 声谱图。<br />
                      声谱图的纵轴是对数频率。颜色深浅对应电平强度。</p>
                    <p><b>// 工具</b><br />
                      点击头栏的工具按钮打开工具面板，里面有三个独立模块。<br />
                      <b>校准信号输出</b>：输出标准频率的正弦波，帮你调好卡座的录音电平和 BIAS。选好信号类型后点「开始输出」，看着卡座的电平表来调节。<br />
                      <b>卡座录制校准</b>：用扫频和 3150 Hz 测试音给卡座做一次体检——频响校准和走带诊断一次搞定。「校准这台卡座」模式是自录自放；「用校准带测其它机器」可以把录好的校准带拿去别的设备回放做对比。<br />
                      <b>播放器听感测量 & EQ 匹配</b>：两种方法测量播放器的频响——用测试信号（精度高）或曲目对比（方便）。测完之后，可以让系统算出 EQ 参数让设备 A 听起来像设备 B，也可以导出全分辨率补偿档案直接烧进音频里。</p>
                    <p><b>// 校准档案</b><br />
                      在主界面底部可以加载校准档案（从工具面板生成或导入）。<br />
                      <b>预览 EQ 补偿</b>：开启后预览会实时应用频响补偿。<br />
                      <b>预览清晰度补偿</b>：开启后预览会实时应用相位 / 瞬态补偿。<br />
                      <b>导出 EQ 补偿</b>：开启后导出的 WAV 文件会烧入补偿 EQ。<br />
                      <b>导出清晰度补偿</b>：开启后导出的 WAV 文件会烧入相位 / 瞬态补偿。</p>
                  </div>
                  <p style={{ fontSize: 11, color: "var(--text-dim)", textAlign: "right", marginTop: 4 }}>
                    ……把声音编译进磁带里。 {RINA_SMILE}<br />
                    <span style={{ fontSize: 10 }}>{T("appVersion")}</span>
                  </p>
                </div>

              ) : lang === "ja" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <p>
                    <b>S</b>equential <b>I</b>nterleaved <b>D</b>ubbing <b>E</b>ngine<br />
                    デジタル音源をカセットテープの A/B 面に配置して、デッキのライン入力に直結できる WAV ファイルを書き出すツール。<br />
                    <span style={{ color: "var(--text-dim)", fontSize: 12 }}>音楽をテープに記録することは、丁寧に扱う価値があると璃奈は思っています。</span>
                  </p>
                  <div style={{ fontSize: 12, color: "var(--text-dim)", display: "flex", flexDirection: "column", gap: 10 }}>
                    <p><b>// 基本的な使い方</b><br />
                      まず現在の SIDE を確認してから、ファイルを追加してください。「ファイル追加」ボタンを使うか、音声ファイルを直接ドラッグ＆ドロップできます。<br />
                      対応フォーマット：MP3 / FLAC / WAV / OGG / AAC / AIFF / M4A。<br />
                      FLAC と AIFF はまずファイルヘッダから元の SR とビット深度を読み取ります。ブラウザでデコードできない場合のみ、ffmpeg.wasm が呼ばれます。<br />
                      ドラッグで順番を変えられます。↑↓ で細かく調整。→A / →B で面を移動。</p>
                    <p><b>// テープ規格</b><br />
                      テープ長（C-46 / C-54 / C-60 / C-90 / C-120 / カスタム）と種類（Type I / II / IV）を選びます。<br />
                      テープ種類はラウドネス正規化のターゲットレベルに影響します。Type II と Type IV はより高い録音レベルが使えます。これは小さくない違いです。</p>
                    <p><b>// 配置</b><br />
                      「自動振り分け」は時間をもとに再配置して、A/B 面の使用率を揃えます。<br />
                      曲間ギャップは手動でも入力できます。スマートギャップ検出を有効にすると、先頭と末尾の無音を差し引いて適切な値を算出します。<br />
                      SR とビット深度は面ごとに決まります。各トラックに変換の方向と目標値が表示されるので、確認してください。<br />
                      Auto SR = 面内の最高 SR。Auto ビット深度 = ロスレスあり → 24bit、なし → 16bit。</p>
                    <p><b>// プレビュー</b><br />
                      面全体のタイムラインで再生されます。ギャップ・正規化ゲイン・末尾パディングも含まれます。<br />
                      シークバーとトラックノードでジャンプできます。一時停止・再開・前後スキップに対応しています。<br />
                      メーターは 5 モードで切り替えられます：VFD ピーク / VU ニードル / FFT スペクトラム / 波形 / スペクトログラム。</p>
                    <p><b>// 媒体シミュレーション</b><br />
                      プレビュー専用の処理です。書き出した WAV ファイルには影響しません。<br />
                      <b>モデリング</b>：Type I / II / IV テープ、またはレコード盤の周波数特性を再現します。<br />
                      <b>デッキ</b>：ポータブル機 / 2 ヘッド / 3 ヘッドのトランスポート特性を適用します。<br />
                      <b>音色</b>：中立 / クール / ウォーム。全体的な周波数の傾向を調整します。<br />
                      <b>真空管</b>：軽微な倍音の着色と、高域の柔らかさを加えます。<br />
                      <b>年代</b>（レコードモード）：現代 / 定番 / 旧式 / 効果。磨耗と帯域減衰の強度を選びます。<br />
                      <b>ポップ</b>（レコードモード）：クリック/ポップノイズの密度を設定します。</p>
                    <p><b>// 書き出し</b><br />
                      WAV ファイルとして書き出します。デッキのライン入力に繋いで、そのまま録音できます。<br />
                      ダウンサンプルやビット深度の変換が必要なトラックは、書き出し前に確認ダイアログが表示されます。<br />
                      末尾パディング：テープの標準長に合わせて無音を補填します。</p>
                    <p><b>// プレイリスト</b><br />
                      JSON 形式で書き出し・読み込みができます。読み込み後はプレースホルダモードです。<br />
                      音声ファイルを含む曲パックも書き出し・読み込みできます。読み込むと完全なトラック構成をそのまま復元します。<br />
                      同じ内容の音声ファイルを再追加すると、重複として検出して通知します。</p>
                    <p><b>// 波形 / スペクトログラム</b><br />
                      各面の下に静的波形または FFT スペクトログラムを切り替えて表示できます。<br />
                      スペクトログラムの縦軸は対数周波数スケールです。色の濃淡がレベルに対応しています。</p>
                    <p><b>// ツール</b><br />
                      ヘッダーのツールボタンからツールパネルを開けます。3 つのモジュールがあります。<br />
                      <b>校正信号出力</b>：標準周波数の正弦波を出力して、デッキの録音レベルと BIAS を調整します。信号の種類を選んで「出力開始」を押し、デッキのメーターを見ながら調整してください。<br />
                      <b>デッキ録音キャリブレーション</b>：スイープと 3150 Hz テストトーンで周波数応答と走行診断を同時に実行します。「このデッキを校正」は自己録再で校正ファイルを生成。「このテープで他機を測定」は校正テープを別のデバイスで再生して比較します。<br />
                      <b>プレイヤー聴感測定 & EQ マッチング</b>：テスト信号（高精度）または楽曲比較（手軽）の 2 方式で周波数応答を測定。EQ パラメータを自動算出して A を B に近づけたり、フル解像度の補正ファイルを音声に焼き込むこともできます。</p>
                    <p><b>// 校正ファイル</b><br />
                      メイン画面下部で校正ファイルを読み込めます（ツールパネルで生成・インポート）。<br />
                      <b>プレビュー EQ 補正</b>：有効にするとプレビュー時にリアルタイムで周波数補正が適用されます。<br />
                      <b>プレビュー 明瞭度補正</b>：有効にすると位相 / 瞬態補正が適用されます。<br />
                      <b>書出 EQ 補正</b>：有効にすると書き出した WAV に EQ 補正が焼き込まれます。<br />
                      <b>書出 明瞭度補正</b>：有効にすると書き出した WAV に位相 / 瞬態補正が焼き込まれます。</p>
                  </div>
                  <p style={{ fontSize: 11, color: "var(--text-dim)", textAlign: "right", marginTop: 4 }}>
                    ……音をテープにコンパイルする。 {RINA_SMILE}<br />
                    <span style={{ fontSize: 10 }}>{T("appVersion")}</span>
                  </p>
                </div>

              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <p>
                    <b>S</b>equential <b>I</b>nterleaved <b>D</b>ubbing <b>E</b>ngine<br />
                    Arrange digital audio files onto cassette tape sides A and B, then export WAV files ready for direct recording through a deck's line input.<br />
                    <span style={{ color: "var(--text-dim)", fontSize: 12 }}>Rina thinks that putting music onto tape is something worth doing carefully.</span>
                  </p>
                  <div style={{ fontSize: 12, color: "var(--text-dim)", display: "flex", flexDirection: "column", gap: 10 }}>
                    <p><b>// Getting started</b><br />
                      Confirm the active SIDE first, then add files. Use the "Add Files" button, or drag audio directly into the side.<br />
                      Supported formats: MP3 / FLAC / WAV / OGG / AAC / AIFF / M4A.<br />
                      For FLAC and AIFF, the original sample rate and bit depth are read from the file header first. ffmpeg.wasm is only called when the browser cannot decode the file natively.<br />
                      Drag to reorder. ↑↓ to nudge. →A / →B to move a track to the other side.</p>
                    <p><b>// Tape settings</b><br />
                      Choose a tape length (C-46 / C-54 / C-60 / C-90 / C-120 / Custom) and type (Type I / II / IV).<br />
                      Tape type sets the normalization target level. Type II and Type IV support higher recording levels. That is not a small difference.</p>
                    <p><b>// Arrangement</b><br />
                      "Auto Distribute" reallocates tracks by duration to keep A and B sides balanced.<br />
                      Track gaps can also be entered manually. With Smart Gap Detection enabled, existing head and tail silence is subtracted automatically, so only the silence that is actually needed gets added.<br />
                      Sample rate and bit depth are resolved per side. Each track shows the conversion direction and target value — please check these.<br />
                      Auto SR = highest SR on the side. Auto bit depth = 24-bit if any lossless source is present, 16-bit otherwise.</p>
                    <p><b>// Preview</b><br />
                      Plays the full side timeline. Gaps, normalization gain, and tail padding are all included.<br />
                      The seekbar and track markers can be used to jump to any point. Pause, resume, and previous/next track are supported.<br />
                      The meter has five modes: VFD peak / VU needle / FFT spectrum / Waveform / Spectrogram.</p>
                    <p><b>// Medium simulation</b><br />
                      This only affects preview. The exported WAV is not changed.<br />
                      <b>Simulation</b>: Type I / II / IV tape, or vinyl. Applies the frequency response of the chosen medium.<br />
                      <b>Deck</b>: Portable / 2-head / 3-head transport characteristics.<br />
                      <b>Tone</b>: Neutral / Cool / Warm. Adjusts the overall spectral tilt.<br />
                      <b>Tube</b>: Adds subtle harmonic coloring and softness in the high frequencies.<br />
                      <b>Era</b> (vinyl): Modern / Classic / Vintage / Effect. Controls wear and bandwidth roll-off.<br />
                      <b>Crackle</b> (vinyl): Sets the density of click and pop surface noise.</p>
                    <p><b>// Export</b><br />
                      Exports as a WAV file. Connect to the deck's line input and record directly.<br />
                      Tracks that require downsampling or bit-depth conversion will show a confirmation dialog before export.<br />
                      Tail fill: silence is padded to match the tape's rated length.</p>
                    <p><b>// Playlists</b><br />
                      Playlists can be exported and imported as JSON. An imported playlist starts in placeholder mode.<br />
                      You can also export and import a bundle that includes the audio files. Importing it restores the full track list immediately.<br />
                      Re-adding an audio file with the same checksum is treated as a duplicate and will be reported.</p>
                    <p><b>// Waveform / Spectrogram</b><br />
                      Each side can display a static waveform or an FFT spectrogram below the track list.<br />
                      The spectrogram's vertical axis is logarithmic frequency. Color intensity maps to level.</p>
                    <p><b>// Tools</b><br />
                      Open the tools panel from the header. There are three independent modules.<br />
                      <b>Calibration Signal Output</b>: Outputs a reference sine wave for adjusting your deck's recording level and bias. Pick a signal type, click Start, and adjust while watching the deck's meters.<br />
                      <b>Deck Recording Calibration</b>: Uses a sweep and 3150 Hz test tone to run response calibration and transport diagnostics together. "Calibrate This Deck" records and plays back on the same deck. "Test Other Devices With This Tape" plays the calibration tape on another device for comparison.<br />
                      <b>Player Response & EQ Matching</b>: Measures frequency response using a test signal (high precision) or song comparison (convenient). Then computes EQ to make device A sound like device B, or exports a full-resolution correction file to bake directly into audio.</p>
                    <p><b>// Calibration Profile</b><br />
                      Load a calibration profile at the bottom of the main screen (generated from the tools panel or imported).<br />
                      <b>Preview EQ Compensation</b>: When enabled, frequency correction is applied in real time during preview.<br />
                      <b>Preview Clarity Compensation</b>: When enabled, phase / transient correction is applied during preview.<br />
                      <b>Export EQ Compensation</b>: When enabled, the exported WAV has the EQ correction baked in.<br />
                      <b>Export Clarity Compensation</b>: When enabled, the exported WAV has the phase / transient correction baked in.</p>
                  </div>
                  <p style={{ fontSize: 11, color: "var(--text-dim)", textAlign: "right", marginTop: 4 }}>
                    …compile your sound into tape. {RINA_SMILE}<br />
                    <span style={{ fontSize: 10 }}>{T("appVersion")}</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showAbout && <div onClick={() => setShowAbout(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
        <div onClick={e => e.stopPropagation()} style={{
          background: "var(--bg)", borderRadius: 12, width: "fit-content", maxWidth: "calc(100vw - 32px)", maxHeight: "80vh", overflow: "hidden",
          border: "1px solid var(--border)", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", fontSize: 14, lineHeight: 1.9, color: "var(--text)", display: "flex", flexDirection: "column"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            <span style={{ fontSize: 16, color: "var(--accent-ink)" }}>{T("about")}</span>
            <button onClick={() => setShowAbout(false)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-dim)" }}>✕</button>
          </div>
          <div className="modalScroll" style={{ padding: "18px 24px 22px", overflowY: "auto", overflowX: "hidden", minHeight: 0 }}>
            <div>Sequential Interleaved Dubbing Engine</div>
            <div>Developed by 天使天才天王寺璃奈</div>
            <div>With Claude Opus 4.6 & GPT 5.4</div>
            <div>{APP_VERSION}</div>
            <a href={APP_GITHUB} target="_blank" rel="noreferrer" style={{ color: "var(--accent-ink)", textDecoration: "none" }}>
              {`Github: ${APP_GITHUB}`}
            </a>
          </div>
        </div>
      </div>}
    </>
  );
});

// ═══════════════════════════════════════════════════════════════
export default function CassetteTool() {
  const [lang, setLang] = useState("zh-CN");
  const [theme, setTheme] = useState("default");
  const th = THEMES[theme] || THEMES.default;
  const sideColors = useMemo(
    () => (th.sideA && th.sideB
      ? { sideA: th.sideA, sideB: th.sideB }
      : deriveSideColors(th.accent)),
    [th.sideA, th.sideB, th.accent]
  );
  const accentInk = useMemo(
    () => th.accentInk || deriveAccentInk(th.accent),
    [th.accentInk, th.accent]
  );
  const warningColor = useMemo(
    () => th.warning || deriveWarningColor(th.accent),
    [th.warning, th.accent]
  );
  const tapeTypeColors = useMemo(() => deriveTapeTypeColors(th.accent), [th.accent]);
  const accentContrast = useMemo(() => th.accentContrast || getContrastColor(th.accent), [th.accentContrast, th.accent]);
  const T = useCallback((k) => t(k, lang), [lang]);

  const [tapePreset, setTapePreset] = useState("C60");
  const [tapeType, setTapeType] = useState("TYPE_I");
  const [customMin, setCustomMin] = useState(30);
  const [tracks, setTracks] = useState([]);
  const [defaultGap, setDefaultGap] = useState(DEFAULT_GAP);
  const [fillTail, setFillTail] = useState(true);
  const [tailMargin, setTailMargin] = useState(2); // minutes
  const [smartGap, setSmartGap] = useState(true);
  const [normalizeMode, setNormalizeMode] = useState("off");
  const [targetDb, setTargetDb] = useState(-3.0);
  const [exportSr, setExportSr] = useState("auto"); // "auto" | 44100 | 48000
  const [exportBits, setExportBits] = useState("auto"); // "auto" | 16 | 24
  // Playback state
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [playingSide, setPlayingSide] = useState(null);
  const [playbackView, setPlaybackView] = useState({ token: 0, schedule: [], totalDur: 0 });
  const playingIdxRef = useRef(-1);
  const playPosRef = useRef(0);
  const displayIdxRef = useRef(-1);
  const displayPosRef = useRef(0);
  const displayDelayRef = useRef(0);
  const playRef = useRef({
    sources: [],
    sourceNodes: [],
    simGraphs: [],
    outputNodes: [],
    simCleanupTimers: [],
    startTime: 0,
    raf: null,
    ctx: null,
    schedule: [],
    totalDur: 0,
    stopping: false,
  });
  const stopPlaybackRef = useRef(null);
  const meterRef = useRef({ el: null, peakL: 0, peakR: 0, decayL: 0, decayR: 0 });
  const analyserRef = useRef({ L: null, R: null });
  const [meterMode, setMeterMode] = useState("vfd"); // vfd | vu | spectrum | waveform
  const [simMode, setSimMode] = useState("off"); // off | TAPE_I | TAPE_II | TAPE_IV | vinyl
  const [deckProfile, setDeckProfile] = useState("off"); // off | portable | deck_2 | deck_3
  const [toneProfile, setToneProfile] = useState("default"); // default | cool | warm
  const [tubeEnabled, setTubeEnabled] = useState(false);
  const [vinylEra, setVinylEra] = useState("classic"); // modern | classic | vintage | effect
  const [vinylCrackle, setVinylCrackle] = useState("low"); // off | low | high
  const [playerVolume, setPlayerVolume] = useState(1.0);
  const [processing, setProcessing] = useState(false);
  const [procMsg, setProcMsg] = useState("");
  const [expProg, setExpProg] = useState(null);
  const [dragOverSide, setDragOverSide] = useState(null);
  const [dragItem, setDragItem] = useState(null);
  const [activeTab, setActiveTab] = useState("A");
  const [sidePreviewMode, setSidePreviewMode] = useState("waveform");
  const [toast, setToast] = useState(null);
  const [ffmpegStatus, setFfmpegStatus] = useState("idle"); // idle | loading | ready | unavailable
  const [showTools, setShowTools] = useState(false);
  const [activeTool, setActiveTool] = useState("signal-output");
  const [loadedCalibrationProfile, setLoadedCalibrationProfile] = useState(null);
  const [loadedCalibrationProfileName, setLoadedCalibrationProfileName] = useState("");
  const [applyCalibrationEqPreview, setApplyCalibrationEqPreview] = useState(true);
  const [applyCalibrationEqExport, setApplyCalibrationEqExport] = useState(true);
  const [applyCalibrationClarityPreview, setApplyCalibrationClarityPreview] = useState(true);
  const [applyCalibrationClarityExport, setApplyCalibrationClarityExport] = useState(true);

  const acRef = useRef(null);
  const fileRef = useRef(null);
  const plRef = useRef(null);
  const bundleRef = useRef(null);
  const calibrationProfileRef = useRef(null);
  const correctionImpulseCacheRef = useRef(new Map());
  const trackOutputStatsCacheRef = useRef(new Map());
  const compensatedTrackStatsCacheRef = useRef(new Map());
  const compensatedTrackRenderCacheRef = useRef(new Map());

  const showToast = useCallback((m, d = 4000) => { setToast(m); setTimeout(() => setToast(null), d); }, []);

  const downloadBlob = useCallback((blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);
  const fillTemplate = useCallback((key, vars = {}) => {
    let message = T(key);
    Object.entries(vars).forEach(([name, value]) => {
      message = message.replace(`{${name}}`, String(value));
    });
    return message;
  }, [T]);
  const joinMessages = useCallback((messages) => messages.filter(Boolean).join(lang === "en" ? "; " : "；"), [lang]);
  const applyImportedConfig = useCallback((config = {}) => {
    if (config.tapePreset) setTapePreset(config.tapePreset);
    if (config.tapeType) {
      setTapeType(config.tapeType);
      setTargetDb(TAPE_TYPES[config.tapeType]?.peakDb ?? -3);
    }
    if (config.customMin != null) setCustomMin(config.customMin);
    if (config.defaultGap != null) setDefaultGap(config.defaultGap);
    if (config.fillTail != null) setFillTail(config.fillTail);
    if (config.tailMargin != null) setTailMargin(config.tailMargin);
    if (config.smartGap != null) setSmartGap(config.smartGap);
    if (config.normalizeMode) setNormalizeMode(config.normalizeMode);
    if (config.targetDb != null) setTargetDb(config.targetDb);
    if (config.exportSr) setExportSr(config.exportSr);
    if (config.exportBits) setExportBits(config.exportBits);
  }, []);
  const buildProjectConfig = useCallback(() => ({
    tapePreset,
    tapeType,
    customMin,
    defaultGap,
    fillTail,
    tailMargin,
    smartGap,
    normalizeMode,
    targetDb,
    exportSr,
    exportBits,
  }), [tapePreset, tapeType, customMin, defaultGap, fillTail, tailMargin, smartGap, normalizeMode, targetDb, exportSr, exportBits]);
  const serializeTrack = useCallback((track) => ({
    name: track.name,
    fileName: track.fileName,
    side: track.side,
    duration: track.duration,
    sampleRate: track.sampleRate,
    bitDepth: track.bitDepth,
    channels: track.channels,
    peakDb: track.peakDb,
    rmsDb: track.rmsDb,
    gapOverride: track.gapOverride,
    headSilence: track.headSilence,
    tailSilence: track.tailSilence,
    format: track.format || "?",
    fileChecksum: track.fileChecksum || null,
  }), []);

  const buildPreviewGains = useCallback((audioTracks) => {
    const gains = audioTracks.map(() => 1.0);
    if (normalizeMode === "peak") {
      const tl = Math.pow(10, targetDb / 20);
      audioTracks.forEach((t, i) => { gains[i] = t.peak > 0 ? tl / t.peak : 1.0; });
    } else if (normalizeMode === "rms") {
      const avg = audioTracks.reduce((s, t) => s + t.rms, 0) / audioTracks.length;
      audioTracks.forEach((t, i) => { gains[i] = t.rms > 0 ? avg / t.rms : 1.0; });
    }
    return gains;
  }, [normalizeMode, targetDb]);
  const getAC = useCallback(() => {
    if (!acRef.current) {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      acRef.current = new AudioContextCtor({ latencyHint: "interactive" });
    }
    return acRef.current;
  }, []);
  const openTools = useCallback(() => {
    setCalibrationSide(activeTab);
    setActiveTool("signal-output");
    setSignalOutputType("rec_level_balance");
    const ctx = getAC();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    setShowTools(true);
  }, [activeTab, getAC]);

  const createBufferLikeSlice = useCallback((audioBuffer, startSample, length) => {
    const safeStart = Math.max(0, Math.min(audioBuffer.length, Math.round(startSample)));
    const safeLength = Math.max(0, Math.min(Math.round(length), audioBuffer.length - safeStart));
    const channels = Array.from({ length: audioBuffer.numberOfChannels }, (_, channel) => {
      const src = audioBuffer.getChannelData(channel);
      return new Float32Array(src.slice(safeStart, safeStart + safeLength));
    });
    return {
      numberOfChannels: audioBuffer.numberOfChannels,
      sampleRate: audioBuffer.sampleRate,
      length: safeLength,
      getChannelData(channel) {
        return channels[channel] || channels[0];
      },
    };
  }, []);

  const scaleBufferLike = useCallback((bufferLike, gain) => {
    if (!Number.isFinite(gain) || Math.abs(gain - 1) < 1e-6) return bufferLike;
    const channels = Array.from({ length: bufferLike.numberOfChannels }, (_, channel) => {
      const src = bufferLike.getChannelData(channel);
      const out = new Float32Array(src.length);
      for (let i = 0; i < src.length; i++) out[i] = src[i] * gain;
      return out;
    });
    return {
      numberOfChannels: bufferLike.numberOfChannels,
      sampleRate: bufferLike.sampleRate,
      length: bufferLike.length,
      getChannelData(channel) {
        return channels[channel] || channels[0];
      },
    };
  }, []);

  const getCorrectionImpulse = useCallback((profile, sampleRate, inverse = false) => {
    if (!profile) return null;
    const baseSignature = profileSignature(profile);
    const key = `${baseSignature}|${sampleRate}|${inverse ? "inv" : "fwd"}`;
    const cache = correctionImpulseCacheRef.current;
    if (!cache.has(key)) {
      const targetProfile = inverse
        ? invertCalibrationProfile(profile, { type: "side.reference-preemphasis-profile", name: `${profile.name} Inverse` })
        : profile;
      cache.set(key, buildLinearPhaseImpulse(targetProfile, sampleRate));
    }
    return cache.get(key);
  }, []);

  const createImpulseAudioBuffer = useCallback((ctx, impulse) => {
    const buffer = ctx.createBuffer(2, impulse.length, ctx.sampleRate);
    buffer.copyToChannel(impulse.left, 0);
    buffer.copyToChannel(impulse.right, 1);
    return buffer;
  }, []);

  const renderTrackOutputWithProfile = useCallback(async (audioBuffer, sampleRate, profile) => {
    const impulse = profile ? getCorrectionImpulse(profile, sampleRate) : null;
    const renderLength = Math.ceil((audioBuffer.duration * sampleRate) + (impulse?.length || 0));
    const oc = new OfflineAudioContext(audioBuffer.numberOfChannels, renderLength, sampleRate);
    const src = oc.createBufferSource();
    src.buffer = audioBuffer;
    if (impulse) {
      const conv = oc.createConvolver();
      conv.normalize = false;
      conv.buffer = createImpulseAudioBuffer(oc, impulse);
      src.connect(conv);
      conv.connect(oc.destination);
    } else {
      src.connect(oc.destination);
    }
    src.start(0);
    const rendered = await oc.startRendering();
    return impulse ? createBufferLikeSlice(rendered, impulse.delaySamples, Math.ceil(audioBuffer.duration * sampleRate)) : rendered;
  }, [createBufferLikeSlice, createImpulseAudioBuffer, getCorrectionImpulse]);

  const renderBufferLikeWithProfile = useCallback(async (bufferLike, profile, inverse = false) => {
    if (!profile) return bufferLike;
    const impulse = getCorrectionImpulse(profile, bufferLike.sampleRate, inverse);
    if (!impulse) return bufferLike;
    const renderLength = bufferLike.length + impulse.length;
    const oc = new OfflineAudioContext(bufferLike.numberOfChannels, renderLength, bufferLike.sampleRate);
    const src = oc.createBufferSource();
    src.buffer = createAudioBufferFromBufferLike(oc, bufferLike);
    const conv = oc.createConvolver();
    conv.normalize = false;
    conv.buffer = createImpulseAudioBuffer(oc, impulse);
    src.connect(conv);
    conv.connect(oc.destination);
    src.start(0);
    const rendered = await oc.startRendering();
    return createBufferLikeSlice(rendered, impulse.delaySamples, bufferLike.length);
  }, [createAudioBufferFromBufferLike, createBufferLikeSlice, createImpulseAudioBuffer, getCorrectionImpulse]);

  const buildDynamicLevelProfiles = useCallback((profile) => {
    if (!profile || !hasDynamicCalibrationProfile(profile)) return [];
    const leftCurves = getProfileLevelCurves(profile, "L");
    const rightCurves = getProfileLevelCurves(profile, "R");
    return leftCurves.map((curve, index) => {
      const rightCurve = rightCurves[index] || rightCurves[rightCurves.length - 1] || curve;
      return {
        inputDb: curve.inputDb,
        profile: {
          ...profile,
          name: `${profile.name} @ ${curve.inputDb} dB`,
          channels: {
            L: {
              frequenciesHz: curve.frequenciesHz,
              correctionDb: curve.correctionDb,
              phaseRad: curve.phaseRad,
            },
            R: {
              frequenciesHz: rightCurve.frequenciesHz,
              correctionDb: rightCurve.correctionDb,
              phaseRad: rightCurve.phaseRad,
            },
          },
        },
      };
    });
  }, []);

  const buildDynamicWeightFrames = useCallback((bufferLike, levelProfiles, peakTargetDb) => {
    if (!levelProfiles.length) return null;
    const levelsDb = levelProfiles.map((entry) => entry.inputDb).sort((a, b) => a - b);
    const frameSize = 2048;
    const hopSize = 512;
    const frameCount = Math.max(1, Math.ceil(bufferLike.length / hopSize));
    const weights = levelsDb.map(() => new Float32Array(frameCount));
    const left = bufferLike.getChannelData(0);
    const right = bufferLike.getChannelData(Math.min(1, bufferLike.numberOfChannels - 1));
    const targetAmp = Math.max(1e-6, Math.pow(10, peakTargetDb / 20));

    for (let frame = 0; frame < frameCount; frame++) {
      const center = frame * hopSize;
      const start = Math.max(0, center - (frameSize >> 1));
      const end = Math.min(bufferLike.length, start + frameSize);
      let peak = 1e-6;
      for (let i = start; i < end; i++) {
        const absL = Math.abs(left[i] || 0);
        const absR = Math.abs(right[i] || 0);
        if (absL > peak) peak = absL;
        if (absR > peak) peak = absR;
      }
      const relDb = 20 * Math.log10(peak / targetAmp);
      if (relDb <= levelsDb[0]) {
        weights[0][frame] = 1;
        continue;
      }
      if (relDb >= levelsDb[levelsDb.length - 1]) {
        weights[levelsDb.length - 1][frame] = 1;
        continue;
      }
      for (let levelIndex = 0; levelIndex < levelsDb.length - 1; levelIndex++) {
        const lo = levelsDb[levelIndex];
        const hi = levelsDb[levelIndex + 1];
        if (relDb >= lo && relDb <= hi) {
          const t = (relDb - lo) / Math.max(1e-9, hi - lo);
          weights[levelIndex][frame] = 1 - t;
          weights[levelIndex + 1][frame] = t;
          break;
        }
      }
    }
    return { weights, hopSize, frameCount };
  }, []);

  const blendDynamicLevelRenders = useCallback((renderedLevels, weightFrames, length, sampleRate) => {
    if (!renderedLevels.length || !weightFrames) return renderedLevels[0] || null;
    const channels = Array.from({ length: renderedLevels[0].numberOfChannels }, (_, channel) => new Float32Array(length));
    for (let sample = 0; sample < length; sample++) {
      const framePos = sample / weightFrames.hopSize;
      const frameA = Math.max(0, Math.min(weightFrames.frameCount - 1, Math.floor(framePos)));
      const frameB = Math.max(0, Math.min(weightFrames.frameCount - 1, frameA + 1));
      const t = Math.max(0, Math.min(1, framePos - frameA));
      for (let levelIndex = 0; levelIndex < renderedLevels.length; levelIndex++) {
        const weightA = weightFrames.weights[levelIndex][frameA] || 0;
        const weightB = weightFrames.weights[levelIndex][frameB] || 0;
        const weight = weightA + (weightB - weightA) * t;
        if (weight <= 1e-6) continue;
        for (let channel = 0; channel < channels.length; channel++) {
          channels[channel][sample] += renderedLevels[levelIndex].getChannelData(channel)[sample] * weight;
        }
      }
    }
    return {
      numberOfChannels: channels.length,
      sampleRate,
      length,
      getChannelData(channel) {
        return channels[channel] || channels[0];
      },
    };
  }, []);

  const renderBufferLikeWithDynamicProfile = useCallback(async (bufferLike, profile, peakTargetDb) => {
    const levelProfiles = buildDynamicLevelProfiles(profile);
    if (!levelProfiles.length) return renderBufferLikeWithProfile(bufferLike, profile);
    const weightFrames = buildDynamicWeightFrames(bufferLike, levelProfiles, peakTargetDb);
    const renderedLevels = [];
    for (const entry of levelProfiles) {
      renderedLevels.push(await renderBufferLikeWithProfile(bufferLike, entry.profile));
    }
    return blendDynamicLevelRenders(renderedLevels, weightFrames, bufferLike.length, bufferLike.sampleRate);
  }, [blendDynamicLevelRenders, buildDynamicLevelProfiles, buildDynamicWeightFrames, renderBufferLikeWithProfile]);

  const renderBufferLikeWithCompensation = useCallback(async (bufferLike, profile, peakTargetDb) => {
    if (!profile) return bufferLike;
    return hasDynamicCalibrationProfile(profile)
      ? await renderBufferLikeWithDynamicProfile(bufferLike, profile, peakTargetDb)
      : await renderBufferLikeWithProfile(bufferLike, profile);
  }, [renderBufferLikeWithDynamicProfile, renderBufferLikeWithProfile]);

  const renderBufferLikeAtSampleRate = useCallback(async (bufferLike, sampleRate) => {
    if (!bufferLike || !sampleRate || bufferLike.sampleRate === sampleRate) return bufferLike;
    const renderLength = Math.ceil((bufferLike.length / bufferLike.sampleRate) * sampleRate);
    const oc = new OfflineAudioContext(bufferLike.numberOfChannels, renderLength, sampleRate);
    const src = oc.createBufferSource();
    src.buffer = createAudioBufferFromBufferLike(oc, bufferLike);
    src.connect(oc.destination);
    src.start(0);
    return await oc.startRendering();
  }, [createAudioBufferFromBufferLike]);

  const renderTrackCompensatedAtGain = useCallback(async (track, sampleRate, profile, inputGain, peakTargetDb) => {
    const source = Math.abs((inputGain ?? 1) - 1) > 1e-6
      ? scaleBufferLike(track.audioBuffer, inputGain)
      : track.audioBuffer;
    const resampledSource = await renderBufferLikeAtSampleRate(source, sampleRate);
    const rendered = await renderBufferLikeWithCompensation(resampledSource, profile, peakTargetDb);
    return {
      rendered,
      peak: getPeak(rendered),
      rms: getRMS(rendered),
    };
  }, [renderBufferLikeAtSampleRate, renderBufferLikeWithCompensation, scaleBufferLike]);

  const getTrackUnityCompensatedStats = useCallback(async (track, sampleRate, profile, peakTargetDb) => {
    const key = `${track.id}|${sampleRate}|${profileSignature(profile)}|${peakTargetDb}|unity`;
    const cache = compensatedTrackStatsCacheRef.current;
    if (!cache.has(key)) {
      cache.set(key, (async () => {
        const result = await renderTrackCompensatedAtGain(track, sampleRate, profile, 1, peakTargetDb);
        return { peak: result.peak, rms: result.rms };
      })());
    }
    return cache.get(key);
  }, [renderTrackCompensatedAtGain]);

  const solveTrackCompensatedRender = useCallback(async (
    track,
    sampleRate,
    profile,
    { targetPeakAmp = null, targetRms = null, peakTargetDb, ceilingAmp = 0.999 } = {}
  ) => {
    let inputGain = 1;
    let renderedState = await renderTrackCompensatedAtGain(track, sampleRate, profile, inputGain, peakTargetDb);

    const targetMetric = targetPeakAmp != null ? "peak" : (targetRms != null ? "rms" : null);
    const targetValue = targetMetric === "peak" ? targetPeakAmp : targetRms;

    if (targetMetric && Number.isFinite(targetValue) && targetValue > 0) {
      for (let pass = 0; pass < 4; pass++) {
        const currentValue = targetMetric === "peak" ? renderedState.peak : renderedState.rms;
        if (!(currentValue > 0)) break;
        const ratio = targetValue / currentValue;
        if (!Number.isFinite(ratio) || ratio <= 0) break;
        if (Math.abs(1 - ratio) <= 0.005) break;
        inputGain *= ratio;
        renderedState = await renderTrackCompensatedAtGain(track, sampleRate, profile, inputGain, peakTargetDb);
      }
    }

    if (Number.isFinite(ceilingAmp) && ceilingAmp > 0) {
      for (let pass = 0; pass < 3; pass++) {
        if (!(renderedState.peak > ceilingAmp * 1.0005)) break;
        const safetyRatio = ceilingAmp / renderedState.peak;
        if (!Number.isFinite(safetyRatio) || safetyRatio <= 0) break;
        inputGain *= safetyRatio;
        renderedState = await renderTrackCompensatedAtGain(track, sampleRate, profile, inputGain, peakTargetDb);
      }
    }

    return {
      trackId: track.id,
      inputGain,
      rendered: renderedState.rendered,
      peak: renderedState.peak,
      rms: renderedState.rms,
    };
  }, [renderTrackCompensatedAtGain]);

  const resolveCompensatedTrackRenders = useCallback(async (audioTracks, sampleRate, profile) => {
    if (!audioTracks.length) return [];
    const cacheKey = JSON.stringify({
      trackIds: audioTracks.map((track) => track.id),
      sampleRate,
      profile: profileSignature(profile),
      normalizeMode,
      targetDb,
    });
    const cache = compensatedTrackRenderCacheRef.current;
    if (!cache.has(cacheKey)) {
      cache.set(cacheKey, (async () => {
        const peakTargetAmp = Math.min(0.999, Math.pow(10, targetDb / 20));
        if (normalizeMode === "rms") {
          const unityStats = await Promise.all(
            audioTracks.map((track) => getTrackUnityCompensatedStats(track, sampleRate, profile, targetDb))
          );
          const avgRms = unityStats.reduce((sum, stat) => sum + stat.rms, 0) / unityStats.length;
          return await Promise.all(audioTracks.map((track) => solveTrackCompensatedRender(
            track,
            sampleRate,
            profile,
            { targetRms: avgRms, peakTargetDb: targetDb, ceilingAmp: 0.999 }
          )));
        }
        if (normalizeMode === "peak") {
          return await Promise.all(audioTracks.map((track) => solveTrackCompensatedRender(
            track,
            sampleRate,
            profile,
            { targetPeakAmp: peakTargetAmp, peakTargetDb: targetDb, ceilingAmp: 0.999 }
          )));
        }
        return await Promise.all(audioTracks.map((track) => solveTrackCompensatedRender(
          track,
          sampleRate,
          profile,
          { peakTargetDb: targetDb, ceilingAmp: 0.999 }
        )));
      })());
    }
    return cache.get(cacheKey);
  }, [getTrackUnityCompensatedStats, normalizeMode, solveTrackCompensatedRender, targetDb]);

  const getTrackOutputStats = useCallback(async (track, sampleRate, profile) => {
    if (!track?.audioBuffer) return { peak: 0, rms: 0 };
    if (!profile) return { peak: track.peak || 0, rms: track.rms || 0 };
    const key = `${track.id}|${sampleRate}|${profileSignature(profile)}`;
    const cache = trackOutputStatsCacheRef.current;
    if (!cache.has(key)) {
      cache.set(key, (async () => {
        const rendered = await renderTrackOutputWithProfile(track.audioBuffer, sampleRate, profile);
        return {
          peak: getPeak(rendered),
          rms: getRMS(rendered),
        };
      })());
    }
    return cache.get(key);
  }, [renderTrackOutputWithProfile]);

  const resolveNormalizedTrackGains = useCallback(async (audioTracks, sampleRate, profile) => {
    if (!audioTracks.length) return [];
    if (normalizeMode === "off") return audioTracks.map(() => 1);
    const stats = await Promise.all(audioTracks.map((track) => getTrackOutputStats(track, sampleRate, profile)));
    if (normalizeMode === "peak") {
      const targetAmp = Math.pow(10, targetDb / 20);
      return stats.map((stat) => stat.peak > 0 ? targetAmp / stat.peak : 1);
    }
    const avgRms = stats.reduce((sum, stat) => sum + stat.rms, 0) / stats.length;
    return stats.map((stat) => stat.rms > 0 ? avgRms / stat.rms : 1);
  }, [getTrackOutputStats, normalizeMode, targetDb]);

  const sideMin = tapePreset === "CUSTOM" ? customMin : TAPE_PRESETS[tapePreset].sideMinutes;
  const sideSec = sideMin * 60;
  const effectiveSec = Math.max(0, sideSec - tailMargin * 60);
  const playbackStructureKey = useMemo(() => JSON.stringify({
    defaultGap, smartGap, fillTail, sideSec,
    tracks: tracks.map(t => ({ id: t.id, side: t.side, gapOverride: t.gapOverride, hasAudio: !!t.audioBuffer }))
  }), [tracks, defaultGap, smartGap, fillTail, sideSec]);
  const activeDeckProfile = simMode.startsWith("TAPE_") ? deckProfile : "off";
  const activePreviewCalibrationProfile = useMemo(
    () => deriveCompensationProfile(loadedCalibrationProfile, {
      applyEq: applyCalibrationEqPreview,
      applyClarity: applyCalibrationClarityPreview,
    }),
    [loadedCalibrationProfile, applyCalibrationEqPreview, applyCalibrationClarityPreview],
  );
  const activeExportCalibrationProfile = useMemo(
    () => deriveCompensationProfile(loadedCalibrationProfile, {
      applyEq: applyCalibrationEqExport,
      applyClarity: applyCalibrationClarityExport,
    }),
    [loadedCalibrationProfile, applyCalibrationEqExport, applyCalibrationClarityExport],
  );

  const sideA = useMemo(() => tracks.filter(t => t.side === "A"), [tracks]);
  const sideB = useMemo(() => tracks.filter(t => t.side === "B"), [tracks]);

  // Resolve export sample rate: "auto" picks max SR from the side's tracks
  const resolveExportSr = useCallback((sideTracks) => {
    if (exportSr !== "auto") return exportSr;
    const maxSr = sideTracks.filter(t => t.audioBuffer).reduce((m, t) => Math.max(m, t.sampleRate), 44100);
    return maxSr;
  }, [exportSr]);

  const LOSSLESS_FMT = new Set(["FLAC", "WAV", "AIFF", "AIF", "APE", "WV", "DSD", "DSF", "DFF"]);
  // Resolve export bit depth: "auto" → 24 if any lossless source, else 16
  const resolveExportBits = useCallback((sideTracks) => {
    if (exportBits !== "auto") return exportBits;
    const hasLossless = sideTracks.some(t => LOSSLESS_FMT.has(t.format));
    return hasLossless ? 24 : 16;
  }, [exportBits]);


  // Compute effective gap for a track (considering smartGap)
  const getGap = useCallback((tr, nextTr) => {
    if (tr.gapOverride != null) return tr.gapOverride;
    if (!smartGap) return defaultGap;
    // Smart: target gap = defaultGap, subtract existing tail+head silence
    const existing = (tr.tailSilence || 0) + (nextTr?.headSilence || 0);
    return Math.max(0, defaultGap - existing);
  }, [defaultGap, smartGap]);

  const calcDur = useCallback((st) => {
    if (st.length === 0) return 0;
    let total = 0;
    st.forEach((tr, i) => {
      total += tr.duration;
      if (i < st.length - 1) total += getGap(tr, st[i + 1]);
    });
    return total;
  }, [getGap]);

  const durA = useMemo(() => calcDur(sideA), [sideA, calcDur]);
  const durB = useMemo(() => calcDur(sideB), [sideB, calcDur]);

  const decodeExternalAudioFile = useCallback(async (file, label = file.name, fileBuffer = null) => {
    setProcMsg(`${T("decoding")}: ${label}`);
    return decodeAudioFileToBufferLike(file, {
      fileBuffer,
      ffmpegStatus,
      setFfmpegStatus,
      setProcMsg,
    });
  }, [T, ffmpegStatus, setFfmpegStatus]);
  const buildLoadedTrack = useCallback(async ({
    file,
    side,
    displayName = file.name.replace(/\.[^.]+$/, ""),
    fileBuffer = null,
    sourceMeta = null,
    fileChecksum = null,
    gapOverride = null,
  }) => {
    const ctx = getAC();
    const decoded = await decodeExternalAudioFile(file, file.name, fileBuffer);
    const ab = createAudioBufferFromBufferLike(ctx, decoded);
    const sil = detectSilence(ab);
    const pk = getPeak(ab);
    const rms = getRMS(ab);
    const ext = (file.name.match(/\.([^.]+)$/) || [])[1]?.toUpperCase() || "?";
    const peaks = downsamplePeaks(ab, 4096);
    const spectrogram = computeSpectrogramPreview(ab);
    const resolvedMeta = sourceMeta || (fileBuffer ? detectSourceAudioMeta(file.name, fileBuffer) : null);
    return {
      id: uid(),
      name: displayName,
      fileName: file.name,
      side: side || "A",
      gapOverride,
      format: ext,
      audioBuffer: ab,
      duration: ab.duration,
      sampleRate: resolvedMeta?.sampleRate || ab.sampleRate,
      channels: resolvedMeta?.channels || ab.numberOfChannels,
      headSilence: sil.headSilence,
      tailSilence: sil.tailSilence,
      peakDb: toDb(pk),
      rmsDb: toDb(rms),
      peak: pk,
      rms,
      bitDepth: resolvedMeta?.bitDepth ?? null,
      peaks,
      spectrogram,
      fileChecksum,
      sourceFile: file,
      sourceMimeType: file.type || "",
    };
  }, [decodeExternalAudioFile, getAC]);

  // ── Tool hooks ────────────────────────────────────────────
  const {
    calibrationSide, setCalibrationSide,
    signalOutputType, setSignalOutputType,
    signalOutputRunning,
    resolveSignalOutput,
    startSignalOutput,
    stopSignalOutput,
    signalOutputRef,
  } = useSignalOutput({ getAC, stopPlaybackRef, tracks, buildPreviewGains, targetDb, showTools });

  const {
    deckCalProgramManifestName,
    deckCalRecordingKind,
    deckCalBrowserRecordingEnabled,
    deckCalCaptureName,
    responseAnalysis,
    transportAnalysis,
    deckCalRecordRef,
    loadDeckCalProgramManifestFile,
    clearDeckCalProgramManifest,
    exportTestTapeProgram,
    importDeckCalCaptureFile,
    startDeckCalRecording,
    stopDeckCalRecording,
    analyseDeckCalCapture,
    saveResponseProfile,
    saveDeckCalProgramManifest,
    multiCaptures,
    importMultiCaptureFiles,
    clearMultiCaptures,
    analyseMultiCaptures,
    standardTapePreset,
    setStandardTapePreset,
    analyseStandardTape,
    standardTapePresets,
  } = useDeckCalibration({ T, showToast, downloadBlob, encodeWAV, decodeExternalAudioFile, setProcessing, setProcMsg, showTools });

  const onLoadCalibrationProfile = useCallback((profile) => {
    setLoadedCalibrationProfile(profile);
    setLoadedCalibrationProfileName(profile.name);
    setApplyCalibrationEqPreview(true);
    setApplyCalibrationEqExport(true);
    setApplyCalibrationClarityPreview(true);
    setApplyCalibrationClarityExport(true);
    correctionImpulseCacheRef.current.clear();
  }, []);

  const {
    probeCaptureName,
    playerProbeProfile,
    exportPlayerProbe,
    importPlayerProbeCaptureFile,
    buildPlayerProbeProfile,
    savePlayerProbeProfile,
    songReferenceTracks,
    songRecordedTracks,
    songPairCount,
    songPairError,
    songPairingDetails,
    songPairPreview,
    songAnalysisFailedPairs,
    playerSongProfile,
    importSongFiles,
    buildPlayerSongProfile,
    savePlayerSongProfile,
    eqWorkbenchBaseProfileName,
    playerEqReadyProfile,
    useProbeAsEqBase,
    useSongAsEqBase,
    importEqBaseProfileFile,
    buildFixedEqWorkbenchProfile,
    saveEqReadyProfile,
    compilerProfileAName,
    compilerProfileBName,
    compilerTargetMode,
    compilerTargetCurve,
    setCompilerTargetCurve,
    playerEqCompileResult,
    compileLoadableProfile,
    importCompilerProfileFile,
    useEqReadyAsCompilerA,
    useProbeAsCompilerA,
    useSongAsCompilerA,
    useProbeAsCompilerB,
    useSongAsCompilerB,
    useEqReadyAsCompilerB,
    changeCompilerTargetMode,
    compilePlayerProfiles,
    loadCompileResultProfile,
    exportCompileLoadableProfile,
    exportCompileResultJson,
    exportCompileResultText,
    loadFullResProfile,
    exportFullResProfile,
  } = usePlayerProfile({ showToast, downloadBlob, encodeWAV, decodeExternalAudioFile, setProcessing, setProcMsg, onLoadCalibrationProfile });



  // ── File loading ─────────────────────────────────────────
  const loadFiles = useCallback(async (files, side) => {
    setProcessing(true);
    const nw = [];
    const hydratedIds = new Set(); // track which stubs got matched
    const duplicateNames = [];
    const loadedTracksByChecksum = new Map(
      tracks
        .filter((track) => track.audioBuffer && track.fileChecksum)
        .map((track) => [track.fileChecksum, track])
    );
    const existingChecksums = new Set(loadedTracksByChecksum.keys());
    const batchChecksums = new Set();
    const batchLoadedTracks = new Map();
    for (const f of files) {
      setProcMsg(`${T("decoding")}: ${f.name}`);
      let fileBuf = null;
      let sourceMeta = null;
      let importFile = f;
      let displayName = f.name.replace(/\.[^.]+$/, "");
      let checksum = null;
      try {
        if (isW1File(f.name)) {
          setProcMsg(`${T("w1Decrypting")}: ${f.name}`);
          const extracted = await extractW1Audio(f);
          importFile = extracted.file;
          fileBuf = extracted.audioBuffer;
          sourceMeta = detectSourceAudioMeta(importFile.name, fileBuf);
        } else {
          fileBuf = await f.arrayBuffer();
          sourceMeta = detectSourceAudioMeta(f.name, fileBuf);
        }
        checksum = await sha256Hex(fileBuf);
      } catch (err) {
        console.error(`Failed to decode ${f.name}:`, err);
        if (isW1File(f.name) && importFile === f) {
          showToast(`${T("w1DecryptFailed")}: ${f.name}`, 5000);
        }
        if (err.message?.includes("SharedArrayBuffer")) {
          showToast("SharedArrayBuffer unavailable — COOP/COEP headers missing. FLAC/AIFF decoding disabled.", 6000);
        }
      }
      if (!checksum) continue;
      // Check for stub match: same fileName, no audioBuffer, not already matched this batch
      const stubMatch = tracks.find((track) => !track.audioBuffer && !hydratedIds.has(track.id) &&
        (track.fileName === f.name || track.name === f.name.replace(/\.[^.]+$/, "")) &&
        (!track.fileChecksum || track.fileChecksum === checksum));
      const duplicateChecksum = existingChecksums.has(checksum) || batchChecksums.has(checksum);
      if (duplicateChecksum && !stubMatch) {
        duplicateNames.push(f.name);
        continue;
      }
      let loadedTrack = batchLoadedTracks.get(checksum) || loadedTracksByChecksum.get(checksum) || null;
      if (!loadedTrack) {
        try {
          loadedTrack = await buildLoadedTrack({
            file: importFile,
            side,
            displayName,
            fileBuffer: fileBuf,
            sourceMeta,
            fileChecksum: checksum,
          });
          batchChecksums.add(checksum);
          batchLoadedTracks.set(checksum, loadedTrack);
        } catch (err) {
          console.error(`Failed to decode ${f.name}:`, err);
          if (err.message?.includes("SharedArrayBuffer")) {
            showToast("SharedArrayBuffer unavailable — COOP/COEP headers missing. FLAC/AIFF decoding disabled.", 6000);
          }
          continue;
        }
      }
      if (stubMatch) {
        hydratedIds.add(stubMatch.id);
        setTracks((prev) => prev.map((track) => track.id === stubMatch.id
          ? {
            ...track,
            ...loadedTrack,
            id: track.id,
            name: track.name,
            fileName: track.fileName,
            side: track.side,
            gapOverride: track.gapOverride,
          }
          : track));
      } else {
        nw.push(loadedTrack);
      }
    }
    if (nw.length > 0) setTracks((prev) => [...prev, ...nw]);
    const matched = hydratedIds.size;
    const summary = [];
    if (matched > 0) summary.push(fillTemplate("stubsHydrated", { count: matched }));
    if (duplicateNames.length === 1) summary.push(fillTemplate("duplicateFileSkipped", { name: duplicateNames[0] }));
    else if (duplicateNames.length > 1) summary.push(fillTemplate("duplicateFilesSkipped", { count: duplicateNames.length }));
    if (summary.length > 0) showToast(joinMessages(summary), 5000);
    setProcessing(false); setProcMsg("");
  }, [T, buildLoadedTrack, fillTemplate, joinMessages, showToast, tracks]);

  const handleDrop = useCallback((e, side) => {
    e.preventDefault(); e.stopPropagation(); setDragOverSide(null);
    if (dragItem) { setTracks(p => p.map(t => t.id === dragItem ? { ...t, side } : t)); setDragItem(null); }
    else if (e.dataTransfer.files.length > 0) loadFiles(Array.from(e.dataTransfer.files), side);
  }, [dragItem, loadFiles]);

  const removeTrack = useCallback(id => setTracks(p => p.filter(t => t.id !== id)), []);
  const moveTrack = useCallback((id, dir) => {
    setTracks(p => {
      const i = p.findIndex(t => t.id === id); if (i === -1) return p;
      const tr = p[i], ss = p.filter(t => t.side === tr.side), si = ss.findIndex(t => t.id === id), sw = si + dir;
      if (sw < 0 || sw >= ss.length) return p;
      const r = [...p], ai = r.findIndex(t => t.id === id), bi = r.findIndex(t => t.id === ss[sw].id);
      [r[ai], r[bi]] = [r[bi], r[ai]]; return r;
    });
  }, []);
  const toggleSide = useCallback(id => setTracks(p => p.map(t => t.id === id ? { ...t, side: t.side === "A" ? "B" : "A" } : t)), []);
  const setTrackGap = useCallback((id, g) => setTracks(p => p.map(t => t.id === id ? { ...t, gapOverride: g } : t)), []);

  const autoDistribute = useCallback(() => {
    if (!tracks.length) return;
    const sorted = [...tracks].sort((a, b) => b.duration - a.duration);
    let sA = 0, sB = 0; const m = new Map();
    const eff = effectiveSec;
    for (const tr of sorted) {
      // Prefer the side that's still under effective capacity; if both under or both over, pick lighter
      const aUnder = sA < eff, bUnder = sB < eff;
      if (aUnder && !bUnder) { m.set(tr.id, "A"); sA += tr.duration; }
      else if (!aUnder && bUnder) { m.set(tr.id, "B"); sB += tr.duration; }
      else if (sA <= sB) { m.set(tr.id, "A"); sA += tr.duration; }
      else { m.set(tr.id, "B"); sB += tr.duration; }
    }
    setTracks(p => p.map(t => ({ ...t, side: m.get(t.id) || t.side })));
  }, [tracks, effectiveSec]);

  // ── Playlist I/O ─────────────────────────────────────────
  const exportPL = useCallback(() => {
    const pl = {
      version: PROJECT_FILE_VERSION,
      generator: "SIDE",
      config: buildProjectConfig(),
      tracks: tracks.map(serializeTrack),
    };
    const b = new Blob([JSON.stringify(pl, null, 2)], { type: "application/json" });
    const u = URL.createObjectURL(b), a = document.createElement("a");
    a.href = u; a.download = `SIDE_playlist_${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(u); showToast(T("playlistExported"));
  }, [buildProjectConfig, serializeTrack, tracks, T, showToast]);

  const importPL = useCallback(async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    try {
      const pl = JSON.parse(await f.text());
      if (pl.kind === AUDIO_BUNDLE_KIND || Array.isArray(pl.files)) throw new Error(T("playlistUseBundleImport"));
      if (!Array.isArray(pl.tracks)) throw new Error(T("playlistInvalid"));
      applyImportedConfig(pl.config || {});
      setTracks(pl.tracks.map((t) => ({
        id: uid(), name: t.name || "?", fileName: t.fileName || "", side: t.side || "A",
        duration: t.duration || 0, sampleRate: t.sampleRate || 44100, bitDepth: t.bitDepth ?? null, channels: t.channels || 2, audioBuffer: null,
        headSilence: t.headSilence || 0, tailSilence: t.tailSilence || 0,
        peakDb: t.peakDb ?? -Infinity, rmsDb: t.rmsDb ?? -Infinity,
        peak: t.peakDb != null ? Math.pow(10, t.peakDb / 20) : 0, rms: t.rmsDb != null ? Math.pow(10, t.rmsDb / 20) : 0,
        gapOverride: t.gapOverride ?? null, format: t.format || "?", fileChecksum: t.fileChecksum || null, sourceFile: null, sourceMimeType: ""
      })));
      showToast(T("playlistImportNoAudio"), 6000);
    } catch (err) { showToast(T("playlistImportError") + ": " + err.message); }
    e.target.value = "";
  }, [T, applyImportedConfig, showToast]);
  const exportBundle = useCallback(async () => {
    if (tracks.some((track) => !track.audioBuffer)) {
      showToast(T("bundleExportNeedsAudio"), 6000);
      return;
    }
    if (tracks.some((track) => !track.sourceFile || !track.fileChecksum)) {
      showToast(T("bundleExportMissingSource"), 6000);
      return;
    }
    setProcessing(true);
    setProcMsg(T("bundleExporting"));
    try {
      const fileEntries = [];
      let nextOffset = 0;
      for (const track of tracks) {
        if (fileEntries.some((entry) => entry.checksum === track.fileChecksum)) continue;
        const sourceBuffer = await track.sourceFile.arrayBuffer();
        fileEntries.push({
          checksum: track.fileChecksum,
          fileName: track.fileName || track.sourceFile.name,
          mimeType: track.sourceMimeType || track.sourceFile.type || "",
          offset: nextOffset,
          size: sourceBuffer.byteLength,
          dataBuffer: sourceBuffer,
        });
        nextOffset += sourceBuffer.byteLength;
      }
      const bundleManifest = {
        version: PROJECT_FILE_VERSION,
        generator: "SIDE",
        kind: AUDIO_BUNDLE_KIND,
        config: buildProjectConfig(),
        tracks: tracks.map(serializeTrack),
        files: fileEntries.map(({ dataBuffer, ...entry }) => entry),
      };
      downloadBlob(
        buildAudioBundleBlob(bundleManifest, fileEntries),
        `SIDE_bundle_${new Date().toISOString().slice(0, 10)}.sidepkg`
      );
      showToast(T("bundleExported"));
    } catch (err) {
      showToast(`${T("bundleExportError")}: ${err.message}`, 5000);
    } finally {
      setProcessing(false);
      setProcMsg("");
    }
  }, [T, buildProjectConfig, downloadBlob, serializeTrack, showToast, tracks]);
  const importBundle = useCallback(async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setProcessing(true);
    setProcMsg(T("bundleImporting"));
    try {
      const bundleBuffer = await f.arrayBuffer();
      const { manifest: bundle, payloadStart } = parseAudioBundleBuffer(bundleBuffer);
      if (bundle.kind !== AUDIO_BUNDLE_KIND || !Array.isArray(bundle.tracks) || !Array.isArray(bundle.files)) {
        throw new Error(T("bundleInvalid"));
      }
      const fileMap = new Map(bundle.files.map((entry) => [entry.checksum, entry]));
      const decodedByChecksum = new Map();
      const importedTracks = [];
      for (const trackMeta of bundle.tracks) {
        if (!trackMeta.fileChecksum) throw new Error(T("bundleTrackMissingFile"));
        if (!decodedByChecksum.has(trackMeta.fileChecksum)) {
          const fileEntry = fileMap.get(trackMeta.fileChecksum);
          if (!fileEntry) throw new Error(T("bundleTrackMissingFile"));
          const offset = Number(fileEntry.offset);
          const size = Number(fileEntry.size);
          if (!Number.isFinite(offset) || offset < 0 || !Number.isFinite(size) || size <= 0) throw new Error(T("bundleInvalid"));
          const start = payloadStart + offset;
          const end = start + size;
          if (end > bundleBuffer.byteLength) throw new Error(T("bundleInvalid"));
          const sourceBuffer = bundleBuffer.slice(start, end);
          const fileName = fileEntry.fileName || trackMeta.fileName || `${trackMeta.name || "track"}.bin`;
          const sourceFile = new File([sourceBuffer], fileName, { type: fileEntry.mimeType || "" });
          decodedByChecksum.set(trackMeta.fileChecksum, await buildLoadedTrack({
            file: sourceFile,
            side: trackMeta.side || "A",
            displayName: trackMeta.name || fileName.replace(/\.[^.]+$/, ""),
            fileBuffer: sourceBuffer,
            fileChecksum: trackMeta.fileChecksum,
            gapOverride: trackMeta.gapOverride ?? null,
          }));
        }
        const decoded = decodedByChecksum.get(trackMeta.fileChecksum);
        importedTracks.push({
          ...decoded,
          id: uid(),
          name: trackMeta.name || decoded.name,
          fileName: trackMeta.fileName || decoded.fileName,
          side: trackMeta.side || "A",
          gapOverride: trackMeta.gapOverride ?? null,
        });
      }
      applyImportedConfig(bundle.config || {});
      setTracks(importedTracks);
      showToast(T("bundleImported"), 6000);
    } catch (err) {
      showToast(`${T("bundleImportError")}: ${err.message}`, 5000);
    } finally {
      setProcessing(false);
      setProcMsg("");
      e.target.value = "";
    }
  }, [T, applyImportedConfig, buildLoadedTrack, showToast]);

  // ── Export Audio ──────────────────────────────────────────
  const expSide = useCallback(async (side) => {
    stopSignalOutput();
    const allSide = tracks.filter(t => t.side === side);
    const st = allSide.filter(t => t.audioBuffer);
    const stubCount = allSide.length - st.length;
    if (!st.length) return;
    if (stubCount > 0) {
      const ok = window.confirm(T("exportHasStubs"));
      if (!ok) return;
    }
    const sr = resolveExportSr(st);
    const bits = resolveExportBits(st);
    // Warn about downsampled tracks
    const downsampled = st.filter(t => t.sampleRate > sr);
    if (downsampled.length > 0) {
      const names = downsampled.map(t => `${t.name} (${t.sampleRate / 1000}kHz→${sr / 1000}kHz)`).join("\n");
      const ok = window.confirm(`${T("resampleWarn")}:\n${names}`);
      if (!ok) return;
    }
    const bitDepthChanged = st.filter(t => t.bitDepth != null && t.bitDepth !== bits);
    if (bitDepthChanged.length > 0) {
      const names = bitDepthChanged.map(t => `${t.name} (${t.bitDepth}bit→${bits}bit)`).join("\n");
      const ok = window.confirm(`${T("bitDepthWarn")}:\n${names}`);
      if (!ok) return;
    }
    setProcessing(true); setExpProg({ side, step: 0, total: st.length + 3 });
    try {
      const ch = 2;
      const exportProfile = activeExportCalibrationProfile;
      const renderedTracks = exportProfile ? await resolveCompensatedTrackRenders(st, sr, exportProfile) : null;
      const renderedByTrackId = renderedTracks ? new Map(renderedTracks.map((entry) => [entry.trackId, entry])) : null;
      const gains = renderedTracks ? st.map(() => 1) : await resolveNormalizedTrackGains(st, sr, exportProfile);
      let len = 0;
      st.forEach((tr, i) => { len += tr.duration * sr; if (i < st.length - 1) len += getGap(tr, st[i + 1]) * sr; });
      if (fillTail) len = Math.max(len, sideSec * sr);
      len = Math.ceil(len);
      const oc = new OfflineAudioContext(ch, len, sr); let cur = 0;
      const mixBus = oc.createGain();
      mixBus.gain.value = 1.0;
      mixBus.connect(oc.destination);
      for (let i = 0; i < st.length; i++) {
        setExpProg({ side, step: i + 1, total: st.length + 3 }); setProcMsg(`SIDE ${side}: [${i + 1}/${st.length}] ${st[i].name}`);
        const tr = st[i], src = oc.createBufferSource(), gn = oc.createGain();
        const renderedTrack = renderedByTrackId?.get(tr.id);
        src.buffer = renderedTrack ? createAudioBufferFromBufferLike(oc, renderedTrack.rendered) : tr.audioBuffer;
        gn.gain.value = gains[i]; src.connect(gn); gn.connect(mixBus);
        src.start(cur / sr); cur += Math.ceil(tr.duration * sr);
        if (i < st.length - 1) cur += Math.ceil(getGap(tr, st[i + 1]) * sr);
      }
      setProcMsg(`SIDE ${side}: ${T("rendering")}`); setExpProg({ side, step: st.length + 1, total: st.length + 3 });
      const baseMix = await oc.startRendering();
      let encodedBuffer = baseMix;
      if (exportProfile && !renderedTracks) {
        setProcMsg(`SIDE ${side}: 正在应用补偿……`);
        setExpProg({ side, step: st.length + 2, total: st.length + 3 });
        encodedBuffer = hasDynamicCalibrationProfile(exportProfile)
          ? await renderBufferLikeWithDynamicProfile(baseMix, exportProfile, targetDb)
          : await renderBufferLikeWithProfile(baseMix, exportProfile);
      }
      setProcMsg(`SIDE ${side}: ${T("encoding")}`); setExpProg({ side, step: st.length + 3, total: st.length + 3 });
      const blob = encodeWAV(encodedBuffer, bits), u = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = u; a.download = `SIDE_${side}_${sr}hz_${bits}bit.wav`; a.click(); URL.revokeObjectURL(u);
    } catch (e) { console.error(e); alert(`导出失败：${e.message}`); }
    setProcessing(false); setProcMsg(""); setExpProg(null);
  }, [tracks, defaultGap, fillTail, sideSec, getAC, T, getGap, resolveExportSr, resolveExportBits, stopSignalOutput, activeExportCalibrationProfile, resolveCompensatedTrackRenders, resolveNormalizedTrackGains, renderBufferLikeWithDynamicProfile, renderBufferLikeWithProfile, targetDb]);

  // ── Playback Engine ───────────────────────────────────────
  const playGenRef = useRef(0); // generation counter to prevent stale callbacks
  const appliedSimKeyRef = useRef(`${simMode}|${activeDeckProfile}|${toneProfile}|${tubeEnabled ? 1 : 0}|${vinylEra}|${vinylCrackle}`);
  const appliedPlaybackStructureRef = useRef(playbackStructureKey);
  const appliedCorrectionKeyRef = useRef(profileSignature(activePreviewCalibrationProfile));
  const getPlaybackCursor = useCallback((schedule, pos, contentDur, totalDur) => {
    if (!schedule.length) return -1;
    if (totalDur > contentDur && pos >= contentDur) return schedule.length;
    const current = [...schedule].reverse().find((seg) => pos >= seg.start);
    return current ? current.idx : schedule[0].idx;
  }, []);

  const getPlaybackDisplayDelay = useCallback((ctx) => {
    const baseLatency = Number.isFinite(ctx?.baseLatency) ? ctx.baseLatency : 0;
    const outputLatency = Number.isFinite(ctx?.outputLatency) ? ctx.outputLatency : 0;
    const mediumDelay = simMode.startsWith("TAPE_")
      ? TAPE_TRANSPORT_PROFILE.baseDelayMs / 1000
      : simMode === "vinyl"
        ? VINYL_SIM_PROFILE.warpBaseDelayMs / 1000
        : 0;
    const correctionDelay = 0;
    return Math.max(0, baseLatency + outputLatency + mediumDelay + correctionDelay);
  }, [simMode]);

  const stopAuxSources = useCallback((sources) => {
    sources.forEach((source) => {
      try { source.stop(); } catch { }
    });
  }, []);

  const disconnectNodes = useCallback((nodes) => {
    nodes.forEach((node) => {
      try { node.disconnect(); } catch { }
    });
  }, []);

  const SIM_SWITCH_FADE_SEC = 0.045;

  const clearSimCleanupTimers = useCallback((playback) => {
    (playback.simCleanupTimers || []).forEach((id) => window.clearTimeout(id));
    playback.simCleanupTimers = [];
  }, []);

  const disposePlaybackSimGraph = useCallback((graph) => {
    if (!graph) return;
    stopAuxSources(graph.auxSources || []);
    disconnectNodes(graph.nodes || []);
  }, [disconnectNodes, stopAuxSources]);

  const clearSimulationGraphs = useCallback((playback) => {
    clearSimCleanupTimers(playback);
    (playback.simGraphs || []).forEach((graph) => disposePlaybackSimGraph(graph));
    playback.simGraphs = [];
  }, [clearSimCleanupTimers, disposePlaybackSimGraph]);

  const clearPlaybackOutputChain = useCallback((playback) => {
    if (playback.masterGain) {
      try { playback.masterGain.disconnect(); } catch { }
    }
    disconnectNodes(playback.outputNodes || []);
    playback.outputNodes = [];
    playback.masterGain = null;
    playback.simOutput = null;
    playback.volumeGain = null;
    playback.splitter = null;
    playback.analyserL = null;
    playback.analyserR = null;
  }, [disconnectNodes]);

  const buildPlaybackOutputChain = useCallback((ctx) => {
    const simOutput = ctx.createGain();
    simOutput.gain.value = 1.0;

    const volumeGain = ctx.createGain();
    volumeGain.gain.value = playerVolume;
    simOutput.connect(volumeGain);
    volumeGain.connect(ctx.destination);

    const splitter = ctx.createChannelSplitter(2);
    volumeGain.connect(splitter);
    const analyserL = ctx.createAnalyser(); analyserL.fftSize = 8192; analyserL.smoothingTimeConstant = 0.18;
    const analyserR = ctx.createAnalyser(); analyserR.fftSize = 8192; analyserR.smoothingTimeConstant = 0.18;
    splitter.connect(analyserL, 0);
    splitter.connect(analyserR, 1);

    return {
      simOutput,
      volumeGain,
      splitter,
      analyserL,
      analyserR,
      outputNodes: [simOutput, volumeGain, splitter, analyserL, analyserR],
    };
  }, [playerVolume]);

  const buildPlaybackCorrectionGraph = useCallback((ctx, inputNode) => {
    if (!activePreviewCalibrationProfile) {
      return { output: inputNode, nodes: [] };
    }
    const impulse = getCorrectionImpulse(activePreviewCalibrationProfile, ctx.sampleRate);
    if (!impulse) return { output: inputNode, nodes: [] };
    const convolver = ctx.createConvolver();
    convolver.normalize = false;
    convolver.buffer = createImpulseAudioBuffer(ctx, impulse);
    inputNode.connect(convolver);

    // When simulation is active after correction, the correction's HF boost
    // can overdrive the saturation WaveShapers, creating sibilance artifacts.
    // Compensate: measure the correction's broadband energy gain and attenuate
    // so the simulation receives approximately the same total signal level.
    // This preserves the corrected frequency shape but prevents level-driven
    // clipping in downstream nonlinear processors.
    const ch = activePreviewCalibrationProfile.channels?.L;
    if (ch?.correctionDb?.length) {
      // RMS of correction curve = broadband energy change
      let sumSq = 0;
      for (const db of ch.correctionDb) sumSq += db * db;
      const rmsDb = Math.sqrt(sumSq / ch.correctionDb.length);
      // Average of positive corrections (net boost)
      let posSum = 0, posCount = 0;
      for (const db of ch.correctionDb) { if (db > 0) { posSum += db; posCount++; } }
      const avgBoostDb = posCount > 0 ? posSum / posCount : 0;
      // Compensate by half the average boost — enough to reduce WaveShaper
      // overdriving without making the signal noticeably quieter
      const compensateDb = Math.min(avgBoostDb * 0.5, 6);
      if (compensateDb > 0.3) {
        const compensate = ctx.createGain();
        compensate.gain.value = Math.pow(10, -compensateDb / 20);
        convolver.connect(compensate);
        return { output: compensate, nodes: [convolver, compensate] };
      }
    }

    return { output: convolver, nodes: [convolver] };
  }, [activePreviewCalibrationProfile, createImpulseAudioBuffer, getCorrectionImpulse]);

  const buildPlaybackSimulationGraph = useCallback((ctx, inputNode, simOutput, playPos, totalDur, initialGain = 1) => {
    let outputNode = inputNode;
    const nodes = [];
    const auxSources = [];

    const toneTubeStage = buildToneTubeStage(ctx, inputNode, toneProfile, tubeEnabled);
    outputNode = toneTubeStage.output;
    nodes.push(...toneTubeStage.nodes);

    if (simMode.startsWith("TAPE_")) {
      const sim = buildTapeSimulation(ctx, outputNode, simMode, activeDeckProfile);
      outputNode = sim.output;
      auxSources.push(...sim.auxSources);
      nodes.push(...sim.nodes);
    } else if (simMode === "vinyl") {
      const sim = buildVinylSimulation(
        ctx,
        outputNode,
        vinylEra,
        vinylCrackle,
        totalDur > 0 ? playPos / totalDur : 0,
        Math.max(0.25, totalDur - playPos)
      );
      outputNode = sim.output;
      auxSources.push(...sim.auxSources);
      nodes.push(...sim.nodes);
    }

    const outputGain = ctx.createGain();
    outputGain.gain.value = initialGain;
    outputNode.connect(outputGain);
    outputGain.connect(simOutput);
    nodes.push(outputGain);

    return { auxSources, nodes, outputGain };
  }, [simMode, activeDeckProfile, toneProfile, tubeEnabled, vinylEra, vinylCrackle]);

  const rebuildPlaybackSimulationGraph = useCallback(() => {
    const playback = playRef.current;
    if (!playback.ctx || !playback.masterGain || !playback.simOutput) return;
    clearSimCleanupTimers(playback);
    const playPos = Math.max(0, Math.min(playPosRef.current, playback.totalDur || 0));
    const nextGraph = buildPlaybackSimulationGraph(
      playback.ctx,
      playback.masterGain,
      playback.simOutput,
      playPos,
      playback.totalDur || 0,
      0.0001
    );
    const now = playback.ctx.currentTime;
    nextGraph.outputGain.gain.setValueAtTime(0.0001, now);
    nextGraph.outputGain.gain.linearRampToValueAtTime(1.0, now + SIM_SWITCH_FADE_SEC);

    const retiringGraphs = playback.simGraphs || [];
    retiringGraphs.forEach((graph) => {
      graph.outputGain?.gain.cancelScheduledValues(now);
      graph.outputGain?.gain.setValueAtTime(Math.max(0.0001, graph.outputGain.gain.value || 1), now);
      graph.outputGain?.gain.linearRampToValueAtTime(0.0001, now + SIM_SWITCH_FADE_SEC);
      const timer = window.setTimeout(() => {
        disposePlaybackSimGraph(graph);
        playback.simGraphs = (playback.simGraphs || []).filter((item) => item !== graph);
        playback.simCleanupTimers = (playback.simCleanupTimers || []).filter((id) => id !== timer);
      }, Math.ceil((SIM_SWITCH_FADE_SEC + 0.03) * 1000));
      playback.simCleanupTimers = [...(playback.simCleanupTimers || []), timer];
    });

    playback.simGraphs = [...retiringGraphs, nextGraph];
    displayDelayRef.current = getPlaybackDisplayDelay(playback.ctx);
  }, [buildPlaybackSimulationGraph, clearSimCleanupTimers, disposePlaybackSimGraph, getPlaybackDisplayDelay]);

  const stopPlayback = useCallback(() => {
    const cleanup = () => {
      playGenRef.current++;
      const p = playRef.current;
      p.stopping = false;
      p.sources.forEach(s => { s.onended = null; try { s.stop(); } catch (e) { } });
      disconnectNodes(p.sourceNodes || []);
      clearSimulationGraphs(p);
      clearPlaybackOutputChain(p);
      p.sources = [];
      p.sourceNodes = [];
      if (p.raf) cancelAnimationFrame(p.raf);
      p.raf = null; p.pausedAt = null;
      p.schedule = []; p.totalDur = 0;
      analyserRef.current = { L: null, R: null };
      setPlaybackView(v => ({ token: v.token + 1, schedule: [], totalDur: 0 }));
      setPlaying(false); setPaused(false); setPlayingSide(null);
      playingIdxRef.current = -1; playPosRef.current = 0;
      displayIdxRef.current = -1; displayPosRef.current = 0; displayDelayRef.current = 0;
    };

    const p = playRef.current;
    if (simMode === "vinyl" && p.ctx && p.volumeGain && p.sources.length && !p.stopping) {
      p.stopping = true;
      const now = p.ctx.currentTime;
      p.sources.forEach((src) => {
        try {
          src.playbackRate.cancelScheduledValues(now);
          src.playbackRate.setValueAtTime(Math.max(0.82, src.playbackRate.value || 1), now);
          src.playbackRate.exponentialRampToValueAtTime(0.72, now + 0.65);
        } catch { }
      });
      try {
        p.volumeGain.gain.cancelScheduledValues(now);
        p.volumeGain.gain.setValueAtTime(Math.max(0.0001, p.volumeGain.gain.value || 1), now);
        p.volumeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
      } catch { }
      window.setTimeout(cleanup, 680);
      return;
    }

    cleanup();
  }, [simMode, clearPlaybackOutputChain, clearSimulationGraphs, disconnectNodes]);

  useEffect(() => {
    stopPlaybackRef.current = stopPlayback;
  }, [stopPlayback]);

  const togglePause = useCallback(() => {
    const ctx = getAC();
    if (!playing) return;
    if (paused) {
      ctx.resume(); setPaused(false);
    } else {
      ctx.suspend(); setPaused(true);
    }
  }, [playing, paused, getAC]);

  // Build schedule from side tracks (reusable)
  const buildSchedule = useCallback((side) => {
    const st = tracks.filter(t => t.side === side && t.audioBuffer);
    const schedule = []; let offset = 0;
    st.forEach((tr, i) => {
      schedule.push({ id: tr.id, name: tr.name, start: offset, dur: tr.duration, idx: i, buffer: tr.audioBuffer });
      offset += tr.duration;
      if (i < st.length - 1) offset += getGap(tr, st[i + 1]);
    });
    // If tail fill enabled, extend to tape side length
    const dur = fillTail ? Math.max(offset, sideSec) : offset;
    return { schedule, totalDur: dur, contentDur: offset, trackCount: st.length };
  }, [tracks, getGap, fillTail, sideSec]);

  // Start playback from a given position (seconds)
  const playFromPos = useCallback(async (side, fromPos) => {
    stopSignalOutput();
    const p = playRef.current;
    p.sources.forEach(s => { s.onended = null; });
    p.sources.forEach(s => { try { s.stop(); } catch (e) { } });
    disconnectNodes(p.sourceNodes || []);
    clearSimulationGraphs(p);
    clearPlaybackOutputChain(p);
    p.sources = [];
    p.sourceNodes = [];
    if (p.raf) cancelAnimationFrame(p.raf);

    const gen = ++playGenRef.current;
    const ctx = getAC();
    // Resume if suspended (from pause)
    if (ctx.state === "suspended") ctx.resume();
    const { schedule, totalDur, contentDur } = buildSchedule(side);
    if (!schedule.length) { stopPlayback(); return; }
    const sideTracks = tracks.filter((track) => track.side === side && track.audioBuffer);
    const renderedTracks = activePreviewCalibrationProfile
      ? await resolveCompensatedTrackRenders(sideTracks, ctx.sampleRate, activePreviewCalibrationProfile)
      : null;
    const renderedByTrackId = renderedTracks
      ? new Map(renderedTracks.map((entry) => [entry.trackId, entry]))
      : null;
    const gains = renderedTracks
      ? sideTracks.map(() => 1)
      : await resolveNormalizedTrackGains(
        sideTracks,
        ctx.sampleRate,
        activePreviewCalibrationProfile
      );
    if (playGenRef.current !== gen) return;
    const gainByTrackId = new Map(sideTracks.map((track, index) => [track.id, gains[index] || 1]));
    const clampedPos = Math.max(0, Math.min(fromPos, totalDur));

    const masterGain = ctx.createGain(); masterGain.gain.value = 1.0;
    const outputChain = buildPlaybackOutputChain(ctx);
    const sourceNodes = [];
    const correctionGraph = renderedTracks ? { output: masterGain, nodes: [] } : buildPlaybackCorrectionGraph(ctx, masterGain);
    const simGraph = buildPlaybackSimulationGraph(ctx, correctionGraph.output, outputChain.simOutput, clampedPos, totalDur);

    const sources = [];
    const now = ctx.currentTime;

    schedule.forEach(s => {
      const trackEnd = s.start + s.dur;
      if (trackEnd <= clampedPos) return;
      const src = ctx.createBufferSource();
      const renderedTrack = renderedByTrackId?.get(s.id);
      src.buffer = renderedTrack ? createAudioBufferFromBufferLike(ctx, renderedTrack.rendered) : s.buffer;
      const gn = ctx.createGain(); gn.gain.value = gainByTrackId.get(s.id) || 1;
      src.connect(gn); gn.connect(masterGain);
      sourceNodes.push(gn, src);
      if (clampedPos > s.start) {
        const skipSec = clampedPos - s.start;
        src.start(now, skipSec, s.dur - skipSec);
      } else {
        src.start(now + (s.start - clampedPos));
      }
      sources.push(src);
    });

    const startTime = now - clampedPos;
    const currentIdx = getPlaybackCursor(schedule, clampedPos, contentDur, totalDur);
    const displayDelay = getPlaybackDisplayDelay(ctx);
    const currentDisplayPos = Math.max(0, Math.min(totalDur, clampedPos - displayDelay));
    const currentDisplayIdx = getPlaybackCursor(schedule, currentDisplayPos, contentDur, totalDur);
    analyserRef.current = { L: outputChain.analyserL, R: outputChain.analyserR };
    playRef.current = {
      ...playRef.current,
      sources,
      sourceNodes: [...sourceNodes, ...(correctionGraph.nodes || [])],
      simGraphs: [simGraph],
      outputNodes: outputChain.outputNodes,
      simCleanupTimers: [],
      startTime,
      raf: null,
      ctx,
      schedule,
      totalDur,
      contentDur,
      analyserL: outputChain.analyserL,
      analyserR: outputChain.analyserR,
      masterGain,
      simOutput: outputChain.simOutput,
      splitter: outputChain.splitter,
      volumeGain: outputChain.volumeGain,
    };
    setPlaybackView({ token: gen, schedule, totalDur, contentDur });
    setPlaying(true); setPlayingSide(side); setPaused(false);
    playingIdxRef.current = currentIdx; playPosRef.current = clampedPos;
    displayDelayRef.current = displayDelay;
    displayPosRef.current = currentDisplayPos;
    displayIdxRef.current = currentDisplayIdx;

    const tick = () => {
      if (playGenRef.current !== gen) return;
      const elapsed = ctx.currentTime - startTime;
      const nextPos = Math.max(0, Math.min(elapsed, totalDur));
      playPosRef.current = nextPos;
      playingIdxRef.current = getPlaybackCursor(schedule, nextPos, contentDur, totalDur);
      const nextDisplayPos = Math.max(0, Math.min(totalDur, nextPos - displayDelayRef.current));
      displayPosRef.current = nextDisplayPos;
      displayIdxRef.current = getPlaybackCursor(schedule, nextDisplayPos, contentDur, totalDur);
      if (nextPos >= totalDur) {
        stopPlayback();
        return;
      }
      playRef.current.raf = requestAnimationFrame(tick);
    };
    playRef.current.raf = requestAnimationFrame(tick);
  }, [getAC, buildPlaybackCorrectionGraph, buildPlaybackOutputChain, buildSchedule, getPlaybackCursor, buildPlaybackSimulationGraph, clearPlaybackOutputChain, clearSimulationGraphs, disconnectNodes, getPlaybackDisplayDelay, stopPlayback, stopSignalOutput, tracks, resolveCompensatedTrackRenders, resolveNormalizedTrackGains, activePreviewCalibrationProfile]);

  const playSide = useCallback((side) => {
    playFromPos(side, 0);
  }, [playFromPos]);

  const seekTo = useCallback((pos) => {
    if (!playingSide) return;
    playFromPos(playingSide, Math.max(0, pos));
  }, [playingSide, playFromPos]);

  const skipTrack = useCallback((dir) => {
    if (!playingSide) return;
    const schedule = playRef.current.schedule || [];
    const contentDur = playRef.current.contentDur || 0;
    const totalDur = playRef.current.totalDur || 0;
    if (!schedule.length) return;
    const curIdx = playingIdxRef.current;
    if (curIdx >= schedule.length) {
      if (dir < 0) {
        playFromPos(playingSide, schedule[schedule.length - 1].start);
      } else if (totalDur > contentDur) {
        playFromPos(playingSide, contentDur);
      }
      return;
    }
    const newIdx = Math.max(0, Math.min(schedule.length - 1, curIdx + dir));
    playFromPos(playingSide, schedule[newIdx]?.start || 0);
  }, [playingSide, playFromPos]);

  useEffect(() => {
    const appliedKey = `${simMode}|${activeDeckProfile}|${toneProfile}|${tubeEnabled ? 1 : 0}|${vinylEra}|${vinylCrackle}`;
    if (appliedSimKeyRef.current === appliedKey) return;
    appliedSimKeyRef.current = appliedKey;
    if (!playing || !playingSide) return;
    rebuildPlaybackSimulationGraph();
  }, [simMode, activeDeckProfile, toneProfile, tubeEnabled, vinylEra, vinylCrackle, playing, playingSide, rebuildPlaybackSimulationGraph]);

  useEffect(() => {
    const appliedKey = profileSignature(activePreviewCalibrationProfile);
    if (appliedCorrectionKeyRef.current === appliedKey) return;
    appliedCorrectionKeyRef.current = appliedKey;
    if (!playing || !playingSide) return;
    const wasPaused = paused;
    void (async () => {
      await playFromPos(playingSide, playPosRef.current);
      if (wasPaused) {
        const ctx = getAC();
        ctx.suspend();
        setPaused(true);
      }
    })();
  }, [activePreviewCalibrationProfile, getAC, paused, playFromPos, playing, playingSide]);

  useEffect(() => {
    if (!playing || !playingSide) return;
    const wasPaused = paused;
    void (async () => {
      await playFromPos(playingSide, playPosRef.current);
      if (wasPaused) {
        const ctx = getAC();
        ctx.suspend();
        setPaused(true);
      }
    })();
  }, [normalizeMode, targetDb, getAC, paused, playFromPos, playing, playingSide]);

  useEffect(() => {
    if (simMode.startsWith("TAPE_")) return;
    if (deckProfile !== "off") setDeckProfile("off");
  }, [simMode, deckProfile]);

  useEffect(() => {
    const p = playRef.current;
    if (!p.volumeGain) return;
    p.volumeGain.gain.cancelScheduledValues(p.ctx.currentTime);
    p.volumeGain.gain.setValueAtTime(playerVolume, p.ctx.currentTime);
  }, [playerVolume]);

  useEffect(() => {
    if (appliedPlaybackStructureRef.current === playbackStructureKey) return;
    appliedPlaybackStructureRef.current = playbackStructureKey;
    if (!playing || !playingSide) return;

    const schedule = playRef.current.schedule || [];
    if (!schedule.length) {
      stopPlayback();
      return;
    }

    const curIdx = playingIdxRef.current;
    const wasPaused = paused;

    if (curIdx >= schedule.length) {
      const prevContentDur = playRef.current.contentDur || 0;
      const blankOffset = Math.max(0, playPosRef.current - prevContentDur);
      const { contentDur, totalDur } = buildSchedule(playingSide);
      if (totalDur <= 0) {
        stopPlayback();
        return;
      }
      void (async () => {
        await playFromPos(playingSide, Math.min(totalDur, contentDur + blankOffset));
        if (wasPaused) {
          const ctx = getAC();
          ctx.suspend();
          setPaused(true);
        }
      })();
    } else {
      const currentSeg = schedule[curIdx];
      const currentTrack = tracks.find((track) => track.id === currentSeg.id && track.audioBuffer);
      if (!currentTrack) {
        stopPlayback();
        return;
      }

      const offsetInTrack = Math.max(0, Math.min(currentSeg.dur, playPosRef.current - currentSeg.start));
      const { schedule: nextSchedule } = buildSchedule(currentTrack.side);
      const nextSeg = nextSchedule.find((seg) => seg.id === currentTrack.id);
      if (!nextSeg) {
        stopPlayback();
        return;
      }
      void (async () => {
        await playFromPos(currentTrack.side, nextSeg.start + Math.min(offsetInTrack, nextSeg.dur));
        if (wasPaused) {
          const ctx = getAC();
          ctx.suspend();
          setPaused(true);
        }
      })();
      return;
    }
  }, [playbackStructureKey, playing, playingSide, paused, tracks, buildSchedule, playFromPos, stopPlayback, getAC]);

  // Cleanup on unmount only. Do not bind cleanup to sim-mode-dependent callback identity.
  useEffect(() => () => {
    stopSignalOutput();
    const active = deckCalRecordRef.current;
    try { if (active.recorder && active.recorder.state !== "inactive") active.recorder.stop(); } catch { }
    try { active.stream?.getTracks?.().forEach((track) => track.stop()); } catch { }
    stopPlaybackRef.current?.();
  }, [stopSignalOutput]);

  // ── Sub-components ───────────────────────────────────────
  const loadCalibrationProfileFile = useCallback(async (file) => {
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      const profile = normalizeCalibrationProfile(raw);
      setLoadedCalibrationProfile(profile);
      setLoadedCalibrationProfileName(file.name);
      setApplyCalibrationEqPreview(true);
      setApplyCalibrationEqExport(true);
      setApplyCalibrationClarityPreview(true);
      setApplyCalibrationClarityExport(true);
      showToast(T("calibrationProfileLoaded"));
    } catch (err) {
      showToast(`${T("calibrationProfileLoadFailed")}: ${err.message}`, 5000);
    }
  }, [T, showToast]);

  const clearCalibrationProfile = useCallback(() => {
    setLoadedCalibrationProfile(null);
    setLoadedCalibrationProfileName("");
    setApplyCalibrationEqPreview(false);
    setApplyCalibrationEqExport(false);
    setApplyCalibrationClarityPreview(false);
    setApplyCalibrationClarityExport(false);
    correctionImpulseCacheRef.current.clear();
    showToast(T("calibrationProfileCleared"));
  }, [T, showToast]);

  const renderCapBar = (used, total, eff, side) => {
    const hardOver = used > total, softOver = !hardOver && used > eff;
    const barBase = total;
    const pct = Math.min((used / barBase) * 100, 100);
    const effPct = (eff / barBase) * 100;
    const okPct = Math.min((Math.min(used, eff) / barBase) * 100, 100);
    const softPct = softOver ? Math.min(((used - eff) / barBase) * 100, 100 - okPct) : 0;
    const rem = eff - used;
    const barColor = hardOver ? "var(--danger)" : `var(--side-${side.toLowerCase()})`;
    const sideColor = `var(--side-${side.toLowerCase()})`;
    const statusColor = hardOver ? "var(--danger)" : softOver ? "var(--warning)" : "var(--text-dim)";
    const statusText = hardOver ? `${T("exceeded")} ${fmtTime(used - total)}` : softOver ? `⚠ +${fmtTime(used - eff)} (${T("remaining")} ${fmtTime(total - used)})` : `${T("remaining")} ${fmtTime(rem)}`;
    return (<div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4, color: "var(--text)" }}>
        <span>SIDE {side} — {fmtTime(used)} / {fmtTime(eff)}{tailMargin > 0 && <span style={{ opacity: 0.5 }}> (tape {fmtTime(total)})</span>}</span>
        <span style={{ color: statusColor }}>{statusText}</span>
      </div>
      <div style={{ height: 6, background: "var(--bg-deep)", borderRadius: 3, overflow: "hidden", position: "relative" }}>
        {softOver && !hardOver ? <>
          <div style={{ height: "100%", width: `${okPct}%`, background: sideColor, borderRadius: 3, transition: "width 0.3s,background 0.3s" }} />
          <div style={{ position: "absolute", left: `${okPct}%`, top: 0, bottom: 0, width: `${softPct}%`, background: "var(--warning)", transition: "left 0.3s,width 0.3s" }} />
        </> : <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: barColor, borderRadius: 3, transition: "width 0.3s,background 0.3s" }} />}
        {tailMargin > 0 && <div style={{ position: "absolute", left: `${effPct}%`, top: 0, bottom: 0, width: 1, background: "var(--warning)", opacity: 0.6 }} />}
      </div>
    </div>);
  };

  const renderTimeLine = (st, total, eff, side) => {
    if (!st.length) return <div style={{ height: 40, background: "var(--bg-deep)", borderRadius: 6, border: "1px solid var(--border)" }} />;
    const segs = []; let off = 0;
    st.forEach((tr, i) => {
      segs.push({ type: "t", track: tr, start: off, dur: tr.duration }); off += tr.duration;
      if (i < st.length - 1) { const g = getGap(tr, st[i + 1]); segs.push({ type: "g", start: off, dur: g }); off += g; }
    });
    const dt = Math.max(off, total);
    const softOver = off > eff;
    const hardOver = off > total;
    return (<div style={{ height: 40, position: "relative", background: "var(--bg-deep)", borderRadius: 6, overflow: "hidden", border: "1px solid var(--border)" }}>
      {segs.map((s, i) => {
        const l = (s.start / dt) * 100, w = (s.dur / dt) * 100;
        if (s.type === "g") return null;
        const hue = (i * 47 + 25) % 360;
        return <div key={s.track.id} title={`${s.track.name} (${fmtTime(s.dur)})`} style={{
          position: "absolute", left: `${l}%`, width: `${Math.max(w, 0.5)}%`, height: "100%",
          background: `hsla(${hue},45%,55%,0.7)`, borderRight: "1px solid var(--bg-deep)",
          display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
          fontSize: 9, color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.5)", padding: "0 2px", whiteSpace: "nowrap",
        }}>{w > 5 ? s.track.name : ""}</div>;
      })}
      {eff < total && <div style={{
        position: "absolute", left: `${(eff / dt) * 100}%`, top: 0, bottom: 0, width: 2,
        background: "var(--warning)", opacity: softOver ? 0.95 : 0.55, zIndex: 5
      }} />}
      {hardOver && <div style={{ position: "absolute", left: `${(total / dt) * 100}%`, top: 0, bottom: 0, width: 2, background: "var(--danger)", zIndex: 6 }} />}
    </div>);
  };

  const renderTrackRow = (tr, idx, st, targetSr, targetBits) => {
    const last = idx === st.length - 1;
    const first = idx === 0;
    const lvlPct = Math.min(100, Math.max(0, (tr.peakDb + 40) / 40 * 100));
    const lvlCol = tr.peakDb > -1 ? "var(--danger)" : tr.peakDb > -3 ? "var(--warning)" : "var(--accent)";
    const noA = !tr.audioBuffer;
    const effGap = last ? null : getGap(tr, st[idx + 1]);
    const fc = fmtColor(tr.format);
    const willResample = tr.audioBuffer && targetSr && tr.sampleRate !== targetSr;
    const srDir = willResample ? (tr.sampleRate > targetSr ? "↓" : "↑") : null;
    const willChangeBits = tr.audioBuffer && tr.bitDepth != null && targetBits && tr.bitDepth !== targetBits;
    const bitDir = willChangeBits ? (tr.bitDepth > targetBits ? "↓" : "↑") : null;
    return (<div key={tr.id} style={{ marginBottom: last ? 0 : 3 }}>
      <div draggable onDragStart={() => setDragItem(tr.id)} onDragEnd={() => setDragItem(null)}
        style={{
          display: "grid", gridTemplateColumns: "30px 1fr 70px 52px 32px 32px 42px 32px",
          alignItems: "center", gap: 5, padding: "8px 10px",
          background: dragItem === tr.id ? "var(--bg-hover)" : "var(--bg-card)", borderRadius: 5, fontSize: 14, cursor: "grab",
          border: `1px solid ${noA ? "var(--warning)" : "var(--border)"}`, opacity: noA ? 0.65 : 1, transition: "background 0.15s"
        }}>
        <span style={{ color: "var(--text-dim)", fontSize: 12, textAlign: "center" }}>{String(idx + 1).padStart(2, "0")}</span>
        <div style={{ overflow: "hidden" }}>
          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text)", display: "flex", alignItems: "center", gap: 5, fontSize: 14 }}>
            {tr.format && tr.format !== "?" && <span style={{ fontSize: 9, background: fc.bg, color: fc.fg, padding: "1px 5px", borderRadius: 3, flexShrink: 0, letterSpacing: "0.03em" }}>{tr.format}</span>}
            {noA && <span style={{ fontSize: 9, background: "var(--warning)", color: "#fff", padding: "1px 5px", borderRadius: 3, flexShrink: 0 }}>{T("stubLabel")}</span>}
            {tr.name}
          </div>
          <div style={{ fontSize: 11, color: "var(--text)", opacity: 0.65, display: "flex", gap: 8, marginTop: 3, alignItems: "center" }}>
            <span title={T("tipSampleRate")} style={willResample ? { color: srDir === "↓" ? "var(--warning)" : "var(--side-b)" } : {}}>{tr.sampleRate / 1000}kHz{willResample && <span style={{ fontSize: 9 }}> {srDir}{targetSr / 1000}k</span>}</span>
            <span title={T("tipBitDepth")} style={willChangeBits ? { color: bitDir === "↓" ? "var(--warning)" : "var(--side-b)" } : {}}>
              {tr.bitDepth != null ? `${tr.bitDepth}bit` : "—bit"}{willChangeBits && <span style={{ fontSize: 9 }}> {bitDir}{targetBits}bit</span>}
            </span>
            <span title={T("tipChannels")}>{tr.channels}ch</span>
            <span title={T("tipPeakLevel")} style={{ color: lvlCol }}>{tr.peakDb > -Infinity ? `${tr.peakDb.toFixed(1)}dB pk` : "—"}</span>
            {tr.headSilence > SILENCE_MIN_DUR && <span title={T("tipHeadSilence")} style={{ fontSize: 10 }}>head {tr.headSilence.toFixed(1)}s</span>}
            {tr.tailSilence > SILENCE_MIN_DUR && <span title={T("tipTailSilence")} style={{ fontSize: 10 }}>tail {tr.tailSilence.toFixed(1)}s</span>}
          </div>
        </div>
        <span style={{ fontSize: 13, color: "var(--text)", textAlign: "right" }}>{fmtTimeMs(tr.duration)}</span>
        <div style={{ height: 5, background: "var(--bg-deep)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${lvlPct}%`, background: lvlCol, borderRadius: 2 }} />
        </div>
        <button onClick={() => moveTrack(tr.id, -1)} disabled={first} style={btnSm} title={T("moveUp")}>↑</button>
        <button onClick={() => moveTrack(tr.id, 1)} disabled={last} style={btnSm} title={T("moveDown")}>↓</button>
        <button onClick={() => toggleSide(tr.id)} style={{ ...btnSm, color: "var(--accent)" }} title={`${T("moveToSide")} ${tr.side === "A" ? "B" : "A"}`}>{tr.side === "A" ? "→B" : "→A"}</button>
        <button onClick={() => removeTrack(tr.id)} style={{ ...btnSm, color: "var(--danger)" }} title={T("deleteTrack")}>✕</button>
      </div>
      {!last && effGap != null && (<div style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 10px 3px 40px", fontSize: 12, color: "var(--text)", opacity: 0.75 }}>
        <span style={{ opacity: 0.4 }}>┄</span><span>{T("gap")}</span>
        <input type="number" value={tr.gapOverride != null ? tr.gapOverride : Number(effGap.toFixed(1))}
          onChange={e => setTrackGap(tr.id, e.target.value === "" ? null : parseFloat(e.target.value))}
          step="0.5" min="0" max="30" style={{ ...inpSm, width: 72 }} />
        <span>s</span>
        {smartGap && tr.gapOverride == null && <span style={{ fontSize: 11, color: "var(--text)", opacity: 0.5 }}>auto</span>}
        {tr.gapOverride != null && <button onClick={() => setTrackGap(tr.id, null)} style={{ ...btnSm, fontSize: 11, padding: "2px 6px", color: "var(--text)" }}>{T("resetGap")}</button>}
      </div>)}
    </div>);
  };

  const renderSidePanel = (side, st, dur) => {
    const active = activeTab === side;
    const audioTracks = st.filter(t => t.audioBuffer);
    const tSr = resolveExportSr(audioTracks);
    const tBits = resolveExportBits(audioTracks);
    const gains = buildPreviewGains(audioTracks);
    const wfSegments = audioTracks.map((t, i) => ({
      id: t.id,
      dur: t.duration,
      gain: gains[i],
      gap: i < audioTracks.length - 1 ? getGap(t, audioTracks[i + 1]) : 0,
      peaks: t.peaks || [],
      channels: t.channels,
    }));
    const specSegments = audioTracks.map((t, i) => ({
      id: t.id,
      dur: t.duration,
      gain: gains[i],
      gap: i < audioTracks.length - 1 ? getGap(t, audioTracks[i + 1]) : 0,
      spectrogram: t.spectrogram || null,
    }));
    return (<div onDragOver={e => { e.preventDefault(); setDragOverSide(side); }} onDragLeave={() => setDragOverSide(null)} onDrop={e => handleDrop(e, side)}
      style={{
        flex: 1, display: active ? "flex" : "none", flexDirection: "column", gap: 8, minHeight: 200,
        border: dragOverSide === side ? `2px dashed var(--side-${side.toLowerCase()})` : "2px solid transparent", transition: "border-color 0.2s"
      }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ flex: 1 }}>{renderCapBar(dur, sideSec, effectiveSec, side)}</div>
        {audioTracks.length > 0 && <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 12 }}>
          <span style={{ fontSize: 11, color: "var(--text-dim)" }}>→ {tSr / 1000}kHz / {tBits}bit</span>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => setSidePreviewMode("waveform")} style={segBtn(sidePreviewMode === "waveform")}>{T("previewWave")}</button>
            <button onClick={() => setSidePreviewMode("spectrogram")} style={segBtn(sidePreviewMode === "spectrogram")}>{T("previewSpectrogram")}</button>
          </div>
        </div>}
      </div>
      {renderTimeLine(st, sideSec, effectiveSec, side)}
      {(wfSegments.length > 0 || specSegments.length > 0) && (
        <div style={{ position: "relative", height: 128 }}>
          <div style={{
            position: "absolute", inset: 0,
            opacity: sidePreviewMode === "waveform" ? 1 : 0,
            pointerEvents: sidePreviewMode === "waveform" ? "auto" : "none"
          }}>
            <SideWaveform segments={wfSegments} />
          </div>
          <div style={{
            position: "absolute", inset: 0,
            opacity: sidePreviewMode === "spectrogram" ? 1 : 0,
            pointerEvents: sidePreviewMode === "spectrogram" ? "auto" : "none"
          }}>
            <SideSpectrogram segments={specSegments} />
          </div>
        </div>
      )}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 0 }}>
        {st.length === 0 ? (
          <div style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            border: "1px dashed var(--border)", borderRadius: 6, minHeight: 120,
            color: "var(--text-dim)", fontSize: 13, flexDirection: "column", gap: 6
          }}>
            <span style={{ fontSize: 24, opacity: 0.3 }}>📼</span>
            <span>{T("dropHere")}</span>
            <span style={{ fontSize: 10, opacity: 0.6 }}>{T("dropHint")}</span>
          </div>
        ) : st.map((tr, i) => renderTrackRow(tr, i, st, tSr, tBits))}
      </div>
    </div>);
  };

  const aHas = sideA.some(t => t.audioBuffer), bHas = sideB.some(t => t.audioBuffer);
  const signalOutput = resolveSignalOutput(signalOutputType, calibrationSide);
  const activePlugin = TOOL_PLUGINS.find((plugin) => plugin.id === activeTool);
  const ActiveToolPluginComponent = activePlugin?.Component;
  const getPluginTitle = useCallback((plugin) => plugin.title?.[lang] || (plugin.titleKey ? T(plugin.titleKey) : plugin.id), [T, lang]);
  const getPluginDesc = useCallback((plugin) => plugin.desc?.[lang] || (plugin.descKey ? T(plugin.descKey) : ""), [T, lang]);

  return (
    <div style={{
      "--bg": th.bg, "--bg-card": th.bgCard, "--bg-deep": th.bgDeep, "--bg-hover": th.bgHover || "#F0EDEA",
      "--text": th.text || "#2D2D38", "--text-dim": th.textDim || "#706B78", "--accent": th.accent, "--accent-dim": th.accentDim,
      "--accent-contrast": accentContrast, "--accent-ink": accentInk,
      "--border": th.border, "--danger": "#C45C5C", "--warning": warningColor,
      "--side-a": sideColors.sideA, "--side-b": sideColors.sideB,
      "--font-mono": "'JetBrains Mono','SF Mono','Fira Code',monospace",
      "--font-body": "'Noto Sans SC','Noto Sans JP','Hiragino Sans','Microsoft YaHei',sans-serif",
      fontFamily: "var(--font-body)", color: "var(--text)", background: "var(--bg)",
      minHeight: "100vh", padding: "20px 24px", boxSizing: "border-box", position: "relative"
    }}>

      {toast && <div style={{
        position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 999,
        background: "var(--bg-card)", border: "1px solid var(--accent)", borderRadius: 8,
        padding: "10px 20px", fontSize: 12, color: "var(--accent)", maxWidth: "90vw",
        boxShadow: "0 4px 20px rgba(0,0,0,0.08)", animation: "fadeIn 0.2s ease"
      }}>{toast}</div>}

      {showTools && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
        <div onClick={(e) => e.stopPropagation()} style={{
          background: "var(--bg)", borderRadius: 14, width: "min(840px, calc(100vw - 32px))", maxHeight: "80vh", overflow: "hidden",
          border: "1px solid var(--border)", boxShadow: "0 12px 36px rgba(0,0,0,0.16)", color: "var(--text)", display: "flex", flexDirection: "column"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 22px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            <div style={{ fontSize: 16, color: "var(--accent-ink)" }}>{T("tools")}</div>
            <button onClick={() => setShowTools(false)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-dim)" }}>✕</button>
          </div>

          <div className="modalScroll" style={{ display: "grid", gridTemplateColumns: "180px minmax(0,1fr)", minHeight: 0, overflow: "hidden", flex: 1 }}>
            <div style={{ padding: 16, borderRight: "1px solid var(--border)", background: "var(--bg-card)", overflowY: "auto", minHeight: 0 }}>
              <button onClick={() => setActiveTool("signal-output")} style={{
                width: "100%", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", cursor: "pointer", textAlign: "left", marginBottom: 8,
                background: activeTool === "signal-output" ? "var(--accent-dim)" : "var(--bg)", color: activeTool === "signal-output" ? "var(--accent-ink)" : "var(--text)"
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{T("toolSignalOutput")}</div>
                <div style={{ fontSize: 11, lineHeight: 1.6, color: "var(--text-dim)" }}>{T("toolSignalOutputCardDesc")}</div>
              </button>
              {TOOL_PLUGINS.map((plugin) => (
                <button key={plugin.id} onClick={() => setActiveTool(plugin.id)} style={{
                  width: "100%", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", cursor: "pointer", textAlign: "left",
                  background: activeTool === plugin.id ? "var(--accent-dim)" : "var(--bg)",
                  color: activeTool === plugin.id ? "var(--accent-ink)" : "var(--text)",
                  marginBottom: 8,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{getPluginTitle(plugin)}</div>
                  <div style={{ fontSize: 11, lineHeight: 1.6, color: "var(--text-dim)" }}>{getPluginDesc(plugin)}</div>
                </button>
              ))}
            </div>

            <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto", minHeight: 0 }}>
              {activeTool === "signal-output" && <>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-ink)", marginBottom: 6 }}>{T("toolDescTitle")}</div>
                  <div style={{ fontSize: 13, lineHeight: 1.8, color: "var(--text-dim)" }}>{T("toolSignalOutputDesc")}</div>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                  <label style={{ ...lb, margin: 0 }}>{T("toolSelectedSide")}</label>
                  {["A", "B"].map((side) => (
                    <button key={side} onClick={() => setCalibrationSide(side)} style={{
                      ...btnTab, minWidth: 54,
                      background: calibrationSide === side ? `var(--side-${side.toLowerCase()})` : "var(--bg-deep)",
                      color: calibrationSide === side ? getContrastColor(side === "A" ? sideColors.sideA : sideColors.sideB) : "var(--text)"
                    }} disabled={signalOutputRunning || signalOutputType !== "rec_level_balance"}>
                      SIDE {side}
                    </button>
                  ))}
                  <button onClick={signalOutputRunning ? stopSignalOutput : startSignalOutput} disabled={processing} style={{
                    ...btnS, padding: "8px 14px",
                    borderColor: signalOutputRunning ? "var(--danger)" : "var(--accent)",
                    color: signalOutputRunning ? "var(--danger)" : "var(--accent-ink)"
                  }}>
                    {signalOutputRunning ? T("toolStop") : T("toolStart")}
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ ...lb, margin: 0 }}>{T("toolSignalPick")}</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
                    {SIGNAL_OUTPUT_PRESETS.map((preset) => (
                      <button key={preset.id} onClick={() => setSignalOutputType(preset.id)} disabled={signalOutputRunning} style={{
                        border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", cursor: "pointer", textAlign: "left",
                        background: signalOutputType === preset.id ? "var(--accent-dim)" : "var(--bg-card)",
                        color: signalOutputType === preset.id ? "var(--accent-ink)" : "var(--text)"
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{T(preset.nameKey)}</div>
                        <div style={{ fontSize: 11, lineHeight: 1.7, color: "var(--text-dim)" }}>{T(preset.descKey)}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 2 }}>
                  <div style={{ minWidth: 210, flex: "1.35 1 0", padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-card)" }}>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>{T("toolSignalSource")}</div>
                    <div style={{ fontSize: 14, lineHeight: 1.7 }}>{T(signalOutput.sourceKey)}</div>
                  </div>
                  <div style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-card)" }}>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>{T("toolSignalFreq")}</div>
                    <div style={{ fontSize: 15, color: "var(--text)" }}>{signalOutput.freqHz} Hz sine</div>
                  </div>
                  <div style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-card)" }}>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>{T("toolSignalLevel")}</div>
                    <div style={{ fontSize: 15, color: "var(--text)" }}>{Number.isFinite(signalOutput.levelDb) ? `${signalOutput.levelDb.toFixed(1)} dBFS peak` : "−∞ dBFS"}</div>
                  </div>
                  <div style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg-card)" }}>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>{T("toolStereoMode")}</div>
                    <div style={{ fontSize: 15, color: "var(--text)" }}>{T("toolStereoDualMono")}</div>
                  </div>
                </div>
              </>}
              {ActiveToolPluginComponent && <ActiveToolPluginComponent
                lang={lang}
                processing={processing}
                procMsg={procMsg}
                captureName={deckCalCaptureName}
                responseAnalysis={responseAnalysis}
                transportAnalysis={transportAnalysis}
                programManifestName={deckCalProgramManifestName}
                recordingKind={deckCalRecordingKind}
                browserRecordingEnabled={deckCalBrowserRecordingEnabled}
                onLoadProgramManifest={loadDeckCalProgramManifestFile}
                onClearProgramManifest={clearDeckCalProgramManifest}
                onExportProgram={exportTestTapeProgram}
                onImportCapture={importDeckCalCaptureFile}
                onStartRecording={startDeckCalRecording}
                onStopRecording={stopDeckCalRecording}
                onAnalyseCapture={analyseDeckCalCapture}
                onSaveResponseProfile={saveResponseProfile}
                onSaveProgramManifest={saveDeckCalProgramManifest}
                multiCaptures={multiCaptures}
                onImportMultiCaptures={importMultiCaptureFiles}
                onClearMultiCaptures={clearMultiCaptures}
                onAnalyseMultiCaptures={analyseMultiCaptures}
                standardTapePreset={standardTapePreset}
                onSetStandardTapePreset={setStandardTapePreset}
                onAnalyseStandardTape={analyseStandardTape}
                standardTapePresets={standardTapePresets}
                probeCaptureName={probeCaptureName}
                probeProfile={playerProbeProfile}
                songRefNames={songReferenceTracks.map((track) => track.name)}
                songRecNames={songRecordedTracks.map((track) => track.name)}
                songPairCount={songPairCount}
                songPairError={songPairError}
                songPairingDetails={songPairingDetails}
                songPairPreview={songPairPreview}
                songAnalysisFailedPairs={songAnalysisFailedPairs}
                songProfile={playerSongProfile}
                eqBaseProfileName={eqWorkbenchBaseProfileName}
                eqReadyProfile={playerEqReadyProfile}
                compilerProfileAName={compilerProfileAName}
                compilerProfileBName={compilerProfileBName}
                compilerTargetMode={compilerTargetMode}
                compilerTargetCurve={compilerTargetCurve}
                onSetCompilerTargetCurve={setCompilerTargetCurve}
                compileResult={playerEqCompileResult}
                compileLoadProfileName={compileLoadableProfile?.name || ""}
                onExportProbe={exportPlayerProbe}
                onImportProbeCapture={importPlayerProbeCaptureFile}
                onBuildProbeProfile={buildPlayerProbeProfile}
                onSaveProbeProfile={savePlayerProbeProfile}
                onImportSongFiles={importSongFiles}
                onBuildSongProfile={buildPlayerSongProfile}
                onSaveSongProfile={savePlayerSongProfile}
                onUseProbeAsEqBase={useProbeAsEqBase}
                onUseSongAsEqBase={useSongAsEqBase}
                onImportEqBaseProfile={importEqBaseProfileFile}
                onBuildFixedEqModel={buildFixedEqWorkbenchProfile}
                onSaveEqReadyProfile={saveEqReadyProfile}
                onImportCompilerProfile={importCompilerProfileFile}
                onUseEqReadyAsCompilerA={useEqReadyAsCompilerA}
                onUseProbeAsCompilerA={useProbeAsCompilerA}
                onUseSongAsCompilerA={useSongAsCompilerA}
                onUseProbeAsCompilerB={useProbeAsCompilerB}
                onUseSongAsCompilerB={useSongAsCompilerB}
                onUseEqReadyAsCompilerB={useEqReadyAsCompilerB}
                onSetCompilerTargetMode={changeCompilerTargetMode}
                onCompileProfiles={compilePlayerProfiles}
                onLoadCompileProfile={loadCompileResultProfile}
                onExportCompileLoadProfile={exportCompileLoadableProfile}
                onExportCompileText={exportCompileResultText}
                onExportCompileJson={exportCompileResultJson}
                onLoadFullResProfile={loadFullResProfile}
                onExportFullResProfile={exportFullResProfile}
              />}
            </div>
          </div>
        </div>
      </div>}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ fontSize: 14, fontWeight: 400, margin: 0, letterSpacing: "0.02em", lineHeight: 1.4 }}>
            <span style={{ color: "var(--accent)" }}>◉ </span>
            <span style={{ fontSize: 20, fontWeight: 600, color: "var(--accent)" }}>S</span><span style={{ fontSize: 11, opacity: 0.55 }}>equential</span>{" "}
            <span style={{ fontSize: 20, fontWeight: 600, color: "var(--accent)" }}>I</span><span style={{ fontSize: 11, opacity: 0.55 }}>nterleaved</span>{" "}
            <span style={{ fontSize: 20, fontWeight: 600, color: "var(--accent)" }}>D</span><span style={{ fontSize: 11, opacity: 0.55 }}>ubbing</span>{" "}
            <span style={{ fontSize: 20, fontWeight: 600, color: "var(--accent)" }}>E</span><span style={{ fontSize: 11, opacity: 0.55 }}>ngine</span>
          </h1>
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 3, fontStyle: "italic", opacity: 0.75 }}>{T("appTagline")}</div>
        </div>
        <span style={{ fontSize: 10, color: "var(--text-dim)" }}>{T("appVersion")}</span>
        <HeaderControls lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} onOpenTools={openTools} T={T} />
      </div>

      {/* Config */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        {/* Row 1: Tape physical params */}
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", padding: "12px 16px", background: "var(--bg-card)", borderRadius: 8, border: "1px solid var(--border)", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={lb}>{T("tapeSpec")}</label>
            <div style={{ display: "flex", gap: 3 }}>
              {Object.entries(TAPE_PRESETS).map(([k, p]) => (
                <button key={k} onClick={() => setTapePreset(k)} style={{
                  ...btnTab,
                  background: tapePreset === k ? "var(--accent)" : "var(--bg-deep)", color: tapePreset === k ? "var(--accent-contrast)" : "var(--text)"
                }}>{p.label}</button>
              ))}
              <button onClick={() => setTapePreset("CUSTOM")} style={{
                ...btnTab,
                background: tapePreset === "CUSTOM" ? "var(--accent)" : "var(--bg-deep)", color: tapePreset === "CUSTOM" ? "var(--accent-contrast)" : "var(--text)"
              }}>{T("tapeCustom")}</button>
            </div>
            {tapePreset === "CUSTOM" && <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
              <input type="number" value={customMin} onChange={e => setCustomMin(Number(e.target.value))} min={1} max={120} style={{ ...inpSm, width: 52 }} />
              <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{T("minPerSide")}</span>
            </div>}
          </div>

          <div style={{ width: 1, height: 40, background: "var(--border)", alignSelf: "center", flexShrink: 0 }} />

          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <label style={lb}>{T("tapeType")}</label>
              <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{TAPE_TYPES[tapeType].desc} · {T("recLevel")} {TAPE_TYPES[tapeType].peakDb}dB · {T("tapeTypeNote")}</span>
            </div>
            <div style={{ display: "flex", gap: 3 }}>
              {Object.entries(TAPE_TYPES).map(([k, tp]) => {
                const tapeColor = tapeTypeColors[k];
                return (
                  <button key={k} onClick={() => { setTapeType(k); setTargetDb(tp.peakDb); }} style={{
                    ...btnTab,
                    background: tapeType === k ? tapeColor : "var(--bg-deep)",
                    color: tapeType === k ? getContrastColor(tapeColor) : tapeColor,
                    border: `1px solid ${tapeColor}`,
                    boxShadow: tapeType === k ? "inset 0 0 0 1px rgba(255,255,255,0.18)" : "none"
                  }}>{tp.label.split(" ")[0]} {tp.label.split(" ")[1]}</button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Row 2: Audio processing params */}
        <div style={{ display: "flex", gap: 16, alignItems: "center", padding: "10px 16px", background: "var(--bg-card)", borderRadius: 8, border: "1px solid var(--border)", flexWrap: "wrap" }}>
          {/* Gap */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label style={{ ...lb, margin: 0 }}>{T("defaultGap")}</label>
            <input type="range" min={0} max={10} step={0.5} value={defaultGap} onChange={e => setDefaultGap(Number(e.target.value))} style={{ width: 72, accentColor: "var(--accent)" }} />
            <span style={{ fontSize: 12, minWidth: 32 }}>{defaultGap.toFixed(1)}s</span>
          </div>

          <div style={{ width: 1, height: 24, background: "var(--border)", alignSelf: "center", flexShrink: 0 }} />

          {/* Smart gap toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label style={{ ...lb, margin: 0 }}>{T("smartGap")}</label>
            <button onClick={() => setSmartGap(!smartGap)} style={toggleStyle(smartGap)}>{smartGap ? "ON" : "OFF"}</button>
          </div>

          <div style={{ width: 1, height: 24, background: "var(--border)", alignSelf: "center", flexShrink: 0 }} />

          {/* Normalize */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label style={{ ...lb, margin: 0 }}>{T("normalize")}</label>
            <div style={{ display: "flex", gap: 2 }}>
              {[["off", "normOff"], ["peak", "normPeak"], ["rms", "normRms"]].map(([v, k]) => (
                <button key={v} onClick={() => setNormalizeMode(v)} style={{
                  ...btnTab, fontSize: 12, padding: "4px 10px",
                  background: normalizeMode === v ? "var(--accent-dim)" : "var(--bg-deep)", color: normalizeMode === v ? "var(--accent-ink)" : "var(--text)"
                }}>{T(k)}</button>
              ))}
            </div>
          </div>

          <div style={{ width: 1, height: 24, background: "var(--border)", alignSelf: "center", flexShrink: 0 }} />

          {/* Tail fill */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label style={{ ...lb, margin: 0 }}>{T("tailFill")}</label>
            <button onClick={() => setFillTail(!fillTail)} style={toggleStyle(fillTail)}>{fillTail ? "ON" : "OFF"}</button>
          </div>

          <div style={{ width: 1, height: 24, background: "var(--border)", alignSelf: "center", flexShrink: 0 }} />

          {/* Tail margin */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label style={{ ...lb, margin: 0 }}>{T("tailMargin")}</label>
            <input type="number" value={tailMargin} onChange={e => setTailMargin(Math.max(0, Number(e.target.value)))} min={0} max={10} step={0.5} style={{ ...inpSm, width: 52 }} />
            <span style={{ fontSize: 12, color: "var(--text-dim)" }}>min</span>
          </div>

          <div style={{ flexBasis: "100%", height: 0 }} />

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <label style={{ ...lb, margin: 0 }}>{T("sampleRate")}</label>
              <div style={{ display: "flex", gap: 2 }}>
                {[["auto", "Auto"], ["44100", "44.1k"], ["48000", "48k"]].map(([v, label]) => {
                  const val = v === "auto" ? "auto" : Number(v);
                  return <button key={v} onClick={() => setExportSr(val)} style={{
                    ...btnTab, fontSize: 12, padding: "5px 10px",
                    background: exportSr === val ? "var(--accent-dim)" : "var(--bg-deep)", color: exportSr === val ? "var(--accent-ink)" : "var(--text)"
                  }}>{label}</button>;
                })}
              </div>
            </div>
            <div style={{ width: 1, height: 20, background: "var(--border)", alignSelf: "center", flexShrink: 0 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <label style={{ ...lb, margin: 0 }}>{T("bitDepth")}</label>
              <div style={{ display: "flex", gap: 2 }}>
                {[["auto", "Auto"], ["16", "16bit"], ["24", "24bit"]].map(([v, label]) => {
                  const val = v === "auto" ? "auto" : Number(v);
                  return <button key={v} onClick={() => setExportBits(val)} style={{
                    ...btnTab, fontSize: 12, padding: "5px 10px",
                    background: exportBits === val ? "var(--accent-dim)" : "var(--bg-deep)", color: exportBits === val ? "var(--accent-ink)" : "var(--text)"
                  }}>{label}</button>;
                })}
              </div>
            </div>
          </div>

          <div style={{ flexBasis: "100%", height: 0 }} />

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <label style={{ ...lb, margin: 0 }}>{T("calibrationProfile")}</label>
            <button onClick={() => calibrationProfileRef.current?.click()} style={btnS} disabled={processing}>{T("loadCalibrationProfile")}</button>
            <button onClick={clearCalibrationProfile} style={btnS} disabled={processing || !loadedCalibrationProfile}>{T("clearCalibrationProfile")}</button>
            <span style={{ fontSize: 12, color: "var(--text-dim)", minWidth: 160 }}>{loadedCalibrationProfileName || T("noCalibrationProfile")}</span>
            <div style={{ width: 1, height: 20, background: "var(--border)", alignSelf: "center", flexShrink: 0 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <label style={{ ...lb, margin: 0 }}>{T("applyCalibrationEqPreview")}</label>
              <button
                onClick={() => loadedCalibrationProfile && setApplyCalibrationEqPreview((value) => !value)}
                style={toggleStyle(!!loadedCalibrationProfile && applyCalibrationEqPreview)}
                disabled={!loadedCalibrationProfile}
              >
                {!!loadedCalibrationProfile && applyCalibrationEqPreview ? "ON" : "OFF"}
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <label style={{ ...lb, margin: 0 }}>{T("applyCalibrationClarityPreview")}</label>
              <button
                onClick={() => loadedCalibrationProfile && setApplyCalibrationClarityPreview((value) => !value)}
                style={toggleStyle(!!loadedCalibrationProfile && applyCalibrationClarityPreview)}
                disabled={!loadedCalibrationProfile}
              >
                {!!loadedCalibrationProfile && applyCalibrationClarityPreview ? "ON" : "OFF"}
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <label style={{ ...lb, margin: 0 }}>{T("applyCalibrationEqExport")}</label>
              <button
                onClick={() => loadedCalibrationProfile && setApplyCalibrationEqExport((value) => !value)}
                style={toggleStyle(!!loadedCalibrationProfile && applyCalibrationEqExport)}
                disabled={!loadedCalibrationProfile}
              >
                {!!loadedCalibrationProfile && applyCalibrationEqExport ? "ON" : "OFF"}
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <label style={{ ...lb, margin: 0 }}>{T("applyCalibrationClarityExport")}</label>
              <button
                onClick={() => loadedCalibrationProfile && setApplyCalibrationClarityExport((value) => !value)}
                style={toggleStyle(!!loadedCalibrationProfile && applyCalibrationClarityExport)}
                disabled={!loadedCalibrationProfile}
              >
                {!!loadedCalibrationProfile && applyCalibrationClarityExport ? "ON" : "OFF"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="actionBar" style={{ marginBottom: 12 }}>
        <input ref={fileRef} type="file" multiple accept="audio/*,.ncm" style={{ display: "none" }}
          onChange={e => { if (e.target.files.length > 0) loadFiles(Array.from(e.target.files), activeTab); e.target.value = ""; }} />
        <input ref={plRef} type="file" accept=".json" style={{ display: "none" }} onChange={importPL} />
        <input ref={bundleRef} type="file" accept=".sidepkg,application/octet-stream" style={{ display: "none" }} onChange={importBundle} />
        <input ref={calibrationProfileRef} type="file" accept=".json,application/json" style={{ display: "none" }}
          onChange={async e => { const file = e.target.files?.[0]; if (file) await loadCalibrationProfileFile(file); e.target.value = ""; }} />
        <div className="actionBarMain">
          <button onClick={() => fileRef.current?.click()} style={btnP} disabled={processing}><IconAdd size={16} /> {T("addFiles")} → SIDE {activeTab}</button>
          <button onClick={autoDistribute} style={btnS} disabled={processing || !tracks.length}><IconAutoAwesome size={16} /> {T("autoDistribute")}</button>
          <button onClick={() => plRef.current?.click()} style={btnS} disabled={processing}><IconFileOpen size={16} /> {T("importPlaylist")}</button>
          <button onClick={exportPL} style={btnS} disabled={processing || !tracks.length}><IconSave size={16} /> {T("exportPlaylist")}</button>
          <button onClick={() => bundleRef.current?.click()} style={btnS} disabled={processing}><IconFileOpen size={16} /> {T("importBundle")}</button>
          <button onClick={exportBundle} style={btnS} disabled={processing || !tracks.length}><IconSave size={16} /> {T("exportBundle")}</button>
          <button onClick={() => { if (tracks.some(t => t.side === activeTab) && window.confirm(T("clearSideConfirm").replace("{side}", activeTab))) setTracks(p => p.filter(t => t.side !== activeTab)); }} style={{ ...btnS, display: "flex", alignItems: "center", gap: 4 }} disabled={processing || !tracks.some(t => t.side === activeTab)}><IconClearSide size={14} />{T("clearSide")}</button>
          <button onClick={() => { if (tracks.length > 0 && window.confirm(T("clearAllConfirm"))) setTracks([]); }} style={{ ...btnS, display: "flex", alignItems: "center", gap: 4 }} disabled={processing || !tracks.length}><IconClearAll size={14} />{T("clearAll")}</button>
        </div>
        <div className="actionBarPlayback">
          {playing ?
            <button onClick={stopPlayback} style={{ ...btnE, borderColor: "var(--danger)", color: "var(--danger)" }}><IconStop size={16} /> {T("stop")}</button>
            : <>
              <button onClick={() => playSide("A")} style={{ ...btnE, borderColor: "var(--side-a)", color: "var(--side-a)", background: mixHex(sideColors.sideA, th.bgCard, 0.9) }} disabled={processing || !aHas}><IconPlay size={16} /> A {T("play")}</button>
              <button onClick={() => playSide("B")} style={{ ...btnE, borderColor: "var(--side-b)", color: "var(--side-b)", background: mixHex(sideColors.sideB, th.bgCard, 0.92) }} disabled={processing || !bHas}><IconPlay size={16} /> B {T("play")}</button>
            </>}
          <button onClick={() => expSide("A")} style={{ ...btnE, borderColor: "var(--side-a)", color: "var(--side-a)", background: mixHex(sideColors.sideA, th.bgCard, 0.9) }} disabled={processing || playing || !aHas}><IconExport size={16} /> A {T("exportSide")}</button>
          <button onClick={() => expSide("B")} style={{ ...btnE, borderColor: "var(--side-b)", color: "var(--side-b)", background: mixHex(sideColors.sideB, th.bgCard, 0.92) }} disabled={processing || playing || !bHas}><IconExport size={16} /> B {T("exportSide")}</button>
        </div>
      </div>

      {/* Player */}
      {playing && <Player
        playing={playing} paused={paused} playingSide={playingSide}
        playingIdxRef={displayIdxRef} playPosRef={displayPosRef}
        playToken={playbackView.token}
        schedule={playbackView.schedule} totalDur={playbackView.totalDur}
        meterMode={meterMode} setMeterMode={setMeterMode}
        simMode={simMode} setSimMode={setSimMode}
        deckProfile={deckProfile} setDeckProfile={setDeckProfile}
        toneProfile={toneProfile} setToneProfile={setToneProfile}
        tubeEnabled={tubeEnabled} setTubeEnabled={setTubeEnabled}
        vinylEra={vinylEra} setVinylEra={setVinylEra}
        vinylCrackle={vinylCrackle} setVinylCrackle={setVinylCrackle}
        playerVolume={playerVolume} setPlayerVolume={setPlayerVolume}
        togglePause={togglePause} stopPlayback={stopPlayback}
        skipTrack={skipTrack} seekTo={seekTo}
        analyserL={analyserRef.current.L} analyserR={analyserRef.current.R}
        T={T} fmtTime={fmtTime}
      />}

      {processing && <div style={{
        padding: "8px 12px", marginBottom: 12, background: "var(--bg-deep)", borderRadius: 6,
        fontSize: 13, color: "var(--accent-ink)", display: "flex", alignItems: "center", gap: 8
      }}>
        <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>◌</span>
        <span>{procMsg}</span>
      </div>}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 8 }}>
        {["A", "B"].map(s => {
          const st = s === "A" ? sideA : sideB, dur = s === "A" ? durA : durB, hardOver = dur > sideSec, softOver = !hardOver && dur > effectiveSec;
          const badgeColor = hardOver ? "var(--danger)" : softOver ? "var(--warning)" : "var(--text-dim)";
          const sideColor = s === "A" ? sideColors.sideA : sideColors.sideB;
          return (<button key={s} onClick={() => setActiveTab(s)} onDragOver={e => { e.preventDefault(); setActiveTab(s); }}
            style={{
              flex: 1, padding: "10px 16px",
              background: activeTab === s ? mixHex(sideColor, th.bgCard, 0.9) : "transparent",
              color: activeTab === s ? `var(--side-${s.toLowerCase()})` : "var(--text-dim)",
              border: "none", borderBottom: activeTab === s ? `2px solid var(--side-${s.toLowerCase()})` : "2px solid var(--border)",
              cursor: "pointer", fontSize: 13, fontWeight: 500, fontFamily: "var(--font-body)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s"
            }}>
            <span style={{ fontSize: 13, letterSpacing: "0.1em" }}>SIDE {s}</span>
            <span style={{
              fontSize: 12, color: activeTab === s ? sideColor : badgeColor,
              background: activeTab === s ? mixHex(sideColor, th.bgDeep, 0.82) : "var(--bg-deep)", padding: "2px 6px", borderRadius: 3
            }}>
              {st.length}{T("tracks")} · {fmtTime(dur)}
            </span>
          </button>);
        })}
      </div>

      <div style={{ minHeight: 300 }}>
        {renderSidePanel("A", sideA, durA)}
        {renderSidePanel("B", sideB, durB)}
      </div>

      {tracks.length > 0 && <div style={{
        position: "sticky", bottom: 0, zIndex: 10, padding: "10px 20px",
        background: "var(--bg)", borderTop: "1px solid var(--border)",
        fontSize: 12, color: "var(--text)", opacity: 0.8, display: "flex", gap: 16, flexWrap: "wrap"
      }}>
        <span>{T("total")} {tracks.length}{T("tracks")}</span>
        <span>A: {fmtTime(durA)} / {fmtTime(effectiveSec)}</span>
        <span>B: {fmtTime(durB)} / {fmtTime(effectiveSec)}</span>
        <span>{T("tape")}: {tapePreset === "CUSTOM" ? `${customMin * 2}min` : TAPE_PRESETS[tapePreset].label}</span>
        <span>{T("type")}: {TAPE_TYPES[tapeType].label}</span>
        {tailMargin > 0 && <span>{T("tailMargin")}: {tailMargin}min</span>}
        <span>{T("smartGap")}: {smartGap ? "ON" : "OFF"}</span>
        <span>{T("normalize")}: {normalizeMode === "off" ? "OFF" : normalizeMode === "peak" ? T("normPeak") : T("normRms")}</span>
        <span>WAV: {exportSr === "auto" ? "Auto" : exportSr / 1000 + "kHz"}/{exportBits === "auto" ? "Auto" : exportBits + "bit"}</span>
        <span style={{ color: ffmpegStatus === "ready" ? "#82B891" : ffmpegStatus === "unavailable" ? "var(--danger)" : "var(--text-dim)" }}>
          ffmpeg: {ffmpegStatus === "ready" ? "✓" : ffmpegStatus === "loading" ? "…" : ffmpegStatus === "unavailable" ? "✕" : "standby"}
        </span>
      </div>}

      <style>{`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateX(-50%) translateY(-8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        *{box-sizing:border-box}
        .actionBar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:start}
        .actionBarMain,.actionBarPlayback{display:flex;gap:8px;flex-wrap:wrap}
        .actionBarPlayback{justify-content:flex-end}
        @media (max-width: 1220px){
          .actionBar{grid-template-columns:1fr}
          .actionBarPlayback{justify-content:flex-start}
        }
        ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:var(--bg-deep)}::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
        .modalScroll{scrollbar-width:thin;scrollbar-color:var(--border) transparent}
        .modalScroll::-webkit-scrollbar{width:10px}
        .modalScroll::-webkit-scrollbar-track{background:transparent;margin:10px 0}
        .modalScroll::-webkit-scrollbar-thumb{background:var(--border);border-radius:999px;border:3px solid transparent;background-clip:content-box}
        input[type="number"]{-moz-appearance:textfield}input[type="number"]::-webkit-inner-spin-button{opacity:0.5}
        .playerVolRange{-webkit-appearance:none;appearance:none;height:16px;background:transparent;outline:none}
        .playerVolRange::-webkit-slider-runnable-track{height:4px;border-radius:999px;background:linear-gradient(to right,var(--accent) 0,var(--accent) var(--vol-pct),var(--accent-dim) var(--vol-pct),var(--accent-dim) 100%)}
        .playerVolRange::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:12px;height:12px;border-radius:50%;background:var(--bg-card);border:2px solid var(--accent);margin-top:-4px;box-shadow:0 0 0 1px color-mix(in srgb,var(--accent) 18%, transparent)}
        .playerVolRange::-moz-range-track{height:4px;border:none;border-radius:999px;background:var(--accent-dim)}
        .playerVolRange::-moz-range-progress{height:4px;border:none;border-radius:999px;background:var(--accent)}
        .playerVolRange::-moz-range-thumb{width:12px;height:12px;border-radius:50%;background:var(--bg-card);border:2px solid var(--accent)}
        button:disabled{opacity:0.35;cursor:not-allowed}button:not(:disabled):hover{filter:brightness(0.95)}
      `}</style>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────
const lb = { fontSize: 13, color: "var(--text)", letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 400 };
const btnTab = { padding: "7px 14px", border: "1px solid var(--border)", borderRadius: 5, cursor: "pointer", fontSize: 14, fontFamily: "inherit", transition: "all 0.15s", fontWeight: 400 };
const btnSm = { background: "transparent", border: "1px solid var(--border)", borderRadius: 3, color: "var(--text-dim)", cursor: "pointer", fontSize: 12, padding: "3px 8px", transition: "all 0.15s" };
const inpSm = { background: "var(--bg-deep)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--text)", fontSize: 14, padding: "5px 9px", outline: "none" };
const btnP = { padding: "10px 20px", background: "var(--accent)", color: "var(--accent-contrast)", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14, fontWeight: 400, fontFamily: "inherit", transition: "all 0.15s" };
const btnS = { padding: "10px 20px", background: "var(--bg-card)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", fontSize: 14, fontFamily: "inherit", transition: "all 0.15s" };
const btnE = { padding: "10px 20px", background: "var(--bg-deep)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", fontSize: 14, transition: "all 0.15s" };
const segBtn = (on) => ({ padding: "4px 10px", background: on ? "var(--accent-dim)" : "var(--bg-deep)", color: on ? "var(--accent-ink)" : "var(--text-dim)", border: "1px solid var(--border)", borderRadius: 999, cursor: "pointer", fontSize: 11, fontFamily: "inherit", transition: "all 0.15s" });
const toggleStyle = (on) => ({
  padding: "5px 16px", borderRadius: 12, border: "none", cursor: "pointer",
  fontSize: 12, fontWeight: 600, transition: "all 0.2s", letterSpacing: "0.05em",
  background: on ? "var(--accent)" : "var(--bg-deep)", color: on ? "var(--accent-contrast)" : "var(--text-dim)"
});
