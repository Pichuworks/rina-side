import { useRef, useEffect, memo } from "react";

const MIN_HZ = 40;

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
      return `rgb(${Math.round(lerp(c0[0], c1[0], t))},${Math.round(lerp(c0[1], c1[1], t))},${Math.round(lerp(c0[2], c1[2], t))})`;
    }
  }
  return "rgb(255,244,184)";
}

function mapDbToLevel(db) {
  const normalized = Math.max(0, Math.min(1, (db + 92) / 74));
  return normalized ** 0.78;
}

function buildTicks(maxHz, h) {
  const ticks = [1000, 4000, 8000, 12000, 16000, 22050]
    .filter((freq) => freq <= maxHz)
    .map((freq) => ({
      freq,
      y: Math.round(h - 1 - ((Math.log10(freq) - Math.log10(MIN_HZ)) / (Math.log10(maxHz) - Math.log10(MIN_HZ))) * (h - 1)),
    }));
  const accepted = [];
  [...ticks].sort((a, b) => b.freq - a.freq).forEach((tick) => {
    if (accepted.every((prev) => Math.abs(prev.y - tick.y) >= 11)) accepted.push(tick);
  });
  return accepted.sort((a, b) => a.freq - b.freq);
}

const SideSpectrogram = memo(function SideSpectrogram({ segments }) {
  const cvsRef = useRef(null);
  const depKey = segments.map((s) => `${s.id}:${s.dur.toFixed(2)}:${s.gap.toFixed(2)}:${(s.gain||1).toFixed(4)}:${s.spectrogram?.frames || 0}:${s.spectrogram?.bands || 0}`).join(",");

  useEffect(() => {
    const cvs = cvsRef.current;
    if (!cvs || !segments.length) return;

    const draw = () => {
      const { ctx, w, h } = prepareCanvas(cvs);
      const axisW = 28;
      const graphW = Math.max(1, w - axisW);
      const totalSec = segments.reduce((s, seg) => s + seg.dur + seg.gap, 0);
      const visibleMaxHz = Math.max(MIN_HZ * 2, ...segments.map((seg) => seg.spectrogram?.maxHz || MIN_HZ));
      const ticks = buildTicks(visibleMaxHz, h);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgba(5,6,18,0.96)";
      ctx.fillRect(0, 0, w, h);
      if (totalSec <= 0) return;

      let xOff = axisW;
      segments.forEach((seg) => {
        const { spectrogram, dur, gap, gain } = seg;
        const gainDb = 20 * Math.log10(Math.max(gain || 1, 1e-6));
        const trackW = Math.max(1, Math.round((dur / totalSec) * graphW));
        if (spectrogram && spectrogram.frames > 0 && spectrogram.bands > 0) {
          const { frames, bands, valuesDb } = spectrogram;
          for (let fi = 0; fi < frames; fi++) {
            const x0 = xOff + Math.round((fi / frames) * trackW);
            const x1 = xOff + Math.round(((fi + 1) / frames) * trackW);
            const cellW = Math.max(1, x1 - x0);
            for (let bi = 0; bi < bands; bi++) {
              const v = mapDbToLevel(valuesDb[fi * bands + bi] + gainDb);
              const y0 = Math.round(((bands - 1 - bi) / bands) * h);
              const y1 = Math.round(((bands - bi) / bands) * h);
              ctx.fillStyle = spectrogramColor(v);
              ctx.fillRect(x0, y0, cellW, Math.max(1, y1 - y0));
            }
          }
        }
        xOff += trackW;
        if (gap > 0) {
          const gapW = Math.max(1, Math.round((gap / totalSec) * graphW));
          ctx.fillStyle = "rgba(255,255,255,0.05)";
          ctx.fillRect(xOff, 0, gapW, h);
          ctx.fillStyle = "rgba(255,255,255,0.12)";
          ctx.fillRect(xOff + Math.floor(gapW / 2), 0, 1, h);
          xOff += gapW;
        }
      });

      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      ctx.lineWidth = 1;
      ticks.forEach(({ y }) => {
        ctx.beginPath();
        ctx.moveTo(axisW, y + 0.5);
        ctx.lineTo(w, y + 0.5);
        ctx.stroke();
      });

      ctx.globalAlpha = 0.82;
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.font = "9px system-ui,sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ticks.forEach(({ freq, y }) => {
        const label = freq >= 1000 ? `${(freq / 1000).toFixed(freq >= 10000 ? 0 : 1)}k` : `${freq}`;
        ctx.fillText(label, axisW - 5, y);
      });
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.moveTo(axisW + 0.5, 0);
      ctx.lineTo(axisW + 0.5, h);
      ctx.stroke();
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(cvs);
    return () => ro.disconnect();
  }, [depKey, segments]);

  if (!segments.length) return null;
  return <canvas ref={cvsRef} style={{ width: "100%", height: 112, borderRadius: 6, background: "#050612", border: "1px solid var(--border)" }} />;
});

export default SideSpectrogram;
