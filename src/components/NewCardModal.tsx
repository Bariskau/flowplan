import { useState } from "react";
import { T, TC } from "../lib/theme";
import * as api from "../lib/api";
import type { Card } from "../types";

interface NewCardModalProps {
  planId: string;
  existingCards: Card[];
  onClose: () => void;
  onCreated: (cardId: string) => void;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: T.bg,
  border: `1px solid ${T.border}`,
  borderRadius: 6,
  padding: "8px 10px",
  fontSize: 12,
  color: T.text,
  fontFamily: T.f,
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  color: T.sec,
  fontFamily: T.m,
  marginBottom: 4,
  display: "block",
};

export default function NewCardModal({ planId, existingCards, onClose, onCreated }: NewCardModalProps) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [cardType, setCardType] = useState("edit");
  const [repo, setRepo] = useState("");
  const [filesStr, setFilesStr] = useState("");
  const [deps, setDeps] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const files = filesStr
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean);
      const result = await api.addCard(planId, {
        title: title.trim(),
        description: desc.trim(),
        type: cardType,
        repo: repo.trim(),
        files,
        dependencies: deps,
      });
      onCreated(result.id);
    } catch {
      setSaving(false);
    }
  };

  return (
    <div
      className="cv-backdrop"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: T.f,
      }}
    >
      <div
        className="cv-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 480,
          maxHeight: "80vh",
          overflowY: "auto",
          background: "rgba(30,30,30,0.85)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          padding: 24,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 18 }}>
          New Card
        </div>

        {/* Title + Type row */}
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Card title"
              autoFocus
              style={inputStyle}
            />
          </div>
          <div style={{ flex: "0 0 120px" }}>
            <label style={labelStyle}>Type</label>
            <select
              value={cardType}
              onChange={(e) => setCardType(e.target.value)}
              style={inputStyle}
            >
              {Object.entries(TC).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.l}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Description</label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Description (markdown supported)"
            rows={4}
            style={{
              ...inputStyle,
              resize: "vertical",
              lineHeight: 1.6,
            }}
          />
        </div>

        {/* Repository */}
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Repository</label>
          <input
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="/path/to/repo"
            style={{ ...inputStyle, fontFamily: T.m }}
          />
        </div>

        {/* Files */}
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Files (one per line)</label>
          <textarea
            value={filesStr}
            onChange={(e) => setFilesStr(e.target.value)}
            placeholder={"src/main.ts\nsrc/utils.ts"}
            rows={3}
            style={{
              ...inputStyle,
              fontSize: 11,
              fontFamily: T.m,
              resize: "vertical",
              lineHeight: 1.6,
            }}
          />
        </div>

        {/* Dependencies */}
        {existingCards.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Dependencies (optional)</label>
            <div
              style={{
                maxHeight: 120,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 3,
              }}
            >
              {existingCards.map((s) => {
                const checked = deps.includes(s.id);
                const stc = TC[s.type] || TC.research;
                return (
                  <label
                    key={s.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 8px",
                      borderRadius: 5,
                      background: checked ? T.aD : T.bg,
                      border: `1px solid ${checked ? T.accent : T.border}`,
                      cursor: "pointer",
                      transition: "all 0.12s",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setDeps((d) =>
                          checked ? d.filter((x) => x !== s.id) : [...d, s.id]
                        )
                      }
                      style={{ accentColor: T.accent }}
                    />
                    <span
                      style={{
                        fontSize: 8,
                        fontWeight: 700,
                        color: stc.c,
                        background: stc.bg,
                        padding: "1px 5px",
                        borderRadius: 3,
                        fontFamily: T.m,
                      }}
                    >
                      {stc.l}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: T.text,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.title}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: `1px solid ${T.border}`,
              borderRadius: 6,
              padding: "6px 16px",
              fontSize: 11,
              color: T.sec,
              cursor: "pointer",
              fontFamily: T.f,
            }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!title.trim() || saving}
            style={{
              background: title.trim() ? T.accent : T.border,
              border: "none",
              borderRadius: 6,
              padding: "6px 16px",
              fontSize: 11,
              fontWeight: 600,
              color: title.trim() ? "#fff" : T.ter,
              cursor: title.trim() ? "pointer" : "default",
              fontFamily: T.f,
            }}
          >
            {saving ? "Adding..." : "Add Card"}
          </button>
        </div>
      </div>
    </div>
  );
}
