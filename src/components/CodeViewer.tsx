import { useEffect, useMemo, useCallback, useState } from "react";
import type { FileChange } from "../types";
import { T } from "../lib/theme";
import { highlight } from "../lib/highlight";
import { Md } from "../lib/markdown";

interface CodeViewerProps {
  path: string;
  change: FileChange;
  onClose: () => void;
}

/* ---- Protocol-style color tokens ---- */
const P = {
  // Surfaces
  panelBg: "rgba(24,24,27,0.92)",
  codeBg: "#111113",
  headerBg: "rgba(255,255,255,0.03)",
  // Borders
  ring: "rgba(255,255,255,0.08)",
  ringHover: "rgba(255,255,255,0.14)",
  separator: "rgba(255,255,255,0.06)",
  // Text
  white: "#fff",
  muted: "#a1a1aa",
  dimmed: "#71717a",
  ghost: "#52525b",
  // Accents (Protocol uses emerald for primary)
  emerald: "#10b981",
  emeraldDim: "rgba(16,185,129,0.12)",
  amber: "#f59e0b",
  amberDim: "rgba(245,158,11,0.12)",
  rose: "#f43f5e",
  roseDim: "rgba(244,63,94,0.10)",
  violet: "#a78bfa",
  violetDim: "rgba(167,139,250,0.10)",
  sky: "#38bdf8",
  skyDim: "rgba(56,189,248,0.10)",
  // Diff
  addBg: "rgba(16,185,129,0.07)",
  addBorder: "#10b981",
  addText: "#6ee7b7",
  removeBg: "rgba(244,63,94,0.07)",
  removeBorder: "#f43f5e",
  removeText: "#fda4af",
  hunkBg: "rgba(167,139,250,0.06)",
  hunkBorder: "#a78bfa",
  hunkText: "#c4b5fd",
};

/* ---- Inline SVG Icons ---- */
const Ico = {
  close: (c: string, s = 16) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M4 4l8 8M12 4l-8 8" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  file: (c: string, s = 14) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M4.5 2h5l3 3v8.5a1 1 0 01-1 1h-7a1 1 0 01-1-1v-10.5a1 1 0 011-1z" stroke={c} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M9.5 2v3h3" stroke={c} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  copy: (c: string, s = 14) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <rect x="5" y="5" width="8" height="8" rx="1.5" stroke={c} strokeWidth="1.2" />
      <path d="M3 11V3.5A1.5 1.5 0 014.5 2H10" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  check: (c: string, s = 14) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M3.5 8.5l3 3 6-7" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

/* ---- Change type badge config (Protocol method-pill style) ---- */
const changeTypeStyle: Record<string, { color: string; bg: string; label: string }> = {
  create:   { color: P.emerald, bg: P.emeraldDim, label: "CREATE" },
  created:  { color: P.emerald, bg: P.emeraldDim, label: "CREATE" },
  add:      { color: P.emerald, bg: P.emeraldDim, label: "ADD" },
  added:    { color: P.emerald, bg: P.emeraldDim, label: "ADD" },
  modify:   { color: P.amber,   bg: P.amberDim,   label: "EDIT" },
  modified: { color: P.amber,   bg: P.amberDim,   label: "EDIT" },
  delete:   { color: P.rose,    bg: P.roseDim,     label: "DELETE" },
  deleted:  { color: P.rose,    bg: P.roseDim,     label: "DELETE" },
  rename:   { color: P.violet,  bg: P.violetDim,   label: "RENAME" },
  renamed:  { color: P.violet,  bg: P.violetDim,   label: "RENAME" },
};

function getChangeStyle(changeType: string) {
  return changeTypeStyle[changeType.toLowerCase()] ?? { color: P.muted, bg: "rgba(255,255,255,0.05)", label: changeType.toUpperCase() };
}

/* ---- Detect markdown content ---- */
function isMarkdownContent(content: string, language: string): boolean {
  if (language === "markdown" || language === "md") return true;
  const mdSignals = [/^#{1,6}\s+/m, /^\s*[-*+]\s+/m, /\[.*?\]\(.*?\)/, /```/, /^\s*>\s+/m, /\*\*.*?\*\*/];
  let score = 0;
  for (const re of mdSignals) {
    if (re.test(content)) score++;
  }
  return score >= 3;
}

/* ---- Parse diff lines ---- */
interface DiffLine {
  type: "add" | "remove" | "hunk" | "normal";
  text: string;
  lineNum: number | null;
}

function parseDiffLines(content: string): DiffLine[] {
  const lines = content.split("\n");
  const result: DiffLine[] = [];
  let lineNum = 0;

  for (const line of lines) {
    if (line.startsWith("@@")) {
      result.push({ type: "hunk", text: line, lineNum: null });
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)/);
      if (match) lineNum = parseInt(match[1], 10) - 1;
    } else if (line.startsWith("+")) {
      lineNum++;
      result.push({ type: "add", text: line.substring(1), lineNum });
    } else if (line.startsWith("-")) {
      result.push({ type: "remove", text: line.substring(1), lineNum: null });
    } else {
      lineNum++;
      result.push({ type: "normal", text: line.startsWith(" ") ? line.substring(1) : line, lineNum });
    }
  }
  return result;
}

