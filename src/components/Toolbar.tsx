import { useState, useCallback, useEffect } from "react";
import type { Plan } from "../types";
import { T } from "../lib/theme";

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

/* Protocol emerald color */
const emerald = "#10b981";
const emeraldDim = "rgba(16,185,129,0.12)";

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
    <button
      onClick={handleCopy}
      title="Copy plan reference"
      className="flex items-center gap-[5px] px-2 h-[26px] rounded-md cursor-pointer transition-all duration-200 ease-in-out"
      style={{
        background: copied ? emeraldDim : "transparent",
        border: `1px solid ${copied ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.1)"}`,
      }}
      onMouseEnter={(e: any) => {
        if (!copied) {
          e.currentTarget.style.background = "rgba(255,255,255,0.05)";
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
        }
      }}
      onMouseLeave={(e: any) => {
        if (!copied) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
        }
      }}
    >
      {copied ? Ico.check(emerald, 10) : Ico.copy("rgba(255,255,255,0.4)", 10)}
      <span
        className="text-[11px] font-mono font-medium tracking-[0.01em]"
        style={{ color: copied ? emerald : "rgba(255,255,255,0.4)" }}
      >
        {copied ? "Copied" : "Ref"}
      </span>
    </button>
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
    <div className="h-[44px] bg-[rgba(24,24,27,0.8)] backdrop-blur-[16px] border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between px-4 shrink-0 z-10">
      {/* ---- Left: Title, count, CopyRef ---- */}
      <div className="flex items-center gap-[10px] min-w-0">
        <span className="text-[15px] font-semibold text-[#f4f4f5] overflow-hidden text-ellipsis whitespace-nowrap max-w-[240px] leading-none tracking-[-0.01em]">
          {planTitle}
        </span>

        <span className="text-[11px] text-[rgba(255,255,255,0.4)] font-mono font-medium bg-[rgba(255,255,255,0.06)] px-2 py-[3px] rounded-md leading-none shrink-0 tracking-[0.02em]">
          {plan.steps.length} card{plan.steps.length !== 1 ? "s" : ""}
        </span>

        <CopyRef planId={planId} />
      </div>

      {/* ---- Right: History, Export, View Toggle ---- */}
      <div className="flex items-center gap-2">
        {/* History toggle */}
        <button
          onClick={onToggleHistory}
          title="History"
          className="flex items-center justify-center p-0 h-7 w-7 rounded-md cursor-pointer transition-all duration-200 ease-in-out"
          style={{
            background: historyOpen ? emeraldDim : "transparent",
            border: `1px solid ${historyOpen ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.1)"}`,
          }}
          onMouseEnter={(e: any) => {
            if (!historyOpen) {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
            }
          }}
          onMouseLeave={(e: any) => {
            if (!historyOpen) {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
            }
          }}
        >
          {Ico.history(historyOpen ? emerald : "rgba(255,255,255,0.5)", 14)}
        </button>

        {/* Export dropdown */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExportOpen(!exportOpen);
            }}
            title="Export"
            className="flex items-center justify-center h-7 w-auto gap-1 px-[10px] rounded-md cursor-pointer transition-all duration-200 ease-in-out"
            style={{
              background: exportOpen ? emeraldDim : "transparent",
              border: `1px solid ${exportOpen ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.1)"}`,
            }}
            onMouseEnter={(e: any) => {
              if (!exportOpen) {
                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
              }
            }}
            onMouseLeave={(e: any) => {
              if (!exportOpen) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
              }
            }}
          >
            {Ico.export(exportOpen ? emerald : "rgba(255,255,255,0.5)", 13)}
            {Ico.chevron(exportOpen ? emerald : "rgba(255,255,255,0.35)", 10)}
          </button>

          {exportOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-[calc(100%+6px)] bg-[rgba(24,24,27,0.95)] backdrop-blur-[20px] border border-[rgba(255,255,255,0.08)] rounded-[10px] p-1 z-[100] min-w-[160px] shadow-[0_8px_30px_rgba(0,0,0,0.4),0_0_1px_rgba(255,255,255,0.1)]"
            >
              {/* SVG Export */}
              <button
                onClick={() => {
                  onExportSvg();
                  setExportOpen(false);
                }}
                className="w-full bg-none border-none cursor-pointer py-2 px-3 rounded-[7px] flex items-center gap-[10px] text-[13px] text-[#e4e4e7] font-sans whitespace-nowrap transition-[background] duration-150"
                onMouseEnter={(e: any) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                }}
                onMouseLeave={(e: any) => {
                  e.currentTarget.style.background = "none";
                }}
              >
                {Ico.svg(T.purple, 14)}
                <span>Export SVG</span>
                <span
                  className="ml-auto text-[10px] font-mono font-semibold px-[6px] py-[2px] rounded-[4px]"
                  style={{ color: T.purple, background: T.pD }}
                >
                  SVG
                </span>
              </button>

              {/* Separator */}
              <div className="h-px bg-[rgba(255,255,255,0.06)] mx-2 my-[2px]" />

              {/* JSON Export */}
              <button
                onClick={() => {
                  onExportJson();
                  setExportOpen(false);
                }}
                className="w-full bg-none border-none cursor-pointer py-2 px-3 rounded-[7px] flex items-center gap-[10px] text-[13px] text-[#e4e4e7] font-sans whitespace-nowrap transition-[background] duration-150"
                onMouseEnter={(e: any) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                }}
                onMouseLeave={(e: any) => {
                  e.currentTarget.style.background = "none";
                }}
              >
                {Ico.json(T.orange, 14)}
                <span>Export JSON</span>
                <span
                  className="ml-auto text-[10px] font-mono font-semibold px-[6px] py-[2px] rounded-[4px]"
                  style={{ color: T.orange, background: T.oD }}
                >
                  JSON
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-[18px] bg-[rgba(255,255,255,0.08)] ml-[2px] mr-[2px]" />

        {/* Flow / List segmented control */}
        <div className="flex items-center bg-[rgba(255,255,255,0.04)] rounded-lg border border-[rgba(255,255,255,0.08)] h-[30px] p-[2px] gap-[2px]">
          <button
            onClick={() => onViewModeChange("flow")}
            title="Flow view"
            className="border-none cursor-pointer flex items-center justify-center gap-[5px] h-full px-[10px] rounded-md transition-all duration-200 ease-in-out"
            style={{ background: viewMode === "flow" ? emerald : "transparent" }}
            onMouseEnter={(e: any) => {
              if (viewMode !== "flow") e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            }}
            onMouseLeave={(e: any) => {
              if (viewMode !== "flow") e.currentTarget.style.background = "transparent";
            }}
          >
            {Ico.flow(viewMode === "flow" ? "#fff" : "rgba(255,255,255,0.45)", 12)}
            <span
              className="text-[11px] font-medium font-sans tracking-[0.01em]"
              style={{ color: viewMode === "flow" ? "#fff" : "rgba(255,255,255,0.45)" }}
            >
              Flow
            </span>
          </button>
          <button
            onClick={() => onViewModeChange("list")}
            title="List view"
            className="border-none cursor-pointer flex items-center justify-center gap-[5px] h-full px-[10px] rounded-md transition-all duration-200 ease-in-out"
            style={{ background: viewMode === "list" ? emerald : "transparent" }}
            onMouseEnter={(e: any) => {
              if (viewMode !== "list") e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            }}
            onMouseLeave={(e: any) => {
              if (viewMode !== "list") e.currentTarget.style.background = "transparent";
            }}
          >
            {Ico.list(viewMode === "list" ? "#fff" : "rgba(255,255,255,0.45)", 12)}
            <span
              className="text-[11px] font-medium font-sans tracking-[0.01em]"
              style={{ color: viewMode === "list" ? "#fff" : "rgba(255,255,255,0.45)" }}
            >
              List
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default Toolbar;
