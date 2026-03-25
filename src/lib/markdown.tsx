import React from "react";

const T = {
  text: "#ececec", sec: "#999", ter: "#666",
  accent: "#0a84ff", green: "#30d158", orange: "#ff9f0a",
  purple: "#bf5af2", border: "#333", surface: "#1e1e1e",
  m: "'SF Mono', 'JetBrains Mono', monospace",
};

interface MdProps {
  text: string;
  fontSize?: number;
  color?: string;
  lineHeight?: number;
  /** If true, truncate to ~3 lines with no block elements */
  compact?: boolean;
}

// Parse inline markdown: **bold**, *italic*, `code`, [link](url)
function renderInline(text: string, key: number = 0): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Combined regex: code, bold, italic, link
  const re = /`([^`]+)`|\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] != null) {
      // inline code
      nodes.push(
        <code key={`${key}-${idx}`} style={{ background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 3, fontFamily: T.m, fontSize: "0.9em", color: T.orange }}>{m[1]}</code>
      );
    } else if (m[2] != null) {
      // bold
      nodes.push(<strong key={`${key}-${idx}`} style={{ fontWeight: 700, color: T.text }}>{m[2]}</strong>);
    } else if (m[3] != null) {
      // italic
      nodes.push(<em key={`${key}-${idx}`} style={{ fontStyle: "italic", color: T.sec }}>{m[3]}</em>);
    } else if (m[4] != null && m[5] != null) {
      // link
      nodes.push(
        <a key={`${key}-${idx}`} href={m[5]} target="_blank" rel="noopener noreferrer"
          style={{ color: T.accent, textDecoration: "none", borderBottom: `1px solid ${T.accent}40` }}>{m[4]}</a>
      );
    }
    last = m.index + m[0].length;
    idx++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Md({ text, fontSize = 12.5, color = "#b0b0b0", lineHeight = 1.75, compact = false }: MdProps) {
  if (!text) return null;

  if (compact) {
    // Strip markdown block syntax and render inline only
    const flat = text
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^[-*+]\s+/gm, "")
      .replace(/^>\s+/gm, "")
      .replace(/```[\s\S]*?```/g, "[code]")
      .replace(/\n+/g, " ")
      .trim();
    return <span style={{ fontSize, color, lineHeight }}>{renderInline(flat)}</span>;
  }

  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <div key={elements.length} style={{ margin: "6px 0", borderRadius: 6, overflow: "hidden", border: `1px solid ${T.border}` }}>
          {lang && <div style={{ fontSize: 9, color: T.ter, fontFamily: T.m, padding: "3px 10px", background: "rgba(255,255,255,0.03)", borderBottom: `1px solid ${T.border}` }}>{lang}</div>}
          <pre style={{ margin: 0, padding: "8px 10px", fontSize: 11, lineHeight: 1.6, fontFamily: T.m, color: T.text, background: "rgba(0,0,0,0.2)", overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {codeLines.join("\n")}
          </pre>
        </div>
      );
      continue;
    }

    // Heading
    const hm = line.match(/^(#{1,6})\s+(.+)/);
    if (hm) {
      const level = hm[1].length;
      const sizes = [15, 14, 13, 12.5, 12, 11.5];
      elements.push(
        <div key={elements.length} style={{ fontSize: sizes[level - 1] || 12, fontWeight: 700, color: T.text, margin: "8px 0 4px", lineHeight: 1.4 }}>
          {renderInline(hm[2])}
        </div>
      );
      i++;
      continue;
    }

    // Unordered list item
    if (/^[-*+]\s+/.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i])) {
        items.push(
          <li key={items.length} style={{ marginBottom: 2 }}>
            {renderInline(lines[i].replace(/^[-*+]\s+/, ""))}
          </li>
        );
        i++;
      }
      elements.push(
        <ul key={elements.length} style={{ margin: "4px 0", paddingLeft: 18, fontSize, color, lineHeight }}>
          {items}
        </ul>
      );
      continue;
    }

    // Ordered list item
    if (/^\d+\.\s+/.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(
          <li key={items.length} style={{ marginBottom: 2 }}>
            {renderInline(lines[i].replace(/^\d+\.\s+/, ""))}
          </li>
        );
        i++;
      }
      elements.push(
        <ol key={elements.length} style={{ margin: "4px 0", paddingLeft: 18, fontSize, color, lineHeight }}>
          {items}
        </ol>
      );
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <div key={elements.length} style={{ borderLeft: `3px solid ${T.purple}`, paddingLeft: 10, margin: "4px 0", color: T.sec, fontSize, lineHeight, fontStyle: "italic" }}>
          {quoteLines.map((ql, qi) => <div key={qi}>{renderInline(ql)}</div>)}
        </div>
      );
      continue;
    }

    // Empty line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={elements.length} style={{ margin: "3px 0", fontSize, color, lineHeight, letterSpacing: "-0.008em" }}>
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return <>{elements}</>;
}
