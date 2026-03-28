import { useState } from "react";
import { T } from "../lib/theme";
import * as api from "../lib/api";

interface NewPlanModalProps {
  onClose: () => void;
  onCreated: (planId: string) => void;
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

export default function NewPlanModal({ onClose, onCreated }: NewPlanModalProps) {
  const [icon, setIcon] = useState("\u{1F4CB}");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const result = await api.createPlan(title.trim(), icon, desc.trim());
      onCreated(result.id);
    } catch {
      setSaving(false);
    }
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = "rgba(16,185,129,0.5)";
    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(16,185,129,0.1)";
  };

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
    e.currentTarget.style.boxShadow = "none";
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
          width: 420,
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
          New Plan
        </div>

        {/* Icon + Title row */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <div style={{ flex: "0 0 56px" }}>
            <label style={labelStyle}>Icon</label>
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              maxLength={4}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              style={{
                ...inputStyle,
                fontSize: 20,
                padding: "10px 8px",
                textAlign: "center",
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Plan title"
              autoFocus
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Description</label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Brief description (optional)"
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
              resize: "none",
              lineHeight: 1.6,
            }}
          />
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          {/* Cancel - Protocol secondary button (bordered) */}
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

          {/* Create - Protocol primary button (emerald) */}
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
                Creating...
              </span>
            ) : (
              <>Create <span style={{ marginLeft: 2 }}>{"\u2192"}</span></>
            )}
          </button>
        </div>
      </div>

      {/* Spin keyframe injected as style tag */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
