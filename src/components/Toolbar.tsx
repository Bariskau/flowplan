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
      style={{
        background: copied ? emeraldDim : "transparent",
        border: `1px solid ${copied ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.1)"}`,
        borderRadius: 6,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 8px",
        height: 26,
        transition: "all 0.2s ease",
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
        style={{
          fontSize: 11,
          color: copied ? emerald : "rgba(255,255,255,0.4)",
          fontFamily: T.m,
          fontWeight: 500,
          letterSpacing: "0.01em",
        }}
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

  /* Icon button base style */
  const iconBtn = (active: boolean): React.CSSProperties => ({
    background: active ? emeraldDim : "transparent",
    border: `1px solid ${active ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.1)"}`,
    borderRadius: 6,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    height: 28,
    width: 28,
    transition: "all 0.2s ease",
  });

  return (
    <div
      style={{
        height: 44,
        background: "rgba(24,24,27,0.8)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        flexShrink: 0,
        zIndex: 10,
      }}
    >
      {/* ---- Left: Title, count, CopyRef ---- */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <span
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "#f4f4f5",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: 240,
            lineHeight: 1,
            letterSpacing: "-0.01em",
          }}
        >
          {planTitle}
        </span>

        <span
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.4)",
            fontFamily: T.m,
            fontWeight: 500,
            background: "rgba(255,255,255,0.06)",
            padding: "3px 8px",
            borderRadius: 6,
            lineHeight: 1,
            flexShrink: 0,
            letterSpacing: "0.02em",
          }}
        >
          {plan.steps.length} card{plan.steps.length !== 1 ? "s" : ""}
        </span>

        <CopyRef planId={planId} />
      </div>

      {/* ---- Right: History, Export, View Toggle ---- */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* History toggle */}
        <button
          onClick={onToggleHistory}
          title="History"
          style={iconBtn(historyOpen)}
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
        <div style={{ position: "relative" }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExportOpen(!exportOpen);
            }}
            title="Export"
            style={{
              ...iconBtn(exportOpen),
              width: "auto",
              gap: 4,
              padding: "0 10px",
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
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 6px)",
                background: "rgba(24,24,27,0.95)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10,
                padding: 4,
                zIndex: 100,
                minWidth: 160,
                boxShadow: "0 8px 30px rgba(0,0,0,0.4), 0 0 1px rgba(255,255,255,0.1)",
              }}
            >
              {/* SVG Export */}
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
                  padding: "8px 12px",
                  borderRadius: 7,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 13,
                  color: "#e4e4e7",
                  fontFamily: T.f,
                  transition: "background 0.15s",
                  whiteSpace: "nowrap",
                }}
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
                  style={{
                    marginLeft: "auto",
                    fontSize: 10,
                    fontFamily: T.m,
                    fontWeight: 600,
                    color: T.purple,
                    background: T.pD,
                    padding: "2px 6px",
                    borderRadius: 4,
                  }}
                >
                  SVG
                </span>
              </button>

              {/* Separator */}
              <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "2px 8px" }} />

              {/* JSON Export */}
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
                  padding: "8px 12px",
                  borderRadius: 7,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 13,
                  color: "#e4e4e7",
                  fontFamily: T.f,
                  transition: "background 0.15s",
                  whiteSpace: "nowrap",
                }}
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
                  style={{
                    marginLeft: "auto",
                    fontSize: 10,
                    fontFamily: T.m,
                    fontWeight: 600,
                    color: T.orange,
                    background: T.oD,
                    padding: "2px 6px",
                    borderRadius: 4,
                  }}
                >
                  JSON
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.08)", marginLeft: 2, marginRight: 2 }} />

        {/* Flow / List segmented control */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "rgba(255,255,255,0.04)",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.08)",
            height: 30,
            padding: 2,
            gap: 2,
          }}
        >
          <button
            onClick={() => onViewModeChange("flow")}
            title="Flow view"
            style={{
              background: viewMode === "flow" ? emerald : "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              height: "100%",
              padding: "0 10px",
              borderRadius: 6,
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e: any) => {
              if (viewMode !== "flow") e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            }}
            onMouseLeave={(e: any) => {
              if (viewMode !== "flow") e.currentTarget.style.background = "transparent";
            }}
          >
            {Ico.flow(viewMode === "flow" ? "#fff" : "rgba(255,255,255,0.45)", 12)}
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: viewMode === "flow" ? "#fff" : "rgba(255,255,255,0.45)",
                fontFamily: T.f,
                letterSpacing: "0.01em",
              }}
            >
              Flow
            </span>
          </button>
          <button
            onClick={() => onViewModeChange("list")}
            title="List view"
            style={{
              background: viewMode === "list" ? emerald : "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              height: "100%",
              padding: "0 10px",
              borderRadius: 6,
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e: any) => {
              if (viewMode !== "list") e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            }}
            onMouseLeave={(e: any) => {
              if (viewMode !== "list") e.currentTarget.style.background = "transparent";
            }}
          >
            {Ico.list(viewMode === "list" ? "#fff" : "rgba(255,255,255,0.45)", 12)}
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: viewMode === "list" ? "#fff" : "rgba(255,255,255,0.45)",
                fontFamily: T.f,
                letterSpacing: "0.01em",
              }}
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
