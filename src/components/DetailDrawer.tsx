import React, { useState, useCallback, useMemo } from "react";
import { TC, FB } from "../lib/theme";
import { Md } from "../lib/markdown";
import type { Card, Feedback, FileChange } from "../types";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";

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
  search: (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  compass: (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M10.5 5.5L9 9 5.5 10.5 7 7z" fill="currentColor" opacity="0.7" />
    </svg>
  ),
  plus: (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  pencil: (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M11.5 2.5l2 2L5 13H3v-2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M9.5 4.5l2 2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ),
  beaker: (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M6 2v5L3 13h10L10 7V2" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M5 2h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  folder: (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M2 4.5a1 1 0 011-1h3l1.5 1.5H13a1 1 0 011 1V12a1 1 0 01-1 1H3a1 1 0 01-1-1z" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ),
  question: (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6.5 6.5a1.5 1.5 0 012.7.9c0 1-1.2 1.1-1.2 2.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="8" cy="12" r="0.7" fill="currentColor" />
    </svg>
  ),
  bolt: (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M9 2L4 9h4l-1 5 5-7H8z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  ),
  alert: (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M8 2L1.5 13h13z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M8 7v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="8" cy="11.5" r="0.6" fill="currentColor" />
    </svg>
  ),
  check: (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M3.5 8.5L6.5 11.5 12.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  send: (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M2 8l12-5-5 12-2-5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M7 10l7-7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  goto: (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  close: (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  arrowUp: (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M8 13V3M4 7l4-4 4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  arrowDown: (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M8 3v10M4 9l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  trash: (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v8.5a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  file: (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M4 2h5.5L13 5.5V14a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2" />
      <path d="M9 2v4h4" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  ),
};

/* ---- Type icon helper ---- */
function typeIcon(type: string) {
  switch (type) {
    case "research": return Ico.search(11);
    case "planning": return Ico.compass(11);
    case "create": return Ico.plus(11);
    case "edit": return Ico.pencil(11);
    case "test": return Ico.beaker(11);
    default: return null;
  }
}

/* ---- Change type badge colors ---- */
const CHANGE_BADGE: Record<string, { label: string; cls: string }> = {
  create: { label: "CREATE", cls: "text-fp-success bg-fp-success-dim" },
  edit: { label: "EDIT", cls: "text-fp-warning bg-fp-warning-dim" },
  delete: { label: "DELETE", cls: "text-fp-danger bg-fp-danger-dim" },
};

/* ---- Feedback accent color map ---- */
const FB_ACCENT: Record<string, { text: string; bg: string; border: string }> = {
  question: { text: "text-fp-info", bg: "bg-fp-info-dim", border: "border-fp-info/20" },
  directive: { text: "text-fp-warning", bg: "bg-fp-warning-dim", border: "border-fp-warning/20" },
  issue: { text: "text-fp-danger", bg: "bg-fp-danger-dim", border: "border-fp-danger/20" },
};

/* ---- FeedbackItem sub-component ---- */
function FeedbackItem({
  fb, onDelete, readOnly,
}: {
  fb: Feedback;
  onDelete: (id: string) => void;
  readOnly?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const style = FB[fb.type] || FB.question;
  const accent = FB_ACCENT[fb.type] || FB_ACCENT.question;
  const isAnswered = fb.type === "question" && fb.answer;
  const isAcknowledged = fb.type !== "question" && fb.read;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`rounded-fp-lg border border-fp-border p-3 mb-2 relative overflow-hidden transition-colors duration-150 ${hovered ? "border-fp-border-hover" : ""}`}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 mb-1.5">
        {/* Type badge pill */}
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-fp-pill uppercase tracking-wider leading-none ${accent.text} ${accent.bg}`}>
          {style.label}
        </span>

        {/* Status dot */}
        <span className={`text-[10px] font-medium inline-flex items-center gap-1 ${(isAnswered || isAcknowledged) ? "text-fp-success" : "text-fp-dim"}`}>
          <span className={`w-[5px] h-[5px] rounded-full inline-block ${(isAnswered || isAcknowledged) ? "bg-fp-success" : "bg-fp-dim/40"}`} />
          {fb.type === "question"
            ? (isAnswered ? "Answered" : "Pending")
            : (isAcknowledged ? "Acknowledged" : "Pending")}
        </span>

        <span className="flex-1" />
        {hovered && !readOnly && (
          <IconButton
            variant="danger"
            size="sm"
            icon={Ico.trash(12)}
            label="Delete feedback"
            onClick={() => onDelete(fb.id)}
          />
        )}
      </div>

      {/* Content */}
      <div className="text-[12.5px] text-fp-muted leading-relaxed">
        {fb.text}
      </div>

      {/* Answer section */}
      {isAnswered && (
        <div className="mt-2.5 pt-2.5 border-t border-fp-border">
          <div className="text-[10px] font-semibold mb-1 uppercase tracking-wider text-fp-success">
            Answer
          </div>
          <div className="text-xs text-fp-dim leading-relaxed">
            {fb.answer}
          </div>
        </div>
      )}
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

  const tc = TC[card.type] || { l: card.type, c: "#10b981", bg: "rgba(16,185,129,0.10)" };
  const editTc = TC[editType] || { l: editType, c: "#10b981", bg: "rgba(16,185,129,0.10)" };

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

  /* Type color mapping to tailwind classes */
  const typeColorCls = (type: string) => {
    switch (type) {
      case "research": return { text: "text-fp-accent", bg: "bg-fp-accent-dim", border: "border-fp-accent/20" };
      case "planning": return { text: "text-fp-purple", bg: "bg-fp-purple-dim", border: "border-fp-purple/20" };
      case "create": return { text: "text-fp-info", bg: "bg-fp-info-dim", border: "border-fp-info/20" };
      case "edit": return { text: "text-fp-warning", bg: "bg-fp-warning-dim", border: "border-fp-warning/20" };
      case "test": return { text: "text-fp-teal", bg: "bg-fp-teal-dim", border: "border-fp-teal/20" };
      default: return { text: "text-fp-accent", bg: "bg-fp-accent-dim", border: "border-fp-accent/20" };
    }
  };

  const typeCls = typeColorCls(card.type);

  return (
    <div className="h-full w-full flex flex-col bg-transparent overflow-hidden">
      {/* ---- Header ---- */}
      <div className="p-4 flex items-center gap-2.5 border-b border-fp-border shrink-0">
        {/* Type badge pill */}
        <span className={`text-[10px] font-semibold py-1 px-2.5 rounded-fp-pill uppercase tracking-wider leading-none inline-flex items-center gap-1.5 border ${typeCls.text} ${typeCls.bg} ${typeCls.border}`}>
          {typeIcon(card.type)}
          {tc.l}
        </span>

        {/* Title */}
        <span className="text-lg font-semibold text-fp-text truncate flex-1">
          {card.title}
        </span>

        {/* Edit button */}
        {!readOnly && onEditCard && !editing && (
          <IconButton
            variant="glassy"
            size="md"
            icon={Ico.pencil(13)}
            label="Edit card"
            onClick={startEdit}
          />
        )}

        {/* Close button */}
        <IconButton
          variant="glassy"
          size="md"
          icon={Ico.close(13)}
          label="Close"
          onClick={onClose}
        />
      </div>

      {/* ---- Scrollable content ---- */}
      <div className="flex-1 overflow-y-auto">
        {/* ---- Edit mode: Title ---- */}
        {editing && (
          <div className="p-4 border-b border-fp-border">
            <label className="fp-label">Title</label>
            <input
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              className="fp-input text-lg font-semibold"
            />
          </div>
        )}

        {/* ---- Edit mode: Type select ---- */}
        {editing && (
          <div className="p-4 border-b border-fp-border">
            <label className="fp-label">Type</label>
            <select
              value={editType}
              onChange={e => setEditType(e.target.value as Card["type"])}
              className="fp-input cursor-pointer font-semibold appearance-none"
              style={{ color: editTc.c }}
            >
              {Object.entries(TC).map(([k, v]) => (
                <option key={k} value={k}>{v.l}</option>
              ))}
            </select>
          </div>
        )}

        {/* ---- Description ---- */}
        <div className="p-4 border-b border-fp-border">
          <div className="text-xs font-mono uppercase tracking-wider text-fp-dim mb-2">Description</div>
          {editing ? (
            <textarea
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              rows={8}
              className="fp-input resize-y font-mono text-xs leading-relaxed"
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

        {/* ---- Repository ---- */}
        <div className="p-4 border-b border-fp-border">
          <div className="text-xs font-mono uppercase tracking-wider text-fp-dim mb-2">Repository</div>
          {editing ? (
            <>
              <label className="fp-label">Repo path</label>
              <input
                value={editRepo}
                onChange={e => setEditRepo(e.target.value)}
                placeholder="e.g. org/repo"
                className="fp-input font-mono text-xs"
              />
            </>
          ) : card.repo ? (
            <div className="flex items-center gap-2">
              <span className="text-fp-dim flex items-center">{Ico.folder(14)}</span>
              <span className="bg-fp-glass rounded-fp-md px-2.5 py-1.5 font-mono text-xs text-fp-text border border-fp-border">
                {card.repo}
              </span>
            </div>
          ) : (
            <div className="text-xs text-fp-dim italic">No repository specified</div>
          )}
        </div>

        {/* ---- Files ---- */}
        <div className="p-4 border-b border-fp-border">
          <div className="text-xs font-mono uppercase tracking-wider text-fp-dim mb-2">
            Files
            {!editing && card.files.length > 0 && (
              <span className="ml-1.5 text-fp-dim/50">({card.files.length})</span>
            )}
          </div>
          {editing ? (
            <>
              <label className="fp-label">File paths (one per line)</label>
              <textarea
                value={editFiles}
                onChange={e => setEditFiles(e.target.value)}
                rows={5}
                placeholder="One file path per line"
                className="fp-input resize-y font-mono text-xs leading-relaxed"
              />
            </>
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
                      className={`flex items-center gap-2 py-2 bg-transparent border-none text-left w-full transition-colors duration-150 ${change ? "cursor-pointer hover:bg-fp-glass-hover" : "cursor-default"}`}
                    >
                      {/* File icon */}
                      <span className="text-fp-dim flex items-center shrink-0">{Ico.file(13)}</span>

                      {/* Filename mono chip */}
                      <span className="bg-fp-glass rounded-fp-md px-2.5 py-1.5 font-mono text-xs text-fp-text border border-fp-border">
                        {fileName}
                      </span>

                      {/* Directory path */}
                      {dirPath ? (
                        <span className="text-[11px] text-fp-dim font-mono flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                          {dirPath}
                        </span>
                      ) : (
                        <span className="flex-1" />
                      )}

                      {/* Change type badge pill */}
                      {badge && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-fp-pill tracking-wider leading-none shrink-0 ${badge.cls}`}>
                          {badge.label}
                        </span>
                      )}
                    </button>
                    {idx < card.files.length - 1 && <div className="border-b border-fp-border" />}
                  </React.Fragment>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-fp-dim italic">No files</div>
          )}
        </div>

        {/* ---- Dependencies ---- */}
        <div className="p-4 border-b border-fp-border">
          <div className="text-xs font-mono uppercase tracking-wider text-fp-dim mb-2">
            Dependencies
            {!editing && card.dependencies.length > 0 && (
              <span className="ml-1.5 text-fp-dim/50">({card.dependencies.length})</span>
            )}
          </div>
          {depCards.length > 0 ? (
            <div className="flex flex-col">
              {depCards.map((dep, idx) => {
                const dCls = typeColorCls(dep.type);
                const dtc = TC[dep.type] || { l: dep.type, c: "#10b981", bg: "rgba(16,185,129,0.10)" };
                return (
                  <React.Fragment key={dep.id}>
                    <div className="flex items-center gap-2 py-2 transition-colors duration-150 hover:bg-fp-glass-hover">
                      {/* Type chip */}
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-fp-sm uppercase tracking-wider leading-none shrink-0 ${dCls.text} ${dCls.bg}`}>
                        {dtc.l}
                      </span>

                      {/* Title */}
                      <span className="text-xs text-fp-muted flex-1 overflow-hidden text-ellipsis whitespace-nowrap leading-snug">
                        {dep.title}
                      </span>

                      {/* Action buttons */}
                      {editing ? (
                        <div className="flex gap-0.5 shrink-0">
                          <IconButton
                            variant="ghost"
                            size="sm"
                            icon={Ico.arrowUp(11)}
                            label="Move up"
                            onClick={() => moveDep(idx, -1)}
                            disabled={idx === 0}
                          />
                          <IconButton
                            variant="ghost"
                            size="sm"
                            icon={Ico.arrowDown(11)}
                            label="Move down"
                            onClick={() => moveDep(idx, 1)}
                            disabled={idx === depCards.length - 1}
                          />
                          <IconButton
                            variant="danger"
                            size="sm"
                            icon={Ico.close(11)}
                            label="Remove dependency"
                            onClick={() => removeDep(idx)}
                          />
                        </div>
                      ) : (
                        <IconButton
                          variant="ghost"
                          size="sm"
                          icon={Ico.goto(11)}
                          label="Go to card"
                          onClick={() => onSelectCard(dep.id)}
                        />
                      )}
                    </div>
                    {idx < depCards.length - 1 && <div className="border-b border-fp-border" />}
                  </React.Fragment>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-fp-dim italic">No dependencies</div>
          )}
        </div>

        {/* ---- Save / Cancel buttons (edit mode) ---- */}
        {editing && (
          <div className="p-4 border-b border-fp-border flex gap-2.5">
            <Button
              variant="accent"
              size="md"
              icon={Ico.check(12)}
              onClick={saveEdit}
              className="flex-1"
            >
              Save changes
            </Button>
            <Button
              variant="glassy"
              size="md"
              onClick={cancelEdit}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        )}

        {/* ---- Feedback Section ---- */}
        <div className="p-4">
          <div className="text-xs font-mono uppercase tracking-wider text-fp-dim mb-2">
            Feedback
            {feedbacks.length > 0 && (
              <span className="ml-1.5 text-fp-dim/50">({feedbacks.length})</span>
            )}
          </div>

          {/* Feedback list */}
          {feedbacks.length > 0 ? (
            <div className="mb-3.5">
              {feedbacks.map(fb => (
                <FeedbackItem key={fb.id} fb={fb} onDelete={onDeleteFeedback} readOnly={readOnly} />
              ))}
            </div>
          ) : (
            <div className="text-xs text-fp-dim italic mb-3.5">No feedback yet</div>
          )}

          {/* Add feedback form */}
          {!readOnly && (
            <div className="border border-fp-border rounded-fp-lg overflow-hidden">
              {/* Tab bar */}
              <div className="flex items-center gap-0 border-b border-fp-border">
                {(["question", "directive", "issue"] as const).map(type => {
                  const active = fbTab === type;
                  const s = FB[type];
                  const icon = type === "question" ? Ico.question : type === "directive" ? Ico.bolt : Ico.alert;
                  return (
                    <Button
                      key={type}
                      variant="ghost"
                      size="sm"
                      icon={icon(11)}
                      onClick={() => setFbTab(type)}
                      className={`rounded-none border-b-2 -mb-px capitalize ${active ? "!border-b-current opacity-100" : "!border-b-transparent opacity-50 hover:opacity-75"}`}
                      style={{ color: active ? s.color : undefined }}
                    >
                      {s.label}
                    </Button>
                  );
                })}
              </div>

              {/* Textarea + send */}
              <div className="p-3">
                <textarea
                  value={fbText}
                  onChange={e => setFbText(e.target.value)}
                  placeholder={`Add a ${fbTab}...`}
                  rows={3}
                  className="fp-input resize-y text-xs leading-relaxed"
                  onKeyDown={e => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleAddFeedback();
                    }
                  }}
                />

                <div className="flex justify-end mt-2">
                  <Button
                    variant={fbText.trim() ? "accent" : "ghost"}
                    size="sm"
                    icon={Ico.send(11)}
                    onClick={handleAddFeedback}
                    disabled={!fbText.trim()}
                  >
                    Send
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(DetailDrawer);
