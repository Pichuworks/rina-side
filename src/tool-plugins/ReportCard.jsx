import React, { useState, useCallback, useMemo } from "react";

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function TagBadge({ label, color }) {
  const isHex = color?.startsWith("#");
  const bg = isHex ? hexToRgba(color, 0.15) : "var(--bg-deep)";
  const text = isHex ? color : "var(--text)";
  const border = isHex ? hexToRgba(color, 0.4) : "var(--border)";
  return (
    <span style={{
      fontSize: 10, padding: "1px 6px", borderRadius: 4, fontWeight: 600,
      background: bg, color: text, border: `1px solid ${border}`,
      flexShrink: 0, whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

/**
 * Mini inline SVG frequency response chart.
 * chartData: { frequencyGridHz: number[], curves: Array<{ db: number[], color: string, label?: string, dash?: string }> }
 */
function MiniFreqChart({ chartData, large = false }) {
  if (!chartData?.frequencyGridHz?.length || !chartData.curves?.length) return null;
  const W = 760, H = large ? 300 : 180, PAD = { l: 42, r: 12, t: 20, b: 24 };
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const freqs = chartData.frequencyGridHz;
  const logMin = Math.log10(Math.max(20, freqs[0]));
  const logMax = Math.log10(Math.min(20000, freqs[freqs.length - 1]));
  const logRange = logMax - logMin || 1;

  // Auto-scale Y
  let yMin = -12, yMax = 12;
  for (const curve of chartData.curves) {
    for (const v of (curve.db || [])) {
      if (Number.isFinite(v)) { yMin = Math.min(yMin, v - 1); yMax = Math.max(yMax, v + 1); }
    }
  }
  const yRange = yMax - yMin || 1;

  const toX = (freq) => PAD.l + ((Math.log10(Math.max(1, freq)) - logMin) / logRange) * plotW;
  const toY = (db) => PAD.t + (1 - ((db - yMin) / yRange)) * plotH;

  const gridFreqs = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
  const gridDbStep = yRange > 20 ? 6 : yRange > 10 ? 3 : 2;
  const gridDbs = [];
  for (let db = Math.ceil(yMin / gridDbStep) * gridDbStep; db <= yMax; db += gridDbStep) gridDbs.push(db);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: "block" }}>
      {/* Grid lines */}
      {gridFreqs.map((f) => f >= freqs[0] && f <= freqs[freqs.length - 1] ? (
        <line key={`gf${f}`} x1={toX(f)} x2={toX(f)} y1={PAD.t} y2={H - PAD.b} stroke="var(--border)" strokeWidth={0.5} />
      ) : null)}
      {gridDbs.map((db) => (
        <g key={`gd${db}`}>
          <line x1={PAD.l} x2={W - PAD.r} y1={toY(db)} y2={toY(db)} stroke={db === 0 ? "var(--text-dim)" : "var(--border)"} strokeWidth={db === 0 ? 0.8 : 0.5} />
          <text x={PAD.l - 6} y={toY(db) + 4} textAnchor="end" fontSize={10} fill="var(--text-dim)">{db > 0 ? `+${db}` : db}</text>
        </g>
      ))}
      {/* Freq labels */}
      {[100, 1000, 10000].map((f) => (
        <text key={`fl${f}`} x={toX(f)} y={H - 4} textAnchor="middle" fontSize={10} fill="var(--text-dim)">
          {f >= 1000 ? `${f / 1000}k` : f}
        </text>
      ))}
      {/* Curves */}
      {chartData.curves.map((curve, ci) => {
        if (!curve.db?.length) return null;
        const points = [];
        for (let i = 0; i < freqs.length; i++) {
          const db = curve.db[i];
          if (!Number.isFinite(db)) continue;
          points.push(`${toX(freqs[i]).toFixed(1)},${toY(db).toFixed(1)}`);
        }
        return (
          <polyline
            key={ci}
            points={points.join(" ")}
            fill="none"
            stroke={curve.color || "#888"}
            strokeWidth={1.6}
            strokeDasharray={curve.dash || undefined}
          />
        );
      })}
      {/* Legend */}
      {chartData.curves.filter((c) => c.label).map((curve, ci) => (
        <g key={`lg${ci}`}>
          <line
            x1={PAD.l + ci * 110}
            x2={PAD.l + ci * 110 + 18}
            y1={8}
            y2={8}
            stroke={curve.color || "#888"}
            strokeWidth={1.8}
            strokeDasharray={curve.dash || undefined}
          />
          <text x={PAD.l + ci * 110 + 24} y={11} fontSize={10} fill="var(--text-dim)">{curve.label}</text>
        </g>
      ))}
    </svg>
  );
}

/**
 * ReportCard — collapsible inline report display with priority tags and optional chart.
 *
 * Props:
 *   summary: string
 *   full: string
 *   tags: Array<{ label, color, priority }>
 *   lang: string
 *   chartData: { frequencyGridHz, curves: [{ db, color, label }] } — optional
 */
export function ReportCard({ summary, full, tags = [], lang = "zh-CN", chartData }) {
  const [expanded, setExpanded] = useState(false);
  const [chartLarge, setChartLarge] = useState(false);

  const handleSave = useCallback(() => {
    if (!full) return;
    const blob = new Blob([full], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "side-report.md"; a.click();
    URL.revokeObjectURL(url);
  }, [full]);

  if (!summary && !full) return null;

  const resolvedTags = tags.slice(0, 5).map((tag) => ({
    label: typeof tag.label === "object" ? (tag.label[lang] || tag.label["zh-CN"] || tag.label.en || "?") : tag.label,
    color: tag.color || "#888",
  }));
  const chartActionLabel = useMemo(() => (
    chartLarge
      ? (lang === "ja" ? "縮小" : lang === "en" ? "Shrink" : "缩小")
      : (lang === "ja" ? "拡大" : lang === "en" ? "Enlarge" : "放大")
  ), [chartLarge, lang]);

  return (
    <div style={{
      padding: "10px 14px",
      border: "1px solid var(--accent-dim, var(--border))",
      borderRadius: 10, background: "var(--bg)",
      fontSize: 12, lineHeight: 1.8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {resolvedTags.map((tag, i) => (
          <TagBadge key={i} label={tag.label} color={tag.color} />
        ))}
        <span style={{ flex: 1, color: "var(--text)", minWidth: 80 }}>{summary}</span>
        {full && (
          <button onClick={() => setExpanded((v) => !v)}
            style={{ background: "none", border: "none", fontSize: 11, color: "var(--accent-ink)", cursor: "pointer", padding: "2px 6px", flexShrink: 0 }}>
            {expanded ? "▲ 收起" : "▼ 详细"}
          </button>
        )}
      </div>
      {expanded && full && (
        <div style={{ marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
          {chartData && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                <button
                  onClick={() => setChartLarge((value) => !value)}
                  style={{ padding: "5px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-deep)", cursor: "pointer", color: "var(--text)", fontSize: 11 }}
                >
                  {chartActionLabel}
                </button>
              </div>
              <MiniFreqChart chartData={chartData} large={chartLarge} />
            </div>
          )}
          <pre style={{ fontFamily: "inherit", whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12, lineHeight: 1.8, margin: 0, color: "var(--text-dim)" }}>
            {full}
          </pre>
          <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
            <button onClick={handleSave}
              style={{ padding: "5px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg-deep)", cursor: "pointer", color: "var(--text)", fontSize: 11 }}>
              保存报告
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
