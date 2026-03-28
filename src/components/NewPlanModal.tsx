import { useState } from "react";
import { T } from "../lib/theme";
import * as api from "../lib/api";

interface NewPlanModalProps {
  onClose: () => void;
  onCreated: (planId: string) => void;
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

export default function NewPlanModal({ onClose, onCreated }: NewPlanModalProps) {
  const [icon, setIcon] = useState("📋");
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
          width: 400,
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
          New Plan
        </div>

        {/* Icon + Title row */}
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <div style={{ flex: "0 0 48px" }}>
            <label style={labelStyle}>Icon</label>
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              maxLength={4}
              style={{
                ...inputStyle,
                fontSize: 18,
                padding: "8px 6px",
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
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Description</label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Brief description (optional)"
            rows={3}
            style={{
              ...inputStyle,
              resize: "none",
              lineHeight: 1.6,
            }}
          />
        </div>

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
            {saving ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
