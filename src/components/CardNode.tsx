import React, { useState, useCallback } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { T, TC } from "../lib/theme";
import { Md } from "../lib/markdown";
import type { Card, FileChange } from "../types";

export const CW = 272;
export const CH = 160;

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
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "2px 4px",
        borderRadius: 4,
        color: copied ? T.green : T.ter,
        fontSize: 10,
        fontFamily: T.m,
        lineHeight: 1,
        transition: "color 0.2s",
      }}
    >
      {copied ? "✓" : "⎘"}
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
      style={{
        display: "inline-block",
        width: 5,
        height: 5,
        borderRadius: "50%",
        background: color,
        marginRight: 3,
        flexShrink: 0,
      }}
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
      : T.borderGlass;

  const boxShadow = selected
    ? `0 0 0 1px ${tc.c}40`
    : highlightColor
      ? `0 0 12px ${highlightColor}40`
      : "none";

  const descTruncated =
    card.description && card.description.length > 300
      ? card.description.slice(0, 300) + "…"
      : card.description || "";

  const visibleFiles = card.files.slice(0, 3);
  const extraCount = card.files.length - 3;

  return (
    <div
      style={{
        background: "rgba(30,30,30,0.6)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: `1.5px solid ${borderColor}`,
        borderRadius: 8,
        width: CW,
        minHeight: CH,
        boxShadow,
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        fontFamily: T.f,
        transition: "border-color 0.2s, box-shadow 0.2s",
        cursor: "grab",
      }}
    >
      {/* ---- Top row: badge + feedback + copy ---- */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {/* Type badge */}
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            color: tc.c,
            background: tc.bg,
            padding: "2px 7px",
            borderRadius: 4,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            lineHeight: 1,
          }}
        >
          {tc.l}
        </span>

        {/* Feedback indicator */}
        {feedbackCount > 0 && (
          <span
            style={{
              fontSize: 9,
              color: T.orange,
              background: T.oD,
              padding: "2px 6px",
              borderRadius: 4,
              lineHeight: 1,
              fontWeight: 600,
            }}
            title={feedbackTypes.join(", ")}
          >
            {feedbackCount}
          </span>
        )}

        <span style={{ flex: 1 }} />

        <CopyRef card={card} planTitle={planTitle} />
      </div>

      {/* ---- Title ---- */}
      <div
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          color: T.text,
          lineHeight: 1.35,
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {card.title}
      </div>

      {/* ---- Description ---- */}
      {descTruncated && (
        <div
          style={{
            fontSize: 10.5,
            color: T.sec,
            lineHeight: 1.45,
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
          }}
        >
          <Md text={descTruncated} fontSize={10.5} color={T.sec} compact />
        </div>
      )}

      {/* ---- Repo ---- */}
      {card.repo && (
        <div
          style={{
            fontSize: 9,
            fontFamily: T.m,
            color: T.ter,
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginTop: "auto",
          }}
        >
          <span style={{ fontSize: 10 }}>📁</span>
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {card.repo}
          </span>
        </div>
      )}

      {/* ---- Files ---- */}
      {visibleFiles.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
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
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 2,
                  fontSize: 9,
                  fontFamily: T.m,
                  color: T.sec,
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${T.borderGlass}`,
                  borderRadius: 4,
                  padding: "2px 6px",
                  cursor: change ? "pointer" : "default",
                  lineHeight: 1,
                  maxWidth: 120,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                <ChangeDot changeType={change?.changeType} />
                {fileName}
              </button>
            );
          })}
          {extraCount > 0 && (
            <span
              style={{
                fontSize: 9,
                color: T.ter,
                padding: "2px 4px",
                lineHeight: 1,
                alignSelf: "center",
              }}
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
        style={{
          width: 6,
          height: 6,
          background: `${T.accent}cc`,
          border: "none",
          borderRadius: "50%",
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: 6,
          height: 6,
          background: `${T.accent}cc`,
          border: "none",
          borderRadius: "50%",
        }}
      />
    </div>
  );
}

export default React.memo(CardNode);
