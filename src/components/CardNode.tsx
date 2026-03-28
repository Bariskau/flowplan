import React, { useState, useCallback, useEffect, useRef } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { TC } from "../lib/theme";
import { Md } from "../lib/markdown";
import type { Card, FileChange } from "../types";
import {
  Folders,
  File,
  Copy,
  MagnifyingGlass,
  Compass,
  Plus,
  PencilSimple,
  Flask,
} from "@phosphor-icons/react";

export const CW = 280;
export const CH = 150;

const TYPE_ICON: Record<string, React.ElementType> = {
  research: MagnifyingGlass,
  planning: Compass,
  create: Plus,
  edit: PencilSimple,
  test: Flask,
};

export interface CardNodeData {
  card: Card;
  feedbackCount: number;
  feedbackTypes: string[];
  planTitle: string;
  planId: string;
  onFileClick: (path: string, change: FileChange) => void;
  onEdit?: (cardId: string) => void;
  onDelete?: (cardId: string) => void;
  highlight?: "added" | "modified" | null;
}

/* ---- CopyRef button ---- */
function CopyRef({ card, planTitle }: { card: Card; planTitle: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const ref = `[${planTitle} / ${card.title}] (${card.type}#${card.id})`;
      navigator.clipboard.writeText(ref).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    },
    [card, planTitle],
  );

  return (
    <button
      onClick={handleCopy}
      title="Copy reference"
      className={`bg-transparent border-none cursor-pointer px-1 py-0.5 rounded leading-none transition-all duration-200 flex items-center
        ${copied ? "text-fp-accent opacity-100" : "text-fp-dim opacity-60 hover:opacity-100"}`}
    >
      {copied ? (
        <span className="font-mono text-[11px]">{"\u2713"}</span>
      ) : (
        <Copy size={12} weight="bold" />
      )}
    </button>
  );
}

/* ---- File change indicator dot ---- */
function ChangeDot({ changeType }: { changeType?: string }) {
  return (
    <span
      className={`inline-block w-1 h-1 rounded-full mr-[3px] shrink-0 ${
        changeType === "create"
          ? "bg-fp-success"
          : changeType === "delete"
            ? "bg-fp-danger"
            : "bg-fp-orange"
      }`}
    />
  );
}

/* ---- Context menu ---- */
function ContextMenu({
  x,
  y,
  onEdit,
  onDelete,
  onClose,
}: {
  x: number;
  y: number;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-[9999] min-w-[140px] fp-glass border border-fp-border rounded-fp-lg p-1 shadow-[0_8px_30px_rgba(0,0,0,0.4)] animate-fade-in"
      style={{ left: x, top: y }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
          onClose();
        }}
        className="w-full bg-transparent border-none cursor-pointer py-2 px-3 rounded-fp-sm flex items-center gap-2.5 text-[13px] font-sans whitespace-nowrap transition-colors duration-150 text-fp-text hover:bg-fp-glass-hover"
      >
        <PencilSimple size={14} className="shrink-0 text-fp-muted" />
        <span>Edit</span>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
          onClose();
        }}
        className="w-full bg-transparent border-none cursor-pointer py-2 px-3 rounded-fp-sm flex items-center gap-2.5 text-[13px] font-sans whitespace-nowrap transition-colors duration-150 text-fp-danger hover:bg-fp-danger-dim"
      >
        <File size={14} className="shrink-0" />
        <span>Delete</span>
      </button>
    </div>
  );
}

