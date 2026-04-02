import React, { useState, useCallback, useMemo, useRef } from "react";
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
import Chip, { type ChipVariant } from "./ui/Chip";
import SegmentedControl from "./ui/SegmentedControl";
import { TYPE_CHIP, TYPE_GRADIENT } from "../lib/cardTypes";

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
  const props = { size: 12, weight: "regular" as const };
  switch (type) {
    case "research":
      return <ChatCircleDots {...props} />;
    case "planning":
      return <Folders {...props} />;
    case "create":
      return <Lightning {...props} />;
    case "edit":
      return <PencilSimple {...props} />;
    case "test":
      return <CheckCircle {...props} />;
    default:
      return null;
  }
}

/* ---- Change type → Chip variant ---- */
const CHANGE_CHIP: Record<string, { label: string; variant: ChipVariant }> = {
  create: { label: "CREATE", variant: "success" },
  edit: { label: "EDIT", variant: "warning" },
  delete: { label: "DELETE", variant: "danger" },
};

/* ---- Feedback Protocol card colors ---- */
const FB_CARD: Record<string, { gradientFrom: string; gradientTo: string; color: string }> = {
  question: { gradientFrom: "rgba(66,133,244,0.03)", gradientTo: "rgba(66,133,244,0.015)", color: "#4285f4" },
  directive: { gradientFrom: "rgba(251,188,4,0.03)", gradientTo: "rgba(251,188,4,0.015)", color: "#fbbc04" },
  issue: { gradientFrom: "rgba(234,67,53,0.03)", gradientTo: "rgba(234,67,53,0.015)", color: "#ea4335" },
};

/* ---- Feedback type → Chip variant ---- */
const FB_CHIP: Record<string, ChipVariant> = {
  question: "info",
  directive: "warning",
  issue: "danger",
};

