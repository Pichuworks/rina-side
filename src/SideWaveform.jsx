import { useRef, useEffect, memo } from "react";

const PEAK_N = 2048; // must match downsamplePeaks() in App.jsx

/**
 * Static waveform overview for one side.
 * Uses pre-downsampled peaks (2048 min/max pairs per channel per track).
 * Drawing cost: ~2048 × numTracks reads — negligible.
 */
const SideWaveform = memo(function SideWaveform({ segments }) {
  const cvsRef = useRef(null);

  const depKey = segments.map(s =>
    `${s.id}:${s.dur.toFixed(2)}:${s.gain.toFixed(4)}:${s.gap.toFixed(2)}`
  ).join(",");

  useEffect(() => {
    const cvs = cvsRef.current;
    if (!cvs || !segments.length) return;
    const ctx = cvs.getContext("2d");
    const w = cvs.width, h = cvs.height, qH = h / 4;
    ctx.clearRect(0, 0, w, h);

    const totalSec = segments.reduce((s, seg) => s + seg.dur + seg.gap, 0);
    if (totalSec <= 0) return;

    // Center lines
    ctx.strokeStyle = "rgba(0,0,0,0.06)"; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(0, qH); ctx.lineTo(w, qH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, qH * 3); ctx.lineTo(w, qH * 3); ctx.stroke();

    let xOff = 0;
    segments.forEach((seg) => {
      const { peaks, gain, dur, gap, channels } = seg;
      if (!peaks || !peaks.length) { xOff += Math.round((dur + gap) / totalSec * w); return; }

      const trackW = Math.max(1, Math.round((dur / totalSec) * w));
      const peaksL = peaks[0];
      const peaksR = channels > 1 && peaks[1] ? peaks[1] : peaksL;

      // L channel (top half) — envelope from peaks
      ctx.fillStyle = "#90C7D7"; ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.moveTo(xOff, qH);
      for (let x = 0; x < trackW; x++) {
        const pi = Math.min(PEAK_N - 1, Math.floor((x / trackW) * PEAK_N));
        const mx = Math.min(peaksL[pi * 2 + 1] * gain, 1);
        ctx.lineTo(xOff + x, qH - mx * qH * 0.9);
      }
      for (let x = trackW - 1; x >= 0; x--) {
        const pi = Math.min(PEAK_N - 1, Math.floor((x / trackW) * PEAK_N));
        const mn = Math.max(peaksL[pi * 2] * gain, -1);
        ctx.lineTo(xOff + x, qH - mn * qH * 0.9);
      }
      ctx.closePath(); ctx.fill();

      // R channel (bottom half)
      ctx.fillStyle = "#D4859A"; ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.moveTo(xOff, qH * 3);
      for (let x = 0; x < trackW; x++) {
        const pi = Math.min(PEAK_N - 1, Math.floor((x / trackW) * PEAK_N));
        const mx = Math.min(peaksR[pi * 2 + 1] * gain, 1);
        ctx.lineTo(xOff + x, qH * 3 - mx * qH * 0.9);
      }
      for (let x = trackW - 1; x >= 0; x--) {
        const pi = Math.min(PEAK_N - 1, Math.floor((x / trackW) * PEAK_N));
        const mn = Math.max(peaksR[pi * 2] * gain, -1);
        ctx.lineTo(xOff + x, qH * 3 - mn * qH * 0.9);
      }
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      xOff += trackW;

      // Gap: single thin dashed center line
      if (gap > 0) {
        const gapW = Math.max(1, Math.round((gap / totalSec) * w));
        ctx.setLineDash([2, 2]); ctx.strokeStyle = "rgba(0,0,0,0.12)"; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(xOff + gapW / 2, 0); ctx.lineTo(xOff + gapW / 2, h); ctx.stroke();
        ctx.setLineDash([]);
        xOff += gapW;
      }
    });

    ctx.globalAlpha = 0.2; ctx.fillStyle = "#2D2D38"; ctx.font = "10px system-ui,sans-serif";
    ctx.fillText("L", 4, 14); ctx.fillText("R", 4, qH * 2 + 14); ctx.globalAlpha = 1;
  }, [depKey]);

  if (!segments.length) return null;
  return <canvas ref={cvsRef} width={1024} height={120}
    style={{ width: "100%", height: 100, borderRadius: 6, background: "#FAFAF8", border: "1px solid #E0DDD8" }} />;
});

export default SideWaveform;
