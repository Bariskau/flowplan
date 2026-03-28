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
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "2px 4px",
        borderRadius: 4,
        color: copied ? T.accent : T.ter,
        fontSize: 11,
        fontFamily: T.m,
        lineHeight: 1,
        opacity: copied ? 1 : 0.6,
        transition: "color 0.2s, opacity 0.15s",
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
      style={{
        display: "inline-block",
        width: 4,
        height: 4,
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
      style={{
        background: "rgba(255,255,255,0.03)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: `1px solid ${borderColor}`,
        borderRadius: 10,
        width: CW,
        minHeight: CH,
        boxShadow,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        fontFamily: T.f,
        transition: "border-color 0.2s, box-shadow 0.2s",
        cursor: "grab",
        position: "relative",
      }}
    >
      {/* ---- Top row: type pill + feedback + copy ---- */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {/* Protocol-style type pill (like GET/POST badges) */}
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            fontFamily: T.m,
            color: tc.c,
            background: tc.bg,
            padding: "3px 8px",
            borderRadius: 6,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            lineHeight: 1,
            border: `1px solid ${tc.c}20`,
          }}
        >
          {tc.l}
        </span>

        {/* Feedback count badge */}
        {feedbackCount > 0 && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 600,
              fontFamily: T.m,
              color: T.orange,
              background: T.oD,
              minWidth: 18,
              height: 18,
              padding: "0 5px",
              borderRadius: 9,
              lineHeight: 1,
              border: `1px solid rgba(251,146,60,0.15)`,
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
          fontSize: 14,
          fontWeight: 600,
          color: T.text,
          lineHeight: 1.35,
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          letterSpacing: "-0.01em",
        }}
      >
        {card.title}
      </div>

      {/* ---- Description ---- */}
      {descTruncated && (
        <div
          style={{
            fontSize: 13,
            color: "#a1a1aa",
            lineHeight: 1.5,
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
          }}
        >
          <Md text={descTruncated} fontSize={13} color="#a1a1aa" compact />
        </div>
      )}

      {/* ---- Repo ---- */}
      {card.repo && (
        <div
          style={{
            fontSize: 11,
            fontFamily: T.m,
            color: T.ter,
            display: "flex",
            alignItems: "center",
            gap: 5,
            marginTop: "auto",
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            style={{ flexShrink: 0, opacity: 0.5 }}
          >
            <path
              d="M1.5 3.5c0-.56.44-1 1-1h4.59c.26 0 .52.1.71.29l.7.71h5c.56 0 1 .44 1 1v8c0 .56-.44 1-1 1h-11c-.56 0-1-.44-1-1v-9z"
              stroke="#71717a"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
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

      {/* ---- File chips (Protocol-style monospace badges like id, username) ---- */}
      {visibleFiles.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
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
                  gap: 3,
                  fontSize: 11,
                  fontFamily: T.m,
                  fontWeight: 500,
                  color: "#a1a1aa",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 6,
                  padding: "3px 8px",
                  cursor: change ? "pointer" : "default",
                  lineHeight: 1,
                  maxWidth: 130,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  transition: "border-color 0.15s, background 0.15s",
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
                fontSize: 10,
                fontFamily: T.m,
                color: T.ter,
                padding: "3px 6px",
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
          background: "rgba(255,255,255,0.15)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: "50%",
          transition: "background 0.15s, border-color 0.15s",
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: 6,
          height: 6,
          background: "rgba(255,255,255,0.15)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: "50%",
          transition: "background 0.15s, border-color 0.15s",
        }}
      />
    </div>
  );
}

export default React.memo(CardNode);
