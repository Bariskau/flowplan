import { useState } from "react";
import { T } from "../lib/theme";
import * as api from "../lib/api";

interface NewPlanModalProps {
  onClose: () => void;
  onCreated: (planId: string) => void;
}

/* Protocol emerald */
const emerald = "#10b981";

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
      className="cv-backdrop fixed inset-0 bg-[rgba(0,0,0,0.5)] backdrop-blur-[8px] z-[1000] flex items-center justify-center font-sans"
      onClick={onClose}
    >
      <div
        className="cv-modal w-[420px] bg-[rgba(24,24,27,0.9)] backdrop-blur-[24px] border border-[rgba(255,255,255,0.08)] rounded-2xl p-7 shadow-[0_24px_80px_rgba(0,0,0,0.6),0_0_1px_rgba(255,255,255,0.1)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal title */}
        <div className="text-lg font-semibold text-[#f4f4f5] mb-6 tracking-[-0.02em]">
          New Plan
        </div>

        {/* Icon + Title row */}
        <div className="flex gap-3 mb-4">
          <div className="flex-[0_0_56px]">
            <label className="text-[11px] font-medium text-[rgba(255,255,255,0.4)] font-mono uppercase tracking-[0.05em] mb-[6px] block">Icon</label>
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              maxLength={4}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              className="w-full bg-[rgba(24,24,27,1)] border border-[rgba(255,255,255,0.1)] rounded-lg text-xl text-[#f4f4f5] font-sans box-border outline-none transition-[border-color,box-shadow] duration-200 ease-in-out py-[10px] px-2 text-center"
            />
          </div>
          <div className="flex-1">
            <label className="text-[11px] font-medium text-[rgba(255,255,255,0.4)] font-mono uppercase tracking-[0.05em] mb-[6px] block">Title</label>
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
              className="w-full bg-[rgba(24,24,27,1)] border border-[rgba(255,255,255,0.1)] rounded-lg py-[10px] px-3 text-[13px] text-[#f4f4f5] font-sans box-border outline-none transition-[border-color,box-shadow] duration-200 ease-in-out"
            />
          </div>
        </div>

        {/* Description */}
        <div className="mb-6">
          <label className="text-[11px] font-medium text-[rgba(255,255,255,0.4)] font-mono uppercase tracking-[0.05em] mb-[6px] block">Description</label>
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
            className="w-full bg-[rgba(24,24,27,1)] border border-[rgba(255,255,255,0.1)] rounded-lg py-[10px] px-3 text-[13px] text-[#f4f4f5] font-sans box-border outline-none transition-[border-color,box-shadow] duration-200 ease-in-out resize-none leading-[1.6]"
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-[10px]">
          {/* Cancel - Protocol secondary button (bordered) */}
          <button
            onClick={onClose}
            className="bg-transparent border border-[rgba(255,255,255,0.12)] rounded-lg py-2 px-[18px] text-[13px] font-medium text-[rgba(255,255,255,0.6)] cursor-pointer font-sans transition-all duration-200 ease-in-out"
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
            className="border-none rounded-lg py-2 px-5 text-[13px] font-semibold font-sans transition-all duration-200 ease-in-out"
            style={{
              background: title.trim() ? emerald : "rgba(255,255,255,0.06)",
              color: title.trim() ? "#fff" : "rgba(255,255,255,0.3)",
              cursor: title.trim() ? "pointer" : "default",
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
              <span className="flex items-center gap-[6px]">
                <span className="w-3 h-3 border-2 border-[rgba(255,255,255,0.3)] border-t-white rounded-full inline-block animate-spin" />
                Creating...
              </span>
            ) : (
              <>Create <span className="ml-[2px]">{"\u2192"}</span></>
            )}
          </button>
        </div>
      </div>

      {/* Spin keyframe injected as style tag */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
