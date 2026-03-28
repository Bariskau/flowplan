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
  plus: (c: string, s = 14) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke={c} strokeWidth="1.5" strokeLinecap="round"/></svg>,
  pin: (c: string, s = 12) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M9.5 2.5L13.5 6.5L10 10L9 13L3 7L6 6Z" stroke={c} strokeWidth="1.3" strokeLinejoin="round"/><path d="M3 13L6 10" stroke={c} strokeWidth="1.3" strokeLinecap="round"/></svg>,
  pinFill: (c: string, s = 12) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M9.5 2.5L13.5 6.5L10 10L9 13L3 7L6 6Z" fill={c} opacity="0.6" stroke={c} strokeWidth="1.3" strokeLinejoin="round"/><path d="M3 13L6 10" stroke={c} strokeWidth="1.3" strokeLinecap="round"/></svg>,
  trash: (c: string, s = 12) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v8.5a1 1 0 001 1h4a1 1 0 001-1V4" stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  dots: (c: string, s = 14) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="3.5" r="1.2" fill={c}/><circle cx="8" cy="8" r="1.2" fill={c}/><circle cx="8" cy="12.5" r="1.2" fill={c}/></svg>,
  download: (c: string, s = 14) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M8 2v8.5M4.5 7.5 8 11l3.5-3.5M3 13h10" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
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
  const pinned = sorted.filter(p => p.pinned);
  const unpinned = sorted.filter(p => !p.pinned);

  /* Dropdown menu component */
  const DropdownMenu = ({ children }: { children: React.ReactNode }) => (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        background: "#1c1c1e",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 8,
        padding: 4,
        minWidth: 160,
        boxShadow: "0 8px 30px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03)",
        backdropFilter: "blur(20px)",
      }}
    >
      {children}
    </div>
  );

  const DropdownItem = ({
    onClick,
    icon,
    label,
    danger,
  }: {
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    danger?: boolean;
  }) => (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "7px 12px",
        borderRadius: 6,
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 13,
        color: danger ? "#ef4444" : "#e4e4e7",
        fontFamily: T.f,
        transition: "background 0.12s",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e: any) => {
        e.currentTarget.style.background = danger ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.06)";
      }}
      onMouseLeave={(e: any) => {
        e.currentTarget.style.background = "none";
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  /* Render a single plan row */
  const PlanItem = ({ p }: { p: Plan }) => {
    const act = p.id === activeId;
    const nc = feedbackPerPlan[p.id] || 0;
    const menuOpen = planMenu === p.id;

    return (
      <li style={{ position: "relative" }}>
        <div
          onClick={() => onSelect(p.id)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 8px 6px 10px",
            cursor: "pointer",
            borderRadius: 6,
            borderLeft: act ? "2px solid #10b981" : "2px solid transparent",
            background: act ? "rgba(16,185,129,0.06)" : "transparent",
            transition: "all 0.2s ease",
            position: "relative",
          }}
          onMouseEnter={(e: any) => {
            if (!act) {
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
              const nameEl = e.currentTarget.querySelector("[data-plan-name]");
              if (nameEl) nameEl.style.color = "#e4e4e7";
            }
          }}
          onMouseLeave={(e: any) => {
            if (!act) {
              e.currentTarget.style.background = "transparent";
              const nameEl = e.currentTarget.querySelector("[data-plan-name]");
              if (nameEl) nameEl.style.color = "#a1a1aa";
            }
          }}
        >
          {/* Pin icon for pinned plans */}
          {p.pinned && (
            <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
              {Ico.pinFill("#10b981", 10)}
            </span>
          )}

          {/* Plan name */}
          <span
            data-plan-name
            style={{
              fontSize: 14,
              fontWeight: 400,
              color: act ? "#ffffff" : "#a1a1aa",
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              transition: "color 0.2s ease",
              flex: 1,
              minWidth: 0,
            }}
          >
            {p.title}
          </span>

          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            {/* Feedback badge */}
            {nc > 0 && (
              <span
                style={{
                  background: "#10b981",
                  color: "#fff",
                  fontSize: 9,
                  fontWeight: 700,
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                  fontFamily: T.m,
                }}
              >
                {nc}
              </span>
            )}

            {/* Card count */}
            <span
              style={{
                fontSize: 10,
                fontWeight: 500,
                color: act ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.18)",
                fontFamily: T.m,
                flexShrink: 0,
                transition: "color 0.2s ease",
              }}
            >
              {p.steps.length}
            </span>

            {/* Three dots menu button */}
            <button
              onClick={e => { e.stopPropagation(); setPlanMenu(menuOpen ? null : p.id); setAddMenu(false); }}
              style={{
                background: menuOpen ? "rgba(255,255,255,0.06)" : "none",
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
                opacity: menuOpen ? 1 : 0,
                transition: "all 0.15s ease",
              }}
              className="plan-actions"
              onMouseEnter={(e: any) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
              onMouseLeave={(e: any) => { e.currentTarget.style.background = menuOpen ? "rgba(255,255,255,0.06)" : "none"; }}
            >
              {Ico.dots(act ? "#71717a" : "#52525b", 14)}
            </button>
          </div>
        </div>

        {/* Context menu dropdown */}
        {menuOpen && (
          <div style={{ position: "absolute", right: 4, top: 34, zIndex: 100 }}>
            <DropdownMenu>
              <DropdownItem
                onClick={() => { onTogglePin(p.id); setPlanMenu(null); }}
                icon={p.pinned ? Ico.pinFill("#10b981", 13) : Ico.pin("#a1a1aa", 13)}
                label={p.pinned ? "Unpin" : "Pin to top"}
              />
              <DropdownItem
                onClick={() => { onDelete(p.id); setPlanMenu(null); }}
                icon={Ico.trash("#ef4444", 13)}
                label="Delete plan"
                danger
              />
            </DropdownMenu>
          </div>
        )}
      </li>
    );
  };

  return (
    <div
      style={{
        width: 220,
        background: "rgba(9,9,11,0.75)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        fontFamily: T.f,
      }}
    >
      {/* ---- Header ---- */}
      <div
        style={{
          padding: "16px 14px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Logo size={22} />
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#ffffff",
              letterSpacing: "-0.01em",
            }}
          >
            FlowPlan
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* MCP connection indicator */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 8px",
              borderRadius: 6,
              background: connected
                ? "rgba(16,185,129,0.08)"
                : "rgba(255,255,255,0.04)",
              border: `1px solid ${connected ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.06)"}`,
            }}
          >
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: connected ? "#10b981" : "#52525b",
                boxShadow: connected ? "0 0 6px rgba(16,185,129,0.5)" : "none",
                transition: "all 0.3s",
              }}
            />
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: connected ? "#10b981" : "#52525b",
                fontFamily: T.m,
                lineHeight: 1,
              }}
            >
              MCP
            </span>
          </div>

          {/* Add button */}
          <div style={{ position: "relative" }}>
            <button
              onClick={e => { e.stopPropagation(); setAddMenu(!addMenu); setPlanMenu(null); }}
              title="Add plan"
              style={{
                background: addMenu ? "rgba(255,255,255,0.06)" : "none",
                border: `1px solid ${addMenu ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.06)"}`,
                cursor: "pointer",
                width: 28,
                height: 28,
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s",
                padding: 0,
              }}
              onMouseEnter={(e: any) => {
                if (!addMenu) {
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                  e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)";
                }
              }}
              onMouseLeave={(e: any) => {
                if (!addMenu) {
                  e.currentTarget.style.background = "none";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                }
              }}
            >
              {Ico.plus(addMenu ? "#10b981" : "#a1a1aa", 14)}
            </button>

            {addMenu && (
              <div style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, zIndex: 100 }}>
                <DropdownMenu>
                  <DropdownItem
                    onClick={() => { onNewPlan(); setAddMenu(false); }}
                    icon={Ico.plus("#10b981", 14)}
                    label="New Plan"
                  />
                  <DropdownItem
                    onClick={() => { onImport(); setAddMenu(false); }}
                    icon={Ico.download("#10b981", 14)}
                    label="Import JSON"
                  />
                </DropdownMenu>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---- Navigation ---- */}
      <nav
        style={{
          flex: 1,
          overflow: "auto",
          padding: "12px 8px",
        }}
      >
        {plans.length === 0 && (
          <div
            style={{
              padding: "40px 16px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div style={{ opacity: 0.15 }}><Logo size={40} /></div>
            <div
              style={{
                fontSize: 13,
                color: "#52525b",
                lineHeight: 1.6,
                maxWidth: 160,
              }}
            >
              {connected
                ? 'Ask your coding agent to "create a plan and show in FlowPlan"'
                : "Connecting to MCP server..."}
            </div>
          </div>
        )}

        {plans.length > 0 && (
          <>
            {/* Section header */}
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#52525b",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                padding: "4px 10px 8px",
                fontFamily: T.f,
              }}
            >
              Plans
            </div>

            {/* Plan list with hover-reveal for dots button */}
            <style>{`
              .sidebar-plan-item:hover .plan-actions {
                opacity: 1 !important;
              }
            `}</style>

            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 1 }}>
              {/* Pinned plans */}
              {pinned.map(p => (
                <div key={p.id} className="sidebar-plan-item">
                  <PlanItem p={p} />
                </div>
              ))}

              {/* Separator between pinned and unpinned */}
              {pinned.length > 0 && unpinned.length > 0 && (
                <li style={{ padding: "4px 10px" }}>
                  <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />
                </li>
              )}

              {/* Unpinned plans */}
              {unpinned.map(p => (
                <div key={p.id} className="sidebar-plan-item">
                  <PlanItem p={p} />
                </div>
              ))}
            </ul>
          </>
        )}
      </nav>

      {/* ---- Footer ---- */}
      <div
        style={{
          padding: "10px 14px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: "#3f3f46",
            fontFamily: T.m,
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          {plans.length} {plans.length === 1 ? "plan" : "plans"}
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
