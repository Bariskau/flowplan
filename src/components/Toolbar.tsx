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
  flow: (c: string, s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="5" height="5" rx="1" stroke={c} strokeWidth="1.3" />
      <rect x="10" y="1" width="5" height="5" rx="1" stroke={c} strokeWidth="1.3" />
      <rect x="5.5" y="10" width="5" height="5" rx="1" stroke={c} strokeWidth="1.3" />
      <path d="M3.5 6v2.5a1 1 0 001 1h3M12.5 6v2.5a1 1 0 01-1 1h-3" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  list: (c: string, s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M4 4h9M4 8h9M4 12h9" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="1.5" cy="4" r="0.8" fill={c} />
      <circle cx="1.5" cy="8" r="0.8" fill={c} />
      <circle cx="1.5" cy="12" r="0.8" fill={c} />
    </svg>
  ),
  history: (c: string, s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M2 8a6 6 0 1112 0A6 6 0 012 8z" stroke={c} strokeWidth="1.3" />
      <path d="M8 5v3.5l2.5 1.5" stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  export: (c: string, s = 12) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M8 2v8M4.5 7L8 10.5 11.5 7" stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 12h10" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  copy: (c: string, s = 11) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <rect x="5" y="5" width="8" height="8" rx="1.5" stroke={c} strokeWidth="1.3" />
      <path d="M3 11V3.5A1.5 1.5 0 014.5 2H11" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  check: (c: string, s = 11) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M3 8.5L6.5 12 13 4" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  chevron: (c: string, s = 8) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M5 6l3 3 3-3" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
    <button
      onClick={handleCopy}
      title="Copy plan reference"
      style={{
        background: copied ? T.gD : "rgba(255,255,255,0.04)",
        border: `0.5px solid ${copied ? T.green : "rgba(255,255,255,0.08)"}`,
        borderRadius: 4,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 6px",
        height: 20,
        transition: "all 0.15s",
      }}
      onMouseEnter={(e: any) => {
        if (!copied) {
          e.currentTarget.style.background = "rgba(255,255,255,0.08)";
          e.currentTarget.style.borderColor = T.border;
        }
      }}
      onMouseLeave={(e: any) => {
        if (!copied) {
          e.currentTarget.style.background = "rgba(255,255,255,0.04)";
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
        }
      }}
    >
      {copied ? Ico.check(T.green, 9) : Ico.copy(T.ter, 9)}
      <span style={{ fontSize: 9, color: copied ? T.green : T.ter, fontFamily: T.m, fontWeight: 500 }}>
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

  const btnBase: React.CSSProperties = {
    background: "none",
    border: `0.5px solid ${T.border}`,
    borderRadius: 5,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    height: 22,
    transition: "all 0.12s",
  };

  return (
    <div
      style={{
        height: 32,
        background: "rgba(20,20,20,0.75)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "0.5px solid rgba(255,255,255,0.06)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 12px",
        flexShrink: 0,
        zIndex: 10,
      }}
    >
      {/* ---- Left: Title, count, CopyRef ---- */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            color: T.text,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: 200,
            lineHeight: 1,
          }}
        >
          {planTitle}
        </span>
        <span
          style={{
            fontSize: 9,
            color: T.ter,
            fontFamily: T.m,
            fontWeight: 500,
            background: "rgba(255,255,255,0.04)",
            padding: "2px 6px",
            borderRadius: 4,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          {plan.steps.length} card{plan.steps.length !== 1 ? "s" : ""}
        </span>
        <CopyRef planId={planId} />
      </div>

      {/* ---- Right: History, Export, View Toggle ---- */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {/* History */}
        <button
          onClick={onToggleHistory}
          title="History"
          style={{
            ...btnBase,
            width: 22,
            background: historyOpen ? T.aD : "none",
            borderColor: historyOpen ? T.accent : T.border,
          }}
          onMouseEnter={(e: any) => {
            if (!historyOpen) {
              e.currentTarget.style.background = "rgba(255,255,255,0.08)";
              e.currentTarget.style.borderColor = T.accent;
            }
          }}
          onMouseLeave={(e: any) => {
            if (!historyOpen) {
              e.currentTarget.style.background = "none";
              e.currentTarget.style.borderColor = T.border;
            }
          }}
        >
          {Ico.history(historyOpen ? T.accent : T.sec, 12)}
        </button>

        {/* Export dropdown */}
        <div style={{ position: "relative" }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExportOpen(!exportOpen);
            }}
            title="Export"
            style={{
              ...btnBase,
              gap: 3,
              padding: "0 6px",
              background: exportOpen ? "rgba(255,255,255,0.08)" : "none",
              borderColor: exportOpen ? T.accent : T.border,
            }}
            onMouseEnter={(e: any) => {
              if (!exportOpen) {
                e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                e.currentTarget.style.borderColor = T.accent;
              }
            }}
            onMouseLeave={(e: any) => {
              if (!exportOpen) {
                e.currentTarget.style.background = "none";
                e.currentTarget.style.borderColor = T.border;
              }
            }}
          >
            {Ico.export(exportOpen ? T.accent : T.sec, 11)}
            {Ico.chevron(exportOpen ? T.accent : T.ter, 8)}
          </button>
          {exportOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                right: 0,
                top: "100%",
                marginTop: 4,
                background: T.raised,
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                padding: 4,
                zIndex: 100,
                minWidth: 130,
                boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
              }}
            >
              <button
                onClick={() => {
                  onExportSvg();
                  setExportOpen(false);
                }}
                style={{
                  width: "100%",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "6px 10px",
                  borderRadius: 5,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 11,
                  color: T.text,
                  fontFamily: T.f,
                  transition: "background 0.1s",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e: any) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                }}
                onMouseLeave={(e: any) => {
                  e.currentTarget.style.background = "none";
                }}
              >
                <span style={{ fontSize: 9, fontFamily: T.m, color: T.purple, fontWeight: 600 }}>SVG</span>
                <span>Export SVG</span>
              </button>
              <button
                onClick={() => {
                  onExportJson();
                  setExportOpen(false);
                }}
                style={{
                  width: "100%",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "6px 10px",
                  borderRadius: 5,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 11,
                  color: T.text,
                  fontFamily: T.f,
                  transition: "background 0.1s",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e: any) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                }}
                onMouseLeave={(e: any) => {
                  e.currentTarget.style.background = "none";
                }}
              >
                <span style={{ fontSize: 9, fontFamily: T.m, color: T.orange, fontWeight: 600 }}>JSON</span>
                <span>Export JSON</span>
              </button>
            </div>
          )}
        </div>

        {/* Flow / List toggle */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "rgba(255,255,255,0.04)",
            borderRadius: 6,
            border: `0.5px solid ${T.border}`,
            height: 22,
            overflow: "hidden",
          }}
        >
          <button
            onClick={() => onViewModeChange("flow")}
            title="Flow view"
            style={{
              background: viewMode === "flow" ? T.aD : "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: "100%",
              padding: 0,
              transition: "background 0.12s",
            }}
            onMouseEnter={(e: any) => {
              if (viewMode !== "flow") e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            }}
            onMouseLeave={(e: any) => {
              if (viewMode !== "flow") e.currentTarget.style.background = "transparent";
            }}
          >
            {Ico.flow(viewMode === "flow" ? T.accent : T.ter, 12)}
          </button>
          <div style={{ width: 0.5, height: 12, background: T.border }} />
          <button
            onClick={() => onViewModeChange("list")}
            title="List view"
            style={{
              background: viewMode === "list" ? T.aD : "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: "100%",
              padding: 0,
              transition: "background 0.12s",
            }}
            onMouseEnter={(e: any) => {
              if (viewMode !== "list") e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            }}
            onMouseLeave={(e: any) => {
              if (viewMode !== "list") e.currentTarget.style.background = "transparent";
            }}
          >
            {Ico.list(viewMode === "list" ? T.accent : T.ter, 12)}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Toolbar;
