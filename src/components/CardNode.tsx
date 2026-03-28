import React, { useState, useCallback } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { TC } from "../lib/theme";
import { Md } from "../lib/markdown";
import type { Card, FileChange } from "../types";

export const CW = 280;
export const CH = 140;

export interface CardNodeData {
  card: Card;
  feedbackCount: number;
  feedbackTypes: string[];
  planTitle: string;
  planId: string;
  onFileClick: (path: string, change: FileChange) => void;
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
      className={`bg-transparent border-none cursor-pointer px-1 py-0.5 rounded font-mono text-[11px] leading-none transition-all duration-200
        ${copied ? "text-fp-accent opacity-100" : "text-fp-dim opacity-60 hover:opacity-100"}`}
    >
      {copied ? "\u2713" : "\u2398"}
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

/* ---- Main node ---- */
function CardNode({ data, selected }: NodeProps & { data: CardNodeData }) {
  const { card, feedbackCount, feedbackTypes, planTitle, onFileClick, highlight } = data;

  const tc = TC[card.type] || { l: card.type, c: "#10b981", bg: "rgba(16,185,129,0.10)" };

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

  return (
    <div
      className={`fp-glass-card border rounded-fp-lg flex flex-col gap-2 px-3.5 py-3 cursor-grab relative transition-all duration-200
        ${selected
          ? "border-fp-accent shadow-[0_0_0_1px_rgba(16,185,129,0.2),0_0_20px_rgba(16,185,129,0.08)]"
          : highlightColor
            ? "border-fp-border"
            : "border-fp-border"
        }`}
      style={{
        width: CW,
        minHeight: CH,
        borderColor: selected ? tc.c : highlightColor ?? undefined,
        boxShadow: selected
          ? `0 0 0 1px ${tc.c}33, 0 0 20px ${tc.c}15`
          : highlightColor
            ? `0 0 12px ${highlightColor}25`
            : undefined,
      }}
    >
      {/* ---- Top row: type pill + feedback + copy ---- */}
      <div className="flex items-center gap-1.5">
        {/* Type pill */}
        <span
          className="text-[10px] font-semibold px-2 py-[3px] rounded-fp-sm uppercase tracking-[0.05em] leading-none font-mono"
          style={{
            color: tc.c,
            background: tc.bg,
            border: `1px solid ${tc.c}20`,
          }}
        >
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

      {/* ---- Description ---- */}
      {descTruncated && (
        <div className="text-xs text-fp-muted leading-normal overflow-hidden text-ellipsis [-webkit-line-clamp:3] [-webkit-box-orient:vertical] [display:-webkit-box]">
          <Md text={descTruncated} fontSize={12} color="#a1a1aa" compact />
        </div>
      )}

      {/* ---- Repo ---- */}
      {card.repo && (
        <div className="text-[11px] font-mono text-fp-dim flex items-center gap-[5px] mt-auto">
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            className="shrink-0 opacity-50"
          >
            <path
              d="M1.5 3.5c0-.56.44-1 1-1h4.59c.26 0 .52.1.71.29l.7.71h5c.56 0 1 .44 1 1v8c0 .56-.44 1-1 1h-11c-.56 0-1-.44-1-1v-9z"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
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
                className={`inline-flex items-center gap-[3px] bg-fp-glass border border-fp-border rounded-fp-sm px-1.5 py-0.5 text-[10px] font-mono text-fp-muted leading-none max-w-[130px] overflow-hidden text-ellipsis whitespace-nowrap transition-all duration-150 hover:border-fp-border-hover hover:bg-fp-glass-hover ${
                  change ? "cursor-pointer" : "cursor-default"
                }`}
              >
                <ChangeDot changeType={change?.changeType} />
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
  );
}

export default React.memo(CardNode);
