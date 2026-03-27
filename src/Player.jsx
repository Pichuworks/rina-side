import { memo, useRef, useEffect, useCallback } from "react";
import { IconSkipPrev, IconSkipNext, IconPlay, IconPause, IconStop, IconEqualizer, IconTape, IconDeck, IconTone, IconTube } from "./Icons.jsx";

// ── Theme colors ───────────────────────────────────────────
const C_CYAN = "#90C7D7";
const C_AMBER = "#DFA026";
const C_PINK = "#D4859A";
const C_RED = "#C45050";

const SEGS = 24;
const SEG_COLORS = Array.from({length:SEGS},(_,i)=>{
  if(i<12) return C_CYAN; if(i<18) return C_AMBER; if(i<21) return C_PINK; return C_RED;
});

const SPEC_BANDS = 16;
const SPEC_ROWS = 12;
const specRowColor = (r) => { if(r<6) return C_CYAN; if(r<9) return C_AMBER; if(r<11) return C_PINK; return C_RED; };
const SPECGRAM_MIN_HZ = 32;
const SPECGRAM_MAX_HZ = 22050;
const SPECGRAM_SCROLL_PX = 2;

const VU_DB = [[-20,0],[-10,0.25],[-7,0.35],[-5,0.45],[-3,0.55],[0,0.7],["+3",0.85]];
const METER_MODES = ["vfd","vu","spectrum","waveform","waterfall"];
const SIM_MODES = ["off","TAPE_I","TAPE_II","TAPE_IV","vinyl"];
const DECK_MODES = ["off","portable","deck_2","deck_3"];
const TONE_MODES = ["default","cool","warm"];
const VINYL_ERAS = ["modern","classic","vintage","effect"];
const VINYL_CRACKLE = ["off","low","mid","high"];
const MODE_LABEL = {vfd:"VFD",vu:"VU",spectrum:"FFT",waveform:"WAVE",waterfall:"SGRAM"};
const FONT = "'Noto Sans SC','Noto Sans JP','Hiragino Sans','Microsoft YaHei',system-ui,sans-serif";

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
  const waveRef = useRef(null);
  const waterfallRef = useRef(null);
  const waterfallHistoryRef = useRef(null);
  const rafRef = useRef(null);
  const decayRef = useRef({dL:0,dR:0,pL:0,pR:0});
  const specPeakRef = useRef(Array.from({length: SPEC_BANDS}, () => ({ level: 0, hold: 0 })));
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
    const { ctx, w, h } = prepareCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
  }, [playToken, meterMode]);

  // ── Animation loop ───────────────────────────────────────
  useEffect(() => {
    if (!playing || paused || !analyserL || !analyserR) return;
    const bufL = new Float32Array(analyserL.fftSize);
    const bufR = new Float32Array(analyserR.fftSize);
    const freqL = new Float32Array(analyserL.frequencyBinCount);
    const freqR = new Float32Array(analyserR.frequencyBinCount);
    const dr = decayRef.current;

    const tick = () => {
      analyserL.getFloatTimeDomainData(bufL);
      analyserR.getFloatTimeDomainData(bufR);
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
      if (sc || wfc) {
        analyserL.getFloatFrequencyData(freqL); analyserR.getFloatFrequencyData(freqR);
      }
      if (sc) {
        const { ctx, w, h } = prepareCanvas(sc);
        ctx.clearRect(0, 0, w, h);
        const labelH = 16;
        const meterH = Math.max(1, h - labelH);
        const bW = Math.floor(w / SPEC_BANDS), cH = Math.floor(meterH / SPEC_ROWS), gap = 4;
        const bPer = Math.floor(freqL.length / SPEC_BANDS);
        const sampleRate = analyserL.context.sampleRate || 48000;
        const fftSize = analyserL.fftSize || 1024;
        for (let b = 0; b < SPEC_BANDS; b++) {
          let sum = 0;
          const startBin = b * bPer;
          const endBin = Math.min((b + 1) * bPer, freqL.length);
          for (let k = startBin; k < endBin; k++) sum += Math.max(0, (freqL[k] + freqR[k]) / 2 + 100);
          const lvl = Math.min(1, sum / bPer / 100), litR = Math.round(lvl * SPEC_ROWS);
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
          const centerBin = startBin + Math.max(0, endBin - startBin - 1) / 2;
          const centerFreq = centerBin * sampleRate / fftSize;
          ctx.globalAlpha = 0.75;
          ctx.fillStyle = "rgba(45,45,56,0.72)";
          ctx.font = "8px " + FONT;
          ctx.textAlign = "center";
          ctx.textBaseline = "alphabetic";
          ctx.fillText(formatSpectrumLabel(centerFreq), Math.round(b * bW + bW / 2), h - 3);
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
        const hctx = history.getContext("2d");
        hctx.imageSmoothingEnabled = false;
        hctx.drawImage(history, scrollPx, 0, Math.max(0, graphPxW - scrollPx), graphPxH, 0, 0, Math.max(0, graphPxW - scrollPx), graphPxH);
        hctx.clearRect(graphPxW - scrollPx, 0, scrollPx, graphPxH);

        for (let y = 0; y < graphPxH; y++) {
          const topRatio = 1 - y / graphPxH;
          const bottomRatio = 1 - (y + 1) / graphPxH;
          const topFreq = 10 ** (Math.log10(SPECGRAM_MIN_HZ) + topRatio * (Math.log10(visibleMaxHz) - Math.log10(SPECGRAM_MIN_HZ)));
          const bottomFreq = 10 ** (Math.log10(SPECGRAM_MIN_HZ) + bottomRatio * (Math.log10(visibleMaxHz) - Math.log10(SPECGRAM_MIN_HZ)));
          const fHi = Math.min(nyquist, Math.max(topFreq, bottomFreq));
          const fLo = Math.max(SPECGRAM_MIN_HZ, Math.min(topFreq, bottomFreq));
          const startBin = Math.max(1, Math.floor(fLo / nyquist * freqL.length));
          const endBin = Math.max(startBin + 1, Math.min(freqL.length, Math.ceil(fHi / nyquist * freqL.length)));
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

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, paused, analyserL, analyserR, meterMode, playToken, getTrackCounter, getTrackTimeLabel]);

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
          background:"var(--bg-deep)",border:"1px solid var(--border)",borderRadius:5,color:"var(--text-dim)",fontSize:11}}>
          <span>VOL</span>
          <input type="range" min="0" max="100" step="1" value={Math.round(playerVolume*100)}
            onChange={(e)=>setPlayerVolume(Number(e.target.value)/100)}
            style={{width:84}}/>
          <span style={{minWidth:28,textAlign:"right"}}>{Math.round(playerVolume*100)}%</span>
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
          style={{width:"100%",height:150,borderRadius:4,display:"block"}}/>}
        {meterMode==="waveform" && <canvas ref={waveRef} width={2048} height={280}
          style={{width:"100%",height:140,borderRadius:4,display:"block"}}/>}
        {meterMode==="waterfall" && <canvas ref={waterfallRef} width={1536} height={320}
          style={{width:"100%",height:180,borderRadius:4,display:"block",background:"#050612"}}/>}
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