/* ---- Main node ---- */
function CardNode({ data, selected }: NodeProps & { data: CardNodeData }) {
  const { card, feedbackCount, feedbackTypes, planTitle, onFileClick, onEdit, onDelete, highlight } = data;
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);

  const tc = TC[card.type] || { l: card.type, c: "#10b981", bg: "rgba(16,185,129,0.10)" };
  const TypeIcon = TYPE_ICON[card.type];

  const highlightColor =
    highlight === "added"
      ? "var(--color-fp-success)"
      : highlight === "modified"
        ? "var(--color-fp-orange)"
        : null;

  const descTruncated =
    card.description && card.description.length > 300
      ? card.description.slice(0, 300) + "\u2026"
      : card.description || "";

  const visibleFiles = card.files.slice(0, 3);
  const extraCount = card.files.length - 3;

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (onEdit || onDelete) {
        setCtxMenu({ x: e.clientX, y: e.clientY });
      }
    },
    [onEdit, onDelete],
  );

  return (
    <>
      <div
        onContextMenu={handleContextMenu}
        className={`fp-glass-card border rounded-fp-lg flex flex-col gap-2 p-3.5 cursor-grab relative transition-all duration-200
          ${selected
            ? "border-fp-border-hover shadow-[0_0_0_1px_rgba(255,255,255,0.1)]"
            : highlightColor
              ? "border-fp-border"
              : "border-fp-border"
          }`}
        style={{
          width: CW,
          minHeight: CH,
          borderColor: selected
            ? "var(--color-fp-border-hover)"
            : highlightColor ?? undefined,
          boxShadow: selected
            ? "0 0 0 1px rgba(255,255,255,0.1)"
            : highlightColor
              ? `0 0 12px ${highlightColor}25`
              : undefined,
        }}
      >
        {/* ---- Top row: type pill + feedback + copy ---- */}
        <div className="flex items-center gap-1.5">
          {/* Type pill */}
          <span
            className="text-[10px] font-semibold px-2 py-1 rounded-fp-sm uppercase tracking-[0.05em] leading-none font-mono inline-flex items-center gap-1"
            style={{
              color: tc.c,
              background: tc.bg,
              border: `1px solid ${tc.c}20`,
            }}
          >
            {TypeIcon && <TypeIcon size={10} weight="bold" />}
            {tc.l}
          </span>

          {/* Feedback count badge */}
          {feedbackCount > 0 && (
            <span
              className="inline-flex items-center justify-center text-[10px] font-semibold font-mono min-w-[18px] h-[18px] px-[5px] rounded-fp-pill leading-none bg-fp-orange-dim text-fp-orange border border-fp-orange/15"
              title={feedbackTypes.join(", ")}
            >
              {feedbackCount}
            </span>
          )}

          <span className="flex-1" />

          <CopyRef card={card} planTitle={planTitle} />
        </div>

        {/* ---- Title ---- */}
        <div className="text-sm font-semibold text-fp-text leading-[1.35] overflow-hidden text-ellipsis [-webkit-line-clamp:2] [-webkit-box-orient:vertical] [display:-webkit-box] tracking-[-0.01em]">
          {card.title}
        </div>

        {/* ---- Description (markdown, compact, max 2 lines) ---- */}
        {descTruncated && (
          <div className="text-xs text-fp-muted leading-normal overflow-hidden text-ellipsis [-webkit-line-clamp:2] [-webkit-box-orient:vertical] [display:-webkit-box]">
            <Md text={descTruncated} fontSize={12} color="#a1a1aa" compact />
          </div>
        )}

        {/* ---- Repo ---- */}
        {card.repo && (
          <div className="text-[11px] font-mono text-fp-dim flex items-center gap-[5px] mt-auto">
            <Folders size={12} weight="duotone" className="shrink-0 opacity-50" />
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">
              {card.repo}
            </span>
          </div>
        )}

        {/* ---- File chips ---- */}
        {visibleFiles.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {visibleFiles.map((f) => {
              const change = card.fileChanges?.[f];
              const fileName = f.split("/").pop() || f;
              return (
                <button
                  key={f}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (change) onFileClick(f, change);
                  }}
                  title={f}
                  className={`inline-flex items-center gap-[3px] bg-fp-glass border border-fp-border rounded-fp-sm px-2 py-0.5 text-[10px] font-mono text-fp-muted leading-none max-w-[130px] overflow-hidden text-ellipsis whitespace-nowrap transition-all duration-150 hover:border-fp-border-hover hover:bg-fp-glass-hover ${
                    change ? "cursor-pointer" : "cursor-default"
                  }`}
                >
                  <ChangeDot changeType={change?.changeType} />
                  <File size={10} className="shrink-0 opacity-50" />
                  {fileName}
                </button>
              );
            })}
            {extraCount > 0 && (
              <span className="text-[10px] font-mono text-fp-dim px-1.5 py-[3px] leading-none self-center">
                +{extraCount}
              </span>
            )}
          </div>
        )}

        {/* ---- Handles ---- */}
        <Handle
          type="target"
          position={Position.Left}
          className="!w-1.5 !h-1.5 !bg-white/15 !border !border-white/10 !rounded-full"
        />
        <Handle
          type="source"
          position={Position.Right}
          className="!w-1.5 !h-1.5 !bg-white/15 !border !border-white/10 !rounded-full"
        />
      </div>

      {/* ---- Right-click context menu (portal-like, fixed position) ---- */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onEdit={() => onEdit?.(card.id)}
          onDelete={() => onDelete?.(card.id)}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </>
  );
}

export default React.memo(CardNode);
