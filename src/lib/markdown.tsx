import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { highlight } from "./highlight";
import { T } from "./theme";

interface MdProps {
  text: string;
  fontSize?: number;
  color?: string;
  lineHeight?: number;
  /** If true, truncate to ~3 lines with no block elements */
  compact?: boolean;
}

export const Md = React.memo(function Md({
  text,
  fontSize = 12.5,
  color = "#b0b0b0",
  lineHeight = 1.75,
  compact = false,
}: MdProps) {
  if (!text) return null;

  if (compact) {
    const flat = text
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^[-*+]\s+/gm, "")
      .replace(/^>\s+/gm, "")
      .replace(/```[\s\S]*?```/g, "[code]")
      .replace(/\|[^\n]+\|/g, "")
      .replace(/\n+/g, " ")
      .trim();
    return <span style={{ fontSize, color, lineHeight }}>{flat}</span>;
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <p style={{ margin: "3px 0", fontSize, color, lineHeight, letterSpacing: "-0.008em" }}>{children}</p>
        ),
        h1: ({ children }) => (
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: "8px 0 4px", lineHeight: 1.4 }}>
            {children}
          </div>
        ),
        h2: ({ children }) => (
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, margin: "8px 0 4px", lineHeight: 1.4 }}>
            {children}
          </div>
        ),
        h3: ({ children }) => (
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text, margin: "8px 0 4px", lineHeight: 1.4 }}>
            {children}
          </div>
        ),
        h4: ({ children }) => (
          <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text, margin: "8px 0 4px", lineHeight: 1.4 }}>
            {children}
          </div>
        ),
        h5: ({ children }) => (
          <div style={{ fontSize: 12, fontWeight: 700, color: T.text, margin: "8px 0 4px", lineHeight: 1.4 }}>
            {children}
          </div>
        ),
        h6: ({ children }) => (
          <div style={{ fontSize: 11.5, fontWeight: 700, color: T.text, margin: "8px 0 4px", lineHeight: 1.4 }}>
            {children}
          </div>
        ),
        strong: ({ children }) => <strong style={{ fontWeight: 700, color: T.text }}>{children}</strong>,
        em: ({ children }) => <em style={{ fontStyle: "italic", color: T.sec }}>{children}</em>,
        del: ({ children }) => <del style={{ color: T.ter, textDecoration: "line-through" }}>{children}</del>,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: T.accent, textDecoration: "none", borderBottom: `1px solid ${T.accent}40` }}
          >
            {children}
          </a>
        ),
        code: ({ className, children }) => {
          const isBlock = className?.includes("language-");
          if (isBlock) {
            const lang = className?.replace("language-", "") || "";
            const code = String(children).replace(/\n$/, "");
            const html = highlight(code, lang);
            return (
              <div style={{ margin: "6px 0", borderRadius: 6, overflow: "hidden", border: `1px solid ${T.border}` }}>
                {lang && (
                  <div
                    style={{
                      fontSize: 9,
                      color: T.ter,
                      fontFamily: T.m,
                      padding: "3px 10px",
                      background: "rgba(255,255,255,0.03)",
                      borderBottom: `1px solid ${T.border}`,
                    }}
                  >
                    {lang}
                  </div>
                )}
                <pre
                  style={{
                    margin: 0,
                    padding: "8px 10px",
                    fontSize: 11,
                    lineHeight: 1.6,
                    fontFamily: T.m,
                    color: T.text,
                    background: "rgba(0,0,0,0.2)",
                    overflowX: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                  }}
                >
                  <code dangerouslySetInnerHTML={{ __html: html }} />
                </pre>
              </div>
            );
          }
          return (
            <code
              style={{
                background: "rgba(255,255,255,0.06)",
                padding: "1px 5px",
                borderRadius: 3,
                fontFamily: T.m,
                fontSize: "0.9em",
                color: T.orange,
              }}
            >
              {children}
            </code>
          );
        },
        pre: ({ children }) => <>{children}</>,
        ul: ({ children }) => (
          <ul style={{ margin: "4px 0", paddingLeft: 18, fontSize, color, lineHeight }}>{children}</ul>
        ),
        ol: ({ children }) => (
          <ol style={{ margin: "4px 0", paddingLeft: 18, fontSize, color, lineHeight }}>{children}</ol>
        ),
        li: ({ children, className }) => {
          const isTask = className === "task-list-item";
          return (
            <li style={{ marginBottom: 2, listStyle: isTask ? "none" : undefined, marginLeft: isTask ? -18 : 0 }}>
              {children}
            </li>
          );
        },
        input: ({ checked }) => (
          <span style={{ marginRight: 6, color: checked ? T.green : T.ter }}>{checked ? "☑" : "☐"}</span>
        ),
        blockquote: ({ children }) => (
          <div
            style={{
              borderLeft: `3px solid ${T.purple}`,
              paddingLeft: 10,
              margin: "4px 0",
              color: T.sec,
              fontSize,
              lineHeight,
              fontStyle: "italic",
            }}
          >
            {children}
          </div>
        ),
        table: ({ children }) => (
          <div style={{ margin: "6px 0", overflowX: "auto", borderRadius: 6, border: `1px solid ${T.border}` }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: T.f }}>
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => <thead style={{ background: "rgba(255,255,255,0.04)" }}>{children}</thead>,
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => <tr style={{ borderBottom: `1px solid ${T.border}` }}>{children}</tr>,
        th: ({ children }) => (
          <th
            style={{
              padding: "6px 10px",
              textAlign: "left",
              fontWeight: 700,
              color: T.text,
              fontSize: 10,
              fontFamily: T.m,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {children}
          </th>
        ),
        td: ({ children }) => <td style={{ padding: "6px 10px", color: T.sec }}>{children}</td>,
        hr: () => <div style={{ height: 1, background: T.border, margin: "8px 0" }} />,
      }}
    >
      {text}
    </ReactMarkdown>
  );
});
