import { memo, useRef, useEffect, useCallback, useState } from "react";
import { IconSkipPrev, IconSkipNext, IconPlay, IconPause, IconStop, IconEqualizer, IconTape, IconDeck, IconTone, IconTube, IconPalette, IconTool } from "./Icons.jsx";

// ── Theme colors ───────────────────────────────────────────
const C_CYAN = "#90C7D7";
const C_AMBER = "#DFA026";
const C_PINK = "#D4859A";
const C_RED = "#C45050";

const SEGS = 24;
const SEG_COLORS = Array.from({length:SEGS},(_,i)=>{
  if(i<12) return C_CYAN; if(i<18) return C_AMBER; if(i<21) return C_PINK; return C_RED;
});

const SPEC_BANDS = 24;
const SPEC_ROWS = 16;
const specRowColor = (r) => { if(r<6) return C_CYAN; if(r<9) return C_AMBER; if(r<11) return C_PINK; return C_RED; };
const SPEC_MIN_HZ = 32;
const SPECGRAM_MIN_HZ = 32;
const SPECGRAM_MAX_HZ = 22050;
const SPECGRAM_SCROLL_PX = 1;

const VU_DB = [[-20,0],[-10,0.25],[-7,0.35],[-5,0.45],[-3,0.55],[0,0.7],["+3",0.85]];
const METER_MODES = ["vfd","vu","spectrum","waveform","waterfall","oscilloscope"];
const SIM_MODES = ["off","TAPE_I","TAPE_II","TAPE_IV","vinyl"];
const DECK_MODES = ["off","portable","deck_2","deck_3"];
const TONE_MODES = ["default","cool","warm"];
const VINYL_ERAS = ["modern","classic","vintage","effect"];
const VINYL_CRACKLE = ["off","low","mid","high"];
const MODE_LABEL = {vfd:"VFD",vu:"VU",spectrum:"FFT",waveform:"WAVE",waterfall:"SGRAM",oscilloscope:"VECT"};
const FONT = "'Noto Sans SC','Noto Sans JP','Hiragino Sans','Microsoft YaHei',system-ui,sans-serif";
const LCD_FONT = "'Pixel Operator','JetBrains Mono',monospace";
const IDLE_SCOPE_BUFFER = new Float32Array(512);
const BITMAP_FONT = {
  " ": ["00000","00000","00000","00000","00000","00000","00000"],
  "!": ["00100","00100","00100","00100","00000","00000","00100"],
  "\"": ["01010","01010","01010","00000","00000","00000","00000"],
  "#": ["01010","01010","11111","01010","11111","01010","01010"],
  "$": ["00100","01111","10100","01110","00101","11110","00100"],
  "%": ["11001","11010","00100","01000","00100","01011","10011"],
  "&": ["01100","10010","10100","01000","10101","10001","01010"],
  "'": ["00100","00100","01000","00000","00000","00000","00000"],
  "(": ["00010","00100","01000","01000","01000","00100","00010"],
  ")": ["01000","00100","00010","00010","00010","00100","01000"],
  "*": ["00000","00100","10101","01110","10101","00100","00000"],
  "+": ["00000","00100","00100","11111","00100","00100","00000"],
  ",": ["00000","00000","00000","00000","01100","00100","01000"],
  "-": ["00000","00000","00000","11111","00000","00000","00000"],
  ".": ["00000","00000","00000","00000","00000","01100","01100"],
  "/": ["00000","00001","00010","00100","01000","10000","00000"],
  "0": ["01110","10001","10001","10001","10001","10001","01110"],
  "1": ["00100","01100","00100","00100","00100","00100","01110"],
  "2": ["01110","10001","00001","00010","00100","01000","11111"],
  "3": ["11111","00010","00100","00010","00001","10001","01110"],
  "4": ["00010","00110","01010","10010","11111","00010","00010"],
  "5": ["11111","10000","11110","00001","00001","10001","01110"],
  "6": ["00110","01000","10000","11110","10001","10001","01110"],
  "7": ["11111","00001","00010","00100","01000","01000","01000"],
  "8": ["01110","10001","10001","01110","10001","10001","01110"],
  "9": ["01110","10001","10001","01111","00001","00010","01100"],
  ":": ["00000","01100","01100","00000","01100","01100","00000"],
  ";": ["00000","01100","01100","00000","01100","00100","01000"],
  "<": ["00010","00100","01000","10000","01000","00100","00010"],
  "=": ["00000","00000","11111","00000","11111","00000","00000"],
  ">": ["01000","00100","00010","00001","00010","00100","01000"],
  "?": ["01110","10001","00001","00010","00100","00000","00100"],
  "A": ["01110","10001","10001","11111","10001","10001","10001"],
  "B": ["11110","10001","10001","11110","10001","10001","11110"],
  "C": ["01110","10001","10000","10000","10000","10001","01110"],
  "D": ["11110","10001","10001","10001","10001","10001","11110"],
  "E": ["11111","10000","10000","11110","10000","10000","11111"],
  "F": ["11111","10000","10000","11110","10000","10000","10000"],
  "G": ["01110","10001","10000","10111","10001","10001","01111"],
  "H": ["10001","10001","10001","11111","10001","10001","10001"],
  "I": ["01110","00100","00100","00100","00100","00100","01110"],
  "J": ["00001","00001","00001","00001","10001","10001","01110"],
  "K": ["10001","10010","10100","11000","10100","10010","10001"],
  "L": ["10000","10000","10000","10000","10000","10000","11111"],
  "M": ["10001","11011","10101","10101","10001","10001","10001"],
  "N": ["10001","11001","10101","10011","10001","10001","10001"],
  "O": ["01110","10001","10001","10001","10001","10001","01110"],
  "P": ["11110","10001","10001","11110","10000","10000","10000"],
  "Q": ["01110","10001","10001","10001","10101","10010","01101"],
  "R": ["11110","10001","10001","11110","10100","10010","10001"],
  "S": ["01110","10001","10000","01110","00001","10001","01110"],
  "T": ["11111","00100","00100","00100","00100","00100","00100"],
  "U": ["10001","10001","10001","10001","10001","10001","01110"],
  "V": ["10001","10001","10001","10001","10001","01010","00100"],
  "W": ["10001","10001","10001","10101","10101","11011","10001"],
  "X": ["10001","10001","01010","00100","01010","10001","10001"],
  "Y": ["10001","10001","10001","01010","00100","00100","00100"],
  "Z": ["11111","00001","00010","00100","01000","10000","11111"],
  "a": ["00000","00000","01110","00001","01111","10001","01111"],
  "b": ["10000","10000","10110","11001","10001","10001","11110"],
  "c": ["00000","00000","01110","10000","10000","10001","01110"],
  "d": ["00001","00001","01101","10011","10001","10001","01111"],
  "e": ["00000","00000","01110","10001","11111","10000","01110"],
  "f": ["00110","01001","01000","11110","01000","01000","01000"],
  "g": ["00000","01111","10001","10001","01111","00001","01110"],
  "h": ["10000","10000","10110","11001","10001","10001","10001"],
  "i": ["00100","00000","01100","00100","00100","00100","01110"],
  "j": ["00010","00000","00010","00010","00010","10010","01100"],
  "k": ["10000","10000","10010","10100","11000","10100","10010"],
  "l": ["01100","00100","00100","00100","00100","00100","01110"],
  "m": ["00000","00000","11010","10101","10101","10101","10101"],
  "n": ["00000","00000","11110","10001","10001","10001","10001"],
  "o": ["00000","00000","01110","10001","10001","10001","01110"],
  "p": ["00000","11110","10001","10001","11110","10000","10000"],
  "q": ["00000","01101","10011","10011","01101","00001","00001"],
  "r": ["00000","00000","10110","11001","10000","10000","10000"],
  "s": ["00000","00000","01110","10000","01110","00001","11110"],
  "t": ["01000","11100","01000","01000","01000","01001","00110"],
  "u": ["00000","00000","10001","10001","10001","10011","01101"],
  "v": ["00000","00000","10001","10001","10001","01010","00100"],
  "w": ["00000","00000","10001","10101","10101","10101","01010"],
  "x": ["00000","00000","10001","01010","00100","01010","10001"],
  "y": ["00000","10001","10001","10001","01111","00001","01110"],
  "z": ["00000","00000","11111","00010","00100","01000","11111"],
};
const OSCILLOSCOPE_THEMES = [
  {
    id: "crt-cyan",
    buttonLabel: "CRT1",
    title: "Blue-green CRT phosphor",
    shellFill: "linear-gradient(180deg,#22312d 0%,#131b19 100%)",
    shellBorder: "#3d5950",
    shellShadow: "rgba(84, 221, 196, 0.16)",
    screen: "#081210",
    text: "#92f3d4",
    gridMajor: "rgba(128, 255, 220, 0.28)",
    gridMinor: "rgba(128, 255, 220, 0.08)",
    traceA: "#8effc7",
    traceB: "#4be8d4",
    glow: "rgba(110,255,212,0.58)",
    scanline: "rgba(118, 255, 220, 0.04)",
    noise: "rgba(128,255,220,0.10)",
    resolution: 1,
    yQuantize: 0,
    lineWidth: 1.35,
    blur: 10,
    labelAccent: "#b8ffea",
  },
  {
    id: "crt-amber",
    buttonLabel: "CRT2",
    title: "Amber CRT phosphor",
    shellFill: "linear-gradient(180deg,#30261a 0%,#1a140d 100%)",
    shellBorder: "#6e5530",
    shellShadow: "rgba(255, 183, 67, 0.18)",
    screen: "#120d07",
    text: "#ffc764",
    gridMajor: "rgba(255, 190, 90, 0.26)",
    gridMinor: "rgba(255, 190, 90, 0.07)",
    traceA: "#ffcd5e",
    traceB: "#ffb53b",
    glow: "rgba(255,194,91,0.62)",
    scanline: "rgba(255, 198, 98, 0.045)",
    noise: "rgba(255,194,91,0.09)",
    resolution: 1,
    yQuantize: 0,
    lineWidth: 1.4,
    blur: 11,
    labelAccent: "#ffe2a8",
  },
  {
    id: "lcd-white",
    buttonLabel: "LCD3",
    title: "White-backlit LCD scope",
    shellFill: "linear-gradient(180deg,#c6ccd5 0%,#9ca6b4 100%)",
    shellBorder: "#7c8796",
    shellShadow: "rgba(76, 96, 128, 0.16)",
    screen: "#E2E8F0",
    text: "#526074",
    gridMajor: "rgba(82, 96, 116, 0.18)",
    gridMinor: "rgba(82, 96, 116, 0.06)",
    traceA: "#2e3b4d",
    traceB: "#57667d",
    glow: "rgba(109,123,149,0.04)",
    scanline: "rgba(55, 71, 94, 0.010)",
    noise: "rgba(60,72,89,0.015)",
    resolution: 1,
    yQuantize: 0,
    lineWidth: 1.1,
    blur: 0,
    labelAccent: "#334155",
    fontMode: "lcd",
    isLCD: true,
    quantize: 3,
  },
  {
    id: "lcd-color",
    buttonLabel: "LCD4",
    title: "Low-resolution color LCD scope",
    shellFill: "linear-gradient(180deg,#212639 0%,#111521 100%)",
    shellBorder: "#4a5477",
    shellShadow: "rgba(120, 146, 255, 0.16)",
    screen: "#0F121D",
    text: "#8ea1bf",
    gridMajor: "rgba(142, 161, 191, 0.20)",
    gridMinor: "rgba(142, 161, 191, 0.06)",
    traceA: "#f6d65d",
    traceB: "#42d5df",
    glow: "rgba(108,144,255,0.05)",
    scanline: "rgba(148, 168, 255, 0.012)",
    noise: "rgba(120,146,255,0.015)",
    resolution: 1,
    yQuantize: 0,
    lineWidth: 1.15,
    blur: 0,
    labelAccent: "#c9d8f0",
    fontMode: "lcd",
    isLCD: true,
    quantize: 3,
  },
];

function prepareCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: rect.width, h: rect.height };
}

function formatSpectrumLabel(freqHz) {
  const khz = freqHz / 1000;
  return `${khz >= 10 ? khz.toFixed(0) : khz.toFixed(1)}k`;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function spectrogramColor(level) {
  const stops = [
    [0.0, [5, 6, 18]],
    [0.18, [34, 16, 74]],
    [0.38, [94, 33, 132]],
    [0.58, [181, 54, 122]],
    [0.76, [248, 101, 86]],
    [0.9, [253, 190, 110]],
    [1.0, [255, 244, 184]],
  ];
  const x = Math.max(0, Math.min(1, level));
  for (let i = 1; i < stops.length; i++) {
    if (x <= stops[i][0]) {
      const [p0, c0] = stops[i - 1];
      const [p1, c1] = stops[i];
      const t = (x - p0) / (p1 - p0 || 1);
      const r = Math.round(lerp(c0[0], c1[0], t));
      const g = Math.round(lerp(c0[1], c1[1], t));
      const b = Math.round(lerp(c0[2], c1[2], t));
      return `rgb(${r},${g},${b})`;
    }
  }
  return "rgb(255,244,184)";
}

function freqToY(freq, graphH) {
  const min = Math.log10(SPECGRAM_MIN_HZ);
  const max = Math.log10(SPECGRAM_MAX_HZ);
  const v = (Math.log10(Math.max(SPECGRAM_MIN_HZ, Math.min(SPECGRAM_MAX_HZ, freq))) - min) / (max - min);
  return Math.round(graphH - 1 - v * (graphH - 1));
}

function buildSpectrogramTicks(maxHz, graphH) {
  const ticks = [64,128,256,512,1024,2048,4096,8192,16000,22050]
    .filter((freq) => freq <= maxHz)
    .map((freq) => ({
      freq,
      y: Math.round(graphH - 1 - ((Math.log10(freq) - Math.log10(SPECGRAM_MIN_HZ)) / (Math.log10(maxHz) - Math.log10(SPECGRAM_MIN_HZ))) * (graphH - 1)),
    }));
  const accepted = [];
  [...ticks].sort((a, b) => b.freq - a.freq).forEach((tick) => {
    if (accepted.every((prev) => Math.abs(prev.y - tick.y) >= 11)) accepted.push(tick);
  });
  return accepted.sort((a, b) => a.freq - b.freq);
}

function buildWaterfallBins(graphPxH, freqBinCount, nyquist, visibleMaxHz) {
  const minLog = Math.log10(SPECGRAM_MIN_HZ);
  const maxLog = Math.log10(visibleMaxHz);
  return Array.from({ length: graphPxH }, (_, y) => {
    const topRatio = 1 - y / graphPxH;
    const bottomRatio = 1 - (y + 1) / graphPxH;
    const topFreq = 10 ** (minLog + topRatio * (maxLog - minLog));
    const bottomFreq = 10 ** (minLog + bottomRatio * (maxLog - minLog));
    const fHi = Math.min(nyquist, Math.max(topFreq, bottomFreq));
    const fLo = Math.max(SPECGRAM_MIN_HZ, Math.min(topFreq, bottomFreq));
    const startBin = Math.max(1, Math.floor(fLo / nyquist * freqBinCount));
    const endBin = Math.max(startBin + 1, Math.min(freqBinCount, Math.ceil(fHi / nyquist * freqBinCount)));
    return { startBin, endBin };
  });
}

function buildSpectrumBands(freqBinCount, sampleRate, bandCount) {
  const nyquist = sampleRate / 2;
  const minHz = Math.max(SPEC_MIN_HZ, sampleRate / Math.max(1, 4096));
  const minLog = Math.log10(minHz);
  const maxLog = Math.log10(nyquist);
  return Array.from({ length: bandCount }, (_, i) => {
    const startHz = 10 ** (minLog + (i / bandCount) * (maxLog - minLog));
    const endHz = 10 ** (minLog + ((i + 1) / bandCount) * (maxLog - minLog));
    const startBin = Math.max(1, Math.floor((startHz / nyquist) * freqBinCount));
    const endBin = Math.max(startBin + 1, Math.min(freqBinCount, Math.ceil((endHz / nyquist) * freqBinCount)));
    return {
      startBin,
      endBin,
      centerFreq: Math.sqrt(startHz * endHz),
    };
  });
}


function Player({
  playing, paused, playingSide, playingIdxRef, playPosRef, schedule, totalDur,
  playToken,
  meterMode, setMeterMode, simMode, setSimMode,
  deckProfile, setDeckProfile, toneProfile, setToneProfile, tubeEnabled, setTubeEnabled,
  vinylEra, setVinylEra, vinylCrackle, setVinylCrackle, playerVolume, setPlayerVolume,
  togglePause, stopPlayback, skipTrack, seekTo,
  analyserL, analyserR, T, fmtTime
}) {
  const meterElRef = useRef(null);
  const specRef = useRef(null);
  const spectrumLayoutRef = useRef(null);
  const waveRef = useRef(null);
  const waterfallRef = useRef(null);
  const scopeRef = useRef(null);
  const scopeFreezeRef = useRef({ left: IDLE_SCOPE_BUFFER, right: IDLE_SCOPE_BUFFER });
  const scopeInfoRef = useRef({ freqHz: 0 });
  const waterfallHistoryRef = useRef(null);
  const waterfallLayoutRef = useRef(null);
  const rafRef = useRef(null);
  const decayRef = useRef({dL:0,dR:0,pL:0,pR:0});
  const specPeakRef = useRef(Array.from({length: SPEC_BANDS}, () => ({ level: 0, hold: 0 })));
  const [scopeThemeIndex, setScopeThemeIndex] = useState(0);
  const [scopeFftSize, setScopeFftSize] = useState(1024);
  const [scopePrecisionPoints, setScopePrecisionPoints] = useState(65536);
  const [scopeZoom, setScopeZoom] = useState(0.7);
  const [scopeSmooth, setScopeSmooth] = useState(0.05);
  const [scopeLineScale, setScopeLineScale] = useState(0.2);
  const [scopeGlowScale, setScopeGlowScale] = useState(2);
  const [scopeGridScale, setScopeGridScale] = useState(3);
  const [scopeNoiseScale, setScopeNoiseScale] = useState(2);

  useEffect(() => {
    if (analyserL) analyserL.fftSize = scopeFftSize;
    if (analyserR) analyserR.fftSize = scopeFftSize;
  }, [analyserL, analyserR, scopeFftSize]);
  // DOM refs for direct 60fps update — no React re-render
  const posRef = useRef(null);
  const progRef = useRef(null);
  const nameRef = useRef(null);
  const numRef = useRef(null);
  const trackTimeRef = useRef(null);
  const reelLRef = useRef(null);
  const reelRRef = useRef(null);

  const st = schedule || [];
  const sideColor = "var(--side-a)";
  const boundaries = st.length > 1 ? st.slice(0, -1).map((s,i) => ({
    p: ((s.start + s.dur) / totalDur) * 100,
    t: st[i+1]?.start || (s.start + s.dur)
  })) : [];
  const contentEnd = st.length > 0 ? st[st.length - 1].start + st[st.length - 1].dur : 0;
  const tailBoundary = contentEnd > 0 && contentEnd < totalDur ? {
    p: (contentEnd / totalDur) * 100,
    t: contentEnd,
  } : null;

  const nextMode = useCallback(() => {
    setMeterMode(m => { const i = METER_MODES.indexOf(m); return METER_MODES[(i + 1) % METER_MODES.length]; });
  }, [setMeterMode]);
  const tapeSimActive = simMode.startsWith("TAPE_");
  const vinylSimActive = simMode === "vinyl";
  const simLabelMap = {
    off: T("simStateOffShort"),
    TAPE_I: T("simStateTapeIShort"),
    TAPE_II: T("simStateTapeIIShort"),
    TAPE_IV: T("simStateTapeIVShort"),
    vinyl: T("simStateVinylShort"),
  };
  const simTipMap = {
    off: T("simStateOffTip"),
    TAPE_I: T("simStateTapeITip"),
    TAPE_II: T("simStateTapeIITip"),
    TAPE_IV: T("simStateTapeIVTip"),
    vinyl: T("simStateVinylTip"),
  };
  const deckLabelMap = {
    off: T("deckStateOffShort"),
    portable: T("deckStatePortableShort"),
    deck_2: T("deckState2HeadShort"),
    deck_3: T("deckState3HeadShort"),
  };
  const deckTipMap = {
    off: T("deckStateOffTip"),
    portable: T("deckStatePortableTip"),
    deck_2: T("deckState2HeadTip"),
    deck_3: T("deckState3HeadTip"),
  };
  const toneLabelMap = {
    default: T("toneStateDefaultShort"),
    cool: T("toneStateCoolShort"),
    warm: T("toneStateWarmShort"),
  };
  const toneTipMap = {
    default: T("toneStateDefaultTip"),
    cool: T("toneStateCoolTip"),
    warm: T("toneStateWarmTip"),
  };
  const vinylEraLabelMap = {
    modern: T("vinylEraModernShort"),
    classic: T("vinylEraClassicShort"),
    vintage: T("vinylEraVintageShort"),
    effect: T("vinylEraEffectShort"),
  };
  const vinylEraTipMap = {
    modern: T("vinylEraModernTip"),
    classic: T("vinylEraClassicTip"),
    vintage: T("vinylEraVintageTip"),
    effect: T("vinylEraEffectTip"),
  };
  const vinylCrackleLabelMap = {
    off: T("crackleStateOffShort"),
    low: T("crackleStateLowShort"),
    mid: T("crackleStateMidShort"),
    high: T("crackleStateHighShort"),
  };
  const vinylCrackleTipMap = {
    off: T("crackleStateOffTip"),
    low: T("crackleStateLowTip"),
    mid: T("crackleStateMidTip"),
    high: T("crackleStateHighTip"),
  };
  const tubeLabel = tubeEnabled ? T("tubeStateOnShort") : T("tubeStateOffShort");
  const tubeTip = tubeEnabled ? T("tubeStateOnTip") : T("tubeStateOffTip");
  const simLabel = simLabelMap[simMode] || simMode;
  const simTitle = `${T("ctlSim")}: ${simTipMap[simMode] || simMode}`;
  const scopeTheme = OSCILLOSCOPE_THEMES[scopeThemeIndex];
  const getTrackCounter = useCallback((idx) => {
    if (st.length === 0) return "0/0";
    if (idx < 0) return `0/${st.length}`;
    return `${Math.min(idx + 1, st.length)}/${st.length}`;
  }, [st.length]);
  const getTrackTimeLabel = useCallback((pos, idx) => {
    const seg = st[idx];
    if (!seg) return "\u2014";
    const localPos = Math.max(0, Math.min(seg.dur, pos - seg.start));
    return `${fmtTime(localPos)} / ${fmtTime(seg.dur)}`;
  }, [fmtTime, st]);

  const handleSeek = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    seekTo(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * totalDur);
  }, [seekTo, totalDur]);

  useEffect(() => {
    const pos = playPosRef.current;
    const idx = playingIdxRef.current;
    const pct = totalDur > 0 ? (pos / totalDur) * 100 : 0;
    if (posRef.current) posRef.current.textContent = fmtTime(pos);
    if (progRef.current) progRef.current.style.width = `${Math.min(pct, 100)}%`;
    if (nameRef.current) nameRef.current.textContent = st[idx]?.name || "\u2014";
    if (numRef.current) numRef.current.textContent = getTrackCounter(idx);
    if (trackTimeRef.current) trackTimeRef.current.textContent = getTrackTimeLabel(pos, idx);
  }, [fmtTime, getTrackCounter, getTrackTimeLabel, playToken, st, totalDur, playPosRef, playingIdxRef]);

  useEffect(() => {
    const canvas = waterfallRef.current;
    if (!canvas) return;
    waterfallHistoryRef.current = null;
    waterfallLayoutRef.current = null;
    const { ctx, w, h } = prepareCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
  }, [playToken, meterMode]);

  useEffect(() => {
    if (meterMode !== "oscilloscope") return;
    const canvas = scopeRef.current;
    if (!canvas) return;
    const { ctx, w, h } = prepareCanvas(canvas);
    drawVectorscopeScreen({
      ctx,
      w,
      h,
      theme: scopeTheme,
      left: playing && paused ? scopeFreezeRef.current.left : IDLE_SCOPE_BUFFER,
      right: playing && paused ? scopeFreezeRef.current.right : IDLE_SCOPE_BUFFER,
      sampleRate: analyserL?.context?.sampleRate || 48000,
      fftSize: analyserL?.fftSize || 4096,
      side: playingSide,
      positionSec: playPosRef.current || 0,
      paused: !playing || paused,
      freqHz: scopeInfoRef.current.freqHz,
      precisionPoints: scopePrecisionPoints,
      zoom: scopeZoom,
      smoothing: scopeSmooth,
      lineScale: scopeLineScale,
      glowScale: scopeGlowScale,
      gridScale: scopeGridScale,
      noiseScale: scopeNoiseScale,
    });
  }, [meterMode, scopeTheme, analyserL, playing, paused, playingSide, playPosRef, playToken, scopePrecisionPoints, scopeZoom, scopeSmooth, scopeLineScale, scopeGlowScale, scopeGridScale, scopeNoiseScale]);

  useEffect(() => {
    if (!playing || !paused || !analyserL || !analyserR) return;
    const left = new Float32Array(analyserL.fftSize);
    const right = new Float32Array(analyserR.fftSize);
    analyserL.getFloatTimeDomainData(left);
    analyserR.getFloatTimeDomainData(right);
    scopeFreezeRef.current = { left, right };
    if (meterMode !== "oscilloscope" || !scopeRef.current) return;
    const { ctx, w, h } = prepareCanvas(scopeRef.current);
    drawVectorscopeScreen({
      ctx,
      w,
      h,
      theme: scopeTheme,
      left,
      right,
      sampleRate: analyserL.context.sampleRate || 48000,
      fftSize: analyserL.fftSize || 4096,
      side: playingSide,
      positionSec: playPosRef.current || 0,
      paused: true,
      freqHz: scopeInfoRef.current.freqHz,
      precisionPoints: scopePrecisionPoints,
      zoom: scopeZoom,
      smoothing: scopeSmooth,
      lineScale: scopeLineScale,
      glowScale: scopeGlowScale,
      gridScale: scopeGridScale,
      noiseScale: scopeNoiseScale,
    });
  }, [playing, paused, analyserL, analyserR, meterMode, scopeTheme, playingSide, playPosRef, scopePrecisionPoints, scopeZoom, scopeSmooth, scopeLineScale, scopeGlowScale, scopeGridScale, scopeNoiseScale]);

  // ── Animation loop ───────────────────────────────────────
  useEffect(() => {
    if (!playing || paused || !analyserL || !analyserR) return;
    let bufL = new Float32Array(analyserL.fftSize);
    let bufR = new Float32Array(analyserR.fftSize);
    const freqL = new Float32Array(analyserL.frequencyBinCount);
    const freqR = new Float32Array(analyserR.frequencyBinCount);
    const dr = decayRef.current;

    const tick = () => {
      if (bufL.length !== analyserL.fftSize) {
        bufL = new Float32Array(analyserL.fftSize);
        bufR = new Float32Array(analyserR.fftSize);
      }
      analyserL.getFloatTimeDomainData(bufL);
      analyserR.getFloatTimeDomainData(bufR);
      scopeFreezeRef.current = { left: bufL.slice(), right: bufR.slice() };
      let pkL = 0, pkR = 0;
      for (let i = 0; i < bufL.length; i++) {
        const l = Math.abs(bufL[i]), r = Math.abs(bufR[i]);
        if (l > pkL) pkL = l; if (r > pkR) pkR = r;
      }
      dr.dL = Math.max(pkL, dr.dL * 0.9); dr.dR = Math.max(pkR, dr.dR * 0.9);
      dr.pL = Math.max(pkL, dr.pL * 0.96); dr.pR = Math.max(pkR, dr.pR * 0.96);

      const el = meterElRef.current;
      if (el) {
        const upd = (chEl, decay, peak) => {
          if (!chEl) return;
          const s = chEl.children, lit = Math.round(decay * SEGS), pk = Math.min(SEGS - 1, Math.round(peak * SEGS));
          for (let j = 0; j < s.length; j++) s[j].style.opacity = j < lit ? "1" : j === pk ? "0.8" : "0.08";
        };
        upd(el.querySelector("[data-ch=L]"), dr.dL, dr.pL);
        upd(el.querySelector("[data-ch=R]"), dr.dR, dr.pR);
        const vuL = el.querySelector("[data-vu=L]"), vuR = el.querySelector("[data-vu=R]");
        if (vuL) vuL.style.transform = `rotate(${-50 + Math.min(dr.dL, 1) * 100}deg)`;
        if (vuR) vuR.style.transform = `rotate(${-50 + Math.min(dr.dR, 1) * 100}deg)`;
      }

      // Segmented spectrum
      const sc = specRef.current;
      const wfc = waterfallRef.current;
      const scopeCanvas = scopeRef.current;
      if (sc || wfc || scopeCanvas) {
        analyserL.getFloatFrequencyData(freqL); analyserR.getFloatFrequencyData(freqR);
        if (scopeCanvas) {
          scopeInfoRef.current.freqHz = estimateDominantFreqHz(freqL, freqR, analyserL.context.sampleRate || 48000, analyserL.fftSize || 4096);
        }
      }
      if (sc) {
        const { ctx, w, h } = prepareCanvas(sc);
        ctx.clearRect(0, 0, w, h);
        const labelH = 15;
        const meterH = Math.max(1, h - labelH);
        const bW = Math.floor(w / SPEC_BANDS), cH = Math.floor(meterH / SPEC_ROWS), gap = 2;
        const sampleRate = analyserL.context.sampleRate || 48000;
        const fftSize = analyserL.fftSize || 1024;
        let layout = spectrumLayoutRef.current;
        if (!layout || layout.freqBinCount !== freqL.length || layout.sampleRate !== sampleRate) {
          layout = {
            freqBinCount: freqL.length,
            sampleRate,
            bands: buildSpectrumBands(freqL.length, sampleRate, SPEC_BANDS),
          };
          spectrumLayoutRef.current = layout;
        }
        for (let b = 0; b < SPEC_BANDS; b++) {
          const band = layout.bands[b];
          let sum = 0;
          for (let k = band.startBin; k < band.endBin; k++) sum += Math.max(0, (freqL[k] + freqR[k]) / 2 + 100);
          const lvl = Math.min(1, sum / Math.max(1, band.endBin - band.startBin) / 100), litR = Math.round(lvl * SPEC_ROWS);
          const peak = specPeakRef.current[b];
          if (litR >= peak.level) {
            peak.level = litR;
            peak.hold = 60;
          } else if (peak.hold > 0) {
            peak.hold -= 1;
          } else {
            peak.level = Math.max(litR, peak.level - 0.22);
          }
          for (let r = 0; r < SPEC_ROWS; r++) {
            const rb = SPEC_ROWS - 1 - r;
            ctx.fillStyle = specRowColor(rb);
            ctx.globalAlpha = rb < litR ? 1.0 : 0.08;
            ctx.fillRect(
              Math.round(b * bW + gap),
              Math.round(r * cH + 2),
              Math.max(1, Math.floor(bW - gap * 2)),
              Math.max(1, Math.floor(cH - 4))
            );
          }
          const peakMarkerCount = Math.min(SPEC_ROWS, Math.max(litR + 1, Math.ceil(peak.level)));
          if (peak.level > 0.05 && litR < SPEC_ROWS && peakMarkerCount > litR) {
            const markerVisualRow = SPEC_ROWS - peakMarkerCount;
            const markerBandRow = peakMarkerCount - 1;
            ctx.globalAlpha = 0.98;
            ctx.fillStyle = specRowColor(markerBandRow);
            ctx.fillRect(
              Math.round(b * bW + gap),
              Math.round(markerVisualRow * cH + 2),
              Math.max(1, Math.floor(bW - gap * 2)),
              Math.max(1, Math.floor(cH - 4))
            );
          }
          if (bW >= 24 || b % 2 === 0) {
            ctx.globalAlpha = 0.75;
            ctx.fillStyle = "rgba(45,45,56,0.72)";
            ctx.font = "8px " + FONT;
            ctx.textAlign = "center";
            ctx.textBaseline = "alphabetic";
            ctx.fillText(formatSpectrumLabel(band.centerFreq), Math.round(b * bW + bW / 2), h - 3);
          }
        }
        ctx.globalAlpha = 1.0;
        ctx.textAlign = "start";
        ctx.textBaseline = "alphabetic";
      }

      // Waterfall spectrogram
      if (wfc) {
        const { ctx, w, h } = prepareCanvas(wfc);
        const dpr = window.devicePixelRatio || 1;
        const axisW = 40;
        const graphW = Math.max(1, w - axisW);
        const graphH = h;
        const sampleRate = analyserL.context.sampleRate || 48000;
        const fftSize = analyserL.fftSize || 1024;
        const nyquist = sampleRate / 2;
        const visibleMaxHz = Math.min(SPECGRAM_MAX_HZ, nyquist);
        const ticks = buildSpectrogramTicks(visibleMaxHz, graphH);
        const x0 = axisW;
        const scrollPx = Math.max(1, Math.round(SPECGRAM_SCROLL_PX * dpr));
        const graphPxW = Math.max(1, Math.round(graphW * dpr));
        const graphPxH = Math.max(1, Math.round(graphH * dpr));
        let history = waterfallHistoryRef.current;
        if (!history || history.width !== graphPxW || history.height !== graphPxH) {
          history = document.createElement("canvas");
          history.width = graphPxW;
          history.height = graphPxH;
          waterfallHistoryRef.current = history;
        }
        let layout = waterfallLayoutRef.current;
        if (!layout || layout.graphPxH !== graphPxH || layout.freqBinCount !== freqL.length || layout.visibleMaxHz !== visibleMaxHz) {
          layout = {
            graphPxH,
            freqBinCount: freqL.length,
            visibleMaxHz,
            rows: buildWaterfallBins(graphPxH, freqL.length, nyquist, visibleMaxHz),
          };
          waterfallLayoutRef.current = layout;
        }
        const hctx = history.getContext("2d");
        hctx.imageSmoothingEnabled = false;
        hctx.drawImage(history, scrollPx, 0, Math.max(0, graphPxW - scrollPx), graphPxH, 0, 0, Math.max(0, graphPxW - scrollPx), graphPxH);
        hctx.clearRect(graphPxW - scrollPx, 0, scrollPx, graphPxH);

        for (let y = 0; y < graphPxH; y++) {
          const { startBin, endBin } = layout.rows[y];
          let sum = 0;
          for (let k = startBin; k < endBin; k++) {
            const db = (freqL[k] + freqR[k]) * 0.5;
            sum += db;
          }
          const avgDb = sum / Math.max(1, endBin - startBin);
          const normalized = Math.max(0, Math.min(1, (avgDb + 92) / 72));
          const shaped = normalized ** 0.78;
          hctx.fillStyle = spectrogramColor(shaped);
          hctx.fillRect(graphPxW - scrollPx, y, scrollPx, 1);
        }

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "rgba(5,6,18,0.96)";
        ctx.fillRect(0, 0, w, h);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(history, x0, 0, graphW, graphH);

        ctx.globalAlpha = 0.42;
        ctx.strokeStyle = "rgba(255,255,255,0.16)";
        ctx.lineWidth = 1;
        ticks.forEach(({ y }) => {
          ctx.beginPath();
          ctx.moveTo(x0, y + 0.5);
          ctx.lineTo(w, y + 0.5);
          ctx.stroke();
        });

        ctx.globalAlpha = 1;
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.beginPath();
        ctx.moveTo(x0 + 0.5, 0);
        ctx.lineTo(x0 + 0.5, h);
        ctx.stroke();

        ctx.globalAlpha = 0.78;
        ctx.fillStyle = "rgba(255,255,255,0.86)";
        ctx.font = "9px " + FONT;
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ticks.forEach(({ freq, y }) => {
          const label = freq >= 1000 ? `${(freq/1000).toFixed(freq >= 10000 ? 0 : 1)}k` : `${freq}`;
          ctx.fillText(label, axisW - 6, y);
        });
        ctx.globalAlpha = 1;
        ctx.textAlign = "start";
        ctx.textBaseline = "alphabetic";
      }

      // Waveform — L top, R bottom, filled
      const wc = waveRef.current;
      if (wc) {
        const ctx = wc.getContext("2d"), w = wc.width, h = wc.height, qH = h / 4;
        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = "rgba(0,0,0,0.05)"; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(0, qH); ctx.lineTo(w, qH); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, qH * 3); ctx.lineTo(w, qH * 3); ctx.stroke();
        ctx.fillStyle = C_CYAN; ctx.globalAlpha = 0.65;
        ctx.beginPath(); ctx.moveTo(0, qH);
        for (let i = 0; i < bufL.length; i++) ctx.lineTo((i / bufL.length) * w, qH - bufL[i] * qH * 0.95);
        ctx.lineTo(w, qH); ctx.closePath(); ctx.fill();
        ctx.fillStyle = C_PINK; ctx.globalAlpha = 0.65;
        ctx.beginPath(); ctx.moveTo(0, qH * 3);
        for (let i = 0; i < bufR.length; i++) ctx.lineTo((i / bufR.length) * w, qH * 3 - bufR[i] * qH * 0.95);
        ctx.lineTo(w, qH * 3); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1; ctx.fillStyle = "rgba(0,0,0,0.15)"; ctx.font = "10px " + FONT;
        ctx.fillText("L", 4, 12); ctx.fillText("R", 4, qH * 2 + 12);
      }

      // Position display — direct DOM update, no React re-render
      const pos = playPosRef.current;
      const idx = playingIdxRef.current;
      const pct = totalDur > 0 ? (pos / totalDur) * 100 : 0;
      if (posRef.current) posRef.current.textContent = fmtTime(pos);
      if (progRef.current) progRef.current.style.width = `${Math.min(pct, 100)}%`;
      if (nameRef.current) nameRef.current.textContent = st[idx]?.name || "\u2014";
      if (numRef.current) numRef.current.textContent = getTrackCounter(idx);
      if (trackTimeRef.current) trackTimeRef.current.textContent = getTrackTimeLabel(pos, idx);
      // Reels
      const deg = pos * 120;
      if (reelLRef.current) reelLRef.current.style.transform = `rotate(${deg}deg)`;
      if (reelRRef.current) reelRRef.current.style.transform = `rotate(${-deg}deg)`;

      if (scopeCanvas) {
        const { ctx, w, h } = prepareCanvas(scopeCanvas);
        drawVectorscopeScreen({
          ctx,
          w,
          h,
          theme: scopeTheme,
          left: bufL,
          right: bufR,
          sampleRate: analyserL.context.sampleRate || 48000,
          fftSize: analyserL.fftSize || 4096,
          side: playingSide,
          positionSec: pos,
          paused,
          freqHz: scopeInfoRef.current.freqHz,
          precisionPoints: scopePrecisionPoints,
          zoom: scopeZoom,
          smoothing: scopeSmooth,
          lineScale: scopeLineScale,
          glowScale: scopeGlowScale,
          gridScale: scopeGridScale,
          noiseScale: scopeNoiseScale,
        });
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, paused, analyserL, analyserR, meterMode, playToken, getTrackCounter, getTrackTimeLabel, playingSide, scopeTheme, scopePrecisionPoints, scopeZoom, scopeSmooth, scopeLineScale, scopeGlowScale, scopeGridScale, scopeNoiseScale]);

  return (
    <div style={{marginBottom:12,background:"var(--bg-card)",borderRadius:12,padding:"14px 18px",
      border:`1px solid ${sideColor}`,fontFamily:FONT}}>

      {/* Reels + info */}
      <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:8}}>
        <div style={{width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <div ref={reelLRef} style={{width:24,height:24,borderRadius:"50%",border:"2px solid var(--border)",
            background:"radial-gradient(circle,var(--bg-deep) 30%,var(--bg) 70%)",
            display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{width:4,height:4,borderRadius:"50%",background:"var(--text-dim)"}}/>
          </div>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:2}}>
            <span style={{fontSize:12,color:sideColor,letterSpacing:"0.08em"}}>
              SIDE {playingSide}{paused?" — PAUSED":""}
            </span>
            <span ref={numRef} style={{fontSize:12,color:"var(--text-dim)"}}>1/{st.length}</span>
          </div>
          <div ref={nameRef} style={{fontSize:15,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {st[0]?.name||"\u2014"}
          </div>
          <div ref={trackTimeRef} style={{fontSize:11,color:"var(--text-dim)",marginTop:3}}>
            {st[0]?`${fmtTime(0)} / ${fmtTime(st[0].dur)}`:"\u2014"}
          </div>
        </div>
        <div style={{width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <div ref={reelRRef} style={{width:28,height:28,borderRadius:"50%",border:"2px solid var(--border)",
            background:"radial-gradient(circle,var(--bg-deep) 30%,var(--bg) 70%)",
            display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{width:4,height:4,borderRadius:"50%",background:"var(--text-dim)"}}/>
          </div>
        </div>
      </div>

      {/* Transport */}
      <div style={{display:"flex",justifyContent:"center",gap:4,marginBottom:8}}>
        {[
          {icon:<IconSkipPrev size={16}/>,fn:()=>skipTrack(-1),d:false,t:T("prevTrack")},
          {icon:paused?<IconPlay size={16}/>:<IconPause size={16}/>,fn:togglePause,d:false,t:paused?T("resume"):T("pause"),c:"var(--accent)"},
          {icon:<IconStop size={16}/>,fn:stopPlayback,d:false,t:T("stop"),c:"var(--danger)"},
          {icon:<IconSkipNext size={16}/>,fn:()=>skipTrack(1),d:false,t:T("nextTrack")},
        ].map((b,i)=>(
          <button key={i} onClick={b.fn} disabled={b.d} title={b.t}
            style={{width:38,height:32,display:"flex",alignItems:"center",justifyContent:"center",
              background:"var(--bg-deep)",border:"1px solid var(--border)",borderRadius:5,
              color:b.c||"var(--text)",cursor:b.d?"not-allowed":"pointer",opacity:b.d?0.35:1}}>{b.icon}</button>
        ))}
        <div style={{width:1,height:20,background:"var(--border)",alignSelf:"center",margin:"0 4px"}}/>
        <button onClick={nextMode} title={MODE_LABEL[meterMode]}
          style={{height:32,display:"flex",alignItems:"center",gap:4,padding:"0 12px",
            background:"var(--bg-deep)",border:"1px solid var(--border)",borderRadius:5,
            color:"var(--text-dim)",cursor:"pointer",fontSize:11}}>
          <IconEqualizer size={14}/>{MODE_LABEL[meterMode]}
        </button>
        {meterMode==="oscilloscope"&&(
          <button onClick={()=>setScopeThemeIndex(i => (i + 1) % OSCILLOSCOPE_THEMES.length)}
            title={scopeTheme.title}
            style={{height:32,display:"flex",alignItems:"center",gap:4,padding:"0 12px",
              background:scopeTheme.screen,border:`1px solid ${scopeTheme.shellBorder}`,borderRadius:5,
              color:scopeTheme.labelAccent,cursor:"pointer",fontSize:11,boxShadow:`inset 0 0 0 1px ${scopeTheme.gridMinor}`}}>
            <IconPalette size={14}/>{scopeTheme.buttonLabel}
          </button>
        )}
        <button onClick={()=>setSimMode(m=>SIM_MODES[(SIM_MODES.indexOf(m)+1)%SIM_MODES.length])}
          title={simTitle}
          style={{height:32,display:"flex",alignItems:"center",gap:4,padding:"0 12px",
            background:simMode==="off"?"var(--bg-deep)":"var(--accent-dim)",
            border:`1px solid ${simMode==="off"?"var(--border)":"var(--accent)"}`,borderRadius:5,
            color:simMode==="off"?"var(--text-dim)":"var(--accent)",cursor:"pointer",fontSize:11}}>
          <IconTape size={14}/>{simLabel}
        </button>
        {tapeSimActive&&(
          <>
            <button onClick={()=>setDeckProfile(m=>DECK_MODES[(DECK_MODES.indexOf(m)+1)%DECK_MODES.length])}
              title={`${T("ctlDeck")}: ${deckTipMap[deckProfile]}`}
              style={{height:32,display:"flex",alignItems:"center",gap:4,padding:"0 12px",
                background:deckProfile==="off"?"var(--bg-deep)":"var(--accent-dim)",
                border:`1px solid ${deckProfile==="off"?"var(--border)":"var(--accent)"}`,borderRadius:5,
                color:deckProfile==="off"?"var(--text-dim)":"var(--accent)",cursor:"pointer",fontSize:11}}>
              <IconDeck size={14}/>{deckLabelMap[deckProfile]}
            </button>
          </>
        )}
        {vinylSimActive&&(
          <>
            <button onClick={()=>setVinylEra(m=>VINYL_ERAS[(VINYL_ERAS.indexOf(m)+1)%VINYL_ERAS.length])}
              title={`${T("ctlVinylEra")}: ${vinylEraTipMap[vinylEra]}`}
              style={{height:32,display:"flex",alignItems:"center",gap:4,padding:"0 12px",
                background:"var(--accent-dim)",border:"1px solid var(--accent)",borderRadius:5,
                color:"var(--accent)",cursor:"pointer",fontSize:11}}>
              {vinylEraLabelMap[vinylEra]}
            </button>
            <button onClick={()=>setVinylCrackle(m=>VINYL_CRACKLE[(VINYL_CRACKLE.indexOf(m)+1)%VINYL_CRACKLE.length])}
              title={`${T("ctlCrackle")}: ${vinylCrackleTipMap[vinylCrackle]}`}
              style={{height:32,display:"flex",alignItems:"center",gap:4,padding:"0 12px",
                background:vinylCrackle==="off"?"var(--bg-deep)":"var(--accent-dim)",
                border:`1px solid ${vinylCrackle==="off"?"var(--border)":"var(--accent)"}`,borderRadius:5,
                color:vinylCrackle==="off"?"var(--text-dim)":"var(--accent)",cursor:"pointer",fontSize:11}}>
              {vinylCrackleLabelMap[vinylCrackle]}
            </button>
          </>
        )}
        <button onClick={()=>setToneProfile(m=>TONE_MODES[(TONE_MODES.indexOf(m)+1)%TONE_MODES.length])}
          title={`${T("ctlTone")}: ${toneTipMap[toneProfile]}`}
          style={{height:32,display:"flex",alignItems:"center",gap:4,padding:"0 12px",
            background:toneProfile==="default"?"var(--bg-deep)":"var(--accent-dim)",
            border:`1px solid ${toneProfile==="default"?"var(--border)":"var(--accent)"}`,borderRadius:5,
            color:toneProfile==="default"?"var(--text-dim)":"var(--accent)",cursor:"pointer",fontSize:11}}>
          <IconTone size={14}/>{toneLabelMap[toneProfile]}
        </button>
        <button onClick={()=>setTubeEnabled(v=>!v)}
          title={`${T("ctlTube")}: ${tubeTip}`}
          style={{height:32,display:"flex",alignItems:"center",gap:4,padding:"0 12px",
            background:tubeEnabled?"var(--accent-dim)":"var(--bg-deep)",
            border:`1px solid ${tubeEnabled?"var(--accent)":"var(--border)"}`,borderRadius:5,
            color:tubeEnabled?"var(--accent)":"var(--text-dim)",cursor:"pointer",fontSize:11}}>
          <IconTube size={14}/>{tubeLabel}
        </button>
        <div style={{height:32,display:"flex",alignItems:"center",gap:8,padding:"0 10px",
          background:"var(--bg-card)",border:"1px solid var(--accent-dim)",borderRadius:5,color:"var(--text-dim)",fontSize:11}}>
          <span style={{color:"var(--accent)",letterSpacing:"0.08em"}}>VOL</span>
          <input className="playerVolRange" type="range" min="0" max="100" step="1" value={Math.round(playerVolume*100)}
            onChange={(e)=>setPlayerVolume(Number(e.target.value)/100)}
            style={{width:84,"--vol-pct":`${Math.round(playerVolume * 100)}%`}}/>
          <span style={{minWidth:28,textAlign:"right",color:"var(--accent-ink)"}}>{Math.round(playerVolume*100)}%</span>
        </div>
      </div>

      {/* Progress bar with dot markers */}
      <div style={{marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--text-dim)",marginBottom:3}}>
          <span ref={posRef}>{fmtTime(0)}</span><span>{fmtTime(totalDur)}</span>
        </div>
        <div onClick={handleSeek}
          style={{height:10,background:"var(--bg-deep)",borderRadius:5,cursor:"pointer",position:"relative"}}>
          <div ref={progRef} style={{height:"100%",width:"0%",background:sideColor,borderRadius:5,pointerEvents:"none"}}/>
          {boundaries.map((b,i)=>(
            <div key={i}
              onClick={(e)=>{e.stopPropagation();seekTo(b.t);}}
              style={{position:"absolute",left:`${b.p}%`,top:"50%",transform:"translate(-50%,-50%)",
                width:12,height:12,borderRadius:"50%",background:"var(--bg-card)",
                border:`2px solid var(--text-dim)`,cursor:"pointer",zIndex:2}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.transform="translate(-50%,-50%) scale(1.2)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--text-dim)";e.currentTarget.style.transform="translate(-50%,-50%) scale(1)";}}
            />
          ))}
          {tailBoundary&&(
            <div
              onClick={(e)=>{e.stopPropagation();seekTo(tailBoundary.t);}}
              style={{position:"absolute",left:`${tailBoundary.p}%`,top:"50%",transform:"translate(-50%,-50%)",
                width:12,height:12,borderRadius:"50%",background:"var(--bg-card)",
                border:`2px solid ${sideColor}`,cursor:"pointer",zIndex:2}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--accent)";e.currentTarget.style.transform="translate(-50%,-50%) scale(1.2)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=sideColor;e.currentTarget.style.transform="translate(-50%,-50%) scale(1)";}}
            />
          )}
        </div>
      </div>

      {/* Visualization */}
      <div ref={meterElRef} style={{background:"var(--bg-card)",borderRadius:8,padding:"10px 12px",border:"1px solid var(--border)"}}>
        {meterMode==="vfd" && <VFDMeter/>}
        {meterMode==="vu" && <VUMeter/>}
        {meterMode==="spectrum" && <canvas ref={specRef} width={SPEC_BANDS * 48} height={SPEC_ROWS * 24}
          style={{width:"100%",height:168,borderRadius:4,display:"block"}}/>}
        {meterMode==="waveform" && <canvas ref={waveRef} width={2048} height={280}
          style={{width:"100%",height:140,borderRadius:4,display:"block"}}/>}
        {meterMode==="waterfall" && <canvas ref={waterfallRef} width={1536} height={384}
          style={{width:"100%",height:200,borderRadius:4,display:"block",background:"#050612"}}/>}
        {meterMode==="oscilloscope" && (
          <div style={{
            padding: 18,
            borderRadius: 20,
            background: scopeTheme.shellFill,
            border: `1.5px solid ${scopeTheme.shellBorder}`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 18px 32px ${scopeTheme.shellShadow}`,
            position: "relative"
          }}>
            <canvas ref={scopeRef}
              style={{width:"100%",height:296,borderRadius:16,display:"block",background:scopeTheme.screen}}/>
            
            <div style={{
              position: "absolute", top: 18, right: 18, bottom: 18, width: 84,
              borderLeft: `1.5px solid ${scopeTheme.gridMajor}`,
              background: withAlpha(scopeTheme.screen, 0.4),
              display: "flex", flexDirection: "column",
              borderTopRightRadius: 16, borderBottomRightRadius: 16,
              overflow: "hidden"
            }}>
              {[
                { label: "MEMORY", value: scopeFftSize, cycle: () => setScopeFftSize(v => { const o = [1024, 2048, 4096, 8192, 16384, 32768]; return o[(o.indexOf(v)+1)%o.length] || 32768; }) },
                { label: "PRECIS", value: scopePrecisionPoints, cycle: () => setScopePrecisionPoints(v => { const o = [1024, 2048, 4096, 8192, 16384, 32768, 65536]; return o[(o.indexOf(v)+1)%o.length] || 65536; }) },
                { label: "ZOOM", value: scopeZoom.toFixed(2), cycle: () => setScopeZoom(v => { const o = [0.5, 0.7, 0.85, 1.0, 1.25, 1.5, 2.0]; return o[(o.indexOf(v)+1)%o.length] || 0.7; }) },
                { label: "SMOOTH", value: scopeSmooth.toFixed(2), cycle: () => setScopeSmooth(v => { const o = [0.01, 0.05, 0.1, 0.28, 0.5, 0.8]; return o[(o.indexOf(v)+1)%o.length] || 0.05; }) },
                { label: "LINE", value: scopeLineScale.toFixed(2), cycle: () => setScopeLineScale(v => { const o = [0.2, 0.5, 1.0, 1.5, 2.0]; return o[(o.indexOf(v)+1)%o.length] || 0.2; }) },
                { label: "GLOW", value: scopeGlowScale, cycle: () => setScopeGlowScale(v => (v + 1) % 5) },
                { label: "GRID", value: scopeGridScale, cycle: () => setScopeGridScale(v => (v + 1) % 5) },
              ].map((item, idx, arr) => (
                <div key={item.label} onClick={item.cycle} style={{
                  flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
                  borderBottom: idx === arr.length - 1 ? "none" : `1px solid ${withAlpha(scopeTheme.gridMajor, 0.5)}`,
                  cursor: "pointer", userSelect: "none",
                  color: scopeTheme.text, fontSize: scopeTheme.isLCD ? 13 : 11, fontFamily: scopeTheme.isLCD ? LCD_FONT : "monospace",
                  background: "transparent", transition: "background 0.1s"
                }}
                onMouseEnter={e => e.currentTarget.style.background = withAlpha(scopeTheme.gridMinor, 0.5)}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div style={{opacity: 0.7, fontSize: scopeTheme.isLCD ? 11 : 10}}>{item.label}</div>
                  <div style={{color: scopeTheme.labelAccent, fontWeight: "bold", marginTop: 2, fontSize: scopeTheme.isLCD ? 15 : undefined}}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(Player);

// ── VFD Segment Meter ──────────────────────────────────────
function VFDMeter() {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:4}}>
      {["L","R"].map(ch=>(
        <div key={ch} style={{display:"flex",alignItems:"center",gap:3,height:16}}>
          <span style={{fontSize:10,color:"var(--accent)",width:10,textAlign:"center"}}>{ch}</span>
          <div data-ch={ch} style={{flex:1,display:"flex",gap:2}}>
            {SEG_COLORS.map((c,i)=><div key={i} style={{flex:1,height:14,background:c,borderRadius:1,opacity:0.08}}/>)}
          </div>
        </div>
      ))}
      <div style={{display:"flex",alignItems:"center",gap:3,height:12,marginTop:1}}>
        <span style={{width:10}}/>
        <div style={{flex:1,position:"relative",fontSize:9,color:"var(--text-dim)"}}>
          {[[-40,0],[-20,6],[-10,12],[-6,16],[-3,18],[0,20],["+3",22]].map(([db,seg])=>(
            <span key={String(db)} style={{position:"absolute",left:`${(seg/SEGS)*100}%`,transform:"translateX(-50%)"}}>{db}</span>
          ))}
          <span style={{position:"absolute",right:0}}>dB</span>
        </div>
      </div>
    </div>
  );
}

// ── VU Needle Meter (Rina themed) ──────────────────────────
function VUMeter() {
  return (
    <div style={{display:"flex",justifyContent:"center",gap:16}}>
      {["L","R"].map(ch=>(
        <div key={ch} style={{position:"relative",width:"48%",maxWidth:280,borderRadius:10,overflow:"hidden",
          background:"linear-gradient(180deg,var(--accent-dim) 0%,var(--bg-card) 100%)",
          border:"1px solid var(--border)"}}>
          <svg viewBox="0 0 140 82" style={{width:"100%",display:"block"}}>
            <path d="M16 70 A54 54 0 0 1 124 70" fill="none" stroke="var(--border)" strokeWidth="0.5"/>
            {[0,0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1.0].map((v,i)=>{
              const a=(-50+v*100)*Math.PI/180, r1=v>=0.7?38:40, r2=v*10%2===0?50:47;
              return <line key={i} x1={70+Math.sin(a)*r1} y1={70-Math.cos(a)*r1}
                x2={70+Math.sin(a)*r2} y2={70-Math.cos(a)*r2}
                stroke={v>=0.7?"var(--accent)":"var(--text-dim)"} strokeWidth={v*10%2===0?"0.7":"0.3"}/>;
            })}
            {VU_DB.map(([db,v])=>{
              const a=(-50+v*100)*Math.PI/180;
              return <text key={String(db)} x={70+Math.sin(a)*33} y={70-Math.cos(a)*33}
                textAnchor="middle" dominantBaseline="central" fill="var(--text-dim)" fontSize="5.5">{db}</text>;
            })}
            <text x="70" y="13" textAnchor="middle" fill="var(--text-dim)" fontSize="8">{ch}</text>
            <line data-vu={ch} x1="70" y1="70" x2="70" y2="18" stroke="var(--accent)" strokeWidth="0.8" strokeLinecap="round"
              style={{transformOrigin:"70px 70px",transform:"rotate(-50deg)",transition:"transform 0.08s ease-out"}}/>
            <circle cx="70" cy="70" r="3.5" fill="var(--accent)"/>
            <text x="70" y="79" textAnchor="middle" fill="var(--text-dim)" fontSize="5">VU</text>
          </svg>
        </div>
      ))}
    </div>
  );
}

function drawVectorscopeScreen({
  ctx,
  w,
  h,
  theme,
  left,
  right,
  sampleRate,
  fftSize,
  side,
  positionSec,
  paused,
  freqHz,
  precisionPoints,
  zoom,
  smoothing,
  lineScale,
  glowScale,
  gridScale,
  noiseScale,
}) {
  if (theme.isLCD) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = theme.screen;
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.fillStyle = withAlpha(theme.screen, 0.25);
    ctx.fillRect(0, 0, w, h);
  }

  const rightMargin = 104; // Leaves room for the right-side OSD menu without traces colliding with it
  const padX = 22;
  const padTop = theme.isLCD ? 26 : theme.fontMode === "dot" ? 34 : 20;
  const padBottom = 24;
  const plotSize = Math.max(1, Math.min(w - padX * 2 - rightMargin, h - padTop - padBottom));
  const plotRect = {
    x: Math.round((w - rightMargin - plotSize) / 2),
    y: padTop,
    w: plotSize,
    h: plotSize,
  };

  drawVectorscopeGrid(ctx, plotRect, theme, gridScale);

  drawVectorscopeTrace(
    ctx,
    left,
    right,
    plotRect,
    theme,
    precisionPoints,
    zoom,
    smoothing,
    lineScale,
    glowScale
  );

  drawScopeNoise(ctx, w, h, theme, noiseScale);
  drawScopeOverlay(ctx, w, h, theme);
  drawVectorscopeLabels(ctx, {
    theme,
    w,
    h,
    sampleRate,
    fftSize,
    side,
    positionSec,
    paused,
    freqHz,
  });
}

function drawVectorscopeGrid(ctx, rect, theme, gridScale = 1) {
  const cols = 8;
  const rows = 8;
  const centerX = rect.x + rect.w / 2;
  const centerY = rect.y + rect.h / 2;
  ctx.save();
  ctx.strokeStyle = withAlpha(theme.gridMinor, alphaOf(theme.gridMinor) * gridScale);
  ctx.setLineDash([1, 6]);
  for (let i = 1; i < cols; i += 1) {
    const x = rect.x + (rect.w / cols) * i;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, rect.y);
    ctx.lineTo(x + 0.5, rect.y + rect.h);
    ctx.stroke();
  }
  for (let i = 1; i < rows; i += 1) {
    const y = rect.y + (rect.h / rows) * i;
    ctx.beginPath();
    ctx.moveTo(rect.x, y + 0.5);
    ctx.lineTo(rect.x + rect.w, y + 0.5);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = withAlpha(theme.gridMajor, alphaOf(theme.gridMajor) * gridScale);
  ctx.lineWidth = 1.2;
  ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);

  ctx.beginPath();
  ctx.moveTo(centerX + 0.5, rect.y);
  ctx.lineTo(centerX + 0.5, rect.y + rect.h);
  ctx.moveTo(rect.x, centerY + 0.5);
  ctx.lineTo(rect.x + rect.w, centerY + 0.5);
  ctx.stroke();

  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.moveTo(rect.x, rect.y + rect.h);
  ctx.lineTo(rect.x + rect.w, rect.y);
  ctx.moveTo(rect.x, rect.y);
  ctx.lineTo(rect.x + rect.w, rect.y + rect.h);
  ctx.strokeStyle = withAlpha(theme.gridMinor, alphaOf(theme.gridMinor) * gridScale);
  ctx.stroke();

  ctx.strokeStyle = withAlpha(theme.gridMajor, alphaOf(theme.gridMajor) * 0.36 * gridScale);
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(centerX, centerY, rect.w * 0.18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(centerX, centerY, rect.w * 0.36, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawVectorscopeTrace(ctx, leftSamples, rightSamples, rect, theme, precisionPoints, zoom, smoothing, lineScale = 1, glowScale = 1) {
  const limit = Math.min(leftSamples.length, rightSamples.length);
  const desiredPoints = precisionPoints || 6144;
  const smooth = smoothing || 0.28;
  const step = smooth <= 0.02 ? 1 : Math.max(1, Math.floor(limit / desiredPoints));
  const centerX = rect.x + rect.w / 2;
  const centerY = rect.y + rect.h / 2;
  const radius = rect.w * 0.485;
  let avgL = 0;
  let avgR = 0;
  let velL = 0;
  let velR = 0;
  const spring = smooth * 0.8;
  const friction = 0.82 + (smooth * 0.1);
  const safeZoom = Math.max(0.05, zoom || 0.7);
  const scale = radius * safeZoom;
  const points = [];
  for (let i = 0; i < limit; i += step) {
    const l = leftSamples[i] || 0;
    const r = rightSamples[i] || 0;
    if (smooth <= 0.02) {
      avgL = l;
      avgR = r;
    } else {
      velL += (l - avgL) * spring;
      velR += (r - avgR) * spring;
      velL *= friction;
      velR *= friction;
      avgL += velL;
      avgR += velR;
    }
    const xRaw = centerX + avgL * scale;
    const yRaw = centerY - avgR * scale;
    const quantize = theme.quantize || theme.yQuantize;
    points.push({
      x: quantize ? Math.round(xRaw / quantize) * quantize : xRaw,
      y: quantize ? Math.round(yRaw / quantize) * quantize : yRaw,
    });
  }
  ctx.save();
  ctx.strokeStyle = theme.traceA;
  ctx.shadowColor = theme.glow;
  ctx.shadowBlur = theme.blur * glowScale;
  ctx.lineWidth = (theme.lineWidth + (theme.blur > 0 ? 1.1 : 0.2)) * lineScale;
  ctx.globalAlpha = theme.blur > 0 ? 0.18 : 0.72;
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    if (i === 0) ctx.moveTo(points[i].x, points[i].y);
    else ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();

  ctx.shadowBlur = theme.blur > 0 ? theme.blur * 0.55 * glowScale : 0;
  ctx.lineWidth = theme.lineWidth * lineScale;
  ctx.globalAlpha = theme.blur > 0 ? 0.9 : 0.96;
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    if (i === 0) ctx.moveTo(points[i].x, points[i].y);
    else ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();

  if (!theme.isLCD) {
    ctx.globalAlpha = 0.08 * glowScale;
    ctx.fillStyle = theme.glow;
    ctx.shadowBlur = 0;
    for (let i = 0; i < points.length; i += 2) {
      ctx.fillRect(points[i].x - 0.75, points[i].y - 0.75, 1.5, 1.5);
    }
  }

  ctx.restore();
}

function drawScopeNoise(ctx, w, h, theme, noiseScale = 1) {
  ctx.save();
  ctx.fillStyle = withAlpha(theme.noise, alphaOf(theme.noise) * noiseScale);
  for (let i = 0; i < 42; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const size = theme.resolution >= 3 ? 2 : 1;
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
}

function drawScopeOverlay(ctx, w, h, theme) {
  ctx.save();
  if (!theme.isLCD && theme.fontMode !== "dot") {
    for (let y = 0; y < h; y += 3) {
      ctx.fillStyle = theme.scanline;
      ctx.fillRect(0, y, w, 1);
    }
  }
  const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.1, w / 2, h / 2, Math.max(w, h) * 0.65);
  vignette.addColorStop(0, "rgba(255,255,255,0)");
  vignette.addColorStop(1, theme.isLCD || theme.fontMode === "dot" ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.34)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawVectorscopeLabels(ctx, {
  theme,
  w,
  h,
  sampleRate,
  fftSize,
  side,
  positionSec,
  paused,
  freqHz,
}) {
  const topLeft = `FREQ ${formatScopeFrequency(freqHz)}`;
  const topCenter = paused ? "XY Hold" : "XY Vector";
  const bottomLeft = "L-R";
  const bottomMidLeft = formatScopeChannelInfo(sampleRate, fftSize);
  const bottomCenter = `${side || "A"} ${formatScopeClock(positionSec)}`;
  const bottomRight = "L+R";
  const rightMargin = 104;
  const effectiveW = w - rightMargin;

  if (theme.fontMode === "dot") {
    drawBitmapText(ctx, topLeft, 12, 8, { color: theme.text, align: "left", baseline: "top", scale: 1.5, gap: 1 });
    drawBitmapText(ctx, topCenter, effectiveW / 2, 8, { color: theme.labelAccent, align: "center", baseline: "top", scale: 1.8, gap: 1 });
    drawBitmapText(ctx, "AUTO", effectiveW - 6, 8, { color: theme.text, align: "right", baseline: "top", scale: 1.8, gap: 1 });
    drawBitmapText(ctx, bottomLeft, 12, h - 8, { color: theme.text, align: "left", baseline: "bottom", scale: 1.8, gap: 1 });
    drawBitmapText(ctx, bottomMidLeft, 58, h - 8, { color: theme.text, align: "left", baseline: "bottom", scale: 1.8, gap: 1 });
    drawBitmapText(ctx, bottomCenter, effectiveW / 2, h - 8, { color: theme.labelAccent, align: "center", baseline: "bottom", scale: 1.8, gap: 1 });
    drawBitmapText(ctx, bottomRight, effectiveW - 6, h - 8, { color: theme.text, align: "right", baseline: "bottom", scale: 1.8, gap: 1 });
    return;
  }
  const labelFont = theme.isLCD ? LCD_FONT : FONT;
  const labelFontSize = theme.isLCD ? 16 : 11;
  ctx.save();
  ctx.font = `${labelFontSize}px ${labelFont}`;
  ctx.fillStyle = theme.text;
  ctx.textBaseline = "top";
  ctx.fillText(topLeft, 12, 8);
  ctx.textAlign = "center";
  ctx.fillStyle = theme.labelAccent;
  ctx.fillText(topCenter, effectiveW / 2, 8);
  ctx.textAlign = "right";
  ctx.fillStyle = theme.text;
  ctx.fillText("Auto", effectiveW - 6, 8);
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText(bottomLeft, 12, h - 8);
  ctx.fillText(bottomMidLeft, 54, h - 8);
  ctx.textAlign = "center";
  ctx.fillText(bottomCenter, effectiveW / 2, h - 8);
  ctx.textAlign = "right";
  ctx.fillText(bottomRight, effectiveW - 6, h - 8);
  ctx.restore();
}

function drawBitmapText(ctx, text, x, y, { color, align = "left", baseline = "top", scale = 1.8, gap = 1 }) {
  const chars = String(text).split("");
  const glyphW = 5;
  const glyphH = 7;
  const advance = glyphW + gap;
  const renderedW = chars.reduce((sum, _ch, index) => sum + glyphW + (index === chars.length - 1 ? 0 : gap), 0) * scale;
  const renderedH = glyphH * scale;
  let drawX = x;
  let drawY = y;
  if (align === "center") drawX -= renderedW / 2;
  if (align === "right") drawX -= renderedW;
  if (baseline === "bottom") drawY -= renderedH;
  ctx.save();
  ctx.fillStyle = color;
  chars.forEach((char, index) => {
    const glyph = BITMAP_FONT[char] || BITMAP_FONT[char.toUpperCase()] || BITMAP_FONT[" "];
    for (let py = 0; py < glyphH; py++) {
      const row = glyph[py] || "00000";
      for (let px = 0; px < glyphW; px++) {
        if (row[px] !== "1") continue;
        ctx.fillRect(
          Math.round(drawX + (index * advance + px) * scale),
          Math.round(drawY + py * scale),
          Math.max(1, scale * 0.82),
          Math.max(1, scale * 0.82)
        );
      }
    }
  });
  ctx.restore();
}

function formatScopeChannelInfo(sampleRate, fftSize) {
  const timePerDivSec = (fftSize / sampleRate) / 10;
  if (timePerDivSec >= 1e-3) return `M ${(timePerDivSec * 1e3).toFixed(timePerDivSec >= 0.01 ? 1 : 2)}ms`;
  return `M ${(timePerDivSec * 1e6).toFixed(0)}us`;
}

function formatScopeClock(sec) {
  const total = Math.max(0, sec || 0);
  const mins = Math.floor(total / 60);
  const secs = Math.floor(total % 60).toString().padStart(2, "0");
  const millis = Math.floor((total % 1) * 1000).toString().padStart(3, "0");
  return `${mins}:${secs}.${millis}`;
}

function formatScopeFrequency(freqHz) {
  const value = Math.max(0, freqHz || 0);
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 1 : 2)}kHz`;
  return `${value.toFixed(value >= 100 ? 0 : 1)}Hz`;
}

function estimateDominantFreqHz(freqL, freqR, sampleRate, fftSize) {
  const binCount = Math.min(freqL.length, freqR.length);
  let bestBin = 1;
  let bestDb = -Infinity;
  for (let i = 2; i < binCount; i++) {
    const freq = (i * sampleRate) / fftSize;
    if (freq < 20 || freq > 20000) continue;
    const db = (freqL[i] + freqR[i]) * 0.5;
    if (db > bestDb) {
      bestDb = db;
      bestBin = i;
    }
  }
  return (bestBin * sampleRate) / fftSize;
}

function alphaOf(color) {
  const match = String(color).match(/rgba?\(([^)]+)\)/i);
  if (!match) return 1;
  const parts = match[1].split(",").map((part) => part.trim());
  return parts.length >= 4 ? Number(parts[3]) || 1 : 1;
}

function withAlpha(color, alpha) {
  const match = String(color).match(/rgba?\(([^)]+)\)/i);
  if (match) {
    const parts = match[1].split(",").map((part) => part.trim());
    const [r = "0", g = "0", b = "0"] = parts;
    return `rgba(${r},${g},${b},${Math.max(0, alpha)})`;
  }
  if (String(color).startsWith("#")) {
    const hex = color.slice(1);
    const full = hex.length === 3 ? hex.split("").map((ch) => ch + ch).join("") : hex;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${Math.max(0, alpha)})`;
  }
  return color;
}
