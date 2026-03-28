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

/* ---- Action badge colors ---- */
const actionStyle: Record<string, { color: string; bg: string; label: string }> = {
  add: { color: T.green, bg: T.gD, label: "Add" },
  remove: { color: T.red, bg: T.rD, label: "Remove" },
  update: { color: T.orange, bg: T.oD, label: "Update" },
  reorder: { color: T.purple, bg: T.pD, label: "Reorder" },
  clear: { color: T.ter, bg: "rgba(255,255,255,0.06)", label: "Clear" },
  create: { color: T.accent, bg: T.aD, label: "Create" },
};

function getActionBadge(action: string) {
  const s = actionStyle[action] || { color: T.sec, bg: "rgba(255,255,255,0.06)", label: action };
  return s;
}

/* ---- Inline SVG Icons ---- */
const Ico = {
  close: (c: string, s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M4 4l8 8M12 4l-8 8" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  trash: (c: string, s = 11) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v8.5a1 1 0 001 1h4a1 1 0 001-1V4" stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  history: (c: string, s = 14) => (
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
        width: 260,
        height: "100%",
        background: "rgba(20,20,20,0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderLeft: "0.5px solid rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      {/* ---- Header ---- */}
      <div
        style={{
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `0.5px solid ${T.border}`,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {Ico.history(T.sec, 13)}
          <span style={{ fontSize: 11, fontWeight: 700, color: T.text, letterSpacing: "0.02em" }}>History</span>
          <span
            style={{
              fontSize: 9,
              fontFamily: T.m,
              color: T.ter,
              background: "rgba(255,255,255,0.04)",
              padding: "1px 5px",
              borderRadius: 4,
              fontWeight: 500,
            }}
          >
            {entries.length}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {entries.length > 0 && (
            <button
              onClick={onClear}
              title="Clear history"
              style={{
                background: "none",
                border: `0.5px solid ${T.border}`,
                borderRadius: 5,
                cursor: "pointer",
                width: 22,
                height: 22,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                transition: "all 0.12s",
              }}
              onMouseEnter={(e: any) => {
                e.currentTarget.style.background = T.rD;
                e.currentTarget.style.borderColor = T.red;
              }}
              onMouseLeave={(e: any) => {
                e.currentTarget.style.background = "none";
                e.currentTarget.style.borderColor = T.border;
              }}
            >
              {Ico.trash(T.ter, 10)}
            </button>
          )}
          <button
            onClick={onClose}
            title="Close history"
            style={{
              background: "none",
              border: `0.5px solid ${T.border}`,
              borderRadius: 5,
              cursor: "pointer",
              width: 22,
              height: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              transition: "all 0.12s",
            }}
            onMouseEnter={(e: any) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.08)";
              e.currentTarget.style.borderColor = T.accent;
            }}
            onMouseLeave={(e: any) => {
              e.currentTarget.style.background = "none";
              e.currentTarget.style.borderColor = T.border;
            }}
          >
            {Ico.close(T.ter, 10)}
          </button>
        </div>
      </div>

      {/* ---- Entries List ---- */}
      <div style={{ flex: 1, overflow: "auto", padding: "6px 8px" }}>
        {entries.length === 0 && (
          <div style={{ padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 10, color: T.ter, lineHeight: 1.6 }}>No history entries yet</div>
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
                padding: "8px 10px",
                borderRadius: 7,
                cursor: "pointer",
                marginBottom: 2,
                background: selected ? T.aD : "transparent",
                border: `0.5px solid ${selected ? T.accent : "transparent"}`,
                transition: "all 0.12s",
              }}
              onMouseEnter={(e: any) => {
                if (!selected) e.currentTarget.style.background = "rgba(255,255,255,0.04)";
              }}
              onMouseLeave={(e: any) => {
                e.currentTarget.style.background = selected ? T.aD : "transparent";
              }}
            >
              {/* Top row: badge + timestamp */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    fontFamily: T.m,
                    color: badge.color,
                    background: badge.bg,
                    padding: "1px 6px",
                    borderRadius: 4,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {badge.label}
                </span>
                <span style={{ fontSize: 9, color: T.ter, fontFamily: T.m }}>{formatTime(entry.timestamp)}</span>
              </div>

              {/* Description */}
              <div
                style={{
                  fontSize: 11,
                  color: selected ? T.text : T.sec,
                  lineHeight: 1.5,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {entry.description}
              </div>

              {/* Card count + diff summary */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 9, color: T.ter, fontFamily: T.m }}>
                  {entry.cards.length} card{entry.cards.length !== 1 ? "s" : ""}
                </span>
                {diff && diff.added.length > 0 && (
                  <span style={{ fontSize: 8, color: T.green, fontFamily: T.m, fontWeight: 600 }}>
                    +{diff.added.length}
                  </span>
                )}
                {diff && diff.removed.length > 0 && (
                  <span style={{ fontSize: 8, color: T.red, fontFamily: T.m, fontWeight: 600 }}>
                    -{diff.removed.length}
                  </span>
                )}
                {diff && diff.modified.length > 0 && (
                  <span style={{ fontSize: 8, color: T.orange, fontFamily: T.m, fontWeight: 600 }}>
                    ~{diff.modified.length}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ---- Footer ---- */}
      <div style={{ padding: "8px 12px", borderTop: `0.5px solid ${T.border}`, flexShrink: 0 }}>
        <div style={{ fontSize: 9, color: T.ter, fontFamily: T.m, textAlign: "center", lineHeight: 1.5 }}>
          {selectedIdx !== null ? `Viewing entry #${selectedIdx + 1}` : "Click entry to preview"}
        </div>
      </div>
    </div>
  );
}

export default HistoryPanel;
