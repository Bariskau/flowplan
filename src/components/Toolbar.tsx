import React, { useState, useCallback } from "react";
import {
  ClockCounterClockwise,
  Export,
  FlowArrow,
  ListBullets,
  Copy,
  Check,
  FileImage,
  BracketsAngle,
  Plus,
} from "@phosphor-icons/react";
import type { Plan } from "../types";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";
import DropdownMenu, { DropdownItem } from "./ui/DropdownMenu";

interface ToolbarProps {
  plan: Plan;
  viewMode: "flow" | "list";
  onViewModeChange: (mode: "flow" | "list") => void;
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
  viewMode,
  onViewModeChange,
  onToggleHistory,
  historyOpen,
  onExportSvg,
  onExportJson,
  onAddCard,
  planTitle,
  planId,
}: ToolbarProps) {
  return (
    <div className="h-[var(--spacing-fp-toolbar)] fp-glass border border-fp-border rounded-fp-pill inline-flex items-center gap-2 px-4 shrink-0 z-10 overflow-hidden">
      {/* ---- Left: Title, count, CopyRef ---- */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[13px] font-semibold text-fp-text overflow-hidden text-ellipsis whitespace-nowrap leading-none tracking-tight min-w-0 flex-shrink">
          {planTitle}
        </span>

        <span className="text-[10px] text-fp-dim font-mono font-medium bg-fp-glass-hover px-1.5 py-0.5 rounded-fp-sm leading-none shrink-0">
          {plan.steps.length}
        </span>

        <CopyRef planId={planId} />

        {/* Divider */}
        <div className="w-px h-4 bg-fp-border" />

        {/* Add Card */}
        <IconButton
          variant="ghost"
          size="sm"
          onClick={onAddCard}
          label="Add card"
          icon={<Plus size={13} weight="bold" className="text-fp-accent" />}
        />
      </div>

      {/* ---- Right: History, Export, View Toggle ---- */}
      <div className="flex items-center gap-1 shrink-0 ml-2">
        {/* History toggle */}
        <IconButton
          variant={historyOpen ? "glassy" : "ghost"}
          size="sm"
          onClick={onToggleHistory}
          label="History"
          icon={<ClockCounterClockwise size={13} weight="bold" />}
          className={historyOpen ? "bg-fp-glass-active border-fp-border-hover text-fp-text" : ""}
        />

        {/* Export dropdown */}
        <DropdownMenu
          align="right"
          trigger={
            <IconButton
              variant="ghost"
              size="sm"
              label="Export"
              icon={<Export size={12} weight="bold" />}
            />
          }
        >
          <DropdownItem
            icon={<FileImage size={14} weight="bold" className="text-fp-purple" />}
            label="Export SVG"
            onClick={onExportSvg}
          />
          <DropdownItem
            icon={<BracketsAngle size={14} weight="bold" className="text-fp-orange" />}
            label="Export JSON"
            onClick={onExportJson}
          />
        </DropdownMenu>

        {/* Divider */}
        <div className="w-px h-4 bg-fp-border mx-0.5" />

        {/* Flow / List segmented control */}
        <div className="flex items-center rounded-fp-sm overflow-hidden border border-fp-border fp-glass-card">
          <button
            onClick={() => onViewModeChange("flow")}
            className={`inline-flex items-center justify-center gap-1 h-6 px-2 text-[11px] font-medium transition-all duration-150 cursor-pointer select-none border-none ${
              viewMode === "flow"
                ? "bg-fp-glass-active text-fp-text"
                : "bg-transparent text-fp-dim hover:bg-fp-glass-hover hover:text-fp-muted"
            }`}
          >
            <FlowArrow size={11} weight="bold" />
            Flow
          </button>
          <button
            onClick={() => onViewModeChange("list")}
            className={`inline-flex items-center justify-center gap-1 h-6 px-2 text-[11px] font-medium transition-all duration-150 cursor-pointer select-none border-none ${
              viewMode === "list"
                ? "bg-fp-glass-active text-fp-text"
                : "bg-transparent text-fp-dim hover:bg-fp-glass-hover hover:text-fp-muted"
            }`}
          >
            <ListBullets size={11} weight="bold" />
            List
          </button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(Toolbar);
