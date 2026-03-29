import React, { useState, useCallback } from "react";
import { ClockCounterClockwise, Export, Copy, Check, FileImage, BracketsAngle, Plus } from "@phosphor-icons/react";
import type { Plan } from "../types";
import IconButton from "./ui/IconButton";
import DropdownMenu, { DropdownItem } from "./ui/DropdownMenu";

interface ToolbarProps {
  plan: Plan;
  onToggleHistory: () => void;
  historyOpen: boolean;
  onExportSvg: () => void;
  onExportJson: () => void;
  onAddCard: () => void;
  planTitle: string;
  planId: string;
}

/* ---- CopyRef inline ---- */
function CopyRef({ planId }: { planId: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(`flowplan://${planId}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [planId]);

  return (
    <IconButton
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      label="Copy plan reference"
      icon={copied ? <Check size={10} weight="bold" className="text-fp-accent" /> : <Copy size={10} weight="bold" />}
      className={copied ? "text-fp-accent bg-fp-accent-dim" : ""}
    />
  );
}

/* ---- Toolbar ---- */
function Toolbar({
  plan,
  onToggleHistory,
  historyOpen,
  onExportSvg,
  onExportJson,
  onAddCard,
  planTitle,
  planId,
}: ToolbarProps) {
  return (
    <div className="h-[var(--spacing-fp-toolbar)] border border-white/8 bg-[rgba(32,33,36,0.72)] backdrop-blur-[20px] rounded-full inline-flex items-center gap-2 px-4 shrink-0 z-10 animate-toolbar-in">
      {/* ---- Left: Title, count, CopyRef, Add ---- */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[13px] font-semibold text-fp-text overflow-hidden text-ellipsis whitespace-nowrap leading-none tracking-tight min-w-0 flex-shrink">
          {planTitle}
        </span>

        <span className="text-[10px] text-fp-dim font-mono font-medium bg-fp-glass-hover px-1.5 py-0.5 rounded-fp-sm leading-none shrink-0 pt-1">
          {plan.steps.length}
        </span>

        <CopyRef planId={planId} />

        <div className="w-px h-4 bg-fp-border" />

        <IconButton
          variant="ghost"
          size="sm"
          onClick={onAddCard}
          label="Add card"
          icon={<Plus size={13} weight="bold" className="text-fp-accent" />}
        />
      </div>

      {/* ---- Right: History, Export ---- */}
      <div className="flex items-center gap-1 shrink-0 ml-2">
        <IconButton
          variant={historyOpen ? "glassy" : "ghost"}
          size="sm"
          onClick={onToggleHistory}
          label="History"
          icon={<ClockCounterClockwise size={13} weight="bold" />}
          className={historyOpen ? "bg-fp-glass-active border-fp-border-hover text-fp-text" : ""}
        />

        <DropdownMenu
          align="right"
          trigger={<IconButton variant="ghost" size="sm" label="Export" icon={<Export size={12} weight="bold" />} />}
        >
          <DropdownItem
            icon={<FileImage size={15} className="text-fp-purple" />}
            label="Export SVG"
            onClick={onExportSvg}
          />
          <DropdownItem
            icon={<BracketsAngle size={15} className="text-fp-orange" />}
            label="Export JSON"
            onClick={onExportJson}
          />
        </DropdownMenu>
      </div>
    </div>
  );
}

export default React.memo(Toolbar);
