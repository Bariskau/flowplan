import { useState } from "react";
import { XIcon as X, PlusIcon as Plus } from "@phosphor-icons/react";
import * as api from "../lib/api";
import type { Plan } from "../types";
import useEscapeClose from "../hooks/useEscapeClose";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";

interface NewPlanModalProps {
  actorId?: string;
  actorAvatarSeed?: string;
  onClose: () => void;
  onCreated: (plan: Plan) => void;
}

export default function NewPlanModal({ actorId, actorAvatarSeed, onClose, onCreated }: NewPlanModalProps) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  useEscapeClose(onClose);

  const submit = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const result = await api.createPlan(title.trim(), "", desc.trim(), undefined, actorId, actorAvatarSeed);
      onCreated({
        id: result.id,
        title: title.trim(),
        icon: "",
        description: desc.trim(),
        steps: [],
        createdAt: Date.now(),
        pinned: false,
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
          <h1 className="text-[16px] font-semibold text-fp-text tracking-[-0.02em] pr-8">New Plan</h1>
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
                placeholder="Plan title"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
                className="fp-input"
              />
            </div>

            {/* Description */}
            <div>
              <label className="fp-label">Description</label>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Brief description (optional)"
                rows={3}
                className="fp-input resize-none leading-[1.6] text-[12px]"
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
            {saving ? "Creating..." : "Create"}
          </Button>
          <Button variant="ghost" size="md" onClick={onClose} className="w-full">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
