import React, { useState, useCallback, useMemo } from "react";
import { T, TC, FB } from "../lib/theme";
import { Md } from "../lib/markdown";
import type { Card, Feedback, FileChange } from "../types";

/* ---- Props ---- */
interface DetailDrawerProps {
  card: Card;
  feedbacks: Feedback[];
  planTitle: string;
  planId: string;
  allCards: Card[];
  readOnly?: boolean;
  onClose: () => void;
  onAddFeedback: (cardId: string, type: string, text: string) => void;
  onDeleteFeedback: (id: string) => void;
  onFileClick: (path: string, change: FileChange) => void;
  onSelectCard: (id: string) => void;
  onEditCard?: (planId: string, cardId: string, updates: Record<string, any>) => void;
}

/* ---- Inline SVG Icons ---- */
const Ico = {
  search: (c: string, s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="4.5" stroke={c} strokeWidth="1.3" />
      <path d="M10.5 10.5L14 14" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  compass: (c: string, s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke={c} strokeWidth="1.3" />
      <path d="M10.5 5.5L9 9 5.5 10.5 7 7z" fill={c} opacity="0.7" />
    </svg>
  ),
  plus: (c: string, s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M8 3v10M3 8h10" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  pencil: (c: string, s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M11.5 2.5l2 2L5 13H3v-2z" stroke={c} strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M9.5 4.5l2 2" stroke={c} strokeWidth="1.3" />
    </svg>
  ),
  beaker: (c: string, s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M6 2v5L3 13h10L10 7V2" stroke={c} strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M5 2h6" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  folder: (c: string, s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M2 4.5a1 1 0 011-1h3l1.5 1.5H13a1 1 0 011 1V12a1 1 0 01-1 1H3a1 1 0 01-1-1z" stroke={c} strokeWidth="1.3" />
    </svg>
  ),
  question: (c: string, s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke={c} strokeWidth="1.3" />
      <path d="M6.5 6.5a1.5 1.5 0 012.7.9c0 1-1.2 1.1-1.2 2.1" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="8" cy="12" r="0.7" fill={c} />
    </svg>
  ),
  bolt: (c: string, s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M9 2L4 9h4l-1 5 5-7H8z" stroke={c} strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  ),
  alert: (c: string, s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M8 2L1.5 13h13z" stroke={c} strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M8 7v3" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="8" cy="11.5" r="0.6" fill={c} />
    </svg>
  ),
  check: (c: string, s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M3.5 8.5L6.5 11.5 12.5 4.5" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  send: (c: string, s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M2 8l12-5-5 12-2-5z" stroke={c} strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M7 10l7-7" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  goto: (c: string, s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M6 3l5 5-5 5" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  close: (c: string, s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M4 4l8 8M12 4l-8 8" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  arrowUp: (c: string, s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M8 13V3M4 7l4-4 4 4" stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  arrowDown: (c: string, s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M8 3v10M4 9l4 4 4-4" stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  trash: (c: string, s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v8.5a1 1 0 001 1h4a1 1 0 001-1V4" stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  file: (c: string, s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M4 2h5.5L13 5.5V14a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke={c} strokeWidth="1.2" />
      <path d="M9 2v4h4" stroke={c} strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  ),
};

/* ---- Type icon helper ---- */
function typeIcon(type: string, color: string) {
  switch (type) {
    case "research": return Ico.search(color, 11);
    case "planning": return Ico.compass(color, 11);
    case "create": return Ico.plus(color, 11);
    case "edit": return Ico.pencil(color, 11);
    case "test": return Ico.beaker(color, 11);
    default: return null;
  }
}

/* ---- Change type badge (Protocol GET/POST style) ---- */
const CHANGE_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  create: { label: "CREATE", color: T.green, bg: "rgba(48,209,88,0.12)" },
  edit: { label: "EDIT", color: T.orange, bg: "rgba(255,159,10,0.12)" },
  delete: { label: "DELETE", color: T.red, bg: "rgba(255,69,58,0.12)" },
};

/* ---- Protocol-style Section Header ---- */
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[13px] font-semibold text-[#fafafa] tracking-[-0.01em] pb-2 mb-0 mt-1">
      {children}
    </div>
  );
}

/* ---- Protocol-style separator ---- */
function Separator() {
  return (
    <div className="h-px bg-[rgba(255,255,255,0.06)] my-4" />
  );
}

/* ---- Protocol-style property row separator (lighter, for within a list) ---- */
function RowSeparator() {
  return (
    <div className="h-px bg-[rgba(255,255,255,0.04)] m-0" />
  );
}

/* ---- Protocol-style monospace chip (like `id`, `username` in Protocol) ---- */
function MonoChip({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className="font-mono text-[11px] font-medium bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.06)] rounded-[5px] px-[7px] py-[2px] leading-none inline-flex items-center"
      style={{ color: color || T.text }}
    >
      {children}
    </span>
  );
}

/* ---- FeedbackItem sub-component (Protocol-inspired card) ---- */
function FeedbackItem({
  fb, onDelete, readOnly,
}: {
  fb: Feedback;
  onDelete: (id: string) => void;
  readOnly?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const style = FB[fb.type] || FB.question;
  const isAnswered = fb.type === "question" && fb.answer;

  // Protocol-style accent bar colors
  const accentMap: Record<string, string> = {
    question: "#38bdf8",   // sky
    directive: "#fbbf24",  // amber
    issue: "#f87171",      // red
  };
  const accentColor = accentMap[fb.type] || accentMap.question;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="bg-[rgba(255,255,255,0.02)] border rounded-lg p-0 mb-2 relative overflow-hidden transition-[border-color,background] duration-150"
      style={{
        borderColor: hovered ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.06)",
      }}
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg opacity-70"
        style={{ background: accentColor }}
      />

      <div className="py-2.5 pr-3 pl-4">
        {/* Header row */}
        <div className="flex items-center gap-2 mb-1.5">
          <span
            className="text-[10px] font-semibold px-2 py-[3px] rounded-[4px] uppercase tracking-[0.05em] leading-none"
            style={{ color: accentColor, background: `${accentColor}14` }}
          >
            {style.label}
          </span>

          {fb.type === "question" ? (
            <span
              className="text-[10px] font-medium inline-flex items-center gap-1"
              style={{ color: isAnswered ? T.green : "rgba(255,255,255,0.4)" }}
            >
              <span
                className="w-[5px] h-[5px] rounded-full inline-block"
                style={{ background: isAnswered ? T.green : "rgba(255,255,255,0.25)" }}
              />
              {isAnswered ? "Answered" : "Pending"}
            </span>
          ) : (
            <span
              className="text-[10px] font-medium inline-flex items-center gap-1"
              style={{ color: fb.read ? T.green : "rgba(255,255,255,0.4)" }}
            >
              <span
                className="w-[5px] h-[5px] rounded-full inline-block"
                style={{ background: fb.read ? T.green : "rgba(255,255,255,0.25)" }}
              />
              {fb.read ? "Acknowledged" : "Pending"}
            </span>
          )}

          <span className="flex-1" />
          {hovered && !readOnly && (
            <button
              onClick={() => onDelete(fb.id)}
              className="bg-transparent border-none cursor-pointer p-[3px] rounded-[4px] flex items-center opacity-60 hover:opacity-100 transition-opacity duration-150"
            >
              {Ico.trash(T.red, 12)}
            </button>
          )}
        </div>

        {/* Content */}
        <div className="text-[12.5px] text-[rgba(255,255,255,0.7)] leading-[1.6] tracking-[-0.005em]">
          {fb.text}
        </div>

        {/* Answer (Protocol response-style) */}
        {isAnswered && (
          <div className="mt-2.5 pt-2.5 border-t border-[rgba(255,255,255,0.06)]">
            <div className="text-[10px] font-semibold mb-[5px] uppercase tracking-[0.05em]" style={{ color: T.green }}>
              Answer
            </div>
            <div className="text-xs text-[rgba(255,255,255,0.55)] leading-[1.6]">
              {fb.answer}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Main DetailDrawer ---- */
function DetailDrawer({
  card, feedbacks, planTitle, planId, allCards, readOnly,
  onClose, onAddFeedback, onDeleteFeedback, onFileClick, onSelectCard, onEditCard,
}: DetailDrawerProps) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(card.title);
  const [editDesc, setEditDesc] = useState(card.description);
  const [editType, setEditType] = useState(card.type);
  const [editRepo, setEditRepo] = useState(card.repo);
  const [editFiles, setEditFiles] = useState(card.files.join("\n"));
  const [editDeps, setEditDeps] = useState<string[]>(card.dependencies);

  const [fbTab, setFbTab] = useState<"question" | "directive" | "issue">("question");
  const [fbText, setFbText] = useState("");

  const tc = TC[card.type] || { l: card.type, c: T.accent, bg: T.aD };
  const editTc = TC[editType] || { l: editType, c: T.accent, bg: T.aD };

  /* Deps mapped to card titles */
  const depCards = useMemo(() => {
    const byId = new Map(allCards.map(c => [c.id, c]));
    return (editing ? editDeps : card.dependencies).map(id => byId.get(id)).filter(Boolean) as Card[];
  }, [card.dependencies, editDeps, allCards, editing]);

  /* Start editing */
  const startEdit = useCallback(() => {
    setEditTitle(card.title);
    setEditDesc(card.description);
    setEditType(card.type);
    setEditRepo(card.repo);
    setEditFiles(card.files.join("\n"));
    setEditDeps([...card.dependencies]);
    setEditing(true);
  }, [card]);

  /* Save edits */
  const saveEdit = useCallback(() => {
    if (!onEditCard) return;
    const files = editFiles.split("\n").map(f => f.trim()).filter(Boolean);
    onEditCard(planId, card.id, {
      title: editTitle,
      description: editDesc,
      type: editType,
      repo: editRepo,
      files,
      dependencies: editDeps,
    });
    setEditing(false);
  }, [onEditCard, planId, card.id, editTitle, editDesc, editType, editRepo, editFiles, editDeps]);

  /* Cancel editing */
  const cancelEdit = useCallback(() => setEditing(false), []);

  /* Move dependency */
  const moveDep = useCallback((idx: number, dir: -1 | 1) => {
    const next = [...editDeps];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setEditDeps(next);
  }, [editDeps]);

  /* Remove dependency */
  const removeDep = useCallback((idx: number) => {
    setEditDeps(prev => prev.filter((_, i) => i !== idx));
  }, []);

  /* Add feedback */
  const handleAddFeedback = useCallback(() => {
    if (!fbText.trim()) return;
    onAddFeedback(card.id, fbTab, fbText.trim());
    setFbText("");
  }, [onAddFeedback, card.id, fbTab, fbText]);

  /* Protocol-style input classes */
  const inputCls = "w-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-[#fafafa] text-[13px] font-[ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] outline-none transition-[border-color,box-shadow] duration-150 box-border";

  return (
    <div className="w-full h-full shrink-0 bg-transparent flex flex-col font-[ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] overflow-hidden">
      {/* ---- Header ---- */}
      <div className="px-5 pt-4 pb-3.5 flex items-center gap-2.5 border-b border-[rgba(255,255,255,0.06)] shrink-0">
        {/* Type pill - Protocol style colored badge */}
        <span
          className="text-[10px] font-semibold py-1 px-2.5 rounded-full uppercase tracking-[0.05em] leading-none inline-flex items-center gap-[5px]"
          style={{ color: tc.c, background: tc.bg, border: `1px solid ${tc.c}20` }}
        >
          {typeIcon(card.type, tc.c)}
          {tc.l}
        </span>

        <span className="flex-1" />

        {/* Edit button */}
        {!readOnly && onEditCard && !editing && (
          <button
            onClick={startEdit}
            title="Edit card"
            className="bg-transparent border border-[rgba(255,255,255,0.08)] cursor-pointer flex items-center justify-center p-0 rounded-lg w-[30px] h-[30px] transition-[background,border-color] duration-150 hover:bg-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)]"
          >
            {Ico.pencil(T.sec, 13)}
          </button>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          title="Close"
          className="bg-transparent border border-[rgba(255,255,255,0.08)] cursor-pointer flex items-center justify-center p-0 rounded-lg w-[30px] h-[30px] transition-[background,border-color] duration-150 hover:bg-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)]"
        >
          {Ico.close(T.sec, 13)}
        </button>
      </div>

      {/* ---- Scrollable content ---- */}
      <div className="flex-1 overflow-auto px-5 pt-5 pb-7">
        {/* ---- Title ---- */}
        {editing ? (
          <input
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            className={`${inputCls} !text-lg !font-bold !mb-4 !px-3.5 !py-2.5 tracking-[-0.02em]`}
          />
        ) : (
          <div className="text-lg font-bold text-[#fafafa] leading-[1.35] mb-4 tracking-[-0.02em]">
            {card.title}
          </div>
        )}

        {/* ---- Type select (edit mode) ---- */}
        {editing && (
          <div className="mb-4">
            <SectionHeader>Type</SectionHeader>
            <select
              value={editType}
              onChange={e => setEditType(e.target.value as Card["type"])}
              className={`${inputCls} cursor-pointer font-semibold appearance-none`}
              style={{ color: editTc.c }}
            >
              {Object.entries(TC).map(([k, v]) => (
                <option key={k} value={k}>{v.l}</option>
              ))}
            </select>
          </div>
        )}

        {/* ---- Description ---- */}
        <div className="mb-0">
          <SectionHeader>Description</SectionHeader>
          {editing ? (
            <textarea
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              rows={8}
              className={`${inputCls} resize-y !font-mono !text-xs !leading-[1.7]`}
            />
          ) : (
            <div className="text-[13px]">
              <Md
                text={card.description || "*No description*"}
                fontSize={13}
                color="rgba(255,255,255,0.55)"
                lineHeight={1.7}
              />
            </div>
          )}
        </div>

        <Separator />

        {/* ---- Repository (Protocol property row style) ---- */}
        <div className="mb-0">
          <SectionHeader>Repository</SectionHeader>
          {editing ? (
            <input
              value={editRepo}
              onChange={e => setEditRepo(e.target.value)}
              placeholder="e.g. org/repo"
              className={`${inputCls} !font-mono !text-xs`}
            />
          ) : card.repo ? (
            <div className="flex items-center gap-2 pt-1">
              <span className="opacity-45 flex items-center">
                {Ico.folder("rgba(255,255,255,0.6)", 14)}
              </span>
              <MonoChip>{card.repo}</MonoChip>
            </div>
          ) : (
            <div className="text-[12.5px] text-[rgba(255,255,255,0.3)] italic pt-1">
              No repository specified
            </div>
          )}
        </div>

        <Separator />

        {/* ---- Files (Protocol properties-list style) ---- */}
        <div className="mb-0">
          <SectionHeader>
            <span className="inline-flex items-center gap-1.5">
              Files
              {!editing && card.files.length > 0 && (
                <span className="text-[11px] font-medium text-[rgba(255,255,255,0.35)]">
                  ({card.files.length})
                </span>
              )}
            </span>
          </SectionHeader>
          {editing ? (
            <textarea
              value={editFiles}
              onChange={e => setEditFiles(e.target.value)}
              rows={5}
              placeholder="One file path per line"
              className={`${inputCls} !font-mono !text-[11.5px] !leading-[1.7] resize-y`}
            />
          ) : card.files.length > 0 ? (
            <div className="flex flex-col">
              {card.files.map((f, idx) => {
                const change = card.fileChanges?.[f];
                const fileName = f.split("/").pop() || f;
                const dirPath = f.includes("/") ? f.substring(0, f.lastIndexOf("/")) : "";
                const badge = change ? CHANGE_BADGE[change.changeType] || CHANGE_BADGE.edit : null;

                return (
                  <React.Fragment key={f}>
                    <button
                      onClick={() => { if (change) onFileClick(f, change); }}
                      title={f}
                      className={`flex items-center gap-2 bg-transparent border-none rounded-none px-1 py-2.5 text-left w-full transition-[background] duration-[120ms] m-0 ${change ? "cursor-pointer hover:bg-[rgba(255,255,255,0.03)]" : "cursor-default"}`}
                    >
                      {/* File icon */}
                      <span className="opacity-35 flex items-center shrink-0">
                        {Ico.file("rgba(255,255,255,0.7)", 13)}
                      </span>

                      {/* Filename as monospace chip */}
                      <MonoChip>{fileName}</MonoChip>

                      {/* Directory path */}
                      {dirPath ? (
                        <span className="text-[11px] text-[rgba(255,255,255,0.25)] font-mono flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                          {dirPath}
                        </span>
                      ) : (
                        <span className="flex-1" />
                      )}

                      {/* Change type badge (Protocol GET/POST style) */}
                      {badge && (
                        <span
                          className="text-[9px] font-bold px-[7px] py-[3px] rounded-[4px] tracking-[0.04em] leading-none shrink-0"
                          style={{ color: badge.color, background: badge.bg }}
                        >
                          {badge.label}
                        </span>
                      )}
                    </button>
                    {idx < card.files.length - 1 && <RowSeparator />}
                  </React.Fragment>
                );
              })}
            </div>
          ) : (
            <div className="text-[12.5px] text-[rgba(255,255,255,0.3)] italic pt-1">
              No files
            </div>
          )}
        </div>

        <Separator />

        {/* ---- Dependencies (Protocol property-row style) ---- */}
        <div className="mb-0">
          <SectionHeader>
            <span className="inline-flex items-center gap-1.5">
              Dependencies
              {!editing && card.dependencies.length > 0 && (
                <span className="text-[11px] font-medium text-[rgba(255,255,255,0.35)]">
                  ({card.dependencies.length})
                </span>
              )}
            </span>
          </SectionHeader>
          {depCards.length > 0 ? (
            <div className="flex flex-col">
              {depCards.map((dep, idx) => {
                const dtc = TC[dep.type] || { l: dep.type, c: T.accent, bg: T.aD };
                return (
                  <React.Fragment key={dep.id}>
                    <div className="flex items-center gap-2 px-1 py-2.5 transition-[background] duration-[120ms] hover:bg-[rgba(255,255,255,0.03)]">
                      {/* Type chip */}
                      <span
                        className="text-[9px] font-bold px-[7px] py-[3px] rounded-[4px] uppercase tracking-[0.04em] leading-none shrink-0"
                        style={{ color: dtc.c, background: dtc.bg }}
                      >
                        {dtc.l}
                      </span>

                      {/* Title */}
                      <span className="text-[12.5px] text-[rgba(255,255,255,0.75)] flex-1 overflow-hidden text-ellipsis whitespace-nowrap leading-[1.4]">
                        {dep.title}
                      </span>

                      {/* Action buttons */}
                      {editing ? (
                        <div className="flex gap-0.5 shrink-0">
                          <button
                            onClick={() => moveDep(idx, -1)}
                            title="Move up"
                            className="bg-transparent border-none cursor-pointer flex items-center justify-center p-0 rounded-[6px] w-6 h-6 transition-opacity duration-[120ms] hover:opacity-100"
                            style={{ opacity: idx === 0 ? 0.25 : 0.6 }}
                            disabled={idx === 0}
                          >
                            {Ico.arrowUp(T.sec, 11)}
                          </button>
                          <button
                            onClick={() => moveDep(idx, 1)}
                            title="Move down"
                            className="bg-transparent border-none cursor-pointer flex items-center justify-center p-0 rounded-[6px] w-6 h-6 transition-opacity duration-[120ms] hover:opacity-100"
                            style={{ opacity: idx === depCards.length - 1 ? 0.25 : 0.6 }}
                            disabled={idx === depCards.length - 1}
                          >
                            {Ico.arrowDown(T.sec, 11)}
                          </button>
                          <button
                            onClick={() => removeDep(idx)}
                            title="Remove dependency"
                            className="bg-transparent border-none cursor-pointer flex items-center justify-center p-0 rounded-[6px] w-6 h-6 opacity-60 transition-opacity duration-[120ms] hover:opacity-100"
                          >
                            {Ico.close(T.red, 11)}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => onSelectCard(dep.id)}
                          title="Go to card"
                          className="bg-transparent border-none cursor-pointer flex items-center justify-center p-0 rounded-[6px] w-6 h-6 shrink-0 opacity-40 transition-opacity duration-[120ms] hover:opacity-100"
                        >
                          {Ico.goto(tc.c, 11)}
                        </button>
                      )}
                    </div>
                    {idx < depCards.length - 1 && <RowSeparator />}
                  </React.Fragment>
                );
              })}
            </div>
          ) : (
            <div className="text-[12.5px] text-[rgba(255,255,255,0.3)] italic pt-1">
              No dependencies
            </div>
          )}
        </div>

        {/* ---- Save / Cancel buttons (edit mode) ---- */}
        {editing && (
          <>
            <Separator />
            <div className="flex gap-2.5">
              <button
                onClick={saveEdit}
                className="flex-1 py-[9px] rounded-lg bg-[#10b981] border-none cursor-pointer text-white text-xs font-semibold font-[ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] flex items-center justify-center gap-1.5 transition-opacity duration-150 hover:opacity-85"
              >
                {Ico.check("#fff", 12)} Save changes
              </button>
              <button
                onClick={cancelEdit}
                className="flex-1 py-[9px] rounded-lg bg-transparent border border-[rgba(255,255,255,0.1)] cursor-pointer text-[rgba(255,255,255,0.55)] text-xs font-semibold font-[ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] transition-all duration-150 hover:bg-[rgba(255,255,255,0.04)] hover:border-[rgba(255,255,255,0.15)]"
              >
                Cancel
              </button>
            </div>
          </>
        )}

        <Separator />

        {/* ---- Feedback Section ---- */}
        <SectionHeader>
          <span className="inline-flex items-center gap-1.5">
            Feedback
            {feedbacks.length > 0 && (
              <span className="text-[11px] font-medium text-[rgba(255,255,255,0.35)]">
                ({feedbacks.length})
              </span>
            )}
          </span>
        </SectionHeader>

        {/* Feedback list */}
        {feedbacks.length > 0 ? (
          <div className="mb-3.5 mt-1">
            {feedbacks.map(fb => (
              <FeedbackItem key={fb.id} fb={fb} onDelete={onDeleteFeedback} readOnly={readOnly} />
            ))}
          </div>
        ) : (
          <div className="text-[12.5px] text-[rgba(255,255,255,0.3)] italic mb-3.5 pt-1">
            No feedback yet
          </div>
        )}

        {/* Add feedback form (Protocol-style card with tabs) */}
        {!readOnly && (
          <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-[10px] overflow-hidden">
            {/* Tab bar (Protocol cURL/JS/Python style) */}
            <div className="flex items-center gap-0 border-b border-[rgba(255,255,255,0.06)] px-3">
              {(["question", "directive", "issue"] as const).map(type => {
                const active = fbTab === type;
                const s = FB[type];
                const icon = type === "question" ? Ico.question : type === "directive" ? Ico.bolt : Ico.alert;
                return (
                  <button
                    key={type}
                    onClick={() => setFbTab(type)}
                    className="bg-transparent border-none border-b-2 rounded-none cursor-pointer flex items-center justify-center p-0 gap-[5px] px-3 py-2.5 text-[11px] font-medium capitalize tracking-[0.01em] transition-[color,border-color] duration-150 -mb-px"
                    style={{
                      color: active ? s.color : "rgba(255,255,255,0.35)",
                      borderBottomColor: active ? s.color : "transparent",
                    }}
                    onMouseEnter={(e: any) => {
                      if (!active) e.currentTarget.style.color = "rgba(255,255,255,0.6)";
                    }}
                    onMouseLeave={(e: any) => {
                      if (!active) e.currentTarget.style.color = "rgba(255,255,255,0.35)";
                    }}
                  >
                    {icon(active ? s.color : "rgba(255,255,255,0.35)", 11)}
                    {s.label}
                  </button>
                );
              })}
            </div>

            {/* Textarea */}
            <div className="p-3">
              <textarea
                value={fbText}
                onChange={e => setFbText(e.target.value)}
                placeholder={`Add a ${fbTab}...`}
                rows={3}
                className="w-full bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-2.5 text-[#fafafa] text-[12.5px] font-[ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] leading-[1.6] resize-y outline-none transition-[border-color] duration-150 box-border focus:border-[rgba(255,255,255,0.12)]"
                onKeyDown={e => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleAddFeedback();
                  }
                }}
              />

              {/* Send button */}
              <div className="flex justify-end mt-2">
                <button
                  onClick={handleAddFeedback}
                  disabled={!fbText.trim()}
                  className="bg-transparent border-none cursor-pointer flex items-center justify-center p-0 rounded-[7px] gap-1.5 px-4 py-[7px] text-[11px] font-semibold transition-all duration-150 hover:opacity-85"
                  style={{
                    color: fbText.trim() ? "#fff" : "rgba(255,255,255,0.25)",
                    background: fbText.trim() ? FB[fbTab].color : "rgba(255,255,255,0.04)",
                    cursor: fbText.trim() ? "pointer" : "default",
                    opacity: fbText.trim() ? 1 : 0.6,
                  }}
                >
                  {Ico.send(fbText.trim() ? "#fff" : "rgba(255,255,255,0.25)", 11)}
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(DetailDrawer);
