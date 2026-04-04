import React, { useState, useMemo } from "react";
import { XIcon as X, PlusIcon as Plus, ChatCircleDotsIcon as ChatCircleDots, FoldersIcon as Folders, LightningIcon as Lightning, PencilSimpleIcon as PencilSimple, CheckCircleIcon as CheckCircle } from "@phosphor-icons/react";
import { TC } from "../lib/theme";
import * as api from "../lib/api";
import type { Card } from "../types";
import useEscapeClose from "../hooks/useEscapeClose";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";
import Chip, { type ChipVariant } from "./ui/Chip";
import SegmentedControl from "./ui/SegmentedControl";
import { Md } from "../lib/markdown";
import { TYPE_CHIP, TYPE_GRADIENT } from "../lib/cardTypes";

const TYPE_ICON: Record<string, React.ReactNode> = {
  research: <ChatCircleDots size={12} weight="regular" />,
  planning: <Folders size={12} weight="regular" />,
  create: <Lightning size={12} weight="regular" />,
  edit: <PencilSimple size={12} weight="regular" />,
  test: <CheckCircle size={12} weight="regular" />,
};

interface NewCardModalProps {
  planId: string;
  existingCards: Card[];
  apiBase?: string;
  sessionId?: string;
  actorId?: string;
  actorAvatarSeed?: string;
  onClose: () => void;
  onCreated: (card: Card) => void;
}

export default function NewCardModal({
  planId,
  existingCards,
  apiBase,
  sessionId,
  actorId,
  actorAvatarSeed,
  onClose,
  onCreated,
}: NewCardModalProps) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [cardType, setCardType] = useState("edit");
  const [repo, setRepo] = useState("");
  const filesStr = "";
  const deps: string[] = [];
  const [saving, setSaving] = useState(false);
  const [descPreview, setDescPreview] = useState(false);

  useEscapeClose(onClose);

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
      }, "rest", apiBase, sessionId, actorId, actorAvatarSeed);
      onCreated({
        id: result.id,
        title: title.trim(),
        description: desc.trim(),
        type: cardType as Card["type"],
        repo: repo.trim(),
        files,
        dependencies: deps,
        fileChanges: {},
        order: existingCards.length,
      });
    } catch {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[1000] flex items-center justify-center animate-modal-overlay"
      onClick={onClose}
    >
      <div
        className="relative w-[400px] max-h-[80vh] flex flex-col animate-modal-in rounded-xl overflow-hidden border border-white/[0.08] bg-[rgba(32,33,36,0.95)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Type gradient tint */}
        <div
          className="absolute inset-0 rounded-xl pointer-events-none transition-all duration-500 ease-out blur-2xl"
          style={{ background: TYPE_GRADIENT[cardType] || TYPE_GRADIENT.edit }}
        />

        {/* Close button — absolute top-right */}
        <IconButton
          variant="ghost"
          size="sm"
          icon={<X size={14} />}
          label="Close"
          onClick={onClose}
          className="absolute right-3 top-3 z-10"
        />

        {/* Header — sticky */}
        <div className="px-6 pt-6 pb-4 shrink-0">
          <h1 className="text-[16px] font-semibold text-fp-text tracking-[-0.02em] pr-8">New Card</h1>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

            {/* Card Type Selector */}
            <div>
              <label className="fp-label">Type</label>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(TC).map(([k, v]) => (
                  <Chip
                    key={k}
                    variant={TYPE_CHIP[k] || "default"}
                    size="sm"
                    icon={TYPE_ICON[k]}
                    onClick={() => setCardType(k)}
                    className={`!normal-case ${cardType !== k ? "opacity-40" : ""}`}
                  >
                    {v.l}
                  </Chip>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="fp-label !mb-0">Description</label>
                <SegmentedControl
                  value={descPreview ? "preview" : "edit"}
                  onChange={(value) => setDescPreview(value === "preview")}
                  options={[
                    { id: "edit", label: "Edit" },
                    { id: "preview", label: "Preview" },
                  ]}
                />
              </div>
              {descPreview ? (
                <div className="fp-input min-h-[100px] overflow-y-auto">
                  {desc.trim() ? (
                    <Md text={desc} fontSize={13} color="rgba(255,255,255,0.55)" lineHeight={1.7} />
                  ) : (
                    <span className="text-fp-dim text-xs italic">Nothing to preview</span>
                  )}
                </div>
              ) : (
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Description (markdown supported)"
                  rows={4}
                  className="fp-input resize-y leading-[1.6]"
                />
              )}
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
          </div>
        </div>

        {/* Footer — sticky */}
        <div className="px-6 pt-4 pb-6 shrink-0 flex flex-col gap-2">
          <Button
            variant="glassy"
            size="md"
            icon={<Plus size={13} weight="bold" />}
            onClick={submit}
            disabled={!title.trim() || saving}
            loading={saving}
            className="w-full"
          >
            {saving ? "Adding..." : "Add Card"}
          </Button>
          <Button variant="ghost" size="md" onClick={onClose} className="w-full">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