/* ---- FeedbackItem sub-component (Protocol-style card) ---- */
function FeedbackItem({
  fb,
  onDelete,
  readOnly,
}: {
  fb: Feedback;
  onDelete: (id: string) => void;
  readOnly?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const glowRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const style = FB[fb.type] || FB.question;
  const fc = FB_CARD[fb.type] || FB_CARD.question;
  const isAnswered = fb.type === "question" && fb.answer;
  const isAcknowledged = fb.type !== "question" && fb.read;

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const mask = `radial-gradient(180px at ${x}px ${y}px, white, transparent)`;
    if (glowRef.current) glowRef.current.style.maskImage = mask;
    if (overlayRef.current) overlayRef.current.style.maskImage = mask;
  }, []);

  const fbIcon =
    fb.type === "question" ? (
      <ChatCircleDots size={11} weight="bold" />
    ) : fb.type === "directive" ? (
      <Lightning size={11} weight="bold" />
    ) : (
      <Warning size={11} weight="bold" />
    );

  return (
    <div
      className="group relative flex rounded-2xl mb-2.5"
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── Effects layer ── */}
      <div className="pointer-events-none">
        <div
          ref={glowRef}
          className="absolute inset-0 rounded-2xl opacity-0 transition duration-300 group-hover:opacity-100"
          style={{
            background: `linear-gradient(to right, ${fc.gradientFrom}, ${fc.gradientTo})`,
            maskImage: "radial-gradient(180px at 0px 0px, white, transparent)",
          }}
        />
      </div>

      {/* Ring border — type-colored on hover */}
      <div
        className="absolute inset-0 rounded-2xl transition duration-300 pointer-events-none"
        style={{ boxShadow: `inset 0 0 0 1px ${hovered ? fc.color + "22" : "rgba(255,255,255,0.1)"}` }}
      />

      {/* ── Content ── */}
      <div className="relative rounded-2xl px-3.5 py-3 w-full">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1.5">
          {/* Type chip */}
          <Chip variant={FB_CHIP[fb.type] || "default"} size="xs" icon={fbIcon}>
            {style.label}
          </Chip>

          {/* Status */}
          <span
            className={`text-[9px] font-medium inline-flex items-center gap-1 ${isAnswered || isAcknowledged ? "text-fp-success" : "text-fp-dim"}`}
          >
            <span
              className={`w-1 h-1 rounded-full inline-block ${isAnswered || isAcknowledged ? "bg-fp-success" : "bg-fp-dim/40"}`}
            />
            {fb.type === "question" ? (isAnswered ? "Answered" : "Pending") : isAcknowledged ? "Ack" : "Pending"}
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

        {/* Text */}
        <p className="text-[12px] text-zinc-400 leading-relaxed">{fb.text}</p>

        {/* Answer section */}
        {isAnswered && (
          <div className="mt-2 pt-2 border-t border-white/[0.06]">
            <div className="text-[9px] font-semibold mb-1 uppercase tracking-wider text-fp-success inline-flex items-center gap-1">
              <CheckCircle size={9} weight="bold" />
              Answer
            </div>
            <p className="text-[11px] text-fp-dim leading-relaxed">{fb.answer}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Main DetailDrawer ---- */
function DetailDrawer({
  card,
  feedbacks,
  planTitle,
  planId,
  allCards,
  readOnly,
  onClose,
  onAddFeedback,
  onDeleteFeedback,
  onFileClick,
  onSelectCard,
  onEditCard,
}: DetailDrawerProps) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(card.title);
  const [editDesc, setEditDesc] = useState(card.description);
  const [editType, setEditType] = useState(card.type);
  const [editRepo, setEditRepo] = useState(card.repo);
  const [editFiles, setEditFiles] = useState(card.files.join("\n"));
  const [editDeps, setEditDeps] = useState<string[]>(card.dependencies);

  const [descPreview, setDescPreview] = useState(false);
  const [fbTab, setFbTab] = useState<"question" | "directive" | "issue">("question");
  const [fbText, setFbText] = useState("");

  const tc = TC[card.type] || { l: card.type, c: "#10b981", bg: "rgba(16,185,129,0.10)" };
  const editTc = TC[editType] || { l: editType, c: "#10b981", bg: "rgba(16,185,129,0.10)" };

  /* Deps mapped to card titles */
  const depCards = useMemo(() => {
    const byId = new Map(allCards.map((c) => [c.id, c]));
    return (editing ? editDeps : card.dependencies).map((id) => byId.get(id)).filter(Boolean) as Card[];
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
    const files = editFiles
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);
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
  const moveDep = useCallback(
    (idx: number, dir: -1 | 1) => {
      const next = [...editDeps];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return;
      [next[idx], next[target]] = [next[target], next[idx]];
      setEditDeps(next);
    },
    [editDeps],
  );

  /* Remove dependency */
  const removeDep = useCallback((idx: number) => {
    setEditDeps((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  /* Add feedback */
  const handleAddFeedback = useCallback(() => {
    if (!fbText.trim()) return;
    onAddFeedback(card.id, fbTab, fbText.trim());
    setFbText("");
  }, [onAddFeedback, card.id, fbTab, fbText]);

  const activeType = editing ? editType : card.type;

  return (
    <div className="h-full w-full flex flex-col bg-transparent overflow-hidden relative">
      {/* Type gradient tint */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-500 ease-out blur-2xl"
        style={{ background: TYPE_GRADIENT[activeType] || TYPE_GRADIENT.edit }}
      />
      {/* ---- Header ---- */}
      <div className="p-3 flex items-center gap-2 border-b border-fp-border shrink-0">
        <Chip variant={TYPE_CHIP[card.type] || "default"} size="sm" icon={typeIcon(card.type)}>
          {tc.l}
        </Chip>

        <div className="min-w-0 flex-1">
          {planTitle && (
            <div className="text-[9px] uppercase tracking-[0.14em] text-white/28 font-medium mb-0.5 truncate">
              {planTitle}
            </div>
          )}
          <div className="text-[13px] font-semibold text-fp-text truncate">{card.title}</div>
        </div>

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
        <IconButton variant="ghost" size="sm" icon={<X size={12} weight="bold" />} label="Close" onClick={onClose} />
      </div>

      {/* ---- Scrollable content ---- */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {editing ? (
          /* ======== EDIT MODE — modal-style form ======== */
          <div className="p-4 flex flex-col gap-4">
            {/* Title */}
            <div>
              <label className="fp-label">Title</label>
              <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="fp-input" />
            </div>

            {/* Type — Chip selector */}
            <div>
              <label className="fp-label">Type</label>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(TC).map(([k, v]) => (
                  <Chip
                    key={k}
                    variant={TYPE_CHIP[k] || "default"}
                    size="sm"
                    icon={typeIcon(k)}
                    onClick={() => setEditType(k as Card["type"])}
                    className={`!normal-case ${editType !== k ? "opacity-40" : ""}`}
                  >
                    {v.l}
                  </Chip>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="fp-label !mb-0">Description</label>
                <SegmentedControl
                  value={descPreview ? "preview" : "edit"}
                  onChange={(value) => setDescPreview(value === "preview")}
                  options={[
                    { id: "edit", label: "Edit" },
                    { id: "preview", label: "Preview" },
                  ]}
                />
              </div>
              {descPreview ? (
                <div className="fp-input min-h-[100px] overflow-y-auto">
                  {editDesc.trim() ? (
                    <Md text={editDesc} fontSize={13} color="rgba(255,255,255,0.55)" lineHeight={1.7} />
                  ) : (
                    <span className="text-fp-dim text-xs italic">Nothing to preview</span>
                  )}
                </div>
              ) : (
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={6}
                  placeholder="Description (markdown supported)"
                  className="fp-input resize-y text-xs leading-relaxed"
                />
              )}
            </div>

            {/* Repository */}
            <div>
              <label className="fp-label">Repository</label>
              <input
                value={editRepo}
                onChange={(e) => setEditRepo(e.target.value)}
                placeholder="/path/to/repo"
                className="fp-input font-mono text-xs"
              />
            </div>

            {/* Files */}
            <div>
              <label className="fp-label">
                Files <span className="normal-case font-normal opacity-60">(one per line)</span>
              </label>
              <textarea
                value={editFiles}
                onChange={(e) => setEditFiles(e.target.value)}
                rows={4}
                placeholder="src/main.ts&#10;src/utils.ts"
                className="fp-input resize-y font-mono text-xs leading-relaxed"
              />
            </div>
          </div>
        ) : (
          /* ======== VIEW MODE ======== */
          <>
            {/* Description */}
            <div className="p-3 border-b border-fp-border">
              <div className="text-[10px] font-mono uppercase tracking-wider text-fp-dim mb-1.5">Description</div>
              <div className="text-[13px]">
                <Md
                  text={card.description || "*No description*"}
                  fontSize={13}
                  color="rgba(255,255,255,0.55)"
                  lineHeight={1.7}
                />
              </div>
            </div>

            {/* Repository */}
            <div className="p-3 border-b border-fp-border">
              <div className="text-[10px] font-mono uppercase tracking-wider text-fp-dim mb-1.5">Repository</div>
              {card.repo ? (
                <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <Folders size={14} className="text-white/30 shrink-0" />
                  <span className="text-[13px] font-mono text-white/60 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                    {card.repo}
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText(card.repo)}
                    className="shrink-0 text-white/20 hover:text-white/50 transition-colors bg-transparent border-none cursor-pointer p-0"
                  >
                    <Copy size={13} />
                  </button>
                </div>
              ) : (
                <div className="text-xs text-fp-dim italic">No repository specified</div>
              )}
            </div>

            {/* Files */}
            <div className="p-3 border-b border-fp-border">
              <div className="text-[10px] font-mono uppercase tracking-wider text-fp-dim mb-1.5">
                Files
                {card.files.length > 0 && <span className="ml-1.5 text-fp-dim/50">({card.files.length})</span>}
              </div>
              {card.files.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {card.files.map((f) => {
                    const change = card.fileChanges?.[f];
                    const fileName = f.split("/").pop() || f;
                    const chipVariant = change
                      ? (CHANGE_CHIP[change.changeType] || CHANGE_CHIP.edit).variant
                      : ("default" as ChipVariant);
                    return (
                      <Chip
                        key={f}
                        variant={chipVariant}
                        size="sm"
                        icon={<File size={12} />}
                        onClick={change ? () => onFileClick(f, change) : undefined}
                        className="!lowercase !tracking-normal font-mono max-w-[200px]"
                      >
                        {fileName}
                      </Chip>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-fp-dim italic">No files</div>
              )}
            </div>

            {/* Feedback Section */}
            <div className="p-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-fp-dim mb-2">
                Feedback
                {feedbacks.length > 0 && <span className="ml-1.5 text-fp-dim/50">({feedbacks.length})</span>}
              </div>

              {feedbacks.length > 0 && (
                <div className="mb-3">
                  {feedbacks.map((fb) => (
                    <FeedbackItem key={fb.id} fb={fb} onDelete={onDeleteFeedback} readOnly={readOnly} />
                  ))}
                </div>
              )}

              {!readOnly && (
                <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
                  {/* Tab selector */}
                  <div className="flex gap-1 p-1.5">
                    {(["question", "directive", "issue"] as const).map((type) => {
                      const active = fbTab === type;
                      const icon =
                        type === "question" ? (
                          <ChatCircleDots size={13} />
                        ) : type === "directive" ? (
                          <Lightning size={13} />
                        ) : (
                          <Warning size={13} />
                        );
                      return (
                        <button
                          key={type}
                          onClick={() => setFbTab(type)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[12px] font-medium border-none cursor-pointer transition-all duration-150
                            ${
                              active
                                ? "bg-white/[0.06] text-white/80"
                                : "bg-transparent text-white/30 hover:text-white/50 hover:bg-white/[0.03]"
                            }`}
                        >
                          {icon}
                          <span className="mt-px">{FB[type].label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Input area */}
                  <div className="px-3 pb-3">
                    <textarea
                      value={fbText}
                      onChange={(e) => setFbText(e.target.value)}
                      placeholder={`Add a ${fbTab}...`}
                      rows={2}
                      className="w-full bg-transparent border-none outline-none resize-none text-[13px] text-white/70 leading-relaxed placeholder:text-white/20"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault();
                          handleAddFeedback();
                        }
                      }}
                    />
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-white/20">Ctrl+Enter to send</span>
                      <button
                        onClick={handleAddFeedback}
                        disabled={!fbText.trim()}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border-none cursor-pointer transition-all duration-150
                          ${
                            fbText.trim()
                              ? "bg-white/10 text-white/80 hover:bg-white/15"
                              : "bg-transparent text-white/15 cursor-not-allowed"
                          }`}
                      >
                        <PaperPlaneTilt size={12} />
                        <span className="mt-px">Send</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ---- Edit mode: sticky footer ---- */}
      {editing && (
        <div className="px-4 py-3 shrink-0 border-t border-fp-border flex flex-col gap-2">
          <Button
            variant="glassy"
            size="md"
            icon={<CheckCircle size={12} weight="bold" />}
            onClick={saveEdit}
            className="w-full"
          >
            Save changes
          </Button>
          <Button variant="ghost" size="md" onClick={cancelEdit} className="w-full">
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

export default React.memo(DetailDrawer);
