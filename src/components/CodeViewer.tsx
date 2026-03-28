import { useEffect, useMemo, useCallback, useState } from "react";
import { X, Copy, Check, FileCode } from "@phosphor-icons/react";
import type { FileChange } from "../types";
import { highlight } from "../lib/highlight";
import { Md } from "../lib/markdown";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";

interface CodeViewerProps {
  path: string;
  change: FileChange;
  onClose: () => void;
}

/* ---- Change type badge config ---- */
const changeTypeStyle: Record<string, { colorClass: string; bgClass: string; label: string }> = {
  create:   { colorClass: "text-fp-success",  bgClass: "bg-fp-success-dim",  label: "CREATE" },
  created:  { colorClass: "text-fp-success",  bgClass: "bg-fp-success-dim",  label: "CREATE" },
  add:      { colorClass: "text-fp-success",  bgClass: "bg-fp-success-dim",  label: "ADD" },
  added:    { colorClass: "text-fp-success",  bgClass: "bg-fp-success-dim",  label: "ADD" },
  modify:   { colorClass: "text-fp-warning",  bgClass: "bg-fp-warning-dim",  label: "EDIT" },
  modified: { colorClass: "text-fp-warning",  bgClass: "bg-fp-warning-dim",  label: "EDIT" },
  delete:   { colorClass: "text-fp-danger",   bgClass: "bg-fp-danger-dim",   label: "DELETE" },
  deleted:  { colorClass: "text-fp-danger",   bgClass: "bg-fp-danger-dim",   label: "DELETE" },
  rename:   { colorClass: "text-fp-purple",   bgClass: "bg-fp-purple-dim",   label: "RENAME" },
  renamed:  { colorClass: "text-fp-purple",   bgClass: "bg-fp-purple-dim",   label: "RENAME" },
};

function getChangeStyle(changeType: string) {
  return changeTypeStyle[changeType.toLowerCase()] ?? {
    colorClass: "text-fp-muted",
    bgClass: "bg-fp-glass-hover",
    label: changeType.toUpperCase(),
  };
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

/* ============================================================
   CodeViewer
   ============================================================ */
function CodeViewer({ path, change, onClose }: CodeViewerProps) {
  const [copied, setCopied] = useState(false);

  /* Escape key */
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
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
  const cs = getChangeStyle(change.changeType);
  const langLabel = change.language ? change.language.toUpperCase() : "";

  return (
    /* ---- Overlay ---- */
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center animate-fade-in"
    >
      {/* ---- Modal Panel ---- */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-fp-solid border border-fp-border rounded-fp-xl max-w-[900px] w-[85%] max-h-[85vh] animate-slide-up shadow-2xl flex flex-col overflow-hidden"
      >
        {/* ---- Header ---- */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-fp-border shrink-0">
          {/* Left: file icon + change badge + file path */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <FileCode size={16} className="text-fp-dim shrink-0" />

            {/* Change type pill */}
            <span
              className={`text-[10px] font-bold font-mono py-[3px] px-2 rounded-fp-sm tracking-[0.06em] leading-none shrink-0 ${cs.colorClass} ${cs.bgClass}`}
            >
              {cs.label}
            </span>

            <span className="text-fp-dim text-[11px] shrink-0">&middot;</span>

            {/* File path */}
            <span
              className="font-mono text-xs text-fp-muted overflow-hidden text-ellipsis whitespace-nowrap min-w-0"
              title={path}
            >
              {path}
            </span>
          </div>

          {/* Right: language badge + copy + close */}
          <div className="flex items-center gap-2 shrink-0 ml-3">
            {/* Language badge */}
            {langLabel && (
              <span className="text-[10px] font-mono text-fp-dim bg-fp-glass py-[3px] px-2 rounded-fp-sm font-medium tracking-[0.03em] leading-none">
                {langLabel}
              </span>
            )}

            {/* Copy button */}
            <Button
              variant={copied ? "accent" : "ghost"}
              size="sm"
              icon={copied ? <Check size={13} weight="bold" /> : <Copy size={13} />}
              onClick={handleCopy}
            >
              {copied ? "Copied!" : "Copy"}
            </Button>

            {/* Close button */}
            <IconButton
              variant="ghost"
              size="md"
              icon={<X size={14} />}
              label="Close (Esc)"
              onClick={onClose}
            />
          </div>
        </div>

        {/* ---- Content Area ---- */}
        <div className="flex-1 overflow-auto bg-fp-bg">
          {isMarkdown ? (
            /* ---- Markdown Mode ---- */
            <div className="py-6 px-8">
              <Md text={change.content} fontSize={14} color="#a1a1aa" lineHeight={1.8} />
            </div>
          ) : isDiff && diffLines ? (
            /* ---- Diff Mode ---- */
            <div className="font-mono text-[13px] leading-[24px]">
              {diffLines.map((dl, i) => (
                <div
                  key={i}
                  className={`flex min-h-[24px] ${
                    dl.type === "add"
                      ? "bg-fp-success-dim"
                      : dl.type === "remove"
                        ? "bg-fp-danger-dim"
                        : dl.type === "hunk"
                          ? "bg-fp-purple-dim"
                          : ""
                  }`}
                  style={{
                    borderLeft: `2px solid ${
                      dl.type === "add"
                        ? "var(--color-fp-success)"
                        : dl.type === "remove"
                          ? "var(--color-fp-danger)"
                          : dl.type === "hunk"
                            ? "var(--color-fp-purple)"
                            : "transparent"
                    }`,
                  }}
                >
                  {/* Line number gutter */}
                  <div
                    className={`w-14 text-right pr-3 text-[11px] select-none shrink-0 font-mono leading-[24px] text-fp-dim ${
                      dl.type === "hunk" ? "text-fp-purple" : ""
                    }`}
                    style={{ opacity: dl.lineNum != null ? 1 : 0.5 }}
                  >
                    {dl.lineNum ?? ""}
                  </div>

                  {/* Diff marker */}
                  <div
                    className={`w-5 text-center font-bold select-none shrink-0 leading-[24px] text-xs ${
                      dl.type === "add"
                        ? "text-fp-success"
                        : dl.type === "remove"
                          ? "text-fp-danger"
                          : dl.type === "hunk"
                            ? "text-fp-purple"
                            : "text-fp-muted"
                    }`}
                  >
                    {dl.type === "add" ? "+" : dl.type === "remove" ? "\u2212" : dl.type === "hunk" ? "@@" : ""}
                  </div>

                  {/* Code content */}
                  <div
                    className={`flex-1 pr-4 pl-2 whitespace-pre-wrap break-all leading-[24px] ${
                      dl.type === "add"
                        ? "text-fp-success"
                        : dl.type === "remove"
                          ? "text-fp-danger"
                          : dl.type === "hunk"
                            ? "text-fp-purple italic"
                            : "text-white/80"
                    }`}
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
              <div className="text-right p-4 text-fp-dim font-mono text-xs select-none border-r border-fp-border shrink-0 leading-[24px] min-w-[56px] bg-fp-surface">
                {change.content.split("\n").map((_, i) => (
                  <div key={i} className="leading-[24px]">
                    {i + 1}
                  </div>
                ))}
              </div>

              {/* Code content */}
              <pre className="m-0 py-4 px-5 flex-1 overflow-auto whitespace-pre-wrap break-all text-fp-text font-mono text-[13px] leading-[24px]">
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
