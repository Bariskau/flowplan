import { useState, useCallback, useRef, useEffect, useMemo, memo } from "react";
import type { AppState, Card, Feedback, FileChange, HistoryEntry, HistoryDiff } from "./types";
import * as api from "./lib/api";
import { computeDiff } from "./lib/diff";
import { Md } from "./lib/markdown";
import { highlight } from "./lib/highlight";

const T = {
  bg: "#1a1a1a", sidebar: "#141414", sH: "#222", sA: "#2a2a2a",
  surface: "#1e1e1e", raised: "#252525", border: "#333",
  text: "#ececec", sec: "#999", ter: "#666",
  accent: "#0a84ff", aD: "rgba(10,132,255,0.12)",
  green: "#30d158", gD: "rgba(48,209,88,0.12)",
  orange: "#ff9f0a", oD: "rgba(255,159,10,0.15)",
  red: "#ff453a", rD: "rgba(255,69,58,0.12)",
  purple: "#bf5af2", pD: "rgba(191,90,242,0.12)",
  teal: "#64d2ff", tD: "rgba(100,210,255,0.12)",
  f: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
  m: "'SF Mono', 'JetBrains Mono', monospace",
};

const Logo = ({ size = 20 }: { size?: number }) => (
  <div style={{ width: size, height: size, background: "#1e1e2a", borderRadius: size * 0.22, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
    <svg width={size * 0.72} height={size * 0.72} viewBox="0 0 251 260" fill="none">
      <defs>
        <radialGradient id="fp1" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="matrix(113.355,0,0,113.355,103.715,138.105)">
          <stop offset=".156" stopColor="#474aff"/><stop offset=".995" stopColor="#ff007a"/>
        </radialGradient>
        <radialGradient id="fp2" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="matrix(21.338,0,0,21.338,98.615,170.162)">
          <stop offset=".156" stopColor="#474aff"/><stop offset=".995" stopColor="#ff007a"/>
        </radialGradient>
      </defs>
      <path fill="url(#fp1)" d="m228.25 106.76c-0.03-17.31-6.06-34.87-14.56-49.62-19.88-34.46-59.16-57.14-98.79-57.14-32.74 0-72 14.2-87.65 45.19-11.24 22.26-6.86 50.57 9.4 69.2 24.28 27.82 66.52 23.83 96.99 8.95 12.31-6.01 25.2-16.76 40.31-2.3 5.84 5.59 9.57 13.14 9.43 21.22-0.25 14.08-10.25 23.07-23.13 26.65-22.33 6.21-39.04 23.02-43.2 46.06-1.87 10.33-0.36 22.55 7.32 30.38 7.63 7.78 20.23 11.02 30.41 6.97 15.81-6.29 20.73-25.4 13.98-39.39-2.98-6.21-0.93-13.67 4.8-17.49 1.36-0.9 2.42-1.62 2.93-1.94 10.26-6.41 19.51-14.42 27.2-23.75 12.13-14.7 20.61-32.79 23.67-51.64q0.91-5.63 0.89-11.35z"/>
      <path fill="url(#fp2)" fillRule="evenodd" d="m104.98 187.72c-8.6 0-15.56-6.96-15.56-15.56 0-8.61 6.96-15.56 15.56-15.56 8.61 0 15.56 6.95 15.56 15.56 0 8.6-6.95 15.56-15.56 15.56z"/>
    </svg>
  </div>
);

const Ico = {
  search: (c: string, s = 10) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5.25" stroke={c} strokeWidth="1.5"/><path d="M11 11l3.5 3.5" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></svg>,
  compass: (c: string, s = 10) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.25" stroke={c} strokeWidth="1.5"/><path d="M10.5 5.5L9 9 5.5 10.5 7 7z" fill={c} opacity="0.5"/><path d="M10.5 5.5L9 9 5.5 10.5 7 7z" stroke={c} strokeWidth="1" strokeLinejoin="round"/></svg>,
  plus: (c: string, s = 10) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></svg>,
  pencil: (c: string, s = 10) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M11.5 2.5l2 2L5 13H3v-2z" stroke={c} strokeWidth="1.5" strokeLinejoin="round"/></svg>,
  beaker: (c: string, s = 10) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M6 2v5L3 13h10L10 7V2" stroke={c} strokeWidth="1.5" strokeLinejoin="round"/><path d="M5 2h6" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></svg>,
  folder: (c: string, s = 10) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M2 4.5A1.5 1.5 0 013.5 3H6l1.5 1.5h5A1.5 1.5 0 0114 6v5.5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 11.5z" stroke={c} strokeWidth="1.3"/></svg>,
  question: (c: string, s = 10) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.25" stroke={c} strokeWidth="1.5"/><path d="M6.5 6.5a1.5 1.5 0 112.12 1.37c-.42.24-.62.5-.62.88V9.5" stroke={c} strokeWidth="1.3" strokeLinecap="round" fill="none"/><circle cx="8" cy="11.5" r="0.75" fill={c}/></svg>,
  bolt: (c: string, s = 10) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M9 1.5L4 9h4l-1 5.5L12 7H8z" fill={c} opacity="0.15" stroke={c} strokeWidth="1.3" strokeLinejoin="round"/></svg>,
  alert: (c: string, s = 10) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M8 2L1.5 13h13z" stroke={c} strokeWidth="1.3" strokeLinejoin="round"/><path d="M8 7v3" stroke={c} strokeWidth="1.3" strokeLinecap="round"/><circle cx="8" cy="11.5" r="0.65" fill={c}/></svg>,
  check: (c: string, s = 10) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.5 3.5L13 4" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  send: (c: string, s = 10) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M2 14L14.5 8 2 2v4.5L10 8 2 9.5z" fill={c}/></svg>,
  copy: (c: string, s = 10) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="8" height="8" rx="1.5" stroke={c} strokeWidth="1.3"/><path d="M3 10V3.5A1.5 1.5 0 014.5 2H11" stroke={c} strokeWidth="1.3" strokeLinecap="round"/></svg>,
  pin: (c: string, s = 10) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M9.5 2.5L13.5 6.5L10 10L9 13L3 7L6 6Z" stroke={c} strokeWidth="1.3" strokeLinejoin="round"/><path d="M3 13L6 10" stroke={c} strokeWidth="1.3" strokeLinecap="round"/></svg>,
  pinFill: (c: string, s = 10) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M9.5 2.5L13.5 6.5L10 10L9 13L3 7L6 6Z" fill={c} opacity="0.6" stroke={c} strokeWidth="1.3" strokeLinejoin="round"/><path d="M3 13L6 10" stroke={c} strokeWidth="1.3" strokeLinecap="round"/></svg>,
  trash: (c: string, s = 10) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v8.5a1 1 0 001 1h4a1 1 0 001-1V4" stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  dots: (c: string, s = 10) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="3.5" r="1.2" fill={c}/><circle cx="8" cy="8" r="1.2" fill={c}/><circle cx="8" cy="12.5" r="1.2" fill={c}/></svg>,
  goto: (c: string, s = 10) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M3 8h9M9 4.5L12.5 8 9 11.5" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  download: (c: string, s = 10) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M8 2v8.5M4.5 7.5 8 11l3.5-3.5M3 13h10" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  clock: (c: string, s = 10) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.25" stroke={c} strokeWidth="1.5"/><path d="M8 4.5V8l2.5 1.5" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  arrange: (c: string, s = 10) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h8M2 12h5" stroke={c} strokeWidth="1.5" strokeLinecap="round"/><path d="M12 10l2 2-2 2" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

function CopyRef({ planTitle, planId, cardTitle, cardId, size = 8 }: { planTitle: string; planId: string; cardTitle: string; cardId: string; size?: number }) {
  const [copied, setCopied] = useState(false);
  const isPlanOnly = !cardId;
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const ref = isPlanOnly
      ? `[FlowPlan] "${planTitle}" (${planId})`
      : `[FlowPlan] "${planTitle}" (${planId}) > "${cardTitle}" (${cardId})`;
    navigator.clipboard.writeText(ref).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <span onClick={copy} title="Copy card reference for Coding Agent"
      style={{ fontSize: size, color: copied ? T.green : T.ter, fontFamily: T.m, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3, padding: "1px 5px", borderRadius: 3, transition: "all 0.15s", background: copied ? T.gD : "transparent" }}
      onMouseEnter={(e: any) => { if (!copied) { e.currentTarget.style.color = T.accent; e.currentTarget.style.background = T.aD; } }}
      onMouseLeave={(e: any) => { e.currentTarget.style.color = copied ? T.green : T.ter; e.currentTarget.style.background = copied ? T.gD : "transparent"; }}>
      {copied ? <>{Ico.check(T.green, size + 1)} Copied ref!</> : <>{Ico.copy(T.ter, size + 1)} Copy ref</>}
    </span>
  );
}

const TC: Record<string, { l: string; icon: (c: string, s?: number) => JSX.Element; c: string; bg: string }> = {
  research: { l: "Research", icon: Ico.search, c: T.accent, bg: T.aD },
  planning: { l: "Planning", icon: Ico.compass, c: T.purple, bg: T.pD },
  create: { l: "Create", icon: Ico.plus, c: T.green, bg: T.gD },
  edit: { l: "Edit", icon: Ico.pencil, c: T.orange, bg: T.oD },
  test: { l: "Test", icon: Ico.beaker, c: T.teal, bg: T.tD },
};
const FB: Record<string, { label: string; icon: (c: string, s?: number) => JSX.Element; color: string; bg: string; border: string }> = {
  question: { label: "Question", icon: Ico.question, color: T.accent, bg: "rgba(10,132,255,0.08)", border: "rgba(10,132,255,0.2)" },
  directive: { label: "Directive", icon: Ico.bolt, color: T.orange, bg: "rgba(255,159,10,0.08)", border: "rgba(255,159,10,0.2)" },
  issue: { label: "Issue", icon: Ico.alert, color: T.red, bg: "rgba(255,69,58,0.08)", border: "rgba(255,69,58,0.2)" },
};
function CodeViewer({ path, change, onClose }: { path: string; change: FileChange; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const content = change.content;
  const isMarkdown = /^```/m.test(content) || /^#{1,6}\s/m.test(content) || /\*\*.+\*\*/.test(content);
  const lines = content.split("\n");
  const isCreate = change.changeType === "create";
  const isDelete = change.changeType === "delete";

  const lineStyle = (line: string): React.CSSProperties => {
    if (isCreate) return { background: "rgba(48,209,88,0.10)" };
    if (isDelete) return { background: "rgba(255,69,58,0.10)" };
    if (line.startsWith("@@")) return { background: "rgba(191,90,242,0.12)", color: T.purple };
    if (line.startsWith("+")) return { background: "rgba(48,209,88,0.10)", color: T.green };
    if (line.startsWith("-")) return { background: "rgba(255,69,58,0.10)", color: T.red };
    return {};
  };

  const typeColors: Record<string, { c: string; bg: string }> = {
    create: { c: T.green, bg: T.gD },
    edit: { c: T.orange, bg: T.oD },
    delete: { c: T.red, bg: T.rD },
  };
  const tc = typeColors[change.changeType] || typeColors.edit;

  return (
    <div className="cv-backdrop" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.f }}>
      <div className="cv-modal" onClick={e => e.stopPropagation()} style={{ width: "85%", maxWidth: 900, minHeight: "50vh", maxHeight: "85vh", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
            <span style={{ fontSize: 11, color: T.text, fontFamily: T.m, wordBreak: "break-all" }}>{path}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: tc.c, background: tc.bg, padding: "2px 6px", borderRadius: 4, fontFamily: T.m, flexShrink: 0 }}>{change.changeType}</span>
            <span style={{ fontSize: 9, color: T.sec, background: T.raised, padding: "2px 6px", borderRadius: 4, fontFamily: T.m, flexShrink: 0 }}>{change.language}</span>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${T.border}`, color: T.sec, cursor: "pointer", fontSize: 13, fontWeight: 600, width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.12s" }}
            onMouseEnter={(e: any) => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = T.text; }}
            onMouseLeave={(e: any) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = T.sec; }}>{"\u2715"}</button>
        </div>
        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
          {isMarkdown ? (
            <div style={{ padding: "12px 16px" }}>
              <Md text={content} fontSize={12} color={T.text} lineHeight={1.7} />
            </div>
          ) : (
            <pre style={{ margin: 0, padding: 0, fontSize: 12, lineHeight: 1.65, fontFamily: T.m }}>
              {lines.map((line, i) => {
                const ls = lineStyle(line);
                const isDiff = line.startsWith("+") || line.startsWith("-") || line.startsWith("@@");
                const html = !isDiff ? highlight(line, change.language) : null;
                return (
                  <div key={i} style={{ display: "flex", minHeight: 20, ...ls }}>
                    <span style={{ display: "inline-block", width: 52, textAlign: "right", paddingRight: 12, color: T.ter, fontSize: 11, flexShrink: 0, userSelect: "none", opacity: 0.6 }}>{i + 1}</span>
                    {html ? (
                      <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", flex: 1 }} dangerouslySetInnerHTML={{ __html: html }} />
                    ) : (
                      <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", color: ls.color || T.text, flex: 1 }}>{line}</span>
                    )}
                  </div>
                );
              })}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

const CW = 272, CH = 160, GX = 64, GY = 28;

function layout(steps: Card[]) {
  const cols: Record<string, number> = {}, vis = new Set<string>();
  function d(s: Card): number {
    if (vis.has(s.id)) return cols[s.id] || 0; vis.add(s.id);
    if (!s.dependencies.length) { cols[s.id] = 0; return 0; }
    cols[s.id] = 1 + Math.max(...s.dependencies.map(x => { const f = steps.find(z => z.id === x); return f ? d(f) : 0; }));
    return cols[s.id];
  }
  steps.forEach(d);
  const g: Record<number, string[]> = {};
  steps.forEach(s => { const c = cols[s.id] || 0; (g[c] = g[c] || []).push(s.id); });
  // Sort within each column by card order
  const orderMap = new Map(steps.map(s => [s.id, s.order ?? 0]));
  Object.values(g).forEach(ids => ids.sort((a, b) => (orderMap.get(a) ?? 0) - (orderMap.get(b) ?? 0)));
  const p: Record<string, { x: number; y: number }> = {};
  Object.keys(g).sort((a, b) => +a - +b).forEach(c => {
    const ids = g[+c], th = ids.length * CH + (ids.length - 1) * GY, sy = -th / 2;
    ids.forEach((id, i) => { p[id] = { x: +c * (CW + GX), y: sy + i * (CH + GY) }; });
  });
  return p;
}

const Conns = memo(function Conns({ steps, pos }: any) {
  return <>{steps.flatMap((s: Card) => s.dependencies.map(dep => {
    const f = pos[dep], t = pos[s.id]; if (!f || !t) return null;
    const x1 = f.x + CW, y1 = f.y + CH / 2, x2 = t.x, y2 = t.y + CH / 2, mx = (x1 + x2) / 2;
    return <g key={`${dep}-${s.id}`}><path d={`M${x1} ${y1}C${mx} ${y1},${mx} ${y2},${x2} ${y2}`} fill="none" stroke={T.border} strokeWidth={1.5} strokeDasharray="4 3" /><circle cx={x2} cy={y2} r={3} fill={T.accent} opacity={0.5} /></g>;
  }))}</>;
});

const SCard = memo(function SCard({ step, pos, sel, onSel, onDrag, fbc, fbt, vm, planTitle, planId, onFileClick, highlight }: any) {
  const tc = TC[step.type] || TC.research, fl = vm === "flow";
  const hlColor = highlight === "added" ? T.green : highlight === "modified" ? T.orange : null;
  const dragRef = useRef(false);
  const handleMouseDown = useCallback((e: any) => { dragRef.current = false; if (fl) { e.preventDefault(); } onDrag(e, step.id); }, [fl, onDrag, step.id]);
  const handleMouseMove = useCallback(() => { dragRef.current = true; }, []);
  const handleClick = useCallback(() => { if (!dragRef.current) onSel(step.id); }, [onSel, step.id]);
  const fc: Record<string, FileChange> | undefined = step.fileChanges;
  const borderColor = hlColor || (sel ? T.accent : T.border);
  return (
    <div onClick={handleClick} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
      style={{ position: fl ? "absolute" : "relative", left: fl ? Math.round(pos.x) : undefined, top: fl ? Math.round(pos.y) : undefined, width: fl ? CW : "100%", minHeight: fl ? CH : undefined, maxHeight: fl ? CH : undefined, overflow: fl ? "hidden" : undefined, background: T.surface, border: `1.5px solid ${borderColor}`, borderRadius: 8, padding: "11px 13px", cursor: fl ? "grab" : "default", fontFamily: T.f, display: "flex", flexDirection: "column", gap: 5, userSelect: "none", zIndex: sel ? 10 : 1, marginBottom: fl ? 0 : 6, WebkitUserSelect: "none", boxShadow: hlColor ? `0 0 12px ${hlColor}40` : undefined, willChange: fl ? "left, top" : undefined }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <span style={{ background: tc.bg, color: tc.c, fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, fontFamily: T.m, display: "inline-flex", alignItems: "center", gap: 3 }}>{tc.icon(tc.c, 9)} {tc.l}</span>
          {fbc > 0 && <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>{fbt.includes("issue") && Ico.alert(T.red, 8)}{fbt.includes("directive") && Ico.bolt(T.orange, 8)}{fbt.includes("question") && Ico.question(T.accent, 8)}<span style={{ background: T.raised, color: T.sec, fontSize: 8, fontWeight: 700, padding: "0 4px", borderRadius: 4, lineHeight: "14px" }}>{fbc}</span></span>}
        </div>
        <CopyRef planTitle={planTitle} planId={planId} cardTitle={step.title} cardId={step.id} size={8} />
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text, lineHeight: 1.35 }}>{step.title}</div>
      <div style={{ fontSize: 10.5, color: T.sec, lineHeight: 1.5, flex: 1, overflow: "hidden", maxHeight: 80 }}><Md text={step.description.length > 300 ? step.description.slice(0, 300) + "…" : step.description} fontSize={10.5} color={T.sec} lineHeight={1.5} /></div>
      <div style={{ fontSize: 9, color: T.sec, fontFamily: T.m, display: "flex", alignItems: "center", gap: 3 }}>{Ico.folder(T.sec, 9)} {step.repo}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
        {step.files.slice(0, 3).map((f: string) => {
          const hasChange = fc && fc[f];
          return <span key={f} onClick={e => { if (hasChange) { e.stopPropagation(); onFileClick(f, fc[f]); } }}
            style={{ fontSize: 8, color: tc.c, background: tc.bg, padding: "1px 5px", borderRadius: 3, fontFamily: T.m, cursor: hasChange ? "pointer" : "default", display: "inline-flex", alignItems: "center", gap: 3 }}>
            {hasChange && <span style={{ width: 5, height: 5, borderRadius: "50%", background: hasChange.changeType === "create" ? T.green : hasChange.changeType === "delete" ? T.red : T.orange, flexShrink: 0 }} />}
            {f.split("/").pop()}
          </span>;
        })}
      </div>
    </div>
  );
}, (prev, next) =>
  prev.step === next.step &&
  prev.sel === next.sel &&
  prev.fbc === next.fbc &&
  prev.highlight === next.highlight &&
  prev.vm === next.vm &&
  prev.pos?.x === next.pos?.x &&
  prev.pos?.y === next.pos?.y
);

function FeedbackItem({ fb, onDel }: { fb: Feedback; onDel: ((id: string) => void) | null }) {
  const f = FB[fb.type];
  const [hover, setHover] = useState(false);

  return (
    <div style={{ background: f.bg, border: `1px solid ${f.border}`, borderRadius: 10, padding: 0, marginBottom: 10, overflow: "hidden" }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "10px 12px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 20, height: 20, borderRadius: 5, background: `${f.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {f.icon(f.color, 11)}
          </div>
          <span style={{ fontSize: 9.5, fontWeight: 700, color: f.color, fontFamily: T.m, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>{f.label}</span>
        </div>
        {onDel && <button onClick={() => onDel(fb.id)}
          style={{ background: hover ? "rgba(255,255,255,0.08)" : "none", border: "none", color: T.sec, cursor: "pointer", fontSize: 12, fontWeight: 600, opacity: hover ? 1 : 0.2, transition: "all 0.15s", padding: "2px 5px", borderRadius: 4, lineHeight: 1 }}>{"\u2715"}</button>}
      </div>
      <div style={{ padding: "8px 12px 11px", fontSize: 12, color: T.text, lineHeight: 1.7, letterSpacing: "-0.01em" }}>
        {fb.text}
      </div>

      {fb.type === "question" && fb.answer && (
        <div style={{ borderTop: `1px solid ${f.border}`, padding: "10px 12px", background: "rgba(48,209,88,0.04)" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <div style={{ width: 18, height: 18, borderRadius: 5, background: T.gD, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
              {Ico.check(T.green, 10)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: T.green, fontFamily: T.m, textTransform: "uppercase" as const, marginBottom: 4, letterSpacing: "0.04em" }}>Answered</div>
              <div style={{ fontSize: 12, color: T.text, lineHeight: 1.7, letterSpacing: "-0.01em" }}><Md text={fb.answer || ""} fontSize={12} color={T.text} lineHeight={1.7} /></div>
            </div>
          </div>
        </div>
      )}

      {fb.type === "question" && !fb.answer && (
        <div style={{ borderTop: `1px solid ${f.border}`, padding: "8px 12px", display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.orange, opacity: 0.6, animation: "pulse 2s ease-in-out infinite" }} />
          <span style={{ fontSize: 10, color: T.ter, fontStyle: "italic" }}>Waiting for answer from Coding Agent...</span>
        </div>
      )}

      {fb.type !== "question" && (
        <div style={{ borderTop: `1px solid ${f.border}`, padding: "6px 12px", display: "flex", alignItems: "center", gap: 6 }}>
          {fb.read ? (
            <>{Ico.check(T.green, 9)} <span style={{ fontSize: 9.5, color: T.green, fontFamily: T.m, fontWeight: 600 }}>Acknowledged</span></>
          ) : (
            <><div style={{ width: 6, height: 6, borderRadius: "50%", background: f.color, opacity: 0.6, animation: "pulse 2s ease-in-out infinite" }} /><span style={{ fontSize: 10, color: T.ter, fontStyle: "italic" }}>Pending</span></>
          )}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 9.5, color: T.ter, fontWeight: 700, marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 6 }}>
    {children}
    <div style={{ flex: 1, height: 1, background: T.border, opacity: 0.5 }} />
  </div>;
}

function Detail({ step, fbs, onClose, onAdd, onDel, planTitle, planId, onFileClick, steps, onSelectCard, readOnly }: any) {
  const [ft, setFt] = useState<"question" | "directive" | "issue">("question");
  const [txt, setTxt] = useState("");
  const r = useRef<HTMLTextAreaElement>(null);
  const tc = TC[step.type] || TC.research;
  const sf: Feedback[] = fbs.filter((f: Feedback) => f.cardId === step.id);
  const add = () => { if (!txt.trim()) return; onAdd(step.id, ft, txt.trim()); setTxt(""); r.current?.focus(); };
  const fc: Record<string, FileChange> | undefined = step.fileChanges;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: T.bg }}>
      {/* Header */}
      <div style={{ padding: "14px 16px", background: T.surface, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ background: tc.bg, color: tc.c, fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 5, fontFamily: T.m, display: "inline-flex", alignItems: "center", gap: 4 }}>{tc.icon(tc.c, 9)} {tc.l}</span>
            {readOnly && <span style={{ background: T.oD, color: T.orange, fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 5, fontFamily: T.m, display: "inline-flex", alignItems: "center", gap: 4 }}>{Ico.clock(T.orange, 9)} Old Version</span>}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.ter, cursor: "pointer", fontSize: 14, width: 22, height: 22, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.12s" }}
            onMouseEnter={(e: any) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = T.text; }}
            onMouseLeave={(e: any) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = T.ter; }}>{"\u2715"}</button>
        </div>
        <h3 data-selectable style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: T.text, lineHeight: 1.35, letterSpacing: "-0.01em" }}>{step.title}</h3>
        {!readOnly && <CopyRef planTitle={planTitle} planId={planId} cardTitle={step.title} cardId={step.id} size={8} />}
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column" }}>
        {/* Description */}
        <div data-selectable style={{ padding: "14px 16px 12px" }}>
          <Md text={step.description} />
        </div>

        {/* Repository */}
        <div style={{ padding: "0 16px 14px" }}>
          <SectionLabel>Repository</SectionLabel>
          <div style={{ fontSize: 11, color: T.accent, background: T.aD, padding: "7px 10px", borderRadius: 6, fontFamily: T.m, display: "flex", alignItems: "center", gap: 5, wordBreak: "break-all" as const, lineHeight: 1.4 }}>{Ico.folder(T.accent, 11)} {step.repo}</div>
        </div>

        {/* Files */}
        <div style={{ padding: "0 16px 14px" }}>
          <SectionLabel>Files</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {step.files.map((f: string) => {
              const hasChange = fc && fc[f];
              const changeColor = hasChange ? (hasChange.changeType === "create" ? T.green : hasChange.changeType === "delete" ? T.red : T.orange) : null;
              return <div key={f} className="detail-file" onClick={() => { if (hasChange) onFileClick(f, fc[f]); }}
                style={{ fontSize: 10.5, color: T.sec, background: T.surface, padding: "6px 10px", borderRadius: 6, fontFamily: T.m, wordBreak: "break-all" as const, lineHeight: 1.5, cursor: hasChange ? "pointer" : "default", display: "flex", alignItems: "center", gap: 6, border: `1px solid ${T.border}`, transition: "all 0.12s" }}
                onMouseEnter={(e: any) => { if (hasChange) { e.currentTarget.style.borderColor = changeColor; e.currentTarget.style.background = T.raised; } }}
                onMouseLeave={(e: any) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.surface; }}>
                {hasChange && <span style={{ width: 7, height: 7, borderRadius: "50%", background: changeColor!, flexShrink: 0, boxShadow: `0 0 6px ${changeColor}40` }} />}
                <span style={{ flex: 1, minWidth: 0 }}>{f}</span>
              </div>;
            })}
          </div>
        </div>

        {/* Dependencies */}
        {step.dependencies.length > 0 && <div style={{ padding: "0 16px 14px" }}>
          <SectionLabel>Depends on</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>{step.dependencies.map((d: string) => {
            const depCard = (steps as Card[])?.find((s: Card) => s.id === d);
            const depTc = depCard ? (TC[depCard.type] || TC.research) : null;
            return <div key={d} className="dep-row" onClick={() => { if (!readOnly) onSelectCard(d); }}
              style={{ fontSize: 10.5, color: T.sec, background: T.surface, padding: "6px 10px", borderRadius: 6, fontFamily: T.f, wordBreak: "break-all" as const, lineHeight: 1.4, cursor: readOnly ? "default" : "pointer", display: "flex", alignItems: "center", gap: 7, border: `1px solid ${T.border}`, transition: "all 0.12s", opacity: readOnly ? 0.6 : 1 }}
              onMouseEnter={(e: any) => { if (!readOnly) { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.background = T.raised; } }}
              onMouseLeave={(e: any) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.surface; }}>
              {depTc && <span style={{ background: depTc.bg, color: depTc.c, fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 3, fontFamily: T.m, flexShrink: 0 }}>{depTc.l}</span>}
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{depCard?.title || d}</span>
              <span style={{ flexShrink: 0, opacity: 0.4, transition: "opacity 0.12s" }} className="dep-goto">{Ico.goto(T.accent, 11)}</span>
            </div>;
          })}</div>
        </div>}

        {/* Divider */}
        <div style={{ height: 1, background: T.border, margin: "0 16px" }} />

        {/* Feedback section */}
        <div style={{ padding: "14px 16px 16px", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <span style={{ fontSize: 10, color: T.text, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>Feedback</span>
            {sf.length > 0 && <span style={{ fontSize: 8.5, color: T.sec, fontFamily: T.m, background: T.surface, padding: "2px 7px", borderRadius: 5, border: `1px solid ${T.border}` }}>{sf.length}</span>}
          </div>

          {sf.length === 0 && (
            <div style={{ textAlign: "center", padding: "20px 12px", color: T.ter, fontSize: 11, lineHeight: 1.7, background: T.surface, borderRadius: 8, border: `1px dashed ${T.border}` }}>
              No feedback yet.{!readOnly && <><br/>Add a question, directive, or report an issue.</>}
            </div>
          )}
          {sf.map(fb => (
            <FeedbackItem key={fb.id} fb={fb} onDel={readOnly ? null : onDel} />
          ))}

          {/* Add feedback — hidden in readOnly */}
          {!readOnly && (
          <div style={{ marginTop: sf.length > 0 ? 14 : 10, background: T.surface, borderRadius: 10, border: `1px solid ${T.border}`, overflow: "hidden" }}>
            <div style={{ display: "flex", borderBottom: `1px solid ${T.border}` }}>
              {Object.entries(FB).map(([k, v]) => {
                const active = ft === k;
                return (
                  <button key={k} onClick={() => setFt(k as any)}
                    style={{ flex: 1, background: active ? v.bg : "transparent", color: active ? v.color : T.ter, border: "none", borderBottom: active ? `2px solid ${v.color}` : "2px solid transparent", padding: "8px 0", fontSize: 9.5, fontWeight: 600, cursor: "pointer", fontFamily: T.m, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, transition: "all 0.12s" }}>
                    {v.icon(active ? v.color : T.ter, 10)}
                    {v.label}
                  </button>
                );
              })}
            </div>
            <div style={{ padding: "10px 10px 8px" }}>
              <textarea
                ref={r}
                value={txt}
                onChange={e => setTxt(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); add(); } }}
                placeholder={ft === "question" ? "Ask a question about this step..." : ft === "directive" ? "Give a directive for this step..." : "Describe the issue..."}
                rows={3}
                style={{ width: "100%", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 11px", fontSize: 11.5, color: T.text, fontFamily: T.f, resize: "none", outline: "none", lineHeight: 1.65, boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <span style={{ fontSize: 9, color: T.ter, fontFamily: T.m }}>Enter to send</span>
                <button onClick={add}
                  style={{ background: txt.trim() ? FB[ft].color : T.border, border: "none", borderRadius: 6, padding: "6px 16px", fontSize: 10, fontWeight: 600, color: txt.trim() ? "#fff" : T.ter, cursor: txt.trim() ? "pointer" : "default", display: "flex", alignItems: "center", gap: 5, fontFamily: T.f, transition: "all 0.15s" }}>
                  {Ico.send(txt.trim() ? "#fff" : T.ter, 10)}
                  Send
                </button>
              </div>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HistoryPanel({ entries, histIdx, onSelect, onClose, onClear }: {
  entries: HistoryEntry[];
  histIdx: number | null;
  onSelect: (idx: number | null) => void;
  onClose: () => void;
  onClear: () => void;
}) {
  const diff: HistoryDiff | null = useMemo(() => {
    if (histIdx === null || histIdx < 0 || histIdx >= entries.length) return null;
    const current = entries[histIdx].cards;
    const prev = histIdx > 0 ? entries[histIdx - 1].cards : [];
    return computeDiff(prev, current);
  }, [entries, histIdx]);

  const fmtTime = (ts: number) => {
    const d = new Date(ts);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: T.bg }}>
      <div style={{ padding: "14px 16px", background: T.surface, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {Ico.clock(T.accent, 13)}
            <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>History</span>
            <span style={{ fontSize: 9, color: T.sec, fontFamily: T.m, background: T.raised, padding: "2px 7px", borderRadius: 5, border: `1px solid ${T.border}` }}>{entries.length}</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.ter, cursor: "pointer", fontSize: 14, width: 22, height: 22, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.12s" }}
            onMouseEnter={(e: any) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = T.text; }}
            onMouseLeave={(e: any) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = T.ter; }}>{"\u2715"}</button>
        </div>
        {entries.length > 0 && (
          <button onClick={onClear} style={{ background: "none", border: `1px solid ${T.border}`, color: T.sec, cursor: "pointer", fontSize: 9, padding: "3px 8px", borderRadius: 4, fontFamily: T.m, transition: "all 0.12s" }}
            onMouseEnter={(e: any) => { e.currentTarget.style.borderColor = T.red; e.currentTarget.style.color = T.red; }}
            onMouseLeave={(e: any) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.sec; }}>Clear history</button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "8px 12px" }}>
        {entries.length === 0 && (
          <div style={{ textAlign: "center", padding: "30px 12px", color: T.ter, fontSize: 11, lineHeight: 1.7 }}>
            No history yet.<br/>Changes will appear here as cards are added, modified, or removed.
          </div>
        )}
        {[...entries].reverse().map((entry, ri) => {
          const idx = entries.length - 1 - ri;
          const active = histIdx === idx;
          const ac: Record<string, { l: string; c: string; bg: string; icon: (c: string, s?: number) => JSX.Element }> = {
            add_card: { l: "Add", c: T.green, bg: T.gD, icon: Ico.plus },
            add_cards: { l: "Batch Add", c: T.green, bg: T.gD, icon: Ico.plus },
            remove_card: { l: "Remove", c: T.red, bg: T.rD, icon: Ico.trash },
            clear_plan: { l: "Clear", c: T.red, bg: T.rD, icon: Ico.trash },
            update_card: { l: "Update", c: T.orange, bg: T.oD, icon: Ico.pencil },
            reorder_cards: { l: "Reorder", c: T.purple, bg: T.pD, icon: Ico.arrange },
          };
          const chip = ac[entry.action];
          return (
            <div key={entry.id} onClick={() => onSelect(active ? null : idx)}
              style={{ padding: "8px 10px", borderRadius: 7, cursor: "pointer", marginBottom: 3, background: active ? T.aD : "transparent", border: `1px solid ${active ? T.accent : "transparent"}`, transition: "all 0.12s" }}
              onMouseEnter={(e: any) => { if (!active) e.currentTarget.style.background = T.sH; }}
              onMouseLeave={(e: any) => { e.currentTarget.style.background = active ? T.aD : "transparent"; }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                {chip && <span style={{ fontSize: 8, fontWeight: 700, color: chip.c, background: chip.bg, padding: "2px 6px", borderRadius: 4, fontFamily: T.m, display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0 }}>{chip.icon(chip.c, 8)} {chip.l}</span>}
                <span style={{ fontSize: 11, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.description}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 9, color: T.ter, fontFamily: T.m }}>{fmtTime(entry.timestamp)}</span>
                <span style={{ fontSize: 9, color: T.sec, fontFamily: T.m, background: T.raised, padding: "1px 5px", borderRadius: 3 }}>{entry.cards.length} cards</span>
              </div>
            </div>
          );
        })}

      </div>
    </div>
  );
}

export default function App() {
  const [st, setSt] = useState<AppState>({ plans: [], feedbacks: [], positions: {} });
  const [aId, setAId] = useState<string | null>(null);
  const [sId, setSId] = useState<string | null>(null);
  const [vm, setVm] = useState("flow");
  const [conn, setConn] = useState(false);
  const [cv, setCv] = useState<{ path: string; change: FileChange } | null>(null);
  const [di, setDi] = useState<any>(null);
  const [cp, setCp] = useState<Record<string, { x: number; y: number }>>({});
  const cr = useRef<HTMLDivElement>(null);
  const [off, setOff] = useState({ x: 50, y: 260 });
  const [z, setZ] = useState(1);
  const [ip, setIp] = useState(false);
  const [ps, setPs] = useState<any>(null);
  const [pm, setPm] = useState<string | null>(null); // plan menu open for plan id
  const [toast, setToast] = useState<{ text: string; file: string; error?: boolean } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [em, setEm] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [histIdx, setHistIdx] = useState<number | null>(null);
  const [oldCard, setOldCard] = useState<Card | null>(null);

  // Disable right-click context menu
  useEffect(() => {
    const prevent = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", prevent);
    return () => document.removeEventListener("contextmenu", prevent);
  }, []);

  // Prevent webview zoom globally
  useEffect(() => {
    const globalHandler = (e: WheelEvent) => { if (e.ctrlKey || e.metaKey) e.preventDefault(); };
    document.addEventListener("wheel", globalHandler, { passive: false });
    return () => document.removeEventListener("wheel", globalHandler);
  }, []);

  // Canvas wheel handler — attach via ref callback so it works after mount
  const wheelRef = useRef<((e: WheelEvent) => void) | null>(null);
  if (!wheelRef.current) {
    wheelRef.current = (e: WheelEvent) => {
      e.preventDefault();
      const rect = cr.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      if (e.ctrlKey || e.metaKey) {
        setZ(prev => {
          const next = Math.max(0.1, Math.min(5, prev - e.deltaY * 0.01));
          const ratio = next / prev;
          setOff(o => ({ x: mx - (mx - o.x) * ratio, y: my - (my - o.y) * ratio }));
          return next;
        });
      } else {
        setOff(o => ({ x: o.x - e.deltaX, y: o.y - e.deltaY }));
      }
    };
  }
  useEffect(() => {
    const el = cr.current;
    if (!el || !wheelRef.current) return;
    el.addEventListener("wheel", wheelRef.current, { passive: false });
    return () => { el.removeEventListener("wheel", wheelRef.current!, { passive: false } as any); };
  });

  // Linux trackpad pinch-to-zoom (forwarded from GTK gesture via Rust)
  useEffect(() => {
    (window as any).__fpPinchZoom = (deltaY: number) => {
      const el = cr.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const mx = rect.width / 2;
      const my = rect.height / 2;
      setZ(prev => {
        const next = Math.max(0.1, Math.min(5, prev - deltaY * 0.003));
        const ratio = next / prev;
        setOff(o => ({ x: mx - (mx - o.x) * ratio, y: my - (my - o.y) * ratio }));
        return next;
      });
    };
    return () => { delete (window as any).__fpPinchZoom; };
  }, []);

  useEffect(() => {
    if (!pm) return;
    const close = () => setPm(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [pm]);

  useEffect(() => {
    if (!em) return;
    const close = () => setEm(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [em]);

  // Poll MCP server state
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const s = await api.fetchState();
        if (alive) {
          setSt(s);
          setConn(true);
          if (s.plans.length) {
            if (!aId || !s.plans.some(p => p.id === aId)) setAId(s.plans[0].id);
          } else {
            setAId(null);
          }
        }
      } catch (err) {
        if (alive) { setConn(false); }
      }
    };
    poll(); const iv = setInterval(poll, 1500);
    return () => { alive = false; clearInterval(iv); };
  }, [aId]);

  // Load saved positions when switching plans
  useEffect(() => {
    setSId(null);
    setHistOpen(false);
    setHistIdx(null);
    setOff({ x: 50, y: 260 });
    setZ(1);
    if (aId && st.positions[aId]) {
      setCp(st.positions[aId]);
    } else {
      setCp({});
    }
  }, [aId]);

  // Fetch history when panel opens or plan changes
  useEffect(() => {
    if (!histOpen || !aId) { setHistory([]); setHistIdx(null); return; }
    let alive = true;
    const load = async () => {
      try {
        const h = await api.fetchHistory(aId);
        if (alive) setHistory(h.entries || []);
      } catch { if (alive) setHistory([]); }
    };
    load();
    const iv = setInterval(load, 3000);
    return () => { alive = false; clearInterval(iv); };
  }, [histOpen, aId]);

  const plan = st.plans.find(p => p.id === aId);
  const steps = plan?.steps || [];
  const sortedSteps = useMemo(() => [...steps].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [steps]);
  const ap = useMemo(() => layout(steps), [steps]);
  const pos = useMemo(() => { const p = { ...ap }; Object.keys(cp).forEach(k => { if (p[k]) p[k] = cp[k]; }); return p; }, [ap, cp]);
  const ss = steps.find(s => s.id === sId);
  const [fcm, ftm] = useMemo(() => { const counts: Record<string, number> = {}; const types: Record<string, string[]> = {}; st.feedbacks.forEach(f => { counts[f.cardId] = (counts[f.cardId] || 0) + 1; if (!types[f.cardId]) types[f.cardId] = []; if (!types[f.cardId].includes(f.type)) types[f.cardId].push(f.type); }); return [counts, types] as const; }, [st.feedbacks]);
  const fbp = useMemo(() => { const c2p: Record<string, string> = {}; st.plans.forEach(p => p.steps.forEach(s => { c2p[s.id] = p.id; })); const m: Record<string, number> = {}; st.feedbacks.forEach(f => { const pid = c2p[f.cardId]; if (pid) m[pid] = (m[pid] || 0) + 1; }); return m; }, [st]);

  // Card highlight map from history diff
  const hlMap = useMemo<Record<string, "added" | "modified">>(() => {
    if (!histOpen || histIdx === null || histIdx >= history.length) return {};
    const current = history[histIdx].cards;
    const prev = histIdx > 0 ? history[histIdx - 1].cards : [];
    const diff = computeDiff(prev, current);
    const m: Record<string, "added" | "modified"> = {};
    diff.added.forEach(c => { m[c.id] = "added"; });
    diff.modified.forEach(c => { m[c.after.id] = "modified"; });
    return m;
  }, [histOpen, histIdx, history]);

  const noop = useCallback(() => {}, []);
  const listPos = useMemo(() => ({ x: 0, y: 0 }), []);

  // Save positions to backend (debounced)
  const persistPositions = useCallback((newCp: Record<string, { x: number; y: number }>) => {
    if (!aId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api.savePositions(aId, newCp).catch(() => {});
    }, 500);
  }, [aId]);

  const onFileClick = useCallback((path: string, change: FileChange) => { setCv({ path, change }); }, []);

  const selectCard = useCallback((id: string) => {
    setSId(id);
    setHistOpen(false);
    setHistIdx(null);
  }, []);

  const arrangeCards = useCallback(() => {
    if (!aId) return;
    // Clear custom positions → fall back to auto-layout (sorted by order + deps)
    setCp({});
    // Persist the cleared positions
    api.savePositions(aId, {}).catch(() => {});
    // Recenter viewport: compute bounding box of auto-layout
    const vals = Object.values(ap);
    if (!vals.length) return;
    const rect = cr.current?.getBoundingClientRect();
    if (!rect) return;
    const minX = Math.min(...vals.map(p => p.x));
    const minY = Math.min(...vals.map(p => p.y));
    const maxX = Math.max(...vals.map(p => p.x)) + CW;
    const maxY = Math.max(...vals.map(p => p.y)) + CH;
    const cw = maxX - minX, ch = maxY - minY;
    const scale = Math.min(1, Math.min((rect.width - 80) / cw, (rect.height - 80) / ch));
    setZ(Math.max(0.1, Math.min(5, scale)));
    setOff({
      x: (rect.width - cw * scale) / 2 - minX * scale,
      y: (rect.height - ch * scale) / 2 - minY * scale,
    });
  }, [aId, ap]);

  const exportSvg = useCallback(() => {
    if (!plan || !steps.length) return;
    const pad = 40;
    const ap2 = Object.entries(pos);
    const minX = Math.min(...ap2.map(([, p]) => p.x)) - pad;
    const minY = Math.min(...ap2.map(([, p]) => p.y)) - pad;
    const maxX = Math.max(...ap2.map(([, p]) => p.x)) + CW + pad;
    const maxY = Math.max(...ap2.map(([, p]) => p.y)) + CH + pad;
    const w = maxX - minX, h = maxY - minY;

    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const tcData: Record<string, { l: string; c: string; bg: string }> = {
      research: { l: "Research", c: T.accent, bg: T.aD },
      planning: { l: "Planning", c: T.purple, bg: T.pD },
      create: { l: "Create", c: T.green, bg: T.gD },
      edit: { l: "Edit", c: T.orange, bg: T.oD },
      test: { l: "Test", c: T.teal, bg: T.tD },
    };

    // Connections
    let conns = "";
    steps.forEach((s: Card) => s.dependencies.forEach(dep => {
      const f = pos[dep], t = pos[s.id];
      if (!f || !t) return;
      const x1 = f.x + CW, y1 = f.y + CH / 2, x2 = t.x, y2 = t.y + CH / 2, mx = (x1 + x2) / 2;
      conns += `<path d="M${x1} ${y1}C${mx} ${y1},${mx} ${y2},${x2} ${y2}" fill="none" stroke="${T.border}" stroke-width="1.5" stroke-dasharray="4 3"/>`;
      conns += `<circle cx="${x2}" cy="${y2}" r="3" fill="${T.accent}" opacity="0.5"/>`;
    }));

    // Cards
    let cards = "";
    steps.forEach((s: Card) => {
      const p = pos[s.id];
      if (!p) return;
      const tc = tcData[s.type] || tcData.research;
      const x = p.x, y = p.y;

      // Truncate helpers
      const truncDesc = (text: string, max: number) => text.length > max ? text.slice(0, max) + "..." : text;
      const desc = truncDesc(s.description, 120);
      const fileNames = s.files.slice(0, 3).map(f => f.split("/").pop() || f);

      cards += `<g transform="translate(${x},${y})">`;
      // Card bg
      cards += `<rect width="${CW}" height="${CH}" rx="8" fill="${T.surface}" stroke="${T.border}" stroke-width="1.5"/>`;
      // Type badge
      cards += `<rect x="11" y="11" width="${tc.l.length * 6.5 + 16}" height="16" rx="4" fill="${tc.bg}"/>`;
      cards += `<text x="19" y="22.5" font-family="SF Mono, JetBrains Mono, monospace" font-size="9" font-weight="700" fill="${tc.c}">${esc(tc.l)}</text>`;
      // Title
      cards += `<text x="13" y="44" font-family="-apple-system, BlinkMacSystemFont, Helvetica Neue, sans-serif" font-size="12.5" font-weight="600" fill="${T.text}">${esc(s.title.length > 35 ? s.title.slice(0, 35) + "..." : s.title)}</text>`;
      // Description (wrap ~2 lines)
      const descLines: string[] = [];
      let line = "", words = desc.split(" ");
      for (const word of words) {
        if ((line + " " + word).length > 42) { descLines.push(line); line = word; if (descLines.length >= 2) break; }
        else line = line ? line + " " + word : word;
      }
      if (descLines.length < 2 && line) descLines.push(line);
      descLines.forEach((dl, i) => {
        cards += `<text x="13" y="${60 + i * 14}" font-family="-apple-system, BlinkMacSystemFont, Helvetica Neue, sans-serif" font-size="10.5" fill="${T.sec}" opacity="0.8">${esc(dl)}${i === 1 && words.length > descLines.join(" ").split(" ").length ? "..." : ""}</text>`;
      });
      // Repo
      const repoY = 100;
      cards += `<text x="13" y="${repoY}" font-family="SF Mono, JetBrains Mono, monospace" font-size="9" fill="${T.sec}">${esc((s.repo || "").length > 38 ? s.repo.slice(0, 38) + "..." : s.repo)}</text>`;
      // Files - clip to card width
      const maxFx = CW - 13;
      let fx = 13;
      fileNames.forEach(fn => {
        const truncFn = fn.length > 22 ? fn.slice(0, 20) + ".." : fn;
        const fw = Math.min(truncFn.length * 5.2 + 12, maxFx - fx);
        if (fx + 30 > maxFx) return; // no room for another badge
        cards += `<g><clipPath id="fc-${s.id}-${fx}"><rect x="${fx}" y="${repoY + 8}" width="${fw}" height="15" rx="3"/></clipPath>`;
        cards += `<rect x="${fx}" y="${repoY + 8}" width="${fw}" height="15" rx="3" fill="${tc.bg}"/>`;
        cards += `<text clip-path="url(#fc-${s.id}-${fx})" x="${fx + 6}" y="${repoY + 19}" font-family="SF Mono, JetBrains Mono, monospace" font-size="8" fill="${tc.c}">${esc(truncFn)}</text></g>`;
        fx += fw + 4;
      });
      cards += `</g>`;
    });

    // Title watermark
    const title = `<text x="${minX + pad}" y="${minY + pad - 10}" font-family="-apple-system, BlinkMacSystemFont, Helvetica Neue, sans-serif" font-size="16" font-weight="700" fill="${T.text}" opacity="0.6">${esc(plan.title)}</text>`;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${w} ${h}" width="${w}" height="${h}">
<rect x="${minX}" y="${minY}" width="${w}" height="${h}" fill="${T.bg}" rx="0"/>
${title}
${conns}
${cards}
</svg>`;

    const fileName = `${plan.title.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-").toLowerCase() || "flowplan"}.svg`;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setToast({ text: "Exported", file: `~/Downloads/${fileName}` });
    setTimeout(() => setToast(null), 4000);
  }, [plan, steps, pos]);

  const exportJson = useCallback(() => {
    if (!plan) return;
    const fileName = `${plan.title.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-").toLowerCase() || "flowplan"}.json`;
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setToast({ text: "Exported", file: `~/Downloads/${fileName}` });
    setTimeout(() => setToast(null), 4000);
  }, [plan]);

  const importPlan = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.title || !Array.isArray(data.steps)) throw new Error("invalid");
        const result = await api.importPlan(data);
        setAId(result.id);
        setToast({ text: "Imported", file: data.title });
        setTimeout(() => setToast(null), 4000);
      } catch {
        setToast({ text: "Could not import plan", file: file.name, error: true });
        setTimeout(() => setToast(null), 4000);
      }
    };
    input.click();
  }, []);

  const animRef = useRef<number>(0);
  const focusCard = useCallback((cardId: string) => {
    const p = pos[cardId];
    if (!p) return;
    setSId(cardId);
    if (vm !== "flow") return;
    const rect = cr.current?.getBoundingClientRect();
    if (!rect) return;
    // Account for sidebar (210px) and possible drawer (320px)
    const cw = rect.width, ch = rect.height;
    const targetX = cw / 2 - (p.x + CW / 2) * z;
    const targetY = ch / 2 - (p.y + CH / 2) * z;
    const startX = off.x, startY = off.y;
    const dx = targetX - startX, dy = targetY - startY;
    const start = performance.now();
    const duration = 350;
    cancelAnimationFrame(animRef.current);
    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // easeInOutCubic
      setOff({ x: startX + dx * ease, y: startY + dy * ease });
      if (t < 1) animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
  }, [pos, z, off, vm]);

  const onDrag = useCallback((e: any, id: string) => { if (vm !== "flow") return; e.preventDefault(); e.stopPropagation(); const p = pos[id]; setDi({ id, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y }); }, [pos, vm]);

  useEffect(() => {
    if (!di) return;
    const mv = (e: MouseEvent) => {
      setCp(p => {
        const next = { ...p, [di.id]: { x: di.ox + (e.clientX - di.sx) / z, y: di.oy + (e.clientY - di.sy) / z } };
        return next;
      });
    };
    const up = () => {
      setDi(null);
      // Persist positions after drag ends
      setCp(current => {
        persistPositions(current);
        return current;
      });
    };
    window.addEventListener("mousemove", mv);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); };
  }, [di, z, persistPositions]);

  const ocd = useCallback((e: any) => { if (e.target === cr.current || e.target.tagName === "svg") { e.preventDefault(); setIp(true); setOff(cur => { setPs({ x: e.clientX - cur.x, y: e.clientY - cur.y }); return cur; }); setSId(null); setHistOpen(false); setHistIdx(null); setOldCard(null); } }, []);
  useEffect(() => { if (!ip || !ps) return; const mv = (e: MouseEvent) => setOff({ x: e.clientX - ps.x, y: e.clientY - ps.y }); const up = () => setIp(false); window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up); return () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); }; }, [ip, ps]);
  const ow = useCallback((e: any) => {
    e.preventDefault();
    const rect = cr.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    if (e.ctrlKey || e.metaKey) {
      // Pinch-to-zoom (trackpad) or Ctrl+scroll
      setZ(prev => {
        const next = Math.max(0.1, Math.min(5, prev - e.deltaY * 0.003));
        const ratio = next / prev;
        setOff(o => ({ x: mx - (mx - o.x) * ratio, y: my - (my - o.y) * ratio }));
        return next;
      });
    } else {
      // Regular scroll → pan
      setOff(o => ({ x: o.x - e.deltaX, y: o.y - e.deltaY }));
    }
  }, []);

  const ap2 = Object.values(pos);
  const mnX = ap2.length ? Math.min(...ap2.map(p => p.x)) - 40 : 0, mnY = ap2.length ? Math.min(...ap2.map(p => p.y)) - 40 : 0;
  const mxX = ap2.length ? Math.max(...ap2.map(p => p.x)) + CW + 40 : 100, mxY = ap2.length ? Math.max(...ap2.map(p => p.y)) + CH + 40 : 100;

  return (
    <div style={{ width: "100%", height: "100vh", background: T.bg, fontFamily: T.f, color: T.text, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:#333;border-radius:3px}textarea:focus,input:focus{border-color:${T.accent}!important;outline:none}@keyframes pulse{0%,100%{opacity:0.3}50%{opacity:1}}.plan-actions{opacity:0;transition:opacity 0.12s}.plan-row:hover .plan-actions{opacity:1}@keyframes cv-backdrop{from{opacity:0}to{opacity:1}}@keyframes cv-modal{from{opacity:0;transform:scale(0.96) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}.cv-backdrop{animation:cv-backdrop 0.18s ease-out}.cv-modal{animation:cv-modal 0.2s cubic-bezier(0.16,1,0.3,1)}.detail-file:hover .dep-goto,.dep-row:hover .dep-goto{opacity:1!important}@keyframes toast-in{from{opacity:0;transform:translateY(12px) scale(0.95)}to{opacity:1;transform:translateY(0) scale(1)}}.toast-enter{animation:toast-in 0.25s cubic-bezier(0.16,1,0.3,1)}`}</style>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Sidebar */}
        <div style={{ width: 210, background: T.sidebar, borderRight: `0.5px solid ${T.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "10px 10px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Logo size={18} />
              <span style={{ fontSize: 11, fontWeight: 700, color: T.sec, letterSpacing: "0.02em" }}>FlowPlan</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={importPlan} title="Import plan from JSON"
                style={{ background: "none", border: `0.5px solid ${T.border}`, cursor: "pointer", width: 22, height: 22, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.12s", padding: 0 }}
                onMouseEnter={(e: any) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.borderColor = T.accent; }}
                onMouseLeave={(e: any) => { e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = T.border; }}>
                {Ico.plus(T.sec, 10)}
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 7px", borderRadius: 5, background: conn ? T.gD : T.raised, border: `0.5px solid ${conn ? T.green : T.border}`, height: 22 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: conn ? T.green : T.ter, boxShadow: conn ? `0 0 5px ${T.green}` : "none" }} />
                <span style={{ fontSize: 9, fontWeight: 600, color: conn ? T.green : T.ter, fontFamily: T.m }}>MCP</span>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "0 8px" }}>
            {st.plans.length === 0 && <div style={{ padding: 20, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}><div style={{ opacity: 0.2 }}><Logo size={32} /></div><div style={{ fontSize: 10, color: T.ter, lineHeight: 1.6 }}>{conn ? 'Tell Coding Agent:\n"Create a plan and show\nin FlowPlan"' : "Connecting..."}</div></div>}
            {[...st.plans].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)).map(p => {
              const act = p.id === aId, nc = fbp[p.id] || 0, menuOpen = pm === p.id;
              return (<div key={p.id} className="plan-row" onClick={() => setAId(p.id)} style={{ padding: "8px 10px", borderRadius: 7, cursor: "pointer", marginBottom: 2, background: act ? T.sA : "transparent", transition: "background 0.1s", position: "relative" }}
                onMouseEnter={(e: any) => { if (!act) e.currentTarget.style.background = T.sH; }}
                onMouseLeave={(e: any) => { e.currentTarget.style.background = act ? T.sA : "transparent"; }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  {p.pinned && (
                    <div style={{ width: 16, height: 16, borderRadius: 4, background: T.aD, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                      {Ico.pinFill(T.accent, 9)}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: act ? T.text : T.sec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.4 }}>{p.title}</span>
                      {nc > 0 && <span style={{ background: T.accent, color: "#fff", fontSize: 7, fontWeight: 800, padding: "0 4px", borderRadius: 5, lineHeight: "13px", flexShrink: 0 }}>{nc}</span>}
                    </div>
                    <div style={{ fontSize: 9, color: T.ter, fontFamily: T.m, marginTop: 2 }}>{p.steps.length} cards</div>
                  </div>
                  <button className="plan-actions" onClick={e => { e.stopPropagation(); setPm(menuOpen ? null : p.id); }}
                    style={{ background: menuOpen ? "rgba(255,255,255,0.08)" : "none", border: "none", cursor: "pointer", width: 22, height: 22, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0, marginTop: 1, transition: "all 0.12s" }}
                    onMouseEnter={(e: any) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
                    onMouseLeave={(e: any) => { e.currentTarget.style.background = menuOpen ? "rgba(255,255,255,0.08)" : "none"; }}>
                    {Ico.dots(T.sec, 12)}
                  </button>
                </div>
                {/* Dropdown menu */}
                {menuOpen && (
                  <div onClick={e => e.stopPropagation()} style={{ position: "absolute", right: 4, top: "100%", marginTop: 2, background: T.raised, border: `1px solid ${T.border}`, borderRadius: 8, padding: 4, zIndex: 100, minWidth: 140, boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
                    <button onClick={() => {
                        setSt(prev => ({ ...prev, plans: prev.plans.map(pp => pp.id === p.id ? { ...pp, pinned: !pp.pinned } : pp) }));
                        api.togglePin(p.id).catch(() => {});
                        setPm(null);
                      }}
                      style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "6px 10px", borderRadius: 5, display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: T.text, fontFamily: T.f, transition: "background 0.1s" }}
                      onMouseEnter={(e: any) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                      onMouseLeave={(e: any) => { e.currentTarget.style.background = "none"; }}>
                      {p.pinned ? Ico.pinFill(T.accent, 12) : Ico.pin(T.sec, 12)}
                      <span>{p.pinned ? "Unpin" : "Pin"}</span>
                    </button>
                    <button onClick={() => {
                        setSt(prev => ({ ...prev, plans: prev.plans.filter(pp => pp.id !== p.id) }));
                        if (aId === p.id) setAId(null);
                        api.deletePlan(p.id).catch(() => {});
                        setPm(null);
                      }}
                      style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "6px 10px", borderRadius: 5, display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: T.red, fontFamily: T.f, transition: "background 0.1s" }}
                      onMouseEnter={(e: any) => { e.currentTarget.style.background = "rgba(255,69,58,0.08)"; }}
                      onMouseLeave={(e: any) => { e.currentTarget.style.background = "none"; }}>
                      {Ico.trash(T.red, 12)}
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>);
            })}
          </div>
          <div style={{ padding: "8px 12px", borderTop: `0.5px solid ${T.border}`, flexShrink: 0 }}>
            <div style={{ fontSize: 9, color: T.ter, fontFamily: T.m, textAlign: "center", lineHeight: 1.5 }}>Plan List</div>
          </div>
        </div>

        {/* Main */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {plan && <div style={{ height: 32, background: T.sidebar, borderBottom: `0.5px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: T.text }}>{plan.title}</span>
              <span style={{ fontSize: 9, color: T.ter, fontFamily: T.m }}>{steps.length} cards</span>
              <CopyRef planTitle={plan.title} planId={plan.id} cardTitle="" cardId="" size={8} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={() => { setHistOpen(h => !h); setSId(null); setHistIdx(null); setOldCard(null); }} title="History"
                style={{ background: histOpen ? T.aD : T.raised, border: histOpen ? `1px solid ${T.accent}` : "none", cursor: "pointer", padding: "2px 7px", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.12s" }}
                onMouseEnter={(e: any) => { if (!histOpen) e.currentTarget.style.background = "#333"; }}
                onMouseLeave={(e: any) => { if (!histOpen) e.currentTarget.style.background = T.raised; }}>
                {Ico.clock(histOpen ? T.accent : T.ter, 10)}
              </button>
              <div style={{ position: "relative" }}>
                <button onClick={e => { e.stopPropagation(); setEm(!em); }} title="Export"
                  style={{ background: em ? T.aD : T.raised, border: em ? `1px solid ${T.accent}` : "none", cursor: "pointer", padding: "2px 7px", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.12s" }}
                  onMouseEnter={(e: any) => { if (!em) e.currentTarget.style.background = "#333"; }}
                  onMouseLeave={(e: any) => { if (!em) e.currentTarget.style.background = em ? T.aD : T.raised; }}>
                  {Ico.download(em ? T.accent : T.ter, 10)}
                </button>
                {em && (
                  <div onClick={e => e.stopPropagation()} style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, background: T.raised, border: `1px solid ${T.border}`, borderRadius: 8, padding: 4, zIndex: 100, minWidth: 150, boxShadow: "0 4px 12px rgba(0,0,0,0.25)" }}>
                    <button onClick={() => { exportSvg(); setEm(false); }}
                      style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "6px 10px", borderRadius: 5, display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: T.text, fontFamily: T.f, transition: "background 0.1s" }}
                      onMouseEnter={(e: any) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                      onMouseLeave={(e: any) => { e.currentTarget.style.background = "none"; }}>
                      <span style={{ fontSize: 8, fontWeight: 700, color: T.purple, background: T.pD, padding: "1px 5px", borderRadius: 3, fontFamily: T.m }}>SVG</span>
                      <span>Export as SVG</span>
                    </button>
                    <button onClick={() => { exportJson(); setEm(false); }}
                      style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "6px 10px", borderRadius: 5, display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: T.text, fontFamily: T.f, transition: "background 0.1s" }}
                      onMouseEnter={(e: any) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                      onMouseLeave={(e: any) => { e.currentTarget.style.background = "none"; }}>
                      <span style={{ fontSize: 8, fontWeight: 700, color: T.orange, background: T.oD, padding: "1px 5px", borderRadius: 3, fontFamily: T.m }}>JSON</span>
                      <span>Export as JSON</span>
                    </button>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", background: T.raised, borderRadius: 4, overflow: "hidden", border: `0.5px solid ${T.border}` }}>{["flow","list"].map(v => <button key={v} onClick={() => setVm(v)} style={{ background: vm === v ? T.accent : "transparent", color: vm === v ? "#fff" : T.ter, border: "none", padding: "2px 8px", fontSize: 9, fontWeight: 600, cursor: "pointer", fontFamily: T.m }}>{v === "flow" ? "Flow" : "List"}</button>)}</div>
            </div>
          </div>}
          <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
            {!plan ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 12 }}>
                <div style={{ opacity: 0.15 }}><Logo size={48} /></div>
                <div style={{ fontSize: 12, color: T.ter, textAlign: "center" }}>{conn ? "Select a plan or tell Coding Agent:" : "Waiting for MCP..."}</div>
                {conn && <div style={{ fontSize: 10, color: T.sec, fontFamily: T.m, background: T.raised, padding: "6px 12px", borderRadius: 6 }}>"Create a plan and show in FlowPlan"</div>}
              </div>
            ) : steps.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: T.ter, fontSize: 12, flexDirection: "column", gap: 8 }}><div>Waiting for cards from Coding Agent...</div></div>
            ) : vm === "flow" ? (
              <div ref={cr} onMouseDown={ocd} style={{ width: "100%", height: "100%", cursor: ip ? "grabbing" : "default" }}>
                <div style={{ transform: `translate(${Math.round(off.x)}px,${Math.round(off.y)}px) scale(${z})`, transformOrigin: "0 0", position: "relative", backfaceVisibility: "hidden" as const, WebkitFontSmoothing: "subpixel-antialiased" }}>
                  <svg style={{ position: "absolute", left: mnX, top: mnY, width: mxX - mnX, height: mxY - mnY, pointerEvents: "none", overflow: "visible" }}><g transform={`translate(${-mnX},${-mnY})`}><Conns steps={steps} pos={pos} /></g></svg>
                  {steps.map(s => <SCard key={s.id} step={s} pos={pos[s.id]} sel={sId === s.id} onSel={selectCard} onDrag={onDrag} fbc={fcm[s.id] || 0} fbt={ftm[s.id] || []} vm="flow" planTitle={plan?.title || ""} planId={plan?.id || ""} onFileClick={onFileClick} highlight={hlMap[s.id] || null} />)}
                </div>
                <div style={{ position: "absolute", bottom: 10, left: 10, display: "flex", gap: 4, alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 2, background: T.raised, border: `0.5px solid ${T.border}`, borderRadius: 5, padding: 2, height: 28, alignItems: "center" }}>
                    <button onClick={() => setZ(v => Math.min(5, v + 0.15))} style={{ background: "none", border: "none", color: T.text, cursor: "pointer", fontSize: 12, width: 22, height: 22 }}>+</button>
                    <span style={{ fontSize: 9, color: T.ter, display: "flex", alignItems: "center", fontFamily: T.m }}>{Math.round(z * 100)}%</span>
                    <button onClick={() => setZ(v => Math.max(0.1, v - 0.15))} style={{ background: "none", border: "none", color: T.text, cursor: "pointer", fontSize: 12, width: 22, height: 22 }}>{"\u2212"}</button>
                  </div>
                  <button onClick={arrangeCards} title="Arrange cards"
                    style={{ background: T.raised, border: `0.5px solid ${T.border}`, cursor: "pointer", padding: "4px 8px", borderRadius: 5, display: "flex", alignItems: "center", gap: 4, transition: "all 0.12s", height: 28 }}
                    onMouseEnter={(e: any) => { e.currentTarget.style.background = "#333"; }}
                    onMouseLeave={(e: any) => { e.currentTarget.style.background = T.raised; }}>
                    {Ico.arrange(T.ter, 10)}
                    <span style={{ fontSize: 9, color: T.ter, fontFamily: T.m }}>Arrange</span>
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ padding: 16, overflow: "auto", height: "100%" }}><div style={{ maxWidth: 440, margin: "0 auto" }}>
                {sortedSteps.map(s => <SCard key={s.id} step={s} pos={listPos} sel={sId === s.id} onSel={selectCard} onDrag={noop} fbc={fcm[s.id] || 0} fbt={ftm[s.id] || []} vm="list" planTitle={plan?.title || ""} planId={plan?.id || ""} onFileClick={onFileClick} highlight={hlMap[s.id] || null} />)}
              </div></div>
            )}
          </div>
        </div>

        {/* Old card drawer — reuses Detail component */}
        {histOpen && oldCard && (
          <div style={{
            position: "fixed",
            top: 0,
            right: 320,
            width: 320,
            height: "100vh",
            background: T.bg,
            borderLeft: `0.5px solid ${T.border}`,
            zIndex: 51,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}>
            <Detail step={oldCard} fbs={st.feedbacks} onClose={() => setOldCard(null)}
              onAdd={async () => {}} onDel={async () => {}}
              planTitle="Old Version" planId="" onFileClick={onFileClick}
              steps={steps} onSelectCard={() => {}} readOnly />
          </div>
        )}

        {/* Drawer: fixed overlay — does not reflow canvas */}
        {(histOpen || (!histOpen && sId && ss)) && (
          <div style={{
            position: "fixed",
            top: 0,
            right: 0,
            width: 320,
            height: "100vh",
            background: T.bg,
            borderLeft: `0.5px solid ${T.border}`,
            zIndex: 50,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}>
            {histOpen ? (
              <HistoryPanel entries={history} histIdx={histIdx}
                onSelect={(idx) => {
                  setHistIdx(idx);
                  setOldCard(null);
                  if (idx !== null && idx > 0) {
                    const current = history[idx].cards;
                    const prev = history[idx - 1];
                    const prevCards = prev.cards;
                    const prevFull = prev.fullCards || [];
                    // Find first modified card
                    for (const c of current) {
                      const p = prevCards.find(pc => pc.id === c.id);
                      if (p && (p.title !== c.title || p.type !== c.type || p.descriptionLen !== c.descriptionLen || p.filesCount !== c.filesCount || JSON.stringify(p.files) !== JSON.stringify(c.files) || JSON.stringify(p.dependencies) !== JSON.stringify(c.dependencies))) {
                        const old = prevFull.find(fc => fc.id === c.id);
                        if (old) setOldCard(old);
                        // Scroll to card if it still exists
                        if (steps.find(s => s.id === c.id)) focusCard(c.id);
                        break;
                      }
                    }
                  }
                }}
                onClose={() => { setHistOpen(false); setHistIdx(null); setOldCard(null); }}
                onClear={async () => { if (aId) { await api.clearHistory(aId); setHistory([]); setHistIdx(null); setOldCard(null); } }} />
            ) : ss ? (
              <Detail step={ss} fbs={st.feedbacks} onClose={() => setSId(null)}
                onAdd={async (c: string, t: string, x: string) => { try { await api.addFeedback(c, t as any, x); } catch {} }}
                onDel={async (id: string) => { try { await api.deleteFeedback(id); } catch {} }}
                planTitle={plan?.title || ""} planId={plan?.id || ""} onFileClick={onFileClick}
                steps={steps} onSelectCard={focusCard} />
            ) : null}
          </div>
        )}
      </div>
      {cv && <CodeViewer path={cv.path} change={cv.change} onClose={() => setCv(null)} />}
      {toast && (
        <div className="toast-enter" style={{ position: "fixed", bottom: 20, right: 20, background: T.surface, border: `1px solid ${toast.error ? T.red : T.border}`, borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, zIndex: 1100, boxShadow: "0 8px 24px rgba(0,0,0,0.3)", cursor: "default", maxWidth: 320 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: toast.error ? T.rD : T.gD, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {toast.error ? Ico.alert(T.red, 14) : Ico.check(T.green, 14)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: toast.error ? T.red : T.text, marginBottom: 1 }}>{toast.text}</div>
            <div style={{ fontSize: 10, color: T.sec, fontFamily: T.m, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{toast.file}</div>
          </div>
          <button onClick={() => setToast(null)} style={{ background: "none", border: "none", color: T.ter, cursor: "pointer", fontSize: 12, padding: "2px 4px", borderRadius: 4, lineHeight: 1 }}>{"\u2715"}</button>
        </div>
      )}
    </div>
  );
}
