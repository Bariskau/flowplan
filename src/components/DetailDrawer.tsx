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
    <div style={{
      fontSize: 13,
      fontWeight: 600,
      color: T.text,
      letterSpacing: "-0.01em",
      paddingBottom: 8,
      marginBottom: 0,
      marginTop: 4,
    }}>
      {children}
    </div>
  );
}

/* ---- Protocol-style separator ---- */
function Separator() {
  return (
    <div style={{
      height: 1,
      background: "rgba(255,255,255,0.06)",
      margin: "16px 0",
    }} />
  );
}

/* ---- Protocol-style property row separator (lighter, for within a list) ---- */
function RowSeparator() {
  return (
    <div style={{
      height: 1,
      background: "rgba(255,255,255,0.04)",
      margin: 0,
    }} />
  );
}

/* ---- Protocol-style monospace chip (like `id`, `username` in Protocol) ---- */
function MonoChip({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{
      fontFamily: T.m,
      fontSize: 11,
      fontWeight: 500,
      color: color || T.text,
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 5,
      padding: "2px 7px",
      lineHeight: 1,
      display: "inline-flex",
      alignItems: "center",
    }}>
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
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 8,
        padding: 0,
        marginBottom: 8,
        position: "relative",
        overflow: "hidden",
        transition: "border-color 0.15s, background 0.15s",
        borderColor: hovered ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.06)",
      }}
    >
      {/* Left accent bar */}
      <div style={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        background: accentColor,
        borderRadius: "8px 0 0 8px",
        opacity: 0.7,
      }} />

      <div style={{ padding: "10px 12px 10px 16px" }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            color: accentColor,
            background: `${accentColor}14`,
            padding: "3px 8px",
            borderRadius: 4,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            lineHeight: 1,
          }}>
            {style.label}
          </span>

          {fb.type === "question" ? (
            <span style={{
              fontSize: 10,
              fontWeight: 500,
              color: isAnswered ? T.green : "rgba(255,255,255,0.4)",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}>
              <span style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: isAnswered ? T.green : "rgba(255,255,255,0.25)",
                display: "inline-block",
              }} />
              {isAnswered ? "Answered" : "Pending"}
            </span>
          ) : (
            <span style={{
              fontSize: 10,
              fontWeight: 500,
              color: fb.read ? T.green : "rgba(255,255,255,0.4)",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}>
              <span style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: fb.read ? T.green : "rgba(255,255,255,0.25)",
                display: "inline-block",
              }} />
              {fb.read ? "Acknowledged" : "Pending"}
            </span>
          )}

          <span style={{ flex: 1 }} />
          {hovered && !readOnly && (
            <button
              onClick={() => onDelete(fb.id)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 3,
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                opacity: 0.6,
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e: any) => { e.currentTarget.style.opacity = "1"; }}
              onMouseLeave={(e: any) => { e.currentTarget.style.opacity = "0.6"; }}
            >
              {Ico.trash(T.red, 12)}
            </button>
          )}
        </div>

        {/* Content */}
        <div style={{
          fontSize: 12.5,
          color: "rgba(255,255,255,0.7)",
          lineHeight: 1.6,
          letterSpacing: "-0.005em",
        }}>
          {fb.text}
        </div>

        {/* Answer (Protocol response-style) */}
        {isAnswered && (
          <div style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{
              fontSize: 10,
              fontWeight: 600,
              color: T.green,
              marginBottom: 5,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}>
              Answer
            </div>
            <div style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.55)",
              lineHeight: 1.6,
            }}>
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

  /* Shared button style helper */
  const btnBase: React.CSSProperties = {
    background: "none",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    borderRadius: 6,
  };

  /* Protocol-style input */
  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8,
    padding: "8px 12px",
    color: T.text,
    fontSize: 13,
    fontFamily: T.f,
    outline: "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
    boxSizing: "border-box" as const,
  };

  return (
    <div style={{
      width: 400,
      flexShrink: 0,
      background: "rgba(24,24,27,0.85)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      borderLeft: "1px solid rgba(255,255,255,0.06)",
      display: "flex",
      flexDirection: "column",
      fontFamily: T.f,
      height: "100%",
      overflow: "hidden",
    }}>
      {/* ---- Header ---- */}
      <div style={{
        padding: "16px 20px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0,
      }}>
        {/* Type pill - Protocol style colored badge */}
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          color: tc.c,
          background: tc.bg,
          padding: "4px 10px",
          borderRadius: 9999,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          lineHeight: 1,
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          border: `1px solid ${tc.c}20`,
        }}>
          {typeIcon(card.type, tc.c)}
          {tc.l}
        </span>

        <span style={{ flex: 1 }} />

        {/* Edit button */}
        {!readOnly && onEditCard && !editing && (
          <button
            onClick={startEdit}
            title="Edit card"
            style={{
              ...btnBase,
              width: 30,
              height: 30,
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              transition: "background 0.15s, border-color 0.15s",
            }}
            onMouseEnter={(e: any) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
            }}
            onMouseLeave={(e: any) => {
              e.currentTarget.style.background = "none";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
            }}
          >
            {Ico.pencil(T.sec, 13)}
          </button>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          title="Close"
          style={{
            ...btnBase,
            width: 30,
            height: 30,
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8,
            transition: "background 0.15s, border-color 0.15s",
          }}
          onMouseEnter={(e: any) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
          }}
          onMouseLeave={(e: any) => {
            e.currentTarget.style.background = "none";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
          }}
        >
          {Ico.close(T.sec, 13)}
        </button>
      </div>

      {/* ---- Scrollable content ---- */}
      <div style={{
        flex: 1,
        overflow: "auto",
        padding: "20px 20px 28px",
      }}>
        {/* ---- Title ---- */}
        {editing ? (
          <input
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            style={{
              ...inputStyle,
              fontSize: 18,
              fontWeight: 700,
              marginBottom: 16,
              padding: "10px 14px",
              letterSpacing: "-0.02em",
            }}
          />
        ) : (
          <div style={{
            fontSize: 18,
            fontWeight: 700,
            color: T.text,
            lineHeight: 1.35,
            marginBottom: 16,
            letterSpacing: "-0.02em",
          }}>
            {card.title}
          </div>
        )}

        {/* ---- Type select (edit mode) ---- */}
        {editing && (
          <div style={{ marginBottom: 16 }}>
            <SectionHeader>Type</SectionHeader>
            <select
              value={editType}
              onChange={e => setEditType(e.target.value as Card["type"])}
              style={{
                ...inputStyle,
                cursor: "pointer",
                color: editTc.c,
                fontWeight: 600,
                appearance: "none" as const,
              }}
            >
              {Object.entries(TC).map(([k, v]) => (
                <option key={k} value={k}>{v.l}</option>
              ))}
            </select>
          </div>
        )}

        {/* ---- Description ---- */}
        <div style={{ marginBottom: 0 }}>
          <SectionHeader>Description</SectionHeader>
          {editing ? (
            <textarea
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              rows={8}
              style={{
                ...inputStyle,
                resize: "vertical",
                fontFamily: T.m,
                fontSize: 12,
                lineHeight: 1.7,
              }}
            />
          ) : (
            <div style={{ fontSize: 13 }}>
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
        <div style={{ marginBottom: 0 }}>
          <SectionHeader>Repository</SectionHeader>
          {editing ? (
            <input
              value={editRepo}
              onChange={e => setEditRepo(e.target.value)}
              placeholder="e.g. org/repo"
              style={{ ...inputStyle, fontFamily: T.m, fontSize: 12 }}
            />
          ) : card.repo ? (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              paddingTop: 4,
            }}>
              <span style={{ opacity: 0.45, display: "flex", alignItems: "center" }}>
                {Ico.folder("rgba(255,255,255,0.6)", 14)}
              </span>
              <MonoChip>{card.repo}</MonoChip>
            </div>
          ) : (
            <div style={{
              fontSize: 12.5,
              color: "rgba(255,255,255,0.3)",
              fontStyle: "italic",
              paddingTop: 4,
            }}>
              No repository specified
            </div>
          )}
        </div>

        <Separator />

        {/* ---- Files (Protocol properties-list style) ---- */}
        <div style={{ marginBottom: 0 }}>
          <SectionHeader>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              Files
              {!editing && card.files.length > 0 && (
                <span style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.35)",
                }}>
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
              style={{
                ...inputStyle,
                fontFamily: T.m,
                fontSize: 11.5,
                lineHeight: 1.7,
                resize: "vertical",
              }}
            />
          ) : card.files.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
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
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        background: "none",
                        border: "none",
                        borderRadius: 0,
                        padding: "10px 4px",
                        cursor: change ? "pointer" : "default",
                        textAlign: "left",
                        width: "100%",
                        transition: "background 0.12s",
                        margin: 0,
                      }}
                      onMouseEnter={(e: any) => {
                        if (change) e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                      }}
                      onMouseLeave={(e: any) => {
                        e.currentTarget.style.background = "none";
                      }}
                    >
                      {/* File icon */}
                      <span style={{ opacity: 0.35, display: "flex", alignItems: "center", flexShrink: 0 }}>
                        {Ico.file("rgba(255,255,255,0.7)", 13)}
                      </span>

                      {/* Filename as monospace chip */}
                      <MonoChip>{fileName}</MonoChip>

                      {/* Directory path */}
                      {dirPath && (
                        <span style={{
                          fontSize: 11,
                          color: "rgba(255,255,255,0.25)",
                          fontFamily: T.m,
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}>
                          {dirPath}
                        </span>
                      )}
                      {!dirPath && <span style={{ flex: 1 }} />}

                      {/* Change type badge (Protocol GET/POST style) */}
                      {badge && (
                        <span style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: badge.color,
                          background: badge.bg,
                          padding: "3px 7px",
                          borderRadius: 4,
                          letterSpacing: "0.04em",
                          lineHeight: 1,
                          flexShrink: 0,
                        }}>
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
            <div style={{
              fontSize: 12.5,
              color: "rgba(255,255,255,0.3)",
              fontStyle: "italic",
              paddingTop: 4,
            }}>
              No files
            </div>
          )}
        </div>

        <Separator />

        {/* ---- Dependencies (Protocol property-row style) ---- */}
        <div style={{ marginBottom: 0 }}>
          <SectionHeader>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              Dependencies
              {!editing && card.dependencies.length > 0 && (
                <span style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.35)",
                }}>
                  ({card.dependencies.length})
                </span>
              )}
            </span>
          </SectionHeader>
          {depCards.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {depCards.map((dep, idx) => {
                const dtc = TC[dep.type] || { l: dep.type, c: T.accent, bg: T.aD };
                return (
                  <React.Fragment key={dep.id}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "10px 4px",
                        transition: "background 0.12s",
                      }}
                      onMouseEnter={(e: any) => {
                        e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                      }}
                      onMouseLeave={(e: any) => {
                        e.currentTarget.style.background = "none";
                      }}
                    >
                      {/* Type chip */}
                      <span style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: dtc.c,
                        background: dtc.bg,
                        padding: "3px 7px",
                        borderRadius: 4,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        lineHeight: 1,
                        flexShrink: 0,
                      }}>
                        {dtc.l}
                      </span>

                      {/* Title */}
                      <span style={{
                        fontSize: 12.5,
                        color: "rgba(255,255,255,0.75)",
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        lineHeight: 1.4,
                      }}>
                        {dep.title}
                      </span>

                      {/* Action buttons */}
                      {editing ? (
                        <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                          <button
                            onClick={() => moveDep(idx, -1)}
                            title="Move up"
                            style={{
                              ...btnBase,
                              width: 24,
                              height: 24,
                              opacity: idx === 0 ? 0.25 : 0.6,
                              transition: "opacity 0.12s",
                            }}
                            disabled={idx === 0}
                            onMouseEnter={(e: any) => { if (idx !== 0) e.currentTarget.style.opacity = "1"; }}
                            onMouseLeave={(e: any) => { e.currentTarget.style.opacity = idx === 0 ? "0.25" : "0.6"; }}
                          >
                            {Ico.arrowUp(T.sec, 11)}
                          </button>
                          <button
                            onClick={() => moveDep(idx, 1)}
                            title="Move down"
                            style={{
                              ...btnBase,
                              width: 24,
                              height: 24,
                              opacity: idx === depCards.length - 1 ? 0.25 : 0.6,
                              transition: "opacity 0.12s",
                            }}
                            disabled={idx === depCards.length - 1}
                            onMouseEnter={(e: any) => { if (idx !== depCards.length - 1) e.currentTarget.style.opacity = "1"; }}
                            onMouseLeave={(e: any) => { e.currentTarget.style.opacity = idx === depCards.length - 1 ? "0.25" : "0.6"; }}
                          >
                            {Ico.arrowDown(T.sec, 11)}
                          </button>
                          <button
                            onClick={() => removeDep(idx)}
                            title="Remove dependency"
                            style={{
                              ...btnBase,
                              width: 24,
                              height: 24,
                              opacity: 0.6,
                              transition: "opacity 0.12s",
                            }}
                            onMouseEnter={(e: any) => { e.currentTarget.style.opacity = "1"; }}
                            onMouseLeave={(e: any) => { e.currentTarget.style.opacity = "0.6"; }}
                          >
                            {Ico.close(T.red, 11)}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => onSelectCard(dep.id)}
                          title="Go to card"
                          style={{
                            ...btnBase,
                            width: 24,
                            height: 24,
                            flexShrink: 0,
                            opacity: 0.4,
                            transition: "opacity 0.12s",
                          }}
                          onMouseEnter={(e: any) => { e.currentTarget.style.opacity = "1"; }}
                          onMouseLeave={(e: any) => { e.currentTarget.style.opacity = "0.4"; }}
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
            <div style={{
              fontSize: 12.5,
              color: "rgba(255,255,255,0.3)",
              fontStyle: "italic",
              paddingTop: 4,
            }}>
              No dependencies
            </div>
          )}
        </div>

        {/* ---- Save / Cancel buttons (edit mode) ---- */}
        {editing && (
          <>
            <Separator />
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={saveEdit}
                style={{
                  flex: 1,
                  padding: "9px 0",
                  borderRadius: 8,
                  background: T.accent,
                  border: "none",
                  cursor: "pointer",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: T.f,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  transition: "opacity 0.15s",
                }}
                onMouseEnter={(e: any) => { e.currentTarget.style.opacity = "0.85"; }}
                onMouseLeave={(e: any) => { e.currentTarget.style.opacity = "1"; }}
              >
                {Ico.check("#fff", 12)} Save changes
              </button>
              <button
                onClick={cancelEdit}
                style={{
                  flex: 1,
                  padding: "9px 0",
                  borderRadius: 8,
                  background: "none",
                  border: "1px solid rgba(255,255,255,0.1)",
                  cursor: "pointer",
                  color: "rgba(255,255,255,0.55)",
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: T.f,
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e: any) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
                }}
                onMouseLeave={(e: any) => {
                  e.currentTarget.style.background = "none";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                }}
              >
                Cancel
              </button>
            </div>
          </>
        )}

        <Separator />

        {/* ---- Feedback Section ---- */}
        <SectionHeader>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            Feedback
            {feedbacks.length > 0 && (
              <span style={{
                fontSize: 11,
                fontWeight: 500,
                color: "rgba(255,255,255,0.35)",
              }}>
                ({feedbacks.length})
              </span>
            )}
          </span>
        </SectionHeader>

        {/* Feedback list */}
        {feedbacks.length > 0 ? (
          <div style={{ marginBottom: 14, marginTop: 4 }}>
            {feedbacks.map(fb => (
              <FeedbackItem key={fb.id} fb={fb} onDelete={onDeleteFeedback} readOnly={readOnly} />
            ))}
          </div>
        ) : (
          <div style={{
            fontSize: 12.5,
            color: "rgba(255,255,255,0.3)",
            fontStyle: "italic",
            marginBottom: 14,
            paddingTop: 4,
          }}>
            No feedback yet
          </div>
        )}

        {/* Add feedback form (Protocol-style card with tabs) */}
        {!readOnly && (
          <div style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 10,
            overflow: "hidden",
          }}>
            {/* Tab bar (Protocol cURL/JS/Python style) */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 0,
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              padding: "0 12px",
            }}>
              {(["question", "directive", "issue"] as const).map(type => {
                const active = fbTab === type;
                const s = FB[type];
                const icon = type === "question" ? Ico.question : type === "directive" ? Ico.bolt : Ico.alert;
                return (
                  <button
                    key={type}
                    onClick={() => setFbTab(type)}
                    style={{
                      ...btnBase,
                      gap: 5,
                      padding: "10px 12px",
                      fontSize: 11,
                      fontWeight: 500,
                      color: active ? s.color : "rgba(255,255,255,0.35)",
                      background: "none",
                      border: "none",
                      borderBottom: active ? `2px solid ${s.color}` : "2px solid transparent",
                      borderRadius: 0,
                      textTransform: "capitalize",
                      letterSpacing: "0.01em",
                      transition: "color 0.15s, border-color 0.15s",
                      marginBottom: -1,
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
            <div style={{ padding: "12px" }}>
              <textarea
                value={fbText}
                onChange={e => setFbText(e.target.value)}
                placeholder={`Add a ${fbTab}...`}
                rows={3}
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 8,
                  padding: "10px 12px",
                  color: T.text,
                  fontSize: 12.5,
                  fontFamily: T.f,
                  lineHeight: 1.6,
                  resize: "vertical",
                  outline: "none",
                  transition: "border-color 0.15s",
                  boxSizing: "border-box" as const,
                }}
                onFocus={(e: any) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                }}
                onBlur={(e: any) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                }}
                onKeyDown={e => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleAddFeedback();
                  }
                }}
              />

              {/* Send button */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button
                  onClick={handleAddFeedback}
                  disabled={!fbText.trim()}
                  style={{
                    ...btnBase,
                    gap: 6,
                    padding: "7px 16px",
                    fontSize: 11,
                    fontWeight: 600,
                    color: fbText.trim() ? "#fff" : "rgba(255,255,255,0.25)",
                    background: fbText.trim() ? FB[fbTab].color : "rgba(255,255,255,0.04)",
                    borderRadius: 7,
                    transition: "all 0.15s",
                    cursor: fbText.trim() ? "pointer" : "default",
                    opacity: fbText.trim() ? 1 : 0.6,
                  }}
                  onMouseEnter={(e: any) => {
                    if (fbText.trim()) e.currentTarget.style.opacity = "0.85";
                  }}
                  onMouseLeave={(e: any) => {
                    e.currentTarget.style.opacity = fbText.trim() ? "1" : "0.6";
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
