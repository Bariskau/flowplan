import { useMemo } from "react";
import {
  ClockCounterClockwise,
  X,
  ArrowsClockwise,
  ArrowUpRight,
  PlusCircle,
  MinusCircle,
  PencilSimple,
} from "@phosphor-icons/react";
import type { CollabProfile, HistoryChange, HistoryEntry } from "../types";
import IconButton from "./ui/IconButton";
import CardTag, { type TagVariant } from "./ui/CardTag";
import Avatar from "./ui/Avatar";

interface HistoryPanelProps {
  entries: HistoryEntry[];
  pageLimit: number;
  selectedEntryId: string | null;
  profile: CollabProfile;
  onSelect: (entryId: string | null) => void;
  onClose: () => void;
  onClear: () => void;
  onCardClick?: (change: HistoryChange, entry: HistoryEntry) => void;
}

const ACTOR_META: Record<string, { variant: TagVariant; label: string; avatarSeed: string; monogram?: string }> = {
  ui: { variant: "info", label: "You", avatarSeed: "history-ui" },
  agent: { variant: "warning", label: "AI", avatarSeed: "history-agent", monogram: "AI" },
  collab: { variant: "accent", label: "Collaborator", avatarSeed: "history-collab" },
  system: { variant: "default", label: "System", avatarSeed: "history-system", monogram: "SYS" },
};

const SOURCE_LABEL: Record<string, string> = {
  rest: "Direct",
  mcp: "Agent",
  undo: "Undo",
  redo: "Redo",
  system: "System",
};

function actorIdentity(entry: HistoryEntry, profile: CollabProfile) {
  const fallback = ACTOR_META[entry.actor] || ACTOR_META.system;
  const actorId = entry.actorId?.trim();
  const storedAvatarSeed = entry.actorAvatarSeed?.trim();

  if (entry.actor === "ui") {
    const label = actorId && actorId.toLowerCase() !== "desktop" ? actorId : profile.username || fallback.label;
    const isCurrentProfile = !actorId || actorId.toLowerCase() === "desktop" || actorId === profile.username;
    return {
      variant: fallback.variant,
      label,
      avatarSeed: storedAvatarSeed || (isCurrentProfile ? profile.avatarSeed : `history-ui-${label.toLowerCase()}`),
      monogram: undefined,
    };
  }

  if (entry.actor === "collab") {
    const label = actorId || fallback.label;
    return {
      variant: fallback.variant,
      label,
      avatarSeed: storedAvatarSeed || `${fallback.avatarSeed}-${label.toLowerCase()}`,
      monogram: undefined,
    };
  }

  if (actorId) {
    return {
      variant: fallback.variant,
      label: actorId,
      avatarSeed: storedAvatarSeed || `${fallback.avatarSeed}-${actorId.toLowerCase()}`,
      monogram: fallback.monogram,
    };
  }

  return {
    ...fallback,
    avatarSeed: storedAvatarSeed || fallback.avatarSeed,
  };
}

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

