import React, { useState, useCallback, useMemo } from "react";
import {
  Folders,
  File,
  CaretUp,
  CaretDown,
  ArrowRight,
  X,
  PencilSimple,
  Trash,
  PaperPlaneTilt,
  ChatCircleDots,
  Lightning,
  Warning,
  CheckCircle,
  Copy,
} from "@phosphor-icons/react";
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

/* ---- Type icon helper ---- */
function typeIcon(type: string) {
  const props = { size: 11, weight: "bold" as const };
  switch (type) {
    case "research": return <ChatCircleDots {...props} />;
    case "planning": return <Folders {...props} />;
    case "create": return <Lightning {...props} />;
    case "edit": return <PencilSimple {...props} />;
    case "test": return <CheckCircle {...props} />;
    default: return null;
  }
}

/* ---- Change type badge colors ---- */
const CHANGE_BADGE: Record<string, { label: string; cls: string }> = {
  create: { label: "CREATE", cls: "text-fp-success bg-fp-success-dim" },
  edit: { label: "EDIT", cls: "text-fp-warning bg-fp-warning-dim" },
  delete: { label: "DELETE", cls: "text-fp-danger bg-fp-danger-dim" },
};

/* ---- Feedback accent color map (Protocol-style glassy cards) ---- */
const FB_ACCENT: Record<string, { text: string; bg: string; border: string; hoverBorder: string; hoverBg: string; ring: string }> = {
  question: { text: "text-fp-info", bg: "bg-fp-glass", border: "border-fp-border", hoverBorder: "hover:border-fp-info/30", hoverBg: "hover:bg-fp-info/[0.04]", ring: "group-hover:ring-fp-info/10" },
  directive: { text: "text-fp-warning", bg: "bg-fp-glass", border: "border-fp-border", hoverBorder: "hover:border-fp-warning/30", hoverBg: "hover:bg-fp-warning/[0.04]", ring: "group-hover:ring-fp-warning/10" },
  issue: { text: "text-fp-danger", bg: "bg-fp-glass", border: "border-fp-border", hoverBorder: "hover:border-fp-danger/30", hoverBg: "hover:bg-fp-danger/[0.04]", ring: "group-hover:ring-fp-danger/10" },
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

  const fbIcon = fb.type === "question"
    ? <ChatCircleDots size={11} weight="bold" />
    : fb.type === "directive"
      ? <Lightning size={11} weight="bold" />
      : <Warning size={11} weight="bold" />;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group rounded-fp-lg border p-3 mb-2 relative overflow-hidden transition-all duration-200 backdrop-blur-fp-card ${accent.bg} ${accent.border} ${accent.hoverBorder} ${accent.hoverBg}`}
    >
      {/* Header row */}
      <div className="flex items-center gap-1.5 mb-1.5">
        {/* Type icon */}
        <span className={`${accent.text} shrink-0`}>{fbIcon}</span>

        {/* Type label */}
        <span className={`text-[10px] font-semibold uppercase tracking-wider leading-none ${accent.text}`}>
          {style.label}
        </span>

        {/* Status dot */}
        <span className={`text-[9px] font-medium inline-flex items-center gap-1 ${(isAnswered || isAcknowledged) ? "text-fp-success" : "text-fp-dim"}`}>
          <span className={`w-1 h-1 rounded-full inline-block ${(isAnswered || isAcknowledged) ? "bg-fp-success" : "bg-fp-dim/40"}`} />
          {fb.type === "question"
            ? (isAnswered ? "Answered" : "Pending")
            : (isAcknowledged ? "Ack" : "Pending")}
        </span>

        <span className="flex-1" />
        {!readOnly && (
          <IconButton
            variant="danger"
            size="sm"
            icon={<Trash size={11} weight="bold" />}
            label="Delete feedback"
            onClick={() => onDelete(fb.id)}
            className={`transition-opacity duration-150 ${hovered ? "opacity-100" : "opacity-0"}`}
          />
        )}
      </div>

      {/* Content */}
      <div className="text-[12px] text-fp-muted leading-relaxed">
        {fb.text}
      </div>

      {/* Answer section */}
      {isAnswered && (
        <div className="mt-2 pt-2 border-t border-fp-border">
          <div className="text-[9px] font-semibold mb-1 uppercase tracking-wider text-fp-success inline-flex items-center gap-1">
            <CheckCircle size={9} weight="bold" />
            Answer
          </div>
          <div className="text-[11px] text-fp-dim leading-relaxed">
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

  /* Feedback tab variant mapping */
  const fbTabVariant = (type: "question" | "directive" | "issue") => {
    if (fbTab !== type) return "ghost" as const;
    switch (type) {
      case "question": return "info" as const;
      case "directive": return "warning" as const;
      case "issue": return "danger" as const;
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-transparent overflow-hidden">
      {/* ---- Header ---- */}
      <div className="p-3 flex items-center gap-2 border-b border-fp-border shrink-0">
        {/* Type badge pill */}
        <span className={`text-[9px] font-semibold py-[3px] px-2 rounded-fp-pill uppercase tracking-wider leading-none inline-flex items-center gap-1 border ${typeCls.text} ${typeCls.bg} ${typeCls.border}`}>
          {typeIcon(card.type)}
          {tc.l}
        </span>

        {/* Title */}
        <span className="text-[13px] font-semibold text-fp-text truncate flex-1">
          {card.title}
        </span>

        {/* Edit button */}
        {!readOnly && onEditCard && !editing && (
          <IconButton
            variant="glassy"
            size="sm"
            icon={<PencilSimple size={12} weight="bold" />}
            label="Edit card"
            onClick={startEdit}
          />
        )}

        {/* Close button */}
        <IconButton
          variant="ghost"
          size="sm"
          icon={<X size={12} weight="bold" />}
          label="Close"
          onClick={onClose}
        />
      </div>

      {/* ---- Scrollable content ---- */}
      <div className="flex-1 overflow-y-auto">
        {/* ---- Edit mode: Title ---- */}
        {editing && (
          <div className="p-3 border-b border-fp-border">
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
          <div className="p-3 border-b border-fp-border">
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
        <div className="p-3 border-b border-fp-border">
          <div className="text-[10px] font-mono uppercase tracking-wider text-fp-dim mb-1.5">Description</div>
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
        <div className="p-3 border-b border-fp-border">
          <div className="text-[10px] font-mono uppercase tracking-wider text-fp-dim mb-1.5">Repository</div>
          {editing ? (
            <div className="flex flex-col gap-3">
              <label className="fp-label">Repo path</label>
              <input
                value={editRepo}
                onChange={e => setEditRepo(e.target.value)}
                placeholder="e.g. org/repo"
                className="fp-input font-mono text-xs"
              />
            </div>
          ) : card.repo ? (
            <div className="flex items-center gap-2">
              <span className="text-fp-dim flex items-center"><Folders size={14} /></span>
              <span className="bg-fp-glass rounded-fp-md px-2.5 py-1.5 font-mono text-xs text-fp-text border border-fp-border">
                {card.repo}
              </span>
            </div>
          ) : (
            <div className="text-xs text-fp-dim italic">No repository specified</div>
          )}
        </div>

        {/* ---- Files ---- */}
        <div className="p-3 border-b border-fp-border">
          <div className="text-[10px] font-mono uppercase tracking-wider text-fp-dim mb-1.5">
            Files
            {!editing && card.files.length > 0 && (
              <span className="ml-1.5 text-fp-dim/50">({card.files.length})</span>
            )}
          </div>
          {editing ? (
            <div className="flex flex-col gap-3">
              <label className="fp-label">File paths (one per line)</label>
              <textarea
                value={editFiles}
                onChange={e => setEditFiles(e.target.value)}
                rows={5}
                placeholder="One file path per line"
                className="fp-input resize-y font-mono text-xs leading-relaxed"
              />
            </div>
          ) : card.files.length > 0 ? (
            <div className="flex flex-col">
              {card.files.map((f, idx) => {
                const change = card.fileChanges?.[f];
                const fileName = f.split("/").pop() || f;
                const dirPath = f.includes("/") ? f.substring(0, f.lastIndexOf("/")) : "";
                const badge = change ? CHANGE_BADGE[change.changeType] || CHANGE_BADGE.edit : null;

                return (
                  <button
                    key={f}
                    onClick={() => { if (change) onFileClick(f, change); }}
                    title={f}
                    className={`flex items-center gap-2 py-2.5 bg-transparent border-none border-b border-fp-border last:border-0 text-left w-full transition-colors duration-150 ${change ? "cursor-pointer hover:bg-fp-glass-hover" : "cursor-default"}`}
                  >
                    {/* File icon */}
                    <span className="text-fp-dim flex items-center shrink-0"><File size={13} /></span>

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
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-fp-dim italic">No files</div>
          )}
        </div>

        {/* ---- Dependencies ---- */}
        <div className="p-3 border-b border-fp-border">
          <div className="text-[10px] font-mono uppercase tracking-wider text-fp-dim mb-1.5">
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
                  <div
                    key={dep.id}
                    className={`flex items-center gap-2 py-2.5 transition-colors duration-150 hover:bg-fp-glass-hover border-b border-fp-border last:border-0`}
                  >
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
                          icon={<CaretUp size={11} weight="bold" />}
                          label="Move up"
                          onClick={() => moveDep(idx, -1)}
                          disabled={idx === 0}
                        />
                        <IconButton
                          variant="ghost"
                          size="sm"
                          icon={<CaretDown size={11} weight="bold" />}
                          label="Move down"
                          onClick={() => moveDep(idx, 1)}
                          disabled={idx === depCards.length - 1}
                        />
                        <IconButton
                          variant="danger"
                          size="sm"
                          icon={<X size={11} weight="bold" />}
                          label="Remove dependency"
                          onClick={() => removeDep(idx)}
                        />
                      </div>
                    ) : (
                      <IconButton
                        variant="ghost"
                        size="sm"
                        icon={<ArrowRight size={11} weight="bold" />}
                        label="Go to card"
                        onClick={() => onSelectCard(dep.id)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-fp-dim italic">No dependencies</div>
          )}
        </div>

        {/* ---- Save / Cancel buttons (edit mode) — sticky bottom ---- */}
        {editing && (
          <div className="p-3 border-t border-fp-border flex gap-2 shrink-0 sticky bottom-0 bg-fp-solid/80 backdrop-blur-fp-card z-10">
            <Button
              variant="accent"
              size="md"
              icon={<CheckCircle size={12} weight="bold" />}
              onClick={saveEdit}
              className="flex-1"
            >
              Save changes
            </Button>
            <Button
              variant="ghost"
              size="md"
              onClick={cancelEdit}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        )}

        {/* ---- Feedback Section ---- */}
        <div className="p-3">
          <div className="text-[10px] font-mono uppercase tracking-wider text-fp-dim mb-1.5">
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
                  const s = FB[type];
                  const icon = type === "question"
                    ? <ChatCircleDots size={11} weight="bold" />
                    : type === "directive"
                      ? <Lightning size={11} weight="bold" />
                      : <Warning size={11} weight="bold" />;
                  return (
                    <Button
                      key={type}
                      variant={fbTabVariant(type)}
                      size="sm"
                      icon={icon}
                      onClick={() => setFbTab(type)}
                      className="rounded-none flex-1 capitalize"
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
                    icon={<PaperPlaneTilt size={11} weight="bold" />}
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
