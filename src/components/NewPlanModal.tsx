import { useState } from "react";
import { X, Plus } from "@phosphor-icons/react";
import * as api from "../lib/api";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";

interface NewPlanModalProps {
  onClose: () => void;
  onCreated: (planId: string) => void;
}

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

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      <div
        className="fp-glass-card border border-fp-border shadow-2xl w-[380px] max-h-[80vh] flex flex-col animate-slide-up rounded-fp-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — sticky */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between shrink-0 border-b border-fp-border">
          <div className="text-[14px] font-semibold text-fp-text tracking-[-0.02em]">
            New Plan
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
            {/* Icon + Title row */}
            <div className="flex gap-2.5">
              <div className="flex-[0_0_48px]">
                <label className="fp-label">Icon</label>
                <input
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  maxLength={4}
                  className="fp-input text-lg text-center !px-1.5"
                />
              </div>
              <div className="flex-1">
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
            {saving ? "Creating..." : "Create"}
          </Button>
        </div>
      </div>
    </div>
  );
}
