import { useState } from "react";
import { TC } from "../lib/theme";
import * as api from "../lib/api";
import type { Card } from "../types";
import Button from "./ui/Button";

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
        className="bg-fp-solid border border-fp-border rounded-fp-xl p-6 w-[480px] max-h-[80vh] overflow-y-auto animate-slide-up shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal title */}
        <div className="text-lg font-semibold text-fp-text mb-6 tracking-[-0.02em]">
          New Card
        </div>

        {/* Title + Type row */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <label className="fp-label">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Card title"
              autoFocus
              className="fp-input"
            />
          </div>
          <div className="flex-[0_0_140px]">
            <label className="fp-label">Type</label>
            <select
              value={cardType}
              onChange={(e) => setCardType(e.target.value)}
              className="fp-input cursor-pointer appearance-none bg-no-repeat bg-[right_10px_center] pr-7"
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
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold font-mono py-[3px] px-2.5 rounded-fp-sm tracking-[0.03em]"
              style={{ color: TC[cardType].c, background: TC[cardType].bg }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: TC[cardType].c }}
              />
              {TC[cardType].l}
            </span>
          </div>
        )}

        {/* Description */}
        <div className="mb-4">
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
        <div className="mb-4">
          <label className="fp-label">Repository</label>
          <input
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="/path/to/repo"
            className="fp-input font-mono !text-xs"
          />
        </div>

        {/* Files */}
        <div className="mb-4">
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
          <div className="mb-6">
            <label className="fp-label">
              Dependencies <span className="normal-case font-normal opacity-60">(optional)</span>
            </label>
            <div className="max-h-[140px] overflow-y-auto flex flex-col gap-1 p-1 bg-fp-surface rounded-fp-lg border border-fp-border">
              {existingCards.map((s) => {
                const checked = deps.includes(s.id);
                const stc = TC[s.type] || TC.research;
                return (
                  <label
                    key={s.id}
                    className={`flex items-center gap-2 py-[7px] px-2.5 rounded-fp-sm cursor-pointer transition-all duration-150
                      ${checked
                        ? "bg-fp-accent-dim border border-fp-accent/20"
                        : "border border-transparent hover:bg-fp-glass-hover"
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
                      className="w-3.5 h-3.5 cursor-pointer accent-fp-accent"
                    />
                    <span
                      className="text-[10px] font-bold py-0.5 px-[7px] rounded-fp-sm font-mono tracking-[0.03em] shrink-0"
                      style={{ color: stc.c, background: stc.bg }}
                    >
                      {stc.l}
                    </span>
                    <span
                      className={`text-[12.5px] overflow-hidden text-ellipsis whitespace-nowrap transition-colors duration-150
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

        {/* Buttons */}
        <div className="flex justify-end gap-2.5">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="accent"
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
