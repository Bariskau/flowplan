import { useState, useEffect, useCallback } from "react";
import type { Plan } from "../types";

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
  <div style={{ width: size, height: size, borderRadius: size * 0.22 }} className="bg-[#1e1e2a] flex items-center justify-center shrink-0">
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
      className="bg-[#1c1c1e] border border-[rgba(255,255,255,0.08)] rounded-lg p-1 min-w-[160px] shadow-[0_8px_30px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.03)] backdrop-blur-[20px]"
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
      className={`w-full bg-transparent border-none cursor-pointer py-[7px] px-3 rounded-md flex items-center gap-2.5 text-[13px] font-sans whitespace-nowrap transition-[background] duration-[120ms] ${danger ? "text-[#ef4444]" : "text-[#e4e4e7]"}`}
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
      <li className="relative">
        <div
          onClick={() => onSelect(p.id)}
          className={`flex items-center gap-2 py-1.5 pr-2 pl-2.5 cursor-pointer rounded-md relative transition-all duration-200 ${
            act
              ? "border-l-2 border-l-[#10b981] bg-[rgba(16,185,129,0.06)]"
              : "border-l-2 border-l-transparent bg-transparent"
          }`}
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
            <span className="shrink-0 flex items-center">
              {Ico.pinFill("#10b981", 10)}
            </span>
          )}

          {/* Plan name */}
          <span
            data-plan-name
            className={`text-sm font-normal tracking-[-0.01em] whitespace-nowrap overflow-hidden text-ellipsis transition-colors duration-200 flex-1 min-w-0 ${
              act ? "text-white" : "text-[#a1a1aa]"
            }`}
          >
            {p.title}
          </span>

          <div className="flex items-center gap-1 shrink-0">
            {/* Feedback badge */}
            {nc > 0 && (
              <span className="bg-[#10b981] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none font-mono">
                {nc}
              </span>
            )}

            {/* Card count */}
            <span
              className={`text-[10px] font-medium font-mono shrink-0 transition-colors duration-200 ${
                act ? "text-[rgba(255,255,255,0.35)]" : "text-[rgba(255,255,255,0.18)]"
              }`}
            >
              {p.steps.length}
            </span>

            {/* Three dots menu button */}
            <button
              onClick={e => { e.stopPropagation(); setPlanMenu(menuOpen ? null : p.id); setAddMenu(false); }}
              className={`border-none cursor-pointer w-[22px] h-[22px] rounded-[5px] flex items-center justify-center p-0 shrink-0 transition-all duration-150 ${
                menuOpen ? "bg-[rgba(255,255,255,0.06)] opacity-100" : "bg-transparent opacity-0"
              } plan-actions`}
              onMouseEnter={(e: any) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
              onMouseLeave={(e: any) => { e.currentTarget.style.background = menuOpen ? "rgba(255,255,255,0.06)" : "none"; }}
            >
              {Ico.dots(act ? "#71717a" : "#52525b", 14)}
            </button>
          </div>
        </div>

        {/* Context menu dropdown */}
        {menuOpen && (
          <div className="absolute right-1 top-[34px] z-[100]">
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
    <div className="w-[220px] bg-[rgba(255,255,255,0.03)] backdrop-blur-[40px] border-r border-r-[rgba(255,255,255,0.06)] flex flex-col shrink-0 font-sans">
      {/* ---- Header ---- */}
      <div className="pt-4 px-3.5 pb-3 flex items-center justify-between border-b border-b-[rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-2">
          <Logo size={22} />
          <span className="text-sm font-semibold text-white tracking-[-0.01em]">
            FlowPlan
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* MCP connection indicator */}
          <div
            className={`flex items-center gap-1 py-[3px] px-2 rounded-md border ${
              connected
                ? "bg-[rgba(16,185,129,0.08)] border-[rgba(16,185,129,0.2)]"
                : "bg-[rgba(255,255,255,0.04)] border-[rgba(255,255,255,0.06)]"
            }`}
          >
            <div
              className={`w-[5px] h-[5px] rounded-full transition-all duration-300 ${
                connected
                  ? "bg-[#10b981] shadow-[0_0_6px_rgba(16,185,129,0.5)]"
                  : "bg-[#52525b] shadow-none"
              }`}
            />
            <span
              className={`text-[10px] font-semibold font-mono leading-none ${
                connected ? "text-[#10b981]" : "text-[#52525b]"
              }`}
            >
              MCP
            </span>
          </div>

          {/* Add button */}
          <div className="relative">
            <button
              onClick={e => { e.stopPropagation(); setAddMenu(!addMenu); setPlanMenu(null); }}
              title="Add plan"
              className={`cursor-pointer w-7 h-7 rounded-md flex items-center justify-center transition-all duration-150 p-0 ${
                addMenu
                  ? "bg-[rgba(255,255,255,0.06)] border border-[rgba(16,185,129,0.3)]"
                  : "bg-transparent border border-[rgba(255,255,255,0.06)]"
              }`}
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
              <div className="absolute right-0 top-full mt-1 z-[100]">
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
      <nav className="flex-1 overflow-auto py-3 px-2">
        {plans.length === 0 && (
          <div className="py-10 px-4 text-center flex flex-col items-center gap-3">
            <div className="opacity-[0.15]"><Logo size={40} /></div>
            <div className="text-[13px] text-[#52525b] leading-[1.6] max-w-[160px]">
              {connected
                ? 'Ask your coding agent to "create a plan and show in FlowPlan"'
                : "Connecting to MCP server..."}
            </div>
          </div>
        )}

        {plans.length > 0 && (
          <>
            {/* Section header */}
            <div className="text-[11px] font-semibold text-[#52525b] tracking-[0.05em] uppercase pt-1 px-2.5 pb-2 font-sans">
              Plans
            </div>

            {/* Plan list with hover-reveal for dots button */}
            <style>{`
              .sidebar-plan-item:hover .plan-actions {
                opacity: 1 !important;
              }
            `}</style>

            <ul className="list-none m-0 p-0 flex flex-col gap-px">
              {/* Pinned plans */}
              {pinned.map(p => (
                <div key={p.id} className="sidebar-plan-item">
                  <PlanItem p={p} />
                </div>
              ))}

              {/* Separator between pinned and unpinned */}
              {pinned.length > 0 && unpinned.length > 0 && (
                <li className="py-1 px-2.5">
                  <div className="h-px bg-[rgba(255,255,255,0.06)]" />
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
      <div className="py-2.5 px-3.5 border-t border-t-[rgba(255,255,255,0.06)] shrink-0">
        <div className="text-[11px] text-[#3f3f46] font-mono text-center leading-[1.5]">
          {plans.length} {plans.length === 1 ? "plan" : "plans"}
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
