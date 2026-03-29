import { useMemo } from "react";
import { ClockCounterClockwise, X, File } from "@phosphor-icons/react";
import type { Card, HistoryEntry } from "../types";
import { computeHistoryEntryDiff, hasFullHistoryEntryCards, hasPreviousFullHistoryEntryCards } from "../lib/diff";
import IconButton from "./ui/IconButton";
import Chip, { type ChipVariant } from "./ui/Chip";

interface HistoryPanelProps {
  entries: HistoryEntry[];
  selectedIdx: number | null;
  onSelect: (idx: number | null) => void;
  onClose: () => void;
  onClear: () => void;
  onCardClick?: (card: Card) => void;
}

const ACTION_CHIP: Record<string, { variant: ChipVariant; label: string }> = {
  add_card: { variant: "success", label: "Add Card" },
  add_cards: { variant: "success", label: "Add Cards" },
  add: { variant: "success", label: "Add Card" },
  remove_card: { variant: "danger", label: "Remove Card" },
  remove_cards: { variant: "danger", label: "Remove Cards" },
  remove: { variant: "danger", label: "Remove" },
  update_card: { variant: "warning", label: "Update Card" },
  update: { variant: "warning", label: "Update" },
  reorder: { variant: "purple", label: "Reorder" },
  clear: { variant: "danger", label: "Clear" },
  clear_plan: { variant: "danger", label: "Clear Plan" },
  create: { variant: "success", label: "Created" },
};

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

function HistoryPanel({ entries, selectedIdx, onSelect, onClose, onClear, onCardClick }: HistoryPanelProps) {
  const reversed = useMemo(() => entries.map((entry, idx) => ({ entry, idx })).reverse(), [entries]);

  const diffs = useMemo(
    () =>
      entries.map((entry, idx) => computeHistoryEntryDiff(idx > 0 ? entries[idx - 1] : null, entry)),
    [entries],
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <ClockCounterClockwise size={14} className="text-white/40" />
          <span className="text-sm font-medium text-white/80">History</span>
          <span className="text-[10px] text-white/30">{entries.length}</span>
        </div>
        <div className="flex items-center gap-1">
          {entries.length > 0 && (
            <button
              onClick={onClear}
              className="text-[11px] text-white/30 hover:text-fp-danger bg-transparent border-none cursor-pointer transition-colors px-2 py-1 rounded-lg hover:bg-white/[0.04]"
            >
              Clear
            </button>
          )}
          <IconButton variant="ghost" size="sm" onClick={onClose} label="Close" icon={<X size={12} />} />
        </div>
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto px-1.5 pb-2" style={{ scrollbarWidth: "none" }}>
        {entries.length === 0 && <div className="p-6 text-center text-[11px] text-white/20">No history yet</div>}

        <div className="flex flex-col gap-1">
          {reversed.map(({ entry, idx }) => {
            const selected = selectedIdx === idx;
            const ac = ACTION_CHIP[entry.action] || {
              variant: "default" as ChipVariant,
              label: entry.action
                .replace(/[_-]/g, " ")
                .split(" ")
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                .join(" "),
            };
            const diff = diffs[idx];
            const prevEntry = idx > 0 ? entries[idx - 1] : null;
            const previousFullCards = hasPreviousFullHistoryEntryCards(entry)
              ? (entry.previousFullCards ?? [])
              : hasFullHistoryEntryCards(prevEntry)
                ? (prevEntry?.fullCards ?? [])
                : [];
            const changedCards = [
              ...diff.added.map((card) => ({
                key: `added-${card.id}`,
                title: card.title,
                diffState: "added" as const,
                card: null,
              })),
              ...diff.modified.map((card) => ({
                key: `modified-${card.before.id}`,
                title: card.before.title,
                diffState: "modified" as const,
                card: previousFullCards.find((fullCard) => fullCard.id === card.before.id) ?? null,
              })),
              ...diff.removed.map((card) => ({
                key: `removed-${card.id}`,
                title: card.title,
                diffState: "removed" as const,
                card: previousFullCards.find((fullCard) => fullCard.id === card.id) ?? null,
              })),
            ];

            return (
              <div
                key={entry.id}
                onClick={() => onSelect(selected ? null : idx)}
                className={`px-3 py-2.5 rounded-[10px] cursor-pointer transition-all duration-150 ${
                  selected ? "bg-white/8" : "hover:bg-white/[0.04] active:bg-white/8"
                }`}
              >
                {/* Top: chip + time */}
                <div className="flex items-center gap-1.5 mb-1">
                  <Chip variant={ac.variant} size="sm">
                    {ac.label}
                  </Chip>
                  <span className="flex-1" />
                  <span className="text-[10px] text-white/25">{formatTime(entry.timestamp)}</span>
                </div>

                {/* Description */}
                <div
                  className={`text-[12px] leading-snug overflow-hidden text-ellipsis whitespace-nowrap ${selected ? "text-white/80" : "text-white/50"}`}
                >
                  {entry.description}
                </div>

                {/* Diff stats */}
                {(diff.added.length > 0 || diff.removed.length > 0 || diff.modified.length > 0) && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[9px] uppercase tracking-[0.08em] text-white/20">Changes</span>
                    {diff.added.length > 0 && (
                      <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-fp-success-dim text-fp-success">
                        +{diff.added.length}
                      </span>
                    )}
                    {diff.removed.length > 0 && (
                      <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-fp-danger-dim text-fp-danger">
                        -{diff.removed.length}
                      </span>
                    )}
                    {diff.modified.length > 0 && (
                      <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-fp-warning-dim text-fp-warning">
                        ~{diff.modified.length}
                      </span>
                    )}
                  </div>
                )}

                {/* Expanded card list */}
                {selected && changedCards.length > 0 && (
                  <div className="mt-2 flex flex-col gap-0.5">
                    {changedCards.map((item) => {
                      const disabled = !item.card || !onCardClick;
                      return (
                        <button
                          key={item.key}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (item.card) onCardClick?.(item.card);
                          }}
                          disabled={disabled}
                          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-left text-[11px] bg-transparent border-none transition-colors w-full ${
                            disabled ? "cursor-default opacity-80" : "cursor-pointer hover:bg-white/[0.06] active:bg-white/10"
                          }`}
                        >
                          <File size={10} className="text-white/30 shrink-0" />
                          <span
                            className={`truncate ${
                              item.diffState === "added"
                                ? "text-fp-success"
                                : item.diffState === "removed"
                                  ? "text-fp-danger line-through"
                                  : item.diffState === "modified"
                                    ? "text-fp-warning"
                                    : "text-white/50"
                            }`}
                          >
                            {item.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default HistoryPanel;
