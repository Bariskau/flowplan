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

/* Protocol emerald */
const emerald = "#10b981";

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(24,24,27,1)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 13,
  color: "#f4f4f5",
  fontFamily: T.f,
  boxSizing: "border-box",
  outline: "none",
  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: "rgba(255,255,255,0.4)",
  fontFamily: T.m,
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  marginBottom: 6,
  display: "block",
};

const handleInputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
  e.currentTarget.style.borderColor = "rgba(16,185,129,0.5)";
  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(16,185,129,0.1)";
};

const handleInputBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
  e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
  e.currentTarget.style.boxShadow = "none";
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
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
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
          width: 500,
          maxHeight: "82vh",
          overflowY: "auto",
          background: "rgba(24,24,27,0.9)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          padding: 28,
          boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 1px rgba(255,255,255,0.1)",
        }}
      >
        {/* Modal title */}
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: "#f4f4f5",
            marginBottom: 24,
            letterSpacing: "-0.02em",
          }}
        >
          New Card
        </div>

        {/* Title + Type row */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Card title"
              autoFocus
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              style={inputStyle}
            />
          </div>
          <div style={{ flex: "0 0 140px" }}>
            <label style={labelStyle}>Type</label>
            <select
              value={cardType}
              onChange={(e) => setCardType(e.target.value)}
              onFocus={handleInputFocus as any}
              onBlur={handleInputBlur as any}
              style={{
                ...inputStyle,
                cursor: "pointer",
                appearance: "none",
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M5 6l3 3 3-3' stroke='%23666' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 10px center",
                paddingRight: 28,
              }}
            >
              {Object.entries(TC).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.l}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selected type indicator */}
        {cardType && TC[cardType] && (
          <div style={{ marginBottom: 16 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                fontWeight: 600,
                fontFamily: T.m,
                color: TC[cardType].c,
                background: TC[cardType].bg,
                padding: "3px 10px",
                borderRadius: 6,
                letterSpacing: "0.03em",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: TC[cardType].c,
                }}
              />
              {TC[cardType].l}
            </span>
          </div>
        )}

        {/* Description */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Description</label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Description (markdown supported)"
            rows={4}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "rgba(16,185,129,0.5)";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(16,185,129,0.1)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
              e.currentTarget.style.boxShadow = "none";
            }}
            style={{
              ...inputStyle,
              resize: "vertical",
              lineHeight: 1.6,
            }}
          />
        </div>

        {/* Repository */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Repository</label>
          <input
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="/path/to/repo"
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            style={{ ...inputStyle, fontFamily: T.m, fontSize: 12 }}
          />
        </div>

        {/* Files */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Files <span style={{ textTransform: "none", fontWeight: 400, opacity: 0.6 }}>(one per line)</span></label>
          <textarea
            value={filesStr}
            onChange={(e) => setFilesStr(e.target.value)}
            placeholder={"src/main.ts\nsrc/utils.ts"}
            rows={3}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "rgba(16,185,129,0.5)";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(16,185,129,0.1)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
              e.currentTarget.style.boxShadow = "none";
            }}
            style={{
              ...inputStyle,
              fontSize: 12,
              fontFamily: T.m,
              resize: "vertical",
              lineHeight: 1.6,
            }}
          />
        </div>

        {/* Dependencies */}
        {existingCards.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Dependencies <span style={{ textTransform: "none", fontWeight: 400, opacity: 0.6 }}>(optional)</span></label>
            <div
              style={{
                maxHeight: 140,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 4,
                padding: 4,
                background: "rgba(24,24,27,0.5)",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.06)",
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
                      gap: 8,
                      padding: "7px 10px",
                      borderRadius: 7,
                      background: checked ? "rgba(16,185,129,0.08)" : "transparent",
                      border: `1px solid ${checked ? "rgba(16,185,129,0.2)" : "transparent"}`,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e: any) => {
                      if (!checked) e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                    }}
                    onMouseLeave={(e: any) => {
                      e.currentTarget.style.background = checked ? "rgba(16,185,129,0.08)" : "transparent";
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
                      style={{
                        accentColor: emerald,
                        width: 14,
                        height: 14,
                        cursor: "pointer",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: stc.c,
                        background: stc.bg,
                        padding: "2px 7px",
                        borderRadius: 5,
                        fontFamily: T.m,
                        letterSpacing: "0.03em",
                        flexShrink: 0,
                      }}
                    >
                      {stc.l}
                    </span>
                    <span
                      style={{
                        fontSize: 12.5,
                        color: checked ? "#e4e4e7" : "rgba(255,255,255,0.6)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        transition: "color 0.15s",
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
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          {/* Cancel - Protocol secondary (bordered) */}
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
              padding: "8px 18px",
              fontSize: 13,
              fontWeight: 500,
              color: "rgba(255,255,255,0.6)",
              cursor: "pointer",
              fontFamily: T.f,
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e: any) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.05)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
              e.currentTarget.style.color = "#e4e4e7";
            }}
            onMouseLeave={(e: any) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
              e.currentTarget.style.color = "rgba(255,255,255,0.6)";
            }}
          >
            Cancel
          </button>

          {/* Add Card - Protocol primary (emerald) */}
          <button
            onClick={submit}
            disabled={!title.trim() || saving}
            style={{
              background: title.trim() ? emerald : "rgba(255,255,255,0.06)",
              border: "none",
              borderRadius: 8,
              padding: "8px 20px",
              fontSize: 13,
              fontWeight: 600,
              color: title.trim() ? "#fff" : "rgba(255,255,255,0.3)",
              cursor: title.trim() ? "pointer" : "default",
              fontFamily: T.f,
              transition: "all 0.2s ease",
              opacity: saving ? 0.7 : 1,
            }}
            onMouseEnter={(e: any) => {
              if (title.trim() && !saving) {
                e.currentTarget.style.background = "#059669";
              }
            }}
            onMouseLeave={(e: any) => {
              if (title.trim() && !saving) {
                e.currentTarget.style.background = emerald;
              }
            }}
          >
            {saving ? (
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    width: 12,
                    height: 12,
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "spin 0.6s linear infinite",
                  }}
                />
                Adding...
              </span>
            ) : (
              <>Add Card <span style={{ marginLeft: 2 }}>{"\u2192"}</span></>
            )}
          </button>
        </div>
      </div>

      {/* Spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
