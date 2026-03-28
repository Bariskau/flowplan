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

/* ---- Action badge colors (Protocol-style method badges) ---- */
const actionStyle: Record<string, { color: string; bg: string; label: string }> = {
  add:     { color: emerald,  bg: "rgba(16,185,129,0.12)",                 label: "ADD" },
  remove:  { color: "#f43f5e", bg: "rgba(244,63,94,0.12)",    label: "REMOVE" },
  update:  { color: "#f59e0b", bg: "rgba(245,158,11,0.12)",   label: "UPDATE" },
  reorder: { color: "#a78bfa", bg: "rgba(167,139,250,0.12)",  label: "REORDER" },
  clear:   { color: "#f43f5e", bg: "rgba(244,63,94,0.12)",    label: "CLEAR" },
  create:  { color: emerald,  bg: "rgba(16,185,129,0.12)",                 label: "CREATE" },
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
    <div className="w-[280px] h-full bg-[rgba(24,24,27,0.85)] backdrop-blur-[20px] border-l border-[rgba(255,255,255,0.06)] flex flex-col shrink-0 overflow-hidden">
      {/* ---- Header ---- */}
      <div className="px-4 py-[14px] flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] shrink-0">
        <div className="flex items-center gap-2">
          {Ico.history("rgba(255,255,255,0.5)", 15)}
          <span className="text-[14px] font-semibold text-[#f4f4f5] tracking-[-0.01em]">
            History
          </span>
          <span className="text-[11px] font-mono text-[rgba(255,255,255,0.4)] bg-[rgba(255,255,255,0.06)] px-[7px] py-[2px] rounded-md font-medium">
            {entries.length}
          </span>
        </div>

        <div className="flex items-center gap-[6px]">
          {entries.length > 0 && (
            <button
              onClick={onClear}
              title="Clear history"
              className="bg-transparent border border-[rgba(255,255,255,0.1)] rounded-md cursor-pointer w-7 h-7 flex items-center justify-center p-0 transition-all duration-200 ease-in-out"
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
            className="bg-transparent border border-[rgba(255,255,255,0.1)] rounded-md cursor-pointer w-7 h-7 flex items-center justify-center p-0 transition-all duration-200 ease-in-out"
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
      <div className="flex-1 overflow-auto py-2 px-[10px]">
        {entries.length === 0 && (
          <div className="p-8 text-center">
            <div className="text-xs text-[rgba(255,255,255,0.3)] leading-[1.6]">
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
              className="py-[10px] px-3 rounded-lg cursor-pointer mb-1 transition-all duration-200 ease-in-out relative"
              style={{
                background: selected ? "rgba(255,255,255,0.04)" : "transparent",
                borderLeft: selected ? `2px solid ${emerald}` : "2px solid transparent",
              }}
              onMouseEnter={(e: any) => {
                if (!selected) e.currentTarget.style.background = "rgba(255,255,255,0.03)";
              }}
              onMouseLeave={(e: any) => {
                e.currentTarget.style.background = selected ? "rgba(255,255,255,0.04)" : "transparent";
              }}
            >
              {/* Top row: badge + timestamp */}
              <div className="flex items-center justify-between mb-[6px]">
                <span
                  className="text-[10px] font-bold font-mono py-[2px] px-[7px] rounded-[5px] tracking-[0.05em] leading-[1.4]"
                  style={{ color: badge.color, background: badge.bg }}
                >
                  {badge.label}
                </span>
                <span className="text-[10px] text-[rgba(255,255,255,0.3)] font-mono font-normal">
                  {formatTime(entry.timestamp)}
                </span>
              </div>

              {/* Description */}
              <div
                className="text-[12.5px] leading-[1.5] overflow-hidden text-ellipsis whitespace-nowrap transition-colors duration-200 ease-in-out"
                style={{ color: selected ? "#e4e4e7" : "rgba(255,255,255,0.6)" }}
              >
                {entry.description}
              </div>

              {/* Card count + diff summary */}
              <div className="flex items-center gap-2 mt-[6px]">
                <span className="text-[10px] text-[rgba(255,255,255,0.3)] font-mono">
                  {entry.cards.length} card{entry.cards.length !== 1 ? "s" : ""}
                </span>
                {diff && diff.added.length > 0 && (
                  <span className="text-[10px] text-[#10b981] font-mono font-semibold">
                    +{diff.added.length}
                  </span>
                )}
                {diff && diff.removed.length > 0 && (
                  <span className="text-[10px] text-[#f43f5e] font-mono font-semibold">
                    -{diff.removed.length}
                  </span>
                )}
                {diff && diff.modified.length > 0 && (
                  <span className="text-[10px] text-[#f59e0b] font-mono font-semibold">
                    ~{diff.modified.length}
                  </span>
                )}
              </div>

              {/* Subtle separator between entries */}
              {idx !== reversed[reversed.length - 1]?.idx && (
                <div className="absolute -bottom-[2px] left-3 right-3 h-px bg-[rgba(255,255,255,0.04)]" />
              )}
            </div>
          );
        })}
      </div>

      {/* ---- Footer ---- */}
      <div className="py-[10px] px-4 border-t border-[rgba(255,255,255,0.06)] shrink-0">
        <div className="text-[11px] text-[rgba(255,255,255,0.3)] font-mono text-center leading-[1.5]">
          {selectedIdx !== null ? (
            <span>
              Viewing entry <span className="text-[#10b981] font-semibold">#{selectedIdx + 1}</span>
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
