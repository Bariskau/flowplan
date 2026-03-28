import { useState, useEffect, useCallback } from "react";
import type { Plan } from "../types";
import { T } from "../lib/theme";

interface SidebarProps {
  plans: Plan[];
  activeId: string | null;
  onSelect: (planId: string) => void;
  onDelete: (planId: string) => void;
  onTogglePin: (planId: string) => void;
  onImport: () => void;
  onNewPlan: () => void;
  connected: boolean;
  feedbackPerPlan: Record<string, number>;
}

/* ---- Logo ---- */
const Logo = ({ size = 20 }: { size?: number }) => (
  <div style={{ width: size, height: size, background: "#1e1e2a", borderRadius: size * 0.22, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
    <svg width={size * 0.72} height={size * 0.72} viewBox="0 0 251 260" fill="none">
      <defs>
        <radialGradient id="sbfp1" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="matrix(113.355,0,0,113.355,103.715,138.105)">
          <stop offset=".156" stopColor="#474aff"/><stop offset=".995" stopColor="#ff007a"/>
        </radialGradient>
        <radialGradient id="sbfp2" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="matrix(21.338,0,0,21.338,98.615,170.162)">
          <stop offset=".156" stopColor="#474aff"/><stop offset=".995" stopColor="#ff007a"/>
        </radialGradient>
      </defs>
      <path fill="url(#sbfp1)" d="m228.25 106.76c-0.03-17.31-6.06-34.87-14.56-49.62-19.88-34.46-59.16-57.14-98.79-57.14-32.74 0-72 14.2-87.65 45.19-11.24 22.26-6.86 50.57 9.4 69.2 24.28 27.82 66.52 23.83 96.99 8.95 12.31-6.01 25.2-16.76 40.31-2.3 5.84 5.59 9.57 13.14 9.43 21.22-0.25 14.08-10.25 23.07-23.13 26.65-22.33 6.21-39.04 23.02-43.2 46.06-1.87 10.33-0.36 22.55 7.32 30.38 7.63 7.78 20.23 11.02 30.41 6.97 15.81-6.29 20.73-25.4 13.98-39.39-2.98-6.21-0.93-13.67 4.8-17.49 1.36-0.9 2.42-1.62 2.93-1.94 10.26-6.41 19.51-14.42 27.2-23.75 12.13-14.7 20.61-32.79 23.67-51.64q0.91-5.63 0.89-11.35z"/>
      <path fill="url(#sbfp2)" fillRule="evenodd" d="m104.98 187.72c-8.6 0-15.56-6.96-15.56-15.56 0-8.61 6.96-15.56 15.56-15.56 8.61 0 15.56 6.95 15.56 15.56 0 8.6-6.95 15.56-15.56 15.56z"/>
    </svg>
  </div>
);

/* ---- Inline SVG Icons ---- */
const Ico = {
  plus: (c: string, s = 10) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></svg>,
  pin: (c: string, s = 10) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M9.5 2.5L13.5 6.5L10 10L9 13L3 7L6 6Z" stroke={c} strokeWidth="1.3" strokeLinejoin="round"/><path d="M3 13L6 10" stroke={c} strokeWidth="1.3" strokeLinecap="round"/></svg>,
  pinFill: (c: string, s = 10) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M9.5 2.5L13.5 6.5L10 10L9 13L3 7L6 6Z" fill={c} opacity="0.6" stroke={c} strokeWidth="1.3" strokeLinejoin="round"/><path d="M3 13L6 10" stroke={c} strokeWidth="1.3" strokeLinecap="round"/></svg>,
  trash: (c: string, s = 10) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v8.5a1 1 0 001 1h4a1 1 0 001-1V4" stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  dots: (c: string, s = 10) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="3.5" r="1.2" fill={c}/><circle cx="8" cy="8" r="1.2" fill={c}/><circle cx="8" cy="12.5" r="1.2" fill={c}/></svg>,
  download: (c: string, s = 10) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M8 2v8.5M4.5 7.5 8 11l3.5-3.5M3 13h10" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

/* ---- Sidebar Component ---- */
function Sidebar({ plans, activeId, onSelect, onDelete, onTogglePin, onImport, onNewPlan, connected, feedbackPerPlan }: SidebarProps) {
  const [addMenu, setAddMenu] = useState(false);
  const [planMenu, setPlanMenu] = useState<string | null>(null);

  /* Close menus on outside click */
  const closeMenus = useCallback(() => {
    setAddMenu(false);
    setPlanMenu(null);
  }, []);

  useEffect(() => {
    if (!addMenu && !planMenu) return;
    const handler = () => closeMenus();
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [addMenu, planMenu, closeMenus]);

  /* Sort plans: pinned first, then by creation date descending */
  const sorted = [...plans].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  return (
    <div style={{
      width: 210,
      background: "rgba(20,20,20,0.75)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      borderRight: "0.5px solid rgba(255,255,255,0.06)",
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
    }}>
      {/* ---- Header ---- */}
      <div style={{ padding: "10px 10px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Logo size={18} />
          <span style={{ fontSize: 11, fontWeight: 700, color: T.sec, letterSpacing: "0.02em" }}>FlowPlan</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* Add button */}
          <div style={{ position: "relative" }}>
            <button
              onClick={e => { e.stopPropagation(); setAddMenu(!addMenu); setPlanMenu(null); }}
              title="Add plan"
              style={{
                background: addMenu ? "rgba(255,255,255,0.08)" : "none",
                border: `0.5px solid ${addMenu ? T.accent : T.border}`,
                cursor: "pointer",
                width: 22,
                height: 22,
                borderRadius: 5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.12s",
                padding: 0,
              }}
              onMouseEnter={(e: any) => { if (!addMenu) { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.borderColor = T.accent; } }}
              onMouseLeave={(e: any) => { if (!addMenu) { e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = T.border; } }}
            >
              {Ico.plus(T.sec, 10)}
            </button>
            {addMenu && (
              <div onClick={e => e.stopPropagation()} style={{
                position: "absolute",
                left: 0,
                top: "100%",
                marginTop: 4,
                background: T.raised,
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                padding: 4,
                zIndex: 100,
                minWidth: 150,
                boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
              }}>
                <button
                  onClick={() => { onNewPlan(); setAddMenu(false); }}
                  style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "6px 10px", borderRadius: 5, display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: T.text, fontFamily: T.f, transition: "background 0.1s", whiteSpace: "nowrap" }}
                  onMouseEnter={(e: any) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                  onMouseLeave={(e: any) => { e.currentTarget.style.background = "none"; }}
                >
                  {Ico.plus(T.green, 11)}
                  <span>New Plan</span>
                </button>
                <button
                  onClick={() => { onImport(); setAddMenu(false); }}
                  style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "6px 10px", borderRadius: 5, display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: T.text, fontFamily: T.f, transition: "background 0.1s", whiteSpace: "nowrap" }}
                  onMouseEnter={(e: any) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                  onMouseLeave={(e: any) => { e.currentTarget.style.background = "none"; }}
                >
                  {Ico.download(T.accent, 11)}
                  <span>Import JSON</span>
                </button>
              </div>
            )}
          </div>
          {/* MCP connection indicator */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "0 7px",
            borderRadius: 5,
            background: connected ? T.gD : T.raised,
            border: `0.5px solid ${connected ? T.green : T.border}`,
            height: 22,
          }}>
            <div style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: connected ? T.green : T.ter,
              boxShadow: connected ? `0 0 5px ${T.green}` : "none",
            }} />
            <span style={{ fontSize: 9, fontWeight: 600, color: connected ? T.green : T.ter, fontFamily: T.m }}>MCP</span>
          </div>
        </div>
      </div>

      {/* ---- Plan List ---- */}
      <div style={{ flex: 1, overflow: "auto", padding: "0 8px" }}>
        {plans.length === 0 && (
          <div style={{ padding: 20, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ opacity: 0.2 }}><Logo size={32} /></div>
            <div style={{ fontSize: 10, color: T.ter, lineHeight: 1.6 }}>
              {connected ? 'Tell Coding Agent:\n"Create a plan and show\nin FlowPlan"' : "Connecting..."}
            </div>
          </div>
        )}
        {sorted.map(p => {
          const act = p.id === activeId;
          const nc = feedbackPerPlan[p.id] || 0;
          const menuOpen = planMenu === p.id;
          return (
            <div
              key={p.id}
              onClick={() => onSelect(p.id)}
              style={{
                padding: "8px 10px",
                borderRadius: 7,
                cursor: "pointer",
                marginBottom: 2,
                background: act ? T.sA : "transparent",
                transition: "background 0.1s",
                position: "relative",
              }}
              onMouseEnter={(e: any) => { if (!act) e.currentTarget.style.background = T.sH; }}
              onMouseLeave={(e: any) => { e.currentTarget.style.background = act ? T.sA : "transparent"; }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                {p.pinned && (
                  <div style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    background: T.aD,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: 1,
                  }}>
                    {Ico.pinFill(T.accent, 9)}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: act ? T.text : T.sec,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      lineHeight: 1.4,
                    }}>{p.title}</span>
                    {nc > 0 && (
                      <span style={{
                        background: T.accent,
                        color: "#fff",
                        fontSize: 7,
                        fontWeight: 800,
                        padding: "0 4px",
                        borderRadius: 5,
                        lineHeight: "13px",
                        flexShrink: 0,
                      }}>{nc}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 9, color: T.ter, fontFamily: T.m, marginTop: 2 }}>{p.steps.length} cards</div>
                </div>
                <button
                  className="plan-actions"
                  onClick={e => { e.stopPropagation(); setPlanMenu(menuOpen ? null : p.id); setAddMenu(false); }}
                  style={{
                    background: menuOpen ? "rgba(255,255,255,0.08)" : "none",
                    border: "none",
                    cursor: "pointer",
                    width: 22,
                    height: 22,
                    borderRadius: 5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                    flexShrink: 0,
                    marginTop: 1,
                    transition: "all 0.12s",
                  }}
                  onMouseEnter={(e: any) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
                  onMouseLeave={(e: any) => { e.currentTarget.style.background = menuOpen ? "rgba(255,255,255,0.08)" : "none"; }}
                >
                  {Ico.dots(T.sec, 12)}
                </button>
              </div>
              {/* Dropdown menu */}
              {menuOpen && (
                <div onClick={e => e.stopPropagation()} style={{
                  position: "absolute",
                  right: 4,
                  top: "100%",
                  marginTop: 2,
                  background: T.raised,
                  border: `1px solid ${T.border}`,
                  borderRadius: 8,
                  padding: 4,
                  zIndex: 100,
                  minWidth: 140,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                }}>
                  <button
                    onClick={() => { onTogglePin(p.id); setPlanMenu(null); }}
                    style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "6px 10px", borderRadius: 5, display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: T.text, fontFamily: T.f, transition: "background 0.1s" }}
                    onMouseEnter={(e: any) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                    onMouseLeave={(e: any) => { e.currentTarget.style.background = "none"; }}
                  >
                    {p.pinned ? Ico.pinFill(T.accent, 12) : Ico.pin(T.sec, 12)}
                    <span>{p.pinned ? "Unpin" : "Pin"}</span>
                  </button>
                  <button
                    onClick={() => { onDelete(p.id); setPlanMenu(null); }}
                    style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "6px 10px", borderRadius: 5, display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: T.red, fontFamily: T.f, transition: "background 0.1s" }}
                    onMouseEnter={(e: any) => { e.currentTarget.style.background = "rgba(255,69,58,0.08)"; }}
                    onMouseLeave={(e: any) => { e.currentTarget.style.background = "none"; }}
                  >
                    {Ico.trash(T.red, 12)}
                    <span>Delete</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ---- Footer ---- */}
      <div style={{ padding: "8px 12px", borderTop: `0.5px solid ${T.border}`, flexShrink: 0 }}>
        <div style={{ fontSize: 9, color: T.ter, fontFamily: T.m, textAlign: "center", lineHeight: 1.5 }}>Plan List</div>
      </div>
    </div>
  );
}

export default Sidebar;
