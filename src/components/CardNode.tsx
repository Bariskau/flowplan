import React, { useState, useCallback } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { T, TC } from "../lib/theme";
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
      className="bg-transparent border-none cursor-pointer px-1 py-0.5 rounded text-[11px] leading-none transition-[color_0.2s,opacity_0.15s]"
      style={{
        color: copied ? T.accent : T.ter,
        fontFamily: T.m,
        opacity: copied ? 1 : 0.6,
      }}
    >
      {copied ? "\u2713" : "\u2398"}
    </button>
  );
}

/* ---- File change indicator dot ---- */
function ChangeDot({ changeType }: { changeType?: string }) {
  const color =
    changeType === "create"
      ? T.green
      : changeType === "delete"
        ? T.red
        : T.orange;
  return (
    <span
      className="inline-block w-1 h-1 rounded-full mr-[3px] shrink-0"
      style={{ background: color }}
    />
  );
}

/* ---- Main node ---- */
function CardNode({ data, selected }: NodeProps & { data: CardNodeData }) {
  const { card, feedbackCount, feedbackTypes, planTitle, onFileClick, highlight } = data;

  const tc = TC[card.type] || { l: card.type, c: T.accent, bg: T.aD };

  const highlightColor =
    highlight === "added"
      ? T.green
      : highlight === "modified"
        ? T.orange
        : null;

  const borderColor = selected
    ? tc.c
    : highlightColor
      ? highlightColor
      : "rgba(255,255,255,0.06)";

  const boxShadow = selected
    ? `0 0 0 1px ${tc.c}33, 0 0 20px ${tc.c}15`
    : highlightColor
      ? `0 0 12px ${highlightColor}25`
      : "0 1px 2px rgba(0,0,0,0.15)";

  const descTruncated =
    card.description && card.description.length > 300
      ? card.description.slice(0, 300) + "\u2026"
      : card.description || "";

  const visibleFiles = card.files.slice(0, 3);
  const extraCount = card.files.length - 3;

  return (
    <div
      className="bg-[rgba(255,255,255,0.03)] backdrop-blur-[16px] [-webkit-backdrop-filter:blur(16px)] rounded-[10px] flex flex-col gap-2 px-[14px] py-3 cursor-grab relative transition-[border-color_0.2s,box-shadow_0.2s]"
      style={{
        border: `1px solid ${borderColor}`,
        width: CW,
        minHeight: CH,
        boxShadow,
        fontFamily: T.f,
      }}
    >
      {/* ---- Top row: type pill + feedback + copy ---- */}
      <div className="flex items-center gap-1.5">
        {/* Protocol-style type pill (like GET/POST badges) */}
        <span
          className="text-[10px] font-semibold px-2 py-[3px] rounded-[6px] uppercase tracking-[0.05em] leading-none"
          style={{
            fontFamily: T.m,
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
            className="inline-flex items-center justify-center text-[10px] font-semibold min-w-[18px] h-[18px] px-[5px] rounded-[9px] leading-none"
            style={{
              fontFamily: T.m,
              color: T.orange,
              background: T.oD,
              border: `1px solid rgba(251,146,60,0.15)`,
            }}
            title={feedbackTypes.join(", ")}
          >
            {feedbackCount}
          </span>
        )}

        <span className="flex-1" />

        <CopyRef card={card} planTitle={planTitle} />
      </div>

      {/* ---- Title ---- */}
      <div
        className="text-sm font-semibold leading-[1.35] overflow-hidden text-ellipsis [-webkit-line-clamp:2] [-webkit-box-orient:vertical] [display:-webkit-box] tracking-[-0.01em]"
        style={{ color: T.text }}
      >
        {card.title}
      </div>

      {/* ---- Description ---- */}
      {descTruncated && (
        <div className="text-[13px] text-[#a1a1aa] leading-normal overflow-hidden text-ellipsis [-webkit-line-clamp:3] [-webkit-box-orient:vertical] [display:-webkit-box]">
          <Md text={descTruncated} fontSize={13} color="#a1a1aa" compact />
        </div>
      )}

      {/* ---- Repo ---- */}
      {card.repo && (
        <div
          className="text-[11px] flex items-center gap-[5px] mt-auto"
          style={{ fontFamily: T.m, color: T.ter }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            className="shrink-0 opacity-50"
          >
            <path
              d="M1.5 3.5c0-.56.44-1 1-1h4.59c.26 0 .52.1.71.29l.7.71h5c.56 0 1 .44 1 1v8c0 .56-.44 1-1 1h-11c-.56 0-1-.44-1-1v-9z"
              stroke="#71717a"
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

      {/* ---- File chips (Protocol-style monospace badges like id, username) ---- */}
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
                className="inline-flex items-center gap-[3px] text-[11px] font-medium text-[#a1a1aa] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-[6px] px-2 py-[3px] leading-none max-w-[130px] overflow-hidden text-ellipsis whitespace-nowrap transition-[border-color_0.15s,background_0.15s]"
                style={{
                  fontFamily: T.m,
                  cursor: change ? "pointer" : "default",
                }}
              >
                <ChangeDot changeType={change?.changeType} />
                {fileName}
              </button>
            );
          })}
          {extraCount > 0 && (
            <span
              className="text-[10px] px-1.5 py-[3px] leading-none self-center"
              style={{ fontFamily: T.m, color: T.ter }}
            >
              +{extraCount}
            </span>
          )}
        </div>
      )}

      {/* ---- Handles ---- */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-1.5 !h-1.5 !bg-[rgba(255,255,255,0.15)] !border !border-[rgba(255,255,255,0.10)] !rounded-full transition-[background_0.15s,border-color_0.15s]"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-1.5 !h-1.5 !bg-[rgba(255,255,255,0.15)] !border !border-[rgba(255,255,255,0.10)] !rounded-full transition-[background_0.15s,border-color_0.15s]"
      />
    </div>
  );
}

export default React.memo(CardNode);
