import { useState } from "react";
import * as api from "../lib/api";
import Button from "./ui/Button";

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
        className="bg-fp-solid border border-fp-border rounded-fp-xl p-6 w-[400px] animate-slide-up shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal title */}
        <div className="text-lg font-semibold text-fp-text mb-6 tracking-[-0.02em]">
          New Plan
        </div>

        {/* Icon + Title row */}
        <div className="flex gap-3 mb-4">
          <div className="flex-[0_0_56px]">
            <label className="fp-label">Icon</label>
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              maxLength={4}
              className="fp-input text-xl text-center !px-2"
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
        <div className="mb-6">
          <label className="fp-label">Description</label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Brief description (optional)"
            rows={3}
            className="fp-input resize-none leading-[1.6]"
          />
        </div>

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
            {saving ? "Creating..." : "Create"}
          </Button>
        </div>
      </div>
    </div>
  );
}