function formatAbsoluteTime(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resolveCardTitle(change: HistoryChange): string {
  return change.after?.title || change.before?.title || change.title || "Untitled";
}

function formatFieldLabel(field: string): string {
  switch (field) {
    case "title":
      return "Title";
    case "description":
      return "Description";
    case "type":
      return "Type";
    case "repo":
      return "Repo";
    case "order":
      return "Order";
    default:
      return field;
  }
}

function changeSummary(change: HistoryChange) {
  const title = resolveCardTitle(change);
  switch (change.kind) {
    case "plan_created":
      return "Plan created";
    case "card_added":
      return `Added ${title}`;
    case "card_removed":
      return `Removed ${title}`;
    case "card_updated":
      if (isDependencyOnlyChange(change)) {
        return `Updated dependencies for ${title}`;
      }
      return `Updated ${title}`;
    default:
      return title;
  }
}

function resolveDependencyLabel(id: string, change: HistoryChange, entry: HistoryEntry): string {
  return (
    entry.snapshot.cards.find((card) => card.id === id)?.title ||
    (change.after?.id === id ? change.after.title : undefined) ||
    (change.before?.id === id ? change.before.title : undefined) ||
    id
  );
}

function ChangeIcon({ change }: { change: HistoryChange }) {
  if (change.kind === "card_added") return <PlusCircle size={13} weight="fill" />;
  if (change.kind === "card_removed") return <MinusCircle size={13} weight="fill" />;
  return <PencilSimple size={13} weight="bold" />;
}

function changeAccent(kind: HistoryChange["kind"]) {
  switch (kind) {
    case "card_added":
      return { tag: "success" as const, text: "text-fp-success", dot: "bg-fp-success/80" };
    case "card_removed":
      return { tag: "danger" as const, text: "text-fp-danger", dot: "bg-fp-danger/80" };
    default:
      return { tag: "warning" as const, text: "text-fp-warning", dot: "bg-fp-warning/80" };
  }
}

function entryDotClass(entry: HistoryEntry) {
  const kinds = entry.changes.map((change) => change.kind);
  if (kinds.length > 0 && kinds.every((kind) => kind === "card_added")) return "bg-fp-success/80";
  if (kinds.length > 0 && kinds.every((kind) => kind === "card_removed")) return "bg-fp-danger/80";
  return "bg-fp-warning/80";
}

function isDependencyOnlyChange(change: HistoryChange) {
  return (
    change.kind === "card_updated" &&
    change.changedFields.length === 0 &&
    change.filesAdded.length === 0 &&
    change.filesRemoved.length === 0 &&
    change.fileChangesUpdated.length === 0 &&
    (change.dependenciesAdded.length > 0 || change.dependenciesRemoved.length > 0)
  );
}

function rangeLabel(entries: HistoryEntry[]) {
  if (entries.length === 0) return "No revisions";
  const newest = entries[entries.length - 1]?.revision ?? 0;
  const oldest = entries[0]?.revision ?? 0;
  return `r${newest}-${oldest}`;
}

function HistoryPanel({
  entries,
  pageLimit,
  selectedEntryId,
  profile,
  onSelect,
  onClose,
  onClear,
  onCardClick,
}: HistoryPanelProps) {
  const reversed = useMemo(() => [...entries].reverse(), [entries]);
  const visibleRange = useMemo(() => rangeLabel(entries), [entries]);

  return (
    <div className="h-full flex flex-col">
      <div className="p-3.5 flex items-center justify-between shrink-0 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-2xl bg-white/[0.04] inline-flex items-center justify-center text-white/45 shrink-0">
            <ClockCounterClockwise size={14} />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-white/80">History</div>
            <div className="text-[10px] text-white/28">
              {visibleRange}
              {entries.length >= pageLimit ? ` · last ${pageLimit}` : ""}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
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

      <div className="px-3.5 pt-2.5 pb-2 shrink-0 flex items-center justify-between gap-2">
        <div className="text-[10px] text-white/24">
          {entries.length === 0 ? "No revisions yet" : `${entries.length} loaded`}
        </div>
        <div className="text-[10px] text-white/22">Newest first</div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3" style={{ scrollbarWidth: "none" }}>
        {entries.length === 0 ? (
          <div className="mt-1 rounded-2xl bg-white/[0.03] px-4 py-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <div className="text-[12px] text-white/58 font-medium">No history yet</div>
            <div className="text-[11px] text-white/24 mt-1">UI and AI changes will appear here as one timeline.</div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {reversed.map((entry) => {
              const selected = selectedEntryId === entry.id;
              const actor = actorIdentity(entry, profile);
              const added = entry.changes.filter((change) => change.kind === "card_added").length;
              const removed = entry.changes.filter((change) => change.kind === "card_removed").length;
              const updated = entry.changes.filter((change) => change.kind === "card_updated").length;
              const entryDot = entryDotClass(entry);

              return (
                <div
                  key={entry.id}
                  onClick={() => onSelect(selected ? null : entry.id)}
                  className={`cursor-pointer rounded-2xl p-3 transition-all duration-200 ${
                    selected
                      ? "bg-white/[0.05] shadow-[0_16px_32px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.05)]"
                      : "bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] hover:bg-white/[0.04] hover:shadow-[0_12px_24px_rgba(0,0,0,0.16),inset_0_1px_0_rgba(255,255,255,0.04)]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${entryDot}`} />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                        <div className="group relative shrink-0">
                          <div
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full border shrink-0 ${
                            actor.variant === "info"
                              ? "border-fp-info/20 bg-fp-info/8"
                              : actor.variant === "warning"
                                ? "border-fp-warning/20 bg-fp-warning/8"
                                : "border-white/10 bg-white/[0.04]"
                          }`}
                        >
                          {actor.monogram ? (
                            <span className="text-[9px] font-semibold tracking-[0.08em] text-white/78">
                              {actor.monogram}
                            </span>
                          ) : (
                            <Avatar
                              user={{ username: actor.label, avatarSeed: actor.avatarSeed }}
                              size="sm"
                              className="!w-5 !h-5 !min-w-5 !min-h-5"
                            />
                          )}
                          </div>
                          <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/8 bg-[rgba(24,25,28,0.94)] px-2.5 py-1 text-[10px] font-medium text-white/72 opacity-0 shadow-[0_8px_24px_rgba(0,0,0,0.24)] transition-opacity duration-150 group-hover:opacity-100">
                            {actor.label}
                          </div>
                        </div>
                        <CardTag variant="default" icon={<ArrowsClockwise size={9} weight="regular" />}>
                          {SOURCE_LABEL[entry.source] || entry.source}
                        </CardTag>
                        <CardTag variant="default">r{entry.revision}</CardTag>
                        <span className="ml-auto text-[10px] text-white/24" title={formatAbsoluteTime(entry.timestamp)}>
                          {formatTime(entry.timestamp)}
                        </span>
                      </div>

                      <div className={`text-[13px] leading-[1.45] font-semibold ${selected ? "text-white/84" : "text-white/72"}`}>
                        {entry.summary || entry.description || "Updated plan"}
                      </div>

                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        {added > 0 && <CardTag variant="success">+{added}</CardTag>}
                        {removed > 0 && <CardTag variant="danger">-{removed}</CardTag>}
                        {updated > 0 && <CardTag variant="warning">~{updated}</CardTag>}
                        <span className="text-[10px] text-white/22">{formatAbsoluteTime(entry.timestamp)}</span>
                      </div>
                    </div>
                  </div>

                  {selected && entry.changes.length > 0 && (
                    <div className="mt-3 flex flex-col gap-2">
                      {entry.changes.map((change, changeIdx) => {
                        const dependencyOnlyChange = isDependencyOnlyChange(change);
                        const interactive = !!(change.after || change.before) && !!onCardClick && !dependencyOnlyChange;
                        const accent = changeAccent(change.kind);
                        const titleChanged =
                          change.changedFields.includes("title") && change.before?.title && change.after?.title;
                        const hasChangeDetails =
                          titleChanged ||
                          change.changedFields.length > 0 ||
                          change.dependenciesAdded.length > 0 ||
                          change.dependenciesRemoved.length > 0 ||
                          change.filesAdded.length > 0 ||
                          change.filesRemoved.length > 0 ||
                          change.fileChangesUpdated.length > 0;
                        const hasMetaTags =
                          change.changedFields.length > 0 ||
                          (!dependencyOnlyChange &&
                            (change.dependenciesAdded.length > 0 ||
                              change.dependenciesRemoved.length > 0 ||
                              change.filesAdded.length > 0 ||
                              change.filesRemoved.length > 0 ||
                              change.fileChangesUpdated.length > 0));

                        return (
                          <button
                            key={`${entry.id}-${changeIdx}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (interactive) onCardClick?.(change, entry);
                            }}
                            disabled={!interactive}
                            className={`w-full text-left rounded-2xl px-3 transition-all duration-150 ${
                              hasChangeDetails ? "py-3" : "h-[54px] flex items-center"
                            } ${
                              interactive
                                ? "cursor-pointer bg-white/[0.025] hover:bg-white/[0.04]"
                                : "cursor-default bg-white/[0.02]"
                            }`}
                          >
                            <div className="flex w-full items-center gap-3">
                              <div className={`shrink-0 self-center ${accent.text}`}>
                                <ChangeIcon change={change} />
                              </div>

                              <div className="min-w-0 flex-1 self-center">
                                <div className={`flex w-full gap-2 ${hasChangeDetails ? "items-start" : "items-center min-h-[20px]"}`}>
                                  <div className={`text-[12px] font-semibold ${accent.text} ${hasChangeDetails ? "" : "leading-none"}`}>
                                    {changeSummary(change)}
                                  </div>
                                  {interactive && (
                                    <span
                                      className={`ml-auto text-[9px] uppercase tracking-[0.12em] text-white/22 inline-flex items-center gap-1 shrink-0 ${
                                        hasChangeDetails ? "" : "leading-none self-center"
                                      }`}
                                    >
                                      View
                                      <ArrowUpRight size={10} />
                                    </span>
                                  )}
                                </div>

                                {titleChanged && (
                                  <div className="mt-1.5 text-[10px] text-white/44 leading-relaxed">
                                    <span className="text-white/26">Title:</span> {change.before?.title} <span className="text-white/18">→</span>{" "}
                                    {change.after?.title}
                                  </div>
                                )}

                                {change.changedFields.includes("description") && (
                                  <div className="mt-1 text-[10px] text-white/38 leading-relaxed">Description content changed</div>
                                )}

                                {dependencyOnlyChange && (
                                  <div className="mt-2 flex flex-col gap-1.5">
                                    {change.dependenciesAdded.length > 0 && (
                                      <div className="flex items-start gap-2 text-[10px] leading-[1.6]">
                                        <span className="shrink-0 font-medium text-fp-success/85">Added</span>
                                        <span className="min-w-0 text-white/60">
                                          {change.dependenciesAdded
                                            .map((id) => resolveDependencyLabel(id, change, entry))
                                            .join(", ")}
                                        </span>
                                      </div>
                                    )}
                                    {change.dependenciesRemoved.length > 0 && (
                                      <div className="flex items-start gap-2 text-[10px] leading-[1.6]">
                                        <span className="shrink-0 font-medium text-fp-danger/85">Removed</span>
                                        <span className="min-w-0 text-white/60">
                                          {change.dependenciesRemoved
                                            .map((id) => resolveDependencyLabel(id, change, entry))
                                            .join(", ")}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {hasMetaTags && (
                                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                    {change.changedFields.map((field) => (
                                      <CardTag key={field} variant="default">
                                        {formatFieldLabel(field)}
                                      </CardTag>
                                    ))}
                                    {!dependencyOnlyChange && change.dependenciesAdded.length > 0 && (
                                      <CardTag variant="success">+{change.dependenciesAdded.length} deps</CardTag>
                                    )}
                                    {!dependencyOnlyChange && change.dependenciesRemoved.length > 0 && (
                                      <CardTag variant="danger">-{change.dependenciesRemoved.length} deps</CardTag>
                                    )}
                                    {change.filesAdded.length > 0 && (
                                      <CardTag variant="success">+{change.filesAdded.length} files</CardTag>
                                    )}
                                    {change.filesRemoved.length > 0 && (
                                      <CardTag variant="danger">-{change.filesRemoved.length} files</CardTag>
                                    )}
                                    {change.fileChangesUpdated.length > 0 && (
                                      <CardTag variant="warning">{change.fileChangesUpdated.length} previews</CardTag>
                                    )}
                                  </div>
                                )}

                                {!dependencyOnlyChange && change.dependenciesAdded.length > 0 && (
                                  <div className="mt-2 text-[10px] text-white/58 leading-relaxed">
                                    <span className="text-white/34">Added deps:</span>{" "}
                                    {change.dependenciesAdded
                                      .map((id) => resolveDependencyLabel(id, change, entry))
                                      .join(", ")}
                                  </div>
                                )}

                                {!dependencyOnlyChange && change.dependenciesRemoved.length > 0 && (
                                  <div className="mt-1 text-[10px] text-white/58 leading-relaxed">
                                    <span className="text-white/34">Removed deps:</span>{" "}
                                    {change.dependenciesRemoved
                                      .map((id) => resolveDependencyLabel(id, change, entry))
                                      .join(", ")}
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default HistoryPanel;
