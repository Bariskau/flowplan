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

/* ---- Change dot ---- */
function ChangeDot({ changeType }: { changeType?: string }) {
  const color = changeType === "create" ? T.green : changeType === "delete" ? T.red : T.orange;
  return (
    <span style={{
      display: "inline-block", width: 6, height: 6, borderRadius: "50%",
      background: color, marginRight: 4, flexShrink: 0,
    }} />
  );
}

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
  const isAnswered = fb.type === "question" && fb.answer;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: 7,
        padding: "8px 10px",
        marginBottom: 6,
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{
          fontSize: 8, fontWeight: 700, color: style.color,
          background: `${style.color}18`, padding: "2px 6px",
          borderRadius: 3, textTransform: "uppercase", letterSpacing: "0.04em",
        }}>
          {style.label}
        </span>
        {fb.type === "question" && (
          <span style={{
            fontSize: 8, fontWeight: 600,
            color: isAnswered ? T.green : T.orange,
            background: isAnswered ? T.gD : T.oD,
            padding: "2px 6px", borderRadius: 3,
          }}>
            {isAnswered ? "Answered" : "Pending"}
          </span>
        )}
        {fb.type !== "question" && (
          <span style={{
            fontSize: 8, fontWeight: 600,
            color: fb.read ? T.green : T.orange,
            background: fb.read ? T.gD : T.oD,
            padding: "2px 6px", borderRadius: 3,
          }}>
            {fb.read ? "Acknowledged" : "Pending"}
          </span>
        )}
        <span style={{ flex: 1 }} />
        {hovered && !readOnly && (
          <button
            onClick={() => onDelete(fb.id)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: 2, borderRadius: 3, display: "flex", alignItems: "center",
            }}
          >
            {Ico.trash(T.red, 11)}
          </button>
        )}
      </div>
      <div style={{ fontSize: 11.5, color: T.text, lineHeight: 1.55 }}>{fb.text}</div>
      {isAnswered && (
        <div style={{
          marginTop: 6, paddingTop: 6,
          borderTop: `1px solid ${style.border}`,
        }}>
          <div style={{ fontSize: 8, fontWeight: 600, color: T.green, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.04em" }}>Answer</div>
          <div style={{ fontSize: 11, color: T.sec, lineHeight: 1.55 }}>{fb.answer}</div>
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
    background: "none", border: "none", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 0, borderRadius: 5,
  };

  const sectionLabel: React.CSSProperties = {
    fontSize: 9, fontWeight: 700, color: T.ter,
    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.04)",
    border: `1px solid ${T.border}`, borderRadius: 6,
    padding: "6px 8px", color: T.text, fontSize: 12,
    fontFamily: T.f, outline: "none",
  };

  return (
    <div style={{
      width: 380, flexShrink: 0, background: "rgba(20,20,20,0.85)",
      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      borderLeft: `0.5px solid ${T.borderGlass}`,
      display: "flex", flexDirection: "column", fontFamily: T.f,
      height: "100%", overflow: "hidden",
    }}>
      {/* ---- Header ---- */}
      <div style={{
        padding: "12px 14px 10px", display: "flex", alignItems: "center", gap: 8,
        borderBottom: `0.5px solid ${T.border}`, flexShrink: 0,
      }}>
        {/* Type badge */}
        <span style={{
          fontSize: 9, fontWeight: 600, color: tc.c, background: tc.bg,
          padding: "3px 8px", borderRadius: 4, textTransform: "uppercase",
          letterSpacing: "0.04em", lineHeight: 1, display: "inline-flex",
          alignItems: "center", gap: 4,
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
              ...btnBase, width: 26, height: 26,
              border: `0.5px solid ${T.border}`,
            }}
            onMouseEnter={(e: any) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
            onMouseLeave={(e: any) => { e.currentTarget.style.background = "none"; }}
          >
            {Ico.pencil(T.sec, 12)}
          </button>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          title="Close"
          style={{
            ...btnBase, width: 26, height: 26,
            border: `0.5px solid ${T.border}`,
          }}
          onMouseEnter={(e: any) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
          onMouseLeave={(e: any) => { e.currentTarget.style.background = "none"; }}
        >
          {Ico.close(T.sec, 12)}
        </button>
      </div>

      {/* ---- Scrollable content ---- */}
      <div style={{ flex: 1, overflow: "auto", padding: "14px 14px 20px" }}>
        {/* ---- Title ---- */}
        {editing ? (
          <input
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            style={{
              ...inputStyle, fontSize: 15, fontWeight: 700,
              marginBottom: 10, padding: "8px 10px",
            }}
          />
        ) : (
          <div style={{
            fontSize: 15, fontWeight: 700, color: T.text,
            lineHeight: 1.4, marginBottom: 10,
          }}>
            {card.title}
          </div>
        )}

        {/* ---- Type select (edit mode) ---- */}
        {editing && (
          <div style={{ marginBottom: 10 }}>
            <div style={sectionLabel}>Type</div>
            <select
              value={editType}
              onChange={e => setEditType(e.target.value as Card["type"])}
              style={{
                ...inputStyle, cursor: "pointer",
                color: editTc.c, fontWeight: 600,
              }}
            >
              {Object.entries(TC).map(([k, v]) => (
                <option key={k} value={k}>{v.l}</option>
              ))}
            </select>
          </div>
        )}

        {/* ---- Description ---- */}
        <div style={{ marginBottom: 14 }}>
          <div style={sectionLabel}>Description</div>
          {editing ? (
            <textarea
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              rows={8}
              style={{
                ...inputStyle, resize: "vertical",
                fontFamily: T.m, fontSize: 11, lineHeight: 1.6,
              }}
            />
          ) : (
            <div style={{ fontSize: 12.5 }}>
              <Md text={card.description || "*No description*"} fontSize={12} color="#b0b0b0" />
            </div>
          )}
        </div>

        {/* ---- Repository ---- */}
        <div style={{ marginBottom: 14 }}>
          <div style={sectionLabel}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              {Ico.folder(T.ter, 10)} Repository
            </span>
          </div>
          {editing ? (
            <input
              value={editRepo}
              onChange={e => setEditRepo(e.target.value)}
              placeholder="e.g. org/repo"
              style={{ ...inputStyle, fontFamily: T.m, fontSize: 11 }}
            />
          ) : card.repo ? (
            <div style={{
              fontSize: 11, fontFamily: T.m, color: T.sec,
              background: "rgba(255,255,255,0.03)", padding: "6px 8px",
              borderRadius: 5, border: `1px solid ${T.borderGlass}`,
            }}>
              {card.repo}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: T.ter, fontStyle: "italic" }}>No repository</div>
          )}
        </div>

        {/* ---- Files ---- */}
        <div style={{ marginBottom: 14 }}>
          <div style={sectionLabel}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              Files {!editing && card.files.length > 0 && (
                <span style={{ color: T.sec, fontWeight: 500 }}>({card.files.length})</span>
              )}
            </span>
          </div>
          {editing ? (
            <textarea
              value={editFiles}
              onChange={e => setEditFiles(e.target.value)}
              rows={5}
              placeholder="One file path per line"
              style={{ ...inputStyle, fontFamily: T.m, fontSize: 10.5, lineHeight: 1.6, resize: "vertical" }}
            />
          ) : card.files.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {card.files.map(f => {
                const change = card.fileChanges?.[f];
                const fileName = f.split("/").pop() || f;
                return (
                  <button
                    key={f}
                    onClick={() => { if (change) onFileClick(f, change); }}
                    title={f}
                    style={{
                      display: "flex", alignItems: "center", gap: 4,
                      background: "rgba(255,255,255,0.03)", border: `1px solid ${T.borderGlass}`,
                      borderRadius: 5, padding: "5px 8px", cursor: change ? "pointer" : "default",
                      fontFamily: T.m, fontSize: 10.5, color: T.sec, textAlign: "left",
                      width: "100%", transition: "background 0.1s",
                    }}
                    onMouseEnter={(e: any) => { if (change) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                    onMouseLeave={(e: any) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                  >
                    <ChangeDot changeType={change?.changeType} />
                    <span style={{
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
                    }}>
                      {fileName}
                    </span>
                    <span style={{ fontSize: 9, color: T.ter, flexShrink: 0, marginLeft: 4 }}>
                      {f.includes("/") ? f.substring(0, f.lastIndexOf("/")) : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: T.ter, fontStyle: "italic" }}>No files</div>
          )}
        </div>

        {/* ---- Dependencies ---- */}
        <div style={{ marginBottom: 14 }}>
          <div style={sectionLabel}>
            Dependencies {!editing && card.dependencies.length > 0 && (
              <span style={{ color: T.sec, fontWeight: 500 }}>({card.dependencies.length})</span>
            )}
          </div>
          {depCards.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {depCards.map((dep, idx) => {
                const dtc = TC[dep.type] || { l: dep.type, c: T.accent, bg: T.aD };
                return (
                  <div
                    key={dep.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      background: "rgba(255,255,255,0.03)",
                      border: `1px solid ${T.borderGlass}`,
                      borderRadius: 5, padding: "5px 8px",
                    }}
                  >
                    <span style={{
                      fontSize: 8, fontWeight: 600, color: dtc.c, background: dtc.bg,
                      padding: "2px 5px", borderRadius: 3, textTransform: "uppercase",
                      letterSpacing: "0.04em", lineHeight: 1, flexShrink: 0,
                    }}>
                      {dtc.l}
                    </span>
                    <span style={{
                      fontSize: 11, color: T.text, flex: 1,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {dep.title}
                    </span>
                    {editing ? (
                      <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                        <button
                          onClick={() => moveDep(idx, -1)}
                          title="Move up"
                          style={{
                            ...btnBase, width: 20, height: 20,
                            opacity: idx === 0 ? 0.3 : 1,
                          }}
                          disabled={idx === 0}
                        >
                          {Ico.arrowUp(T.sec, 10)}
                        </button>
                        <button
                          onClick={() => moveDep(idx, 1)}
                          title="Move down"
                          style={{
                            ...btnBase, width: 20, height: 20,
                            opacity: idx === depCards.length - 1 ? 0.3 : 1,
                          }}
                          disabled={idx === depCards.length - 1}
                        >
                          {Ico.arrowDown(T.sec, 10)}
                        </button>
                        <button
                          onClick={() => removeDep(idx)}
                          title="Remove dependency"
                          style={{ ...btnBase, width: 20, height: 20 }}
                        >
                          {Ico.close(T.red, 10)}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => onSelectCard(dep.id)}
                        title="Go to card"
                        style={{ ...btnBase, width: 20, height: 20, flexShrink: 0 }}
                        onMouseEnter={(e: any) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                        onMouseLeave={(e: any) => { e.currentTarget.style.background = "none"; }}
                      >
                        {Ico.goto(T.accent, 10)}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: T.ter, fontStyle: "italic" }}>No dependencies</div>
          )}
        </div>

        {/* ---- Save / Cancel buttons (edit mode) ---- */}
        {editing && (
          <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
            <button
              onClick={saveEdit}
              style={{
                flex: 1, padding: "7px 0", borderRadius: 6,
                background: T.accent, border: "none", cursor: "pointer",
                color: "#fff", fontSize: 11, fontWeight: 600,
                fontFamily: T.f, display: "flex", alignItems: "center",
                justifyContent: "center", gap: 5, transition: "opacity 0.15s",
              }}
              onMouseEnter={(e: any) => { e.currentTarget.style.opacity = "0.85"; }}
              onMouseLeave={(e: any) => { e.currentTarget.style.opacity = "1"; }}
            >
              {Ico.check("#fff", 11)} Save
            </button>
            <button
              onClick={cancelEdit}
              style={{
                flex: 1, padding: "7px 0", borderRadius: 6,
                background: "none", border: `1px solid ${T.border}`,
                cursor: "pointer", color: T.sec, fontSize: 11,
                fontWeight: 600, fontFamily: T.f, transition: "all 0.15s",
              }}
              onMouseEnter={(e: any) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
              onMouseLeave={(e: any) => { e.currentTarget.style.background = "none"; }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* ---- Divider ---- */}
        <div style={{ height: 1, background: T.border, margin: "4px 0 14px" }} />

        {/* ---- Feedback Section ---- */}
        <div style={sectionLabel}>
          Feedback {feedbacks.length > 0 && (
            <span style={{ color: T.sec, fontWeight: 500 }}>({feedbacks.length})</span>
          )}
        </div>

        {/* Feedback list */}
        {feedbacks.length > 0 ? (
          <div style={{ marginBottom: 12 }}>
            {feedbacks.map(fb => (
              <FeedbackItem key={fb.id} fb={fb} onDelete={onDeleteFeedback} readOnly={readOnly} />
            ))}
          </div>
        ) : (
          <div style={{
            fontSize: 11, color: T.ter, fontStyle: "italic", marginBottom: 12,
          }}>
            No feedback yet
          </div>
        )}

        {/* Add feedback form */}
        {!readOnly && (
          <div style={{
            background: "rgba(255,255,255,0.02)",
            border: `1px solid ${T.borderGlass}`,
            borderRadius: 8, padding: 10,
          }}>
            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
              {(["question", "directive", "issue"] as const).map(type => {
                const active = fbTab === type;
                const s = FB[type];
                const icon = type === "question" ? Ico.question : type === "directive" ? Ico.bolt : Ico.alert;
                return (
                  <button
                    key={type}
                    onClick={() => setFbTab(type)}
                    style={{
                      ...btnBase, gap: 4, padding: "4px 8px",
                      fontSize: 9, fontWeight: 600,
                      color: active ? s.color : T.ter,
                      background: active ? s.bg : "none",
                      border: `1px solid ${active ? s.border : "transparent"}`,
                      borderRadius: 5, textTransform: "uppercase",
                      letterSpacing: "0.04em", transition: "all 0.12s",
                    }}
                    onMouseEnter={(e: any) => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; } }}
                    onMouseLeave={(e: any) => { if (!active) { e.currentTarget.style.background = "none"; } }}
                  >
                    {icon(active ? s.color : T.ter, 10)}
                    {s.label}
                  </button>
                );
              })}
            </div>

            {/* Textarea */}
            <textarea
              value={fbText}
              onChange={e => setFbText(e.target.value)}
              placeholder={`Add a ${fbTab}...`}
              rows={3}
              style={{
                ...inputStyle, fontSize: 11, lineHeight: 1.55,
                resize: "vertical", marginBottom: 6,
              }}
              onKeyDown={e => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleAddFeedback();
                }
              }}
            />

            {/* Send button */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={handleAddFeedback}
                disabled={!fbText.trim()}
                style={{
                  ...btnBase, gap: 5, padding: "5px 12px",
                  fontSize: 10, fontWeight: 600,
                  color: fbText.trim() ? "#fff" : T.ter,
                  background: fbText.trim() ? FB[fbTab].color : "rgba(255,255,255,0.04)",
                  borderRadius: 5, transition: "all 0.15s",
                  cursor: fbText.trim() ? "pointer" : "default",
                  opacity: fbText.trim() ? 1 : 0.5,
                }}
                onMouseEnter={(e: any) => { if (fbText.trim()) e.currentTarget.style.opacity = "0.85"; }}
                onMouseLeave={(e: any) => { e.currentTarget.style.opacity = fbText.trim() ? "1" : "0.5"; }}
              >
                {Ico.send(fbText.trim() ? "#fff" : T.ter, 10)}
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(DetailDrawer);
