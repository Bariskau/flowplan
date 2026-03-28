import { useState } from "react";
import { X, Plus } from "@phosphor-icons/react";
import { TC } from "../lib/theme";
import * as api from "../lib/api";
import type { Card } from "../types";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";

interface NewCardModalProps {
  planId: string;
  existingCards: Card[];
  onClose: () => void;
  onCreated: (cardId: string) => void;
}

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
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      <div
        className="fp-glass-card border border-fp-border shadow-2xl w-[440px] max-h-[80vh] flex flex-col animate-slide-up rounded-fp-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — sticky */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between shrink-0 border-b border-fp-border">
          <div className="text-[14px] font-semibold text-fp-text tracking-[-0.02em]">
            New Card
          </div>
          <IconButton
            variant="ghost"
            size="sm"
            icon={<X size={12} />}
            label="Close"
            onClick={onClose}
          />
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-4">
            {/* Title */}
            <div>
              <label className="fp-label">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Card title"
                autoFocus
                className="fp-input"
              />
            </div>

            {/* Card Type Selector — styled mini-buttons */}
            <div>
              <label className="fp-label">Type</label>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(TC).map(([k, v]) => {
                  const active = cardType === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setCardType(k)}
                      className={`
                        inline-flex items-center gap-1 text-[10px] font-semibold font-mono
                        py-1 px-2.5 rounded-full tracking-[0.03em] leading-none
                        cursor-pointer transition-all duration-150
                        ${active
                          ? "ring-1 ring-inset ring-current shadow-[0_0_8px_rgba(255,255,255,0.04)]"
                          : "opacity-50 hover:opacity-80"
                        }
                      `.trim().replace(/\s+/g, " ")}
                      style={{
                        color: v.c,
                        background: active ? v.bg : "transparent",
                      }}
                    >
                      <span
                        className="w-1 h-1 rounded-full shrink-0"
                        style={{ background: v.c }}
                      />
                      {v.l}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="fp-label">Description</label>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Description (markdown supported)"
                rows={4}
                className="fp-input resize-y leading-[1.6]"
              />
            </div>

            {/* Repository */}
            <div>
              <label className="fp-label">Repository</label>
              <input
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="/path/to/repo"
                className="fp-input font-mono !text-xs"
              />
            </div>

            {/* Files */}
            <div>
              <label className="fp-label">
                Files <span className="normal-case font-normal opacity-60">(one per line)</span>
              </label>
              <textarea
                value={filesStr}
                onChange={(e) => setFilesStr(e.target.value)}
                placeholder={"src/main.ts\nsrc/utils.ts"}
                rows={3}
                className="fp-input !text-xs font-mono resize-y leading-[1.6]"
              />
            </div>

            {/* Dependencies */}
            {existingCards.length > 0 && (
              <div>
                <label className="fp-label">
                  Dependencies <span className="normal-case font-normal opacity-60">(optional)</span>
                </label>
                <div className="max-h-[120px] overflow-y-auto flex flex-col gap-0.5 p-1 rounded-fp-md" style={{ background: "rgba(0,0,0,0.15)", border: "1px solid var(--color-fp-border)" }}>
                  {existingCards.map((s) => {
                    const checked = deps.includes(s.id);
                    const stc = TC[s.type] || TC.research;
                    return (
                      <label
                        key={s.id}
                        className={`flex items-center gap-1.5 py-1.5 px-2 rounded-fp-sm cursor-pointer transition-all duration-150
                          ${checked
                            ? "bg-fp-accent-dim ring-1 ring-inset ring-fp-accent/20"
                            : "hover:bg-fp-glass-hover"
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setDeps((d) =>
                              checked ? d.filter((x) => x !== s.id) : [...d, s.id]
                            )
                          }
                          className="w-3 h-3 cursor-pointer accent-fp-accent"
                        />
                        <span
                          className="text-[9px] font-bold py-[2px] px-1.5 rounded-full font-mono tracking-[0.03em] shrink-0"
                          style={{ color: stc.c, background: stc.bg }}
                        >
                          {stc.l}
                        </span>
                        <span
                          className={`text-[11px] overflow-hidden text-ellipsis whitespace-nowrap transition-colors duration-150
                            ${checked ? "text-fp-text" : "text-fp-muted"}`}
                        >
                          {s.title}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer — sticky */}
        <div className="px-5 pb-4 pt-3 flex justify-end gap-2 shrink-0 border-t border-fp-border">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="accent"
            size="sm"
            icon={<Plus size={12} weight="bold" />}
            onClick={submit}
            disabled={!title.trim() || saving}
            loading={saving}
          >
            {saving ? "Adding..." : "Add Card"}
          </Button>
        </div>
      </div>
    </div>
  );
}