/* ---- Check if content is a diff ---- */
function isDiffContent(content: string): boolean {
  const lines = content.split("\n");
  let diffLineCount = 0;
  for (const line of lines) {
    if (line.startsWith("+") || line.startsWith("-") || line.startsWith("@@")) {
      diffLineCount++;
    }
  }
  return diffLineCount > lines.length * 0.15;
}

/* ---- Keyframes for modal animation ---- */
const animId = "cv-anim-" + Math.random().toString(36).slice(2, 8);
if (typeof document !== "undefined" && !document.getElementById(animId)) {
  const style = document.createElement("style");
  style.id = animId;
  style.textContent = `
    @keyframes cv-overlay-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes cv-panel-in { from { opacity: 0; transform: scale(0.97) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
    @keyframes cv-overlay-out { from { opacity: 1; } to { opacity: 0; } }
    @keyframes cv-panel-out { from { opacity: 1; transform: scale(1) translateY(0); } to { opacity: 0; transform: scale(0.97) translateY(8px); } }
  `;
  document.head.appendChild(style);
}

/* ============================================================
   CodeViewer -- Protocol design language
   ============================================================ */
function CodeViewer({ path, change, onClose }: CodeViewerProps) {
  const [copied, setCopied] = useState(false);
  const [closing, setClosing] = useState(false);

  /* Animated close */
  const startClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 160);
  }, [onClose]);

  /* Escape key */
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") startClose();
    },
    [startClose],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  /* Copy to clipboard */
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(change.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [change.content]);

  /* Rendering mode */
  const isMarkdown = useMemo(() => isMarkdownContent(change.content, change.language), [change.content, change.language]);
  const isDiff = useMemo(() => isDiffContent(change.content), [change.content]);
  const diffLines = useMemo(() => (isDiff ? parseDiffLines(change.content) : null), [isDiff, change.content]);

  /* Syntax highlighted HTML */
  const highlightedHtml = useMemo(() => {
    if (isMarkdown || isDiff) return "";
    return highlight(change.content, change.language);
  }, [change.content, change.language, isMarkdown, isDiff]);

  /* Derived values */
  const filename = path.split("/").pop() || path;
  const cs = getChangeStyle(change.changeType);
  const langLabel = change.language ? change.language.toUpperCase() : "";

  /* Diff line styling maps */
  const diffLineBg: Record<string, string> = {
    add: P.addBg,
    remove: P.removeBg,
    hunk: P.hunkBg,
    normal: "transparent",
  };
  const diffLineBorder: Record<string, string> = {
    add: P.addBorder,
    remove: P.removeBorder,
    hunk: P.hunkBorder,
    normal: "transparent",
  };
  const diffLineColor: Record<string, string> = {
    add: P.addText,
    remove: P.removeText,
    hunk: P.hunkText,
    normal: "rgba(255,255,255,0.8)",
  };

  return (
    /* ---- Overlay ---- */
    <div
      onClick={startClose}
      className="fixed inset-0 bg-[rgba(0,0,0,0.6)] backdrop-blur-[12px] flex items-center justify-center z-[1000]"
      style={{
        animation: closing ? "cv-overlay-out 160ms ease-in forwards" : "cv-overlay-in 200ms ease-out",
      }}
    >
      {/* ---- Modal Panel ---- */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[88vw] max-w-[940px] h-[86vh] bg-[rgba(24,24,27,0.92)] backdrop-blur-[24px] rounded-2xl border border-[rgba(255,255,255,0.08)] shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_64px_rgba(0,0,0,0.5),0_8px_20px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden"
        style={{
          animation: closing ? "cv-panel-out 160ms ease-in forwards" : "cv-panel-in 250ms cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        {/* ---- Header ---- */}
        <div className="px-5 h-12 flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] shrink-0">
          {/* Left: file path + change badge */}
          <div className="flex items-center gap-[10px] min-w-0 flex-1">
            {/* Change type pill (Protocol method badge style) */}
            <span
              className="text-[10px] font-bold font-mono py-[3px] px-2 rounded-md tracking-[0.06em] leading-none shrink-0"
              style={{ color: cs.color, background: cs.bg }}
            >
              {cs.label}
            </span>

            {/* Dot separator */}
            <span className="text-[#52525b] text-[11px] shrink-0">·</span>

            {/* File path in monospace (like Protocol endpoint path) */}
            <span
              className="text-[12.5px] font-mono text-[#a1a1aa] overflow-hidden text-ellipsis whitespace-nowrap min-w-0"
              title={path}
            >
              {path}
            </span>
          </div>

          {/* Right: language badge + copy + close */}
          <div className="flex items-center gap-2 shrink-0 ml-3">
            {/* Language badge */}
            {langLabel && (
              <span className="text-[10px] font-mono text-[#71717a] bg-[rgba(255,255,255,0.05)] py-[3px] px-2 rounded-md font-medium tracking-[0.03em] leading-none">
                {langLabel}
              </span>
            )}

            {/* Copy button (Protocol-style: icon + text, pill-shaped) */}
            <button
              onClick={handleCopy}
              title="Copy to clipboard"
              className="flex items-center gap-[5px] rounded-full py-1 pl-2 pr-3 cursor-pointer transition-all duration-150 ease-in-out text-xs font-mono font-medium leading-none"
              style={{
                background: copied ? P.emeraldDim : "rgba(255,255,255,0.025)",
                border: `1px solid ${copied ? "rgba(16,185,129,0.25)" : P.ring}`,
                color: copied ? P.emerald : P.muted,
              }}
              onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                if (!copied) {
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                  e.currentTarget.style.borderColor = P.ringHover;
                  e.currentTarget.style.color = P.white;
                }
              }}
              onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                if (!copied) {
                  e.currentTarget.style.background = "rgba(255,255,255,0.025)";
                  e.currentTarget.style.borderColor = P.ring;
                  e.currentTarget.style.color = P.muted;
                }
              }}
            >
              {copied ? Ico.check(P.emerald, 13) : Ico.copy(P.muted, 13)}
              <span>{copied ? "Copied!" : "Copy"}</span>
            </button>

            {/* Close button */}
            <button
              onClick={startClose}
              title="Close (Esc)"
              className="bg-transparent border-none rounded-lg cursor-pointer w-7 h-7 flex items-center justify-center p-0 transition-all duration-[120ms] ease-in-out text-[#71717a]"
              onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                (e.currentTarget.firstChild as any)?.querySelector?.("path")?.setAttribute?.("stroke", P.white);
              }}
              onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                e.currentTarget.style.background = "transparent";
                (e.currentTarget.firstChild as any)?.querySelector?.("path")?.setAttribute?.("stroke", P.dimmed);
              }}
            >
              {Ico.close(P.dimmed, 14)}
            </button>
          </div>
        </div>

        {/* ---- Content Area ---- */}
        <div className="flex-1 overflow-auto bg-[#111113]">
          {isMarkdown ? (
            /* ---- Markdown Mode ---- */
            <div className="py-6 px-8">
              <Md text={change.content} fontSize={14} color={P.muted} lineHeight={1.8} />
            </div>
          ) : isDiff && diffLines ? (
            /* ---- Diff Mode ---- */
            <div className="font-mono text-[13px] leading-[24px]">
              {diffLines.map((dl, i) => (
                <div
                  key={i}
                  className="flex min-h-[24px]"
                  style={{
                    background: diffLineBg[dl.type],
                    borderLeft: `2px solid ${diffLineBorder[dl.type]}`,
                  }}
                >
                  {/* Line number gutter */}
                  <div
                    className="w-14 text-right pr-3 text-[11px] select-none shrink-0 font-mono leading-[24px]"
                    style={{
                      color: dl.type === "hunk" ? P.hunkText : P.ghost,
                      opacity: dl.lineNum != null ? 1 : 0.5,
                    }}
                  >
                    {dl.lineNum ?? ""}
                  </div>

                  {/* Diff marker */}
                  <div
                    className="w-5 text-center font-bold select-none shrink-0 leading-[24px] text-xs"
                    style={{ color: diffLineColor[dl.type] }}
                  >
                    {dl.type === "add" ? "+" : dl.type === "remove" ? "\u2212" : dl.type === "hunk" ? "@@" : ""}
                  </div>

                  {/* Code content */}
                  <div
                    className="flex-1 pr-4 pl-2 whitespace-pre-wrap break-all leading-[24px]"
                    style={{
                      color: diffLineColor[dl.type],
                      fontStyle: dl.type === "hunk" ? "italic" : "normal",
                    }}
                  >
                    {dl.text}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ---- Code Mode with line numbers ---- */
            <div className="flex font-mono text-[13px] leading-[24px]">
              {/* Line numbers gutter */}
              <div className="text-right p-4 pr-4 pl-4 text-[#52525b] text-xs select-none border-r border-[rgba(255,255,255,0.06)] shrink-0 font-mono leading-[24px] min-w-[56px] bg-[rgba(255,255,255,0.01)]">
                {change.content.split("\n").map((_, i) => (
                  <div key={i} className="leading-[24px]">
                    {i + 1}
                  </div>
                ))}
              </div>

              {/* Code content */}
              <pre className="m-0 py-4 px-5 flex-1 overflow-auto whitespace-pre-wrap break-all text-white font-mono text-[13px] leading-[24px]">
                <code dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CodeViewer;
