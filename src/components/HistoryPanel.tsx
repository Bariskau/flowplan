import { useMemo } from "react";
import { ClockCounterClockwise, Trash, X, Plus, PencilSimple, ArrowsDownUp } from "@phosphor-icons/react";
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

/* ---- Action badge colors using fp-* token classes ---- */
const actionStyle: Record<string, { colorClass: string; bgClass: string; label: string; icon: "plus" | "pencil" | "trash" | "arrows" | "clear" | "create" }> = {
  add:     { colorClass: "text-fp-success",  bgClass: "bg-fp-success-dim",  label: "ADD",     icon: "plus" },
  remove:  { colorClass: "text-fp-danger",   bgClass: "bg-fp-danger-dim",   label: "REMOVE",  icon: "trash" },
  update:  { colorClass: "text-fp-warning",  bgClass: "bg-fp-warning-dim",  label: "UPDATE",  icon: "pencil" },
  reorder: { colorClass: "text-fp-purple",   bgClass: "bg-fp-purple-dim",   label: "REORDER", icon: "arrows" },
  clear:   { colorClass: "text-fp-danger",   bgClass: "bg-fp-danger-dim",   label: "CLEAR",   icon: "clear" },
  create:  { colorClass: "text-fp-success",  bgClass: "bg-fp-success-dim",  label: "CREATE",  icon: "create" },
};

function getActionBadge(action: string) {
  return actionStyle[action] || { colorClass: "text-fp-muted", bgClass: "bg-fp-glass-hover", label: action.toUpperCase(), icon: "plus" as const };
}

const actionIcons: Record<string, React.ReactNode> = {
  plus:    <Plus size={10} weight="bold" />,
  pencil:  <PencilSimple size={10} weight="bold" />,
  trash:   <Trash size={10} weight="bold" />,
  arrows:  <ArrowsDownUp size={10} weight="bold" />,
  clear:   <Trash size={10} weight="bold" />,
  create:  <Plus size={10} weight="bold" />,
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
      <div className="p-3 border-b border-fp-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ClockCounterClockwise size={13} className="text-fp-muted" />
            <span className="text-[13px] font-semibold text-fp-text">
              History
            </span>
            <span className="text-[10px] font-mono text-fp-dim bg-fp-glass-hover px-1.5 py-0.5 rounded-fp-sm font-medium">
              {entries.length}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {entries.length > 0 && (
              <IconButton
                variant="danger"
                size="sm"
                onClick={onClear}
                label="Clear history"
                icon={<Trash size={11} />}
              />
            )}
            <IconButton
              variant="ghost"
              size="sm"
              onClick={onClose}
              label="Close history"
              icon={<X size={11} />}
            />
          </div>
        </div>
      </div>

      {/* ---- Entries List ---- */}
      <div className="flex-1 overflow-y-auto p-1.5">
        {entries.length === 0 && (
          <div className="p-6 text-center">
            <div className="text-[11px] text-fp-dim leading-relaxed">
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
                p-2 rounded-fp-sm cursor-pointer transition-all mb-0.5 relative
                ${selected
                  ? "bg-fp-glass-active border-l-2 border-fp-accent"
                  : "border-l-2 border-transparent hover:bg-fp-glass-hover"
                }
              `.trim().replace(/\s+/g, " ")}
            >
              {/* Top row: badge + timestamp */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`inline-flex items-center gap-0.5 text-[9px] font-mono uppercase font-semibold px-1 py-[2px] rounded-fp-sm tracking-wide leading-snug ${badge.colorClass} ${badge.bgClass}`}
                >
                  {actionIcons[badge.icon]}
                  {badge.label}
                </span>
                <span className="text-fp-dim text-[10px] font-mono">
                  {formatTime(entry.timestamp)}
                </span>
              </div>

              {/* Description */}
              <div
                className={`text-[11px] leading-normal overflow-hidden text-ellipsis whitespace-nowrap transition-colors ${selected ? "text-fp-text" : "text-fp-muted"}`}
              >
                {entry.description}
              </div>

              {/* Card count + diff summary */}
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-fp-dim text-[9px] font-mono">
                  {entry.cards.length} card{entry.cards.length !== 1 ? "s" : ""}
                </span>
                {diff && diff.added.length > 0 && (
                  <span className="text-[9px] text-fp-success font-mono font-semibold">
                    +{diff.added.length}
                  </span>
                )}
                {diff && diff.removed.length > 0 && (
                  <span className="text-[9px] text-fp-danger font-mono font-semibold">
                    -{diff.removed.length}
                  </span>
                )}
                {diff && diff.modified.length > 0 && (
                  <span className="text-[9px] text-fp-warning font-mono font-semibold">
                    ~{diff.modified.length}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ---- Footer ---- */}
      <div className="p-2 border-t border-fp-border text-fp-dim text-[10px] shrink-0">
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
