import React, { useState, useCallback } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { TC } from "../lib/theme";
import { Md } from "../lib/markdown";
import { formatCardRef } from "../lib/refs";
import type { Card, FileChange } from "../types";
import { Folders, File, Copy, MagnifyingGlass, Compass, Plus, PencilSimple, Flask } from "@phosphor-icons/react";
import CardTag from "./ui/CardTag";
import FileTag from "./ui/FileTag";
import { TYPE_TAG_VARIANT, TYPE_BG } from "../lib/cardTypes";

export const CW = 240;
export const CH = 150;

const TYPE_ICON: Record<string, React.ElementType> = {
  research: MagnifyingGlass,
  planning: Compass,
  create: Plus,
  edit: PencilSimple,
  test: Flask,
};

export interface CardNodeData extends Record<string, unknown> {
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
      const ref = formatCardRef(planTitle, card);
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
      className={`bg-transparent border-none cursor-pointer w-5 h-5 rounded flex items-center justify-center transition-colors duration-150
        ${copied ? "text-fp-accent" : "text-white/25 hover:text-white/50"}`}
    >
      {copied ? <span className="text-[10px]">{"\u2713"}</span> : <Copy size={10} />}
    </button>
  );
}

/* ---- File change indicator dot ---- */
function ChangeDot({ changeType }: { changeType?: string }) {
  return (
    <span
      className={`inline-block w-1 h-1 rounded-full mr-[3px] shrink-0 ${
        changeType === "create" ? "bg-fp-success" : changeType === "delete" ? "bg-fp-danger" : "bg-fp-orange"
      }`}
    />
  );
}

/* ---- Main node ---- */
function CardNode({ data, selected, isConnectable }: NodeProps & { data: CardNodeData }) {
  const { card, feedbackCount, planTitle, onFileClick, highlight } = data;

  const tc = TC[card.type] || { l: card.type, c: "#10b981", bg: "rgba(16,185,129,0.10)" };
  const TypeIcon = TYPE_ICON[card.type];

  const highlightColor =
    highlight === "added" ? "var(--color-fp-success)" : highlight === "modified" ? "var(--color-fp-orange)" : null;

  const descTruncated =
    card.description && card.description.length > 900
      ? card.description.slice(0, 900) + "\u2026"
      : card.description || "";

  const visibleFiles = card.files.slice(0, 3);
  const extraCount = card.files.length - 3;

  return (
    <>
      <div
        className={`card-node flex flex-col gap-1.5 p-3 cursor-grab relative rounded-2xl border transition-all duration-150 ease-out
          ${selected ? "border-white/15" : "border-white/8 hover:border-white/12"}`}
        style={{
          width: CW,
          minHeight: CH,
          background: TYPE_BG[card.type] || TYPE_BG.create,
          ...(highlightColor
            ? {
                borderColor: highlightColor,
                boxShadow: `0 0 12px ${highlightColor}25, 0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06)`,
              }
            : {}),
        }}
      >
        {/* ---- Top row: type tag + feedback + copy ---- */}
        <div className="flex items-center gap-1">
          <CardTag
            variant={TYPE_TAG_VARIANT[card.type] || "default"}
            icon={TypeIcon ? <TypeIcon size={9} weight="regular" /> : undefined}
          >
            {tc.l}
          </CardTag>

          {feedbackCount > 0 && <CardTag variant="orange">{feedbackCount}</CardTag>}

          <span className="flex-1" />

          <CopyRef card={card} planTitle={planTitle} />
        </div>

        {/* ---- Title ---- */}
        <div className="text-[12px] font-semibold text-fp-text leading-[1.35] overflow-hidden text-ellipsis [-webkit-line-clamp:2] [-webkit-box-orient:vertical] [display:-webkit-box] tracking-[-0.01em]">
          {card.title}
        </div>

        {/* ---- Description (markdown, expanded, max 6 lines) ---- */}
        {descTruncated && (
          <div className="text-[11px] text-fp-muted leading-[1.45] overflow-hidden text-ellipsis [-webkit-line-clamp:6] [-webkit-box-orient:vertical] [display:-webkit-box] min-h-[94px]">
            <Md text={descTruncated} fontSize={11} color="#a1a1aa" compact />
          </div>
        )}

        {/* ---- Repo ---- */}
        {card.repo && (
          <div className="text-[10px] font-mono text-fp-dim flex items-center gap-1 mt-auto">
            <Folders size={10} weight="regular" className="shrink-0 opacity-50" />
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">{card.repo}</span>
          </div>
        )}

        {/* ---- File tags ---- */}
        {visibleFiles.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {visibleFiles.map((f) => {
              const change = card.fileChanges?.[f];
              const fileName = f.split("/").pop() || f;
              return (
                <FileTag
                  key={f}
                  dot={<ChangeDot changeType={change?.changeType} />}
                  icon={<File size={9} weight="regular" className="opacity-40" />}
                  onClick={change ? () => onFileClick(f, change) : undefined}
                >
                  {fileName}
                </FileTag>
              );
            })}
            {extraCount > 0 && <span className="text-[9px] text-white/25 px-1 self-center">+{extraCount}</span>}
          </div>
        )}

        {/* ---- Handles (only inside ReactFlow) ---- */}
        {isConnectable !== false && (
          <>
            <Handle
              type="target"
              position={Position.Left}
              className="!w-2 !h-2 !bg-white/20 !border !border-white/10 !rounded-full hover:!bg-fp-accent/50 hover:!border-fp-accent/30 !transition-colors"
            />
            <Handle
              type="source"
              position={Position.Right}
              className="!w-2 !h-2 !bg-white/20 !border !border-white/10 !rounded-full hover:!bg-fp-accent/50 hover:!border-fp-accent/30 !transition-colors"
            />
          </>
        )}
      </div>
    </>
  );
}

export default React.memo(CardNode);
