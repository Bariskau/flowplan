import { useMemo } from "react";
import type { HistoryEntry } from "../types";
import { computeDiff } from "../lib/diff";
import IconButton from "./ui/IconButton";

interface HistoryPanelProps {
  entries: HistoryEntry[];
  selectedIdx: number | null;
  onSelect: (idx: number | null) => void;
  onClose: () => void;
  onClear: () => void;
}

/* ---- Action badge colors using fp-* tokens ---- */
const actionStyle: Record<string, { colorClass: string; bgClass: string; label: string }> = {
  add:     { colorClass: "text-fp-success",  bgClass: "bg-fp-success-dim",  label: "ADD" },
  remove:  { colorClass: "text-fp-danger",   bgClass: "bg-fp-danger-dim",   label: "REMOVE" },
  update:  { colorClass: "text-fp-warning",  bgClass: "bg-fp-warning-dim",  label: "UPDATE" },
  reorder: { colorClass: "text-fp-purple",   bgClass: "bg-fp-purple-dim",   label: "REORDER" },
  clear:   { colorClass: "text-fp-danger",   bgClass: "bg-fp-danger-dim",   label: "CLEAR" },
  create:  { colorClass: "text-fp-success",  bgClass: "bg-fp-success-dim",  label: "CREATE" },
};

function getActionBadge(action: string) {
  return actionStyle[action] || { colorClass: "text-fp-muted", bgClass: "bg-fp-glass-hover", label: action.toUpperCase() };
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
    <div className="h-full flex flex-col">
      {/* ---- Header ---- */}
      <div className="p-4 border-b border-fp-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {Ico.history("currentColor", 15)}
            <span className="text-sm font-semibold text-fp-text">
              History
            </span>
            <span className="text-xs font-mono text-fp-dim bg-fp-glass-hover px-1.5 py-0.5 rounded-fp-sm font-medium">
              {entries.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {entries.length > 0 && (
              <IconButton
                variant="danger"
                size="md"
                onClick={onClear}
                label="Clear history"
                icon={Ico.trash("currentColor", 12)}
              />
            )}
            <IconButton
              variant="ghost"
              size="md"
              onClick={onClose}
              label="Close history"
              icon={Ico.close("currentColor", 12)}
            />
          </div>
        </div>
      </div>

      {/* ---- Entries List ---- */}
      <div className="flex-1 overflow-y-auto p-3">
        {entries.length === 0 && (
          <div className="p-8 text-center">
            <div className="text-xs text-fp-dim leading-relaxed">
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
              className={`
                p-2.5 rounded-fp-md cursor-pointer transition-all mb-1 relative
                ${selected
                  ? "bg-fp-glass-active border-l-2 border-fp-accent"
                  : "border-l-2 border-transparent hover:bg-fp-glass-hover"
                }
              `.trim().replace(/\s+/g, " ")}
            >
              {/* Top row: badge + timestamp */}
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className={`text-[10px] font-mono uppercase font-semibold px-1.5 py-0.5 rounded-fp-sm tracking-wide leading-snug ${badge.colorClass} ${badge.bgClass}`}
                >
                  {badge.label}
                </span>
                <span className="text-fp-dim text-xs font-mono">
                  {formatTime(entry.timestamp)}
                </span>
              </div>

              {/* Description */}
              <div
                className={`text-[12.5px] leading-normal overflow-hidden text-ellipsis whitespace-nowrap transition-colors ${selected ? "text-fp-text" : "text-fp-muted"}`}
              >
                {entry.description}
              </div>

              {/* Card count + diff summary */}
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-fp-dim text-[10px] font-mono">
                  {entry.cards.length} card{entry.cards.length !== 1 ? "s" : ""}
                </span>
                {diff && diff.added.length > 0 && (
                  <span className="text-[10px] text-fp-success font-mono font-semibold">
                    +{diff.added.length}
                  </span>
                )}
                {diff && diff.removed.length > 0 && (
                  <span className="text-[10px] text-fp-danger font-mono font-semibold">
                    -{diff.removed.length}
                  </span>
                )}
                {diff && diff.modified.length > 0 && (
                  <span className="text-[10px] text-fp-warning font-mono font-semibold">
                    ~{diff.modified.length}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ---- Footer ---- */}
      <div className="p-3 border-t border-fp-border text-fp-dim text-xs shrink-0">
        <div className="font-mono text-center leading-relaxed">
          {selectedIdx !== null ? (
            <span>
              Viewing entry <span className="text-fp-accent font-semibold">#{selectedIdx + 1}</span>
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
