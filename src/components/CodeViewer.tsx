import { useEffect, useMemo, useCallback } from "react";
import type { FileChange } from "../types";
import { T } from "../lib/theme";
import { highlight } from "../lib/highlight";
import { Md } from "../lib/markdown";

interface CodeViewerProps {
  path: string;
  change: FileChange;
  onClose: () => void;
}

/* ---- Inline SVG Icons ---- */
const Ico = {
  close: (c: string, s = 14) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M4 4l8 8M12 4l-8 8" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  file: (c: string, s = 13) => (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M4.5 2h5l3 3v8.5a1 1 0 01-1 1h-7a1 1 0 01-1-1v-10.5a1 1 0 011-1z" stroke={c} strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M9.5 2v3h3" stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

/* ---- Change type badge colors ---- */
const changeTypeStyle: Record<string, { color: string; bg: string; label: string }> = {
  create: { color: T.green, bg: T.gD, label: "Created" },
  created: { color: T.green, bg: T.gD, label: "Created" },
  modify: { color: T.orange, bg: T.oD, label: "Modified" },
  modified: { color: T.orange, bg: T.oD, label: "Modified" },
  delete: { color: T.red, bg: T.rD, label: "Deleted" },
  deleted: { color: T.red, bg: T.rD, label: "Deleted" },
  rename: { color: T.purple, bg: T.pD, label: "Renamed" },
  renamed: { color: T.purple, bg: T.pD, label: "Renamed" },
  add: { color: T.green, bg: T.gD, label: "Added" },
  added: { color: T.green, bg: T.gD, label: "Added" },
};

function getChangeStyle(changeType: string) {
  return changeTypeStyle[changeType.toLowerCase()] || { color: T.sec, bg: "rgba(255,255,255,0.06)", label: changeType };
}

/* ---- Detect if content looks like markdown ---- */
function isMarkdownContent(content: string, language: string): boolean {
  if (language === "markdown" || language === "md") return true;
  const mdSignals = [/^#{1,6}\s+/m, /^\s*[-*+]\s+/m, /\[.*?\]\(.*?\)/, /```/, /^\s*>\s+/m, /\*\*.*?\*\*/];
  let score = 0;
  for (const re of mdSignals) {
    if (re.test(content)) score++;
  }
  return score >= 3;
}

/* ---- Parse diff lines for highlighting ---- */
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
      /* Extract line number from hunk header */
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

/* ---- CodeViewer ---- */
function CodeViewer({ path, change, onClose }: CodeViewerProps) {
  /* Escape key to close */
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  /* Determine rendering mode */
  const isMarkdown = useMemo(() => isMarkdownContent(change.content, change.language), [change.content, change.language]);
  const isDiff = useMemo(() => isDiffContent(change.content), [change.content]);
  const diffLines = useMemo(() => (isDiff ? parseDiffLines(change.content) : null), [isDiff, change.content]);

  /* Syntax-highlighted HTML for code mode */
  const highlightedHtml = useMemo(() => {
    if (isMarkdown || isDiff) return "";
    return highlight(change.content, change.language);
  }, [change.content, change.language, isMarkdown, isDiff]);

  /* Extract filename from path */
  const filename = path.split("/").pop() || path;
  const cs = getChangeStyle(change.changeType);

  /* Diff line background colors */
  const diffBg: Record<string, string> = {
    add: "rgba(48,209,88,0.08)",
    remove: "rgba(255,69,58,0.08)",
    hunk: "rgba(191,90,242,0.06)",
    normal: "transparent",
  };
  const diffBorder: Record<string, string> = {
    add: T.green,
    remove: T.red,
    hunk: T.purple,
    normal: "transparent",
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "85vw",
          maxWidth: 900,
          height: "85vh",
          background: T.bg,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
        }}
      >
        {/* ---- Header ---- */}
        <div
          style={{
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: `1px solid ${T.border}`,
            background: "rgba(20,20,20,0.6)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            {Ico.file(T.sec, 14)}
            <span
              style={{
                fontSize: 12,
                fontFamily: T.m,
                color: T.text,
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={path}
            >
              {filename}
            </span>
            <span
              style={{
                fontSize: 10,
                color: T.ter,
                fontFamily: T.m,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 300,
              }}
              title={path}
            >
              {path !== filename ? path : ""}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {/* Change type badge */}
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                fontFamily: T.m,
                color: cs.color,
                background: cs.bg,
                padding: "2px 7px",
                borderRadius: 4,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {cs.label}
            </span>
            {/* Language badge */}
            {change.language && (
              <span
                style={{
                  fontSize: 9,
                  fontFamily: T.m,
                  color: T.sec,
                  background: "rgba(255,255,255,0.06)",
                  padding: "2px 7px",
                  borderRadius: 4,
                  fontWeight: 500,
                }}
              >
                {change.language}
              </span>
            )}
            {/* Close button */}
            <button
              onClick={onClose}
              title="Close (Esc)"
              style={{
                background: "none",
                border: `0.5px solid ${T.border}`,
                borderRadius: 5,
                cursor: "pointer",
                width: 24,
                height: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                marginLeft: 4,
                transition: "all 0.12s",
              }}
              onMouseEnter={(e: any) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                e.currentTarget.style.borderColor = T.accent;
              }}
              onMouseLeave={(e: any) => {
                e.currentTarget.style.background = "none";
                e.currentTarget.style.borderColor = T.border;
              }}
            >
              {Ico.close(T.sec, 12)}
            </button>
          </div>
        </div>

        {/* ---- Content ---- */}
        <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
          {isMarkdown ? (
            /* ---- Markdown Mode ---- */
            <div style={{ padding: "16px 24px" }}>
              <Md text={change.content} fontSize={13} color={T.sec} lineHeight={1.8} />
            </div>
          ) : isDiff && diffLines ? (
            /* ---- Diff Mode ---- */
            <div style={{ fontFamily: T.m, fontSize: 11.5, lineHeight: 1.7 }}>
              {diffLines.map((dl, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    background: diffBg[dl.type],
                    borderLeft: `2px solid ${diffBorder[dl.type]}`,
                    minHeight: 20,
                  }}
                >
                  {/* Line number gutter */}
                  <div
                    style={{
                      width: 50,
                      textAlign: "right",
                      padding: "0 8px",
                      color: dl.type === "hunk" ? T.purple : T.ter,
                      fontSize: 10,
                      userSelect: "none",
                      flexShrink: 0,
                      fontFamily: T.m,
                      opacity: dl.lineNum != null ? 1 : 0.4,
                    }}
                  >
                    {dl.lineNum ?? ""}
                  </div>
                  {/* Diff marker */}
                  <div
                    style={{
                      width: 16,
                      textAlign: "center",
                      color:
                        dl.type === "add"
                          ? T.green
                          : dl.type === "remove"
                          ? T.red
                          : dl.type === "hunk"
                          ? T.purple
                          : "transparent",
                      fontWeight: 700,
                      userSelect: "none",
                      flexShrink: 0,
                    }}
                  >
                    {dl.type === "add" ? "+" : dl.type === "remove" ? "-" : dl.type === "hunk" ? "@@" : ""}
                  </div>
                  {/* Code content */}
                  <div
                    style={{
                      flex: 1,
                      padding: "0 12px 0 4px",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                      color:
                        dl.type === "add"
                          ? T.green
                          : dl.type === "remove"
                          ? T.red
                          : dl.type === "hunk"
                          ? T.purple
                          : T.text,
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
            <div style={{ display: "flex", fontFamily: T.m, fontSize: 11.5, lineHeight: 1.7 }}>
              {/* Line numbers gutter */}
              <div
                style={{
                  textAlign: "right",
                  padding: "12px 8px 12px 12px",
                  color: T.ter,
                  fontSize: 10,
                  userSelect: "none",
                  borderRight: `1px solid ${T.border}`,
                  flexShrink: 0,
                  fontFamily: T.m,
                  background: "rgba(255,255,255,0.015)",
                }}
              >
                {change.content.split("\n").map((_, i) => (
                  <div key={i} style={{ lineHeight: 1.7 }}>
                    {i + 1}
                  </div>
                ))}
              </div>
              {/* Code content */}
              <pre
                style={{
                  margin: 0,
                  padding: "12px 16px",
                  flex: 1,
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  color: T.text,
                  fontFamily: T.m,
                  fontSize: 11.5,
                  lineHeight: 1.7,
                }}
              >
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
