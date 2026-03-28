import { useState, useCallback, useEffect } from "react";
import type { Plan } from "../types";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";

interface ToolbarProps {
  plan: Plan;
  viewMode: "flow" | "list";
  onViewModeChange: (mode: "flow" | "list") => void;
  onToggleHistory: () => void;
  historyOpen: boolean;
  onExportSvg: () => void;
  onExportJson: () => void;
  planTitle: string;
  planId: string;
}

/* ---- Inline SVG Icons ---- */
const Ico = {
  flow: (c: string, s = 14) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="5" height="5" rx="1" stroke={c} strokeWidth="1.3" />
      <rect x="10" y="1" width="5" height="5" rx="1" stroke={c} strokeWidth="1.3" />
      <rect x="5.5" y="10" width="5" height="5" rx="1" stroke={c} strokeWidth="1.3" />
      <path d="M3.5 6v2.5a1 1 0 001 1h3M12.5 6v2.5a1 1 0 01-1 1h-3" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  list: (c: string, s = 14) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M4 4h9M4 8h9M4 12h9" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="1.5" cy="4" r="0.8" fill={c} />
      <circle cx="1.5" cy="8" r="0.8" fill={c} />
      <circle cx="1.5" cy="12" r="0.8" fill={c} />
    </svg>
  ),
  history: (c: string, s = 14) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M2 8a6 6 0 1112 0A6 6 0 012 8z" stroke={c} strokeWidth="1.3" />
      <path d="M8 5v3.5l2.5 1.5" stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  export: (c: string, s = 14) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M8 2v8M4.5 7L8 10.5 11.5 7" stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 12h10" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  copy: (c: string, s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <rect x="5" y="5" width="8" height="8" rx="1.5" stroke={c} strokeWidth="1.3" />
      <path d="M3 11V3.5A1.5 1.5 0 014.5 2H11" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  check: (c: string, s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M3 8.5L6.5 12 13 4" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  chevron: (c: string, s = 10) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M5 6l3 3 3-3" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  svg: (c: string, s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="3" width="14" height="10" rx="2" stroke={c} strokeWidth="1.2" />
      <path d="M4.5 9.5L6 7.5 8 10l2.5-4L13 9.5" stroke={c} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  json: (c: string, s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M5 2C3.5 2 3 3 3 4v2c0 1-1 1.5-1.5 2 .5.5 1.5 1 1.5 2v2c0 1 .5 2 2 2" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M11 2c1.5 0 2 1 2 2v2c0 1 1 1.5 1.5 2-.5.5-1.5 1-1.5 2v2c0 1-.5 2-2 2" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
};

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
      icon={copied ? Ico.check("#10b981", 10) : Ico.copy("currentColor", 10)}
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
  planTitle,
  planId,
}: ToolbarProps) {
  const [exportOpen, setExportOpen] = useState(false);

  /* Close export menu on outside click */
  useEffect(() => {
    if (!exportOpen) return;
    const handler = () => setExportOpen(false);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [exportOpen]);

  return (
    <div className="h-[--spacing-fp-toolbar] fp-glass border-b border-fp-border flex items-center justify-between px-4 shrink-0 z-10">
      {/* ---- Left: Title, count, CopyRef ---- */}
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-sm font-semibold text-fp-text overflow-hidden text-ellipsis whitespace-nowrap max-w-[240px] leading-none tracking-tight">
          {planTitle}
        </span>

        <span className="text-xs text-fp-dim font-mono font-medium bg-fp-glass-hover px-2 py-0.5 rounded-fp-sm leading-none shrink-0">
          {plan.steps.length} card{plan.steps.length !== 1 ? "s" : ""}
        </span>

        <CopyRef planId={planId} />
      </div>

      {/* ---- Right: History, Export, View Toggle ---- */}
      <div className="flex items-center gap-2">
        {/* History toggle */}
        <IconButton
          variant={historyOpen ? "glassy" : "ghost"}
          size="md"
          onClick={onToggleHistory}
          label="History"
          icon={Ico.history(historyOpen ? "#10b981" : "currentColor", 14)}
          className={historyOpen ? "bg-fp-accent-dim border-fp-accent/25 text-fp-accent" : ""}
        />

        {/* Export dropdown */}
        <div className="relative">
          <IconButton
            variant={exportOpen ? "glassy" : "ghost"}
            size="md"
            onClick={(e) => {
              e.stopPropagation();
              setExportOpen(!exportOpen);
            }}
            label="Export"
            icon={
              <span className="flex items-center gap-1">
                {Ico.export(exportOpen ? "#10b981" : "currentColor", 13)}
                {Ico.chevron(exportOpen ? "#10b981" : "currentColor", 10)}
              </span>
            }
            className={`w-auto px-2 ${exportOpen ? "bg-fp-accent-dim border-fp-accent/25 text-fp-accent" : ""}`}
          />

          {exportOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-[calc(100%+6px)] bg-fp-solid rounded-fp-lg border border-fp-border shadow-lg p-1 z-[100] min-w-[160px]"
            >
              {/* SVG Export */}
              <Button
                variant="ghost"
                size="md"
                icon={Ico.svg("#a78bfa", 14)}
                onClick={() => {
                  onExportSvg();
                  setExportOpen(false);
                }}
                className="w-full justify-start"
              >
                <span className="flex items-center gap-2 w-full">
                  Export SVG
                  <span className="ml-auto text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-fp-sm text-fp-purple bg-fp-purple-dim">
                    SVG
                  </span>
                </span>
              </Button>

              {/* Separator */}
              <div className="h-px bg-fp-border mx-2 my-0.5" />

              {/* JSON Export */}
              <Button
                variant="ghost"
                size="md"
                icon={Ico.json("#fb923c", 14)}
                onClick={() => {
                  onExportJson();
                  setExportOpen(false);
                }}
                className="w-full justify-start"
              >
                <span className="flex items-center gap-2 w-full">
                  Export JSON
                  <span className="ml-auto text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-fp-sm text-fp-orange bg-fp-orange-dim">
                    JSON
                  </span>
                </span>
              </Button>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-[18px] bg-fp-border mx-0.5" />

        {/* Flow / List segmented control */}
        <div className="flex items-center rounded-fp-md overflow-hidden border border-fp-border">
          <Button
            variant="ghost"
            size="sm"
            icon={Ico.flow(viewMode === "flow" ? "#fff" : "currentColor", 12)}
            onClick={() => onViewModeChange("flow")}
            className={`rounded-none border-none ${viewMode === "flow" ? "bg-fp-glass-active text-fp-text" : "bg-transparent text-fp-dim"}`}
          >
            Flow
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={Ico.list(viewMode === "list" ? "#fff" : "currentColor", 12)}
            onClick={() => onViewModeChange("list")}
            className={`rounded-none border-none ${viewMode === "list" ? "bg-fp-glass-active text-fp-text" : "bg-transparent text-fp-dim"}`}
          >
            List
          </Button>
        </div>
      </div>
    </div>
  );
}

export default Toolbar;
