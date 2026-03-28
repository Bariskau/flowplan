import { useMemo } from "react";
import type { HistoryEntry } from "../types";
import { T } from "../lib/theme";
import { computeDiff } from "../lib/diff";

interface HistoryPanelProps {
  entries: HistoryEntry[];
  selectedIdx: number | null;
  onSelect: (idx: number | null) => void;
  onClose: () => void;
  onClear: () => void;
}

/* Protocol emerald */
const emerald = "#10b981";
const emeraldDim = "rgba(16,185,129,0.12)";

/* ---- Action badge colors (Protocol-style method badges) ---- */
const actionStyle: Record<string, { color: string; bg: string; label: string }> = {
  add:     { color: emerald,  bg: emeraldDim,                 label: "ADD" },
  remove:  { color: "#f43f5e", bg: "rgba(244,63,94,0.12)",    label: "REMOVE" },
  update:  { color: "#f59e0b", bg: "rgba(245,158,11,0.12)",   label: "UPDATE" },
  reorder: { color: "#a78bfa", bg: "rgba(167,139,250,0.12)",  label: "REORDER" },
  clear:   { color: "#f43f5e", bg: "rgba(244,63,94,0.12)",    label: "CLEAR" },
  create:  { color: emerald,  bg: emeraldDim,                 label: "CREATE" },
};

function getActionBadge(action: string) {
  return actionStyle[action] || { color: "rgba(255,255,255,0.5)", bg: "rgba(255,255,255,0.06)", label: action.toUpperCase() };
}

/* ---- Inline SVG Icons ---- */
const Ico = {
  close: (c: string, s = 14) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M4 4l8 8M12 4l-8 8" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  trash: (c: string, s = 13) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v8.5a1 1 0 001 1h4a1 1 0 001-1V4" stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  history: (c: string, s = 16) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M2 8a6 6 0 1112 0A6 6 0 012 8z" stroke={c} strokeWidth="1.3" />
      <path d="M8 5v3.5l2.5 1.5" stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

/* ---- Timestamp formatting ---- */
function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ---- HistoryPanel ---- */
function HistoryPanel({ entries, selectedIdx, onSelect, onClose, onClear }: HistoryPanelProps) {
  /* Reverse entries so newest is first */
  const reversed = useMemo(() => {
    return entries.map((entry, idx) => ({ entry, idx })).reverse();
  }, [entries]);

  /* Compute diffs between consecutive entries for highlighting */
  const diffs = useMemo(() => {
    return entries.map((entry, idx) => {
      if (idx === 0) return null;
      return computeDiff(entries[idx - 1].cards, entry.cards);
    });
  }, [entries]);

  return (
    <div
      style={{
        width: 280,
        height: "100%",
        background: "rgba(24,24,27,0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderLeft: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      {/* ---- Header ---- */}
      <div
        style={{
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {Ico.history("rgba(255,255,255,0.5)", 15)}
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#f4f4f5",
              letterSpacing: "-0.01em",
            }}
          >
            History
          </span>
          <span
            style={{
              fontSize: 11,
              fontFamily: T.m,
              color: "rgba(255,255,255,0.4)",
              background: "rgba(255,255,255,0.06)",
              padding: "2px 7px",
              borderRadius: 6,
              fontWeight: 500,
            }}
          >
            {entries.length}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {entries.length > 0 && (
            <button
              onClick={onClear}
              title="Clear history"
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6,
                cursor: "pointer",
                width: 28,
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e: any) => {
                e.currentTarget.style.background = "rgba(244,63,94,0.12)";
                e.currentTarget.style.borderColor = "rgba(244,63,94,0.3)";
              }}
              onMouseLeave={(e: any) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
              }}
            >
              {Ico.trash("rgba(255,255,255,0.4)", 12)}
            </button>
          )}
          <button
            onClick={onClose}
            title="Close history"
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6,
              cursor: "pointer",
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e: any) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
            }}
            onMouseLeave={(e: any) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
            }}
          >
            {Ico.close("rgba(255,255,255,0.4)", 12)}
          </button>
        </div>
      </div>

      {/* ---- Entries List ---- */}
      <div style={{ flex: 1, overflow: "auto", padding: "8px 10px" }}>
        {entries.length === 0 && (
          <div style={{ padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", lineHeight: 1.6 }}>
              No history entries yet
            </div>
          </div>
        )}

        {reversed.map(({ entry, idx }) => {
          const selected = selectedIdx === idx;
          const badge = getActionBadge(entry.action);
          const diff = diffs[idx];

          return (
            <div
              key={entry.id}
              onClick={() => onSelect(selected ? null : idx)}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                cursor: "pointer",
                marginBottom: 4,
                background: selected ? "rgba(255,255,255,0.04)" : "transparent",
                borderLeft: selected ? `2px solid ${emerald}` : "2px solid transparent",
                transition: "all 0.2s ease",
                position: "relative",
              }}
              onMouseEnter={(e: any) => {
                if (!selected) e.currentTarget.style.background = "rgba(255,255,255,0.03)";
              }}
              onMouseLeave={(e: any) => {
                e.currentTarget.style.background = selected ? "rgba(255,255,255,0.04)" : "transparent";
              }}
            >
              {/* Top row: badge + timestamp */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: T.m,
                    color: badge.color,
                    background: badge.bg,
                    padding: "2px 7px",
                    borderRadius: 5,
                    letterSpacing: "0.05em",
                    lineHeight: 1.4,
                  }}
                >
                  {badge.label}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.3)",
                    fontFamily: T.m,
                    fontWeight: 400,
                  }}
                >
                  {formatTime(entry.timestamp)}
                </span>
              </div>

              {/* Description */}
              <div
                style={{
                  fontSize: 12.5,
                  color: selected ? "#e4e4e7" : "rgba(255,255,255,0.6)",
                  lineHeight: 1.5,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  transition: "color 0.2s ease",
                }}
              >
                {entry.description}
              </div>

              {/* Card count + diff summary */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                <span
                  style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.3)",
                    fontFamily: T.m,
                  }}
                >
                  {entry.cards.length} card{entry.cards.length !== 1 ? "s" : ""}
                </span>
                {diff && diff.added.length > 0 && (
                  <span style={{ fontSize: 10, color: emerald, fontFamily: T.m, fontWeight: 600 }}>
                    +{diff.added.length}
                  </span>
                )}
                {diff && diff.removed.length > 0 && (
                  <span style={{ fontSize: 10, color: "#f43f5e", fontFamily: T.m, fontWeight: 600 }}>
                    -{diff.removed.length}
                  </span>
                )}
                {diff && diff.modified.length > 0 && (
                  <span style={{ fontSize: 10, color: "#f59e0b", fontFamily: T.m, fontWeight: 600 }}>
                    ~{diff.modified.length}
                  </span>
                )}
              </div>

              {/* Subtle separator between entries */}
              {idx !== reversed[reversed.length - 1]?.idx && (
                <div
                  style={{
                    position: "absolute",
                    bottom: -2,
                    left: 12,
                    right: 12,
                    height: 1,
                    background: "rgba(255,255,255,0.04)",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ---- Footer ---- */}
      <div
        style={{
          padding: "10px 16px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.3)",
            fontFamily: T.m,
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          {selectedIdx !== null ? (
            <span>
              Viewing entry <span style={{ color: emerald, fontWeight: 600 }}>#{selectedIdx + 1}</span>
            </span>
          ) : (
            "Click entry to preview"
          )}
        </div>
      </div>
    </div>
  );
}

export default HistoryPanel;
