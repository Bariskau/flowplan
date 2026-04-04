import { useEffect, useCallback, useState, useMemo, useRef } from "react";
import { XIcon as X, CopyIcon as Copy, CheckIcon as Check, FileCodeIcon as FileCode, FloppyDiskIcon as FloppyDisk } from "@phosphor-icons/react";
import type { FileChange } from "../types";
import { highlight } from "../lib/highlight";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";

interface CodeViewerProps {
  path: string;
  change: FileChange;
  onClose: () => void;
  onSave?: (path: string, content: string) => void | Promise<void>;
}

/* ---- Change type badge config ---- */
const changeTypeStyle: Record<string, { colorClass: string; bgClass: string; label: string }> = {
  create: { colorClass: "text-fp-success", bgClass: "bg-fp-success-dim", label: "CREATE" },
  created: { colorClass: "text-fp-success", bgClass: "bg-fp-success-dim", label: "CREATE" },
  add: { colorClass: "text-fp-success", bgClass: "bg-fp-success-dim", label: "ADD" },
  added: { colorClass: "text-fp-success", bgClass: "bg-fp-success-dim", label: "ADD" },
  modify: { colorClass: "text-fp-warning", bgClass: "bg-fp-warning-dim", label: "EDIT" },
  modified: { colorClass: "text-fp-warning", bgClass: "bg-fp-warning-dim", label: "EDIT" },
  delete: { colorClass: "text-fp-danger", bgClass: "bg-fp-danger-dim", label: "DELETE" },
  deleted: { colorClass: "text-fp-danger", bgClass: "bg-fp-danger-dim", label: "DELETE" },
  rename: { colorClass: "text-fp-purple", bgClass: "bg-fp-purple-dim", label: "RENAME" },
  renamed: { colorClass: "text-fp-purple", bgClass: "bg-fp-purple-dim", label: "RENAME" },
};

function getChangeStyle(changeType: string) {
  return (
    changeTypeStyle[changeType.toLowerCase()] ?? {
      colorClass: "text-fp-muted",
      bgClass: "bg-fp-glass-hover",
      label: changeType.toUpperCase(),
    }
  );
}

/* ============================================================
   CodeViewer — live syntax-highlighted editable code
   ============================================================ */
function CodeViewer({ path, change, onClose, onSave }: CodeViewerProps) {
  const [copied, setCopied] = useState(false);
  const [content, setContent] = useState(change.content);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const dirty = content !== change.content;

  useEffect(() => {
    setContent(change.content);
    setSaved(false);
    setSaving(false);
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
        scrollRef.current.scrollLeft = 0;
      }
      if (textareaRef.current) {
        textareaRef.current.scrollTop = 0;
        textareaRef.current.scrollLeft = 0;
      }
    });
  }, [path, change.content]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  /* Syntax highlighted HTML — updates live as you type */
  const highlightedHtml = useMemo(
    () => highlight(content, change.language || undefined),
    [content, change.language],
  );

  /* Sync scroll between textarea and highlighted pre */
  const handleScroll = useCallback(() => {
    if (scrollRef.current && textareaRef.current) {
      scrollRef.current.scrollTop = textareaRef.current.scrollTop;
      scrollRef.current.scrollLeft = 0;
      textareaRef.current.scrollLeft = 0;
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!onSave || !dirty || saving) return;
    setSaving(true);
    try {
      await onSave(path, content);
      setSaved(true);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => setSaved(false), 1500);
    } catch {
      setSaved(false);
    } finally {
      setSaving(false);
    }
  }, [onSave, path, content, dirty, saving]);

  /* Escape key + Ctrl/Cmd+S */
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === "s" && onSave) {
        e.preventDefault();
        void handleSave();
      }
    },
    [onClose, onSave, handleSave],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [content]);

  const cs = getChangeStyle(change.changeType);
  const langLabel = change.language ? change.language.toUpperCase() : "";
  const lines = content.split("\n");

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[1000] flex items-center justify-center animate-modal-overlay"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative border border-white/[0.08] rounded-xl max-w-[860px] w-[85%] min-h-[360px] h-[72vh] max-h-[820px] animate-modal-in flex flex-col overflow-hidden bg-[rgba(32,33,36,0.95)]"
      >
        {/* ---- Header ---- */}
        <div className="px-3 py-2.5 flex items-center justify-between border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <FileCode size={14} className="text-fp-dim shrink-0" />
            <span className={`text-[9px] font-bold font-mono py-[2px] px-1.5 rounded-fp-sm tracking-[0.06em] leading-none shrink-0 pt-1 ${cs.colorClass} ${cs.bgClass}`}>
              {cs.label}
            </span>
            <span className="text-fp-dim text-[10px] shrink-0">&middot;</span>
            <span className="font-mono text-[11px] text-fp-muted overflow-hidden text-ellipsis whitespace-nowrap min-w-0" title={path}>
              {path}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {langLabel && (
              <span className="pt-1 text-[9px] font-mono text-fp-dim bg-fp-glass py-[2px] px-1.5 rounded-fp-sm font-medium tracking-[0.03em] leading-none">
                {langLabel}
              </span>
            )}

            {onSave && (dirty || saved) && (
              <Button
                variant={saved ? "success" : "glassy"}
                size="sm"
                icon={saved ? <Check size={11} weight="bold" /> : <FloppyDisk size={11} weight="bold" />}
                onClick={() => void handleSave()}
                disabled={saved || saving}
              >
                {saved ? "Saved!" : saving ? "Saving..." : "Save"}
              </Button>
            )}

            <Button variant={copied ? "accent" : "ghost"} size="sm" icon={copied ? <Check size={11} weight="bold" /> : <Copy size={11} />} onClick={handleCopy}>
              {copied ? "Copied!" : "Copy"}
            </Button>
            <IconButton variant="ghost" size="sm" icon={<X size={12} />} label="Close (Esc)" onClick={onClose} />
          </div>
        </div>

        {/* ---- Content — highlighted code + overlay textarea ---- */}
        <div className="flex-1 overflow-hidden bg-fp-bg flex">
          {/* Line numbers gutter */}
          <div className="text-right py-4 px-2 text-fp-dim font-mono text-xs select-none shrink-0 leading-[24px] min-w-[48px] bg-fp-surface border-r border-white/[0.04] overflow-hidden">
            {lines.map((_, i) => (
              <div key={i} className="leading-[24px]">{i + 1}</div>
            ))}
          </div>

          {/* Code area — stacked pre (highlight) + textarea (input) */}
          <div className="flex-1 relative overflow-hidden">
            {/* Highlighted layer — visible, not interactive */}
            <div
              ref={scrollRef}
              className="absolute inset-0 overflow-y-auto overflow-x-hidden pointer-events-none"
              aria-hidden
            >
              <pre className="w-full py-4 px-4 m-0 font-mono text-[13px] leading-[24px] text-fp-text whitespace-pre-wrap break-words">
                <code dangerouslySetInnerHTML={{ __html: highlightedHtml + "\n" }} />
              </pre>
            </div>

            {/* Editable textarea — transparent text, synced scroll */}
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onScroll={handleScroll}
              className="absolute inset-0 w-full h-full py-4 px-4 font-mono text-[13px] leading-[24px] bg-transparent text-transparent caret-fp-text resize-none outline-none border-none whitespace-pre-wrap break-words overflow-y-auto overflow-x-hidden"
              style={{ caretColor: "var(--color-fp-text)" }}
              spellCheck={false}
              readOnly={!onSave}
              wrap="soft"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default CodeViewer;
