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

const handleInputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
  e.currentTarget.style.borderColor = "rgba(16,185,129,0.5)";
  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(16,185,129,0.1)";
};

const handleInputBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
  e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
  e.currentTarget.style.boxShadow = "none";
};

/* Shared input classes */
const inputCls = "w-full bg-[rgba(24,24,27,1)] border border-[rgba(255,255,255,0.1)] rounded-lg py-[10px] px-3 text-[13px] text-[#f4f4f5] font-sans box-border outline-none transition-[border-color,box-shadow] duration-200 ease-in-out";
const labelCls = "text-[11px] font-medium text-[rgba(255,255,255,0.4)] font-mono uppercase tracking-[0.05em] mb-[6px] block";

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
      className="cv-backdrop fixed inset-0 bg-[rgba(0,0,0,0.5)] backdrop-blur-[8px] z-[1000] flex items-center justify-center font-sans"
      onClick={onClose}
    >
      <div
        className="cv-modal w-[500px] max-h-[82vh] overflow-y-auto bg-[rgba(24,24,27,0.9)] backdrop-blur-[24px] border border-[rgba(255,255,255,0.08)] rounded-2xl p-7 shadow-[0_24px_80px_rgba(0,0,0,0.6),0_0_1px_rgba(255,255,255,0.1)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal title */}
        <div className="text-lg font-semibold text-[#f4f4f5] mb-6 tracking-[-0.02em]">
          New Card
        </div>

        {/* Title + Type row */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <label className={labelCls}>Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Card title"
              autoFocus
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              className={inputCls}
            />
          </div>
          <div className="flex-[0_0_140px]">
            <label className={labelCls}>Type</label>
            <select
              value={cardType}
              onChange={(e) => setCardType(e.target.value)}
              onFocus={handleInputFocus as any}
              onBlur={handleInputBlur as any}
              className={`${inputCls} cursor-pointer appearance-none bg-no-repeat bg-[right_10px_center] pr-7`}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 16 16' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M5 6l3 3 3-3' stroke='%23666' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
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
          <div className="mb-4">
            <span
              className="inline-flex items-center gap-[6px] text-[11px] font-semibold font-mono py-[3px] px-[10px] rounded-md tracking-[0.03em]"
              style={{ color: TC[cardType].c, background: TC[cardType].bg }}
            >
              <span
                className="w-[6px] h-[6px] rounded-full"
                style={{ background: TC[cardType].c }}
              />
              {TC[cardType].l}
            </span>
          </div>
        )}

        {/* Description */}
        <div className="mb-4">
          <label className={labelCls}>Description</label>
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
            className={`${inputCls} resize-y leading-[1.6]`}
          />
        </div>

        {/* Repository */}
        <div className="mb-4">
          <label className={labelCls}>Repository</label>
          <input
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="/path/to/repo"
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            className={`${inputCls} font-mono !text-xs`}
          />
        </div>

        {/* Files */}
        <div className="mb-4">
          <label className={labelCls}>Files <span className="normal-case font-normal opacity-60">(one per line)</span></label>
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
            className={`${inputCls} !text-xs font-mono resize-y leading-[1.6]`}
          />
        </div>

        {/* Dependencies */}
        {existingCards.length > 0 && (
          <div className="mb-6">
            <label className={labelCls}>Dependencies <span className="normal-case font-normal opacity-60">(optional)</span></label>
            <div className="max-h-[140px] overflow-y-auto flex flex-col gap-1 p-1 bg-[rgba(24,24,27,0.5)] rounded-[10px] border border-[rgba(255,255,255,0.06)]">
              {existingCards.map((s) => {
                const checked = deps.includes(s.id);
                const stc = TC[s.type] || TC.research;
                return (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 py-[7px] px-[10px] rounded-[7px] cursor-pointer transition-all duration-150 ease-in-out"
                    style={{
                      background: checked ? "rgba(16,185,129,0.08)" : "transparent",
                      border: `1px solid ${checked ? "rgba(16,185,129,0.2)" : "transparent"}`,
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
                      className="w-[14px] h-[14px] cursor-pointer accent-[#10b981]"
                    />
                    <span
                      className="text-[10px] font-bold py-[2px] px-[7px] rounded-[5px] font-mono tracking-[0.03em] shrink-0"
                      style={{ color: stc.c, background: stc.bg }}
                    >
                      {stc.l}
                    </span>
                    <span
                      className="text-[12.5px] overflow-hidden text-ellipsis whitespace-nowrap transition-colors duration-150"
                      style={{ color: checked ? "#e4e4e7" : "rgba(255,255,255,0.6)" }}
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
        <div className="flex justify-end gap-[10px]">
          {/* Cancel - Protocol secondary (bordered) */}
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

          {/* Add Card - Protocol primary (emerald) */}
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
                Adding...
              </span>
            ) : (
              <>Add Card <span className="ml-[2px]">{"\u2192"}</span></>
            )}
          </button>
        </div>
      </div>

      {/* Spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
