import React, { useState, useCallback } from "react";

/**
 * ReportCard — collapsible inline report display.
 *
 * Props:
 *   summary: string — 1-line summary always visible
 *   full: string — full markdown-ish report (shown on expand)
 *   onSave: () => void — optional, shows save button
 *   accentLabel: string — optional label badge (e.g. "璃奈" / "Rina")
 */
export function ReportCard({ summary, full, onSave, accentLabel }) {
  const [expanded, setExpanded] = useState(false);

  const handleSave = useCallback(() => {
    if (!full || !onSave) return;
    const blob = new Blob([full], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "side-report.md";
    a.click();
    URL.revokeObjectURL(url);
    onSave();
  }, [full, onSave]);

  if (!summary && !full) return null;

  return (
    <div style={{
      padding: "10px 14px",
      border: "1px solid var(--accent-dim, var(--border))",
      borderRadius: 10,
      background: "var(--bg)",
      fontSize: 12,
      lineHeight: 1.8,
    }}>
      {/* Summary row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {accentLabel && (
          <span style={{
            fontSize: 10,
            padding: "1px 6px",
            borderRadius: 4,
            background: "var(--accent-dim)",
            color: "var(--accent-ink)",
            flexShrink: 0,
            fontWeight: 600,
          }}>
            {accentLabel}
          </span>
        )}
        <span style={{ flex: 1, color: "var(--text)" }}>{summary}</span>
        {full && (
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              background: "none",
              border: "none",
              fontSize: 11,
              color: "var(--accent-ink)",
              cursor: "pointer",
              padding: "2px 6px",
              flexShrink: 0,
            }}
          >
            {expanded ? "▲ 收起" : "▼ 详细"}
          </button>
        )}
      </div>

      {/* Expanded full report */}
      {expanded && full && (
        <div style={{ marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
          <pre style={{
            fontFamily: "inherit",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontSize: 12,
            lineHeight: 1.8,
            margin: 0,
            color: "var(--text-dim)",
          }}>
            {full}
          </pre>
          {onSave && (
            <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={handleSave}
                style={{
                  padding: "5px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  background: "var(--bg-deep)",
                  cursor: "pointer",
                  color: "var(--text)",
                  fontSize: 11,
                }}
              >
                保存报告
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
