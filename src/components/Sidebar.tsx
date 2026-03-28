import { useState, useEffect, useCallback } from "react";
import type { Plan } from "../types";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";

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
  <div style={{ width: size, height: size, borderRadius: size * 0.22 }} className="bg-fp-raised flex items-center justify-center shrink-0">
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
  plus: (s = 14) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  pin: (s = 12) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M9.5 2.5L13.5 6.5L10 10L9 13L3 7L6 6Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M3 13L6 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  pinFill: (s = 12) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M9.5 2.5L13.5 6.5L10 10L9 13L3 7L6 6Z" fill="currentColor" opacity="0.6" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M3 13L6 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  trash: (s = 12) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v8.5a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  dots: (s = 14) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="3.5" r="1.2" fill="currentColor"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/><circle cx="8" cy="12.5" r="1.2" fill="currentColor"/></svg>,
  download: (s = 14) => <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M8 2v8.5M4.5 7.5 8 11l3.5-3.5M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
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
      className="bg-fp-solid border border-fp-border-hover rounded-fp-md p-1 min-w-[160px] shadow-[0_8px_30px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.03)] backdrop-blur-fp-panel"
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
      className={`w-full bg-transparent border-none cursor-pointer py-[7px] px-3 rounded-fp-sm flex items-center gap-2.5 text-[13px] font-sans whitespace-nowrap transition-colors duration-150 hover:bg-fp-glass-hover ${
        danger ? "text-fp-danger hover:bg-fp-danger-dim" : "text-fp-text"
      }`}
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
      <li className="relative plan-row">
        <div
          onClick={() => onSelect(p.id)}
          className={`flex items-center gap-2 py-2 px-3 cursor-pointer rounded-fp-sm transition-all duration-150 ${
            act
              ? "border-l-2 border-l-fp-accent bg-fp-glass-hover"
              : "border-l-2 border-l-transparent hover:bg-fp-glass-hover"
          }`}
        >
          {/* Pin icon for pinned plans */}
          {p.pinned && (
            <span className="shrink-0 flex items-center text-fp-accent">
              {Ico.pinFill(10)}
            </span>
          )}

          {/* Plan name */}
          <span
            className={`text-sm font-normal tracking-[-0.01em] whitespace-nowrap overflow-hidden text-ellipsis transition-colors duration-150 flex-1 min-w-0 ${
              act ? "text-fp-text" : "text-fp-muted"
            }`}
          >
            {p.title}
          </span>

          <div className="flex items-center gap-1 shrink-0">
            {/* Feedback badge */}
            {nc > 0 && (
              <span className="bg-fp-accent text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none font-mono">
                {nc}
              </span>
            )}

            {/* Card count */}
            <span
              className={`text-[10px] font-medium font-mono shrink-0 transition-colors duration-150 ${
                act ? "text-fp-dim" : "text-fp-dim/50"
              }`}
            >
              {p.steps.length}
            </span>

            {/* Three dots menu button */}
            <IconButton
              variant="ghost"
              size="sm"
              icon={Ico.dots(14)}
              label="Plan options"
              onClick={e => { e.stopPropagation(); setPlanMenu(menuOpen ? null : p.id); setAddMenu(false); }}
              className={`${menuOpen ? "opacity-100 bg-fp-glass-hover" : "opacity-0"} plan-actions`}
            />
          </div>
        </div>

        {/* Context menu dropdown */}
        {menuOpen && (
          <div className="absolute right-1 top-[34px] z-[100]">
            <DropdownMenu>
              <DropdownItem
                onClick={() => { onTogglePin(p.id); setPlanMenu(null); }}
                icon={<span className="text-fp-accent">{p.pinned ? Ico.pinFill(13) : Ico.pin(13)}</span>}
                label={p.pinned ? "Unpin" : "Pin to top"}
              />
              <DropdownItem
                onClick={() => { onDelete(p.id); setPlanMenu(null); }}
                icon={<span className="text-fp-danger">{Ico.trash(13)}</span>}
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
    <div className="w-[--spacing-fp-sidebar] h-screen fp-glass border-r border-r-fp-border flex flex-col shrink-0 font-sans">
      {/* ---- Header ---- */}
      <div className="py-1.5 px-3.5 flex items-center justify-between border-b border-b-fp-border">
        <div className="flex items-center gap-2">
          <Logo size={22} />
          <span className="text-sm font-semibold text-fp-text tracking-[-0.01em]">
            FlowPlan
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* MCP connection indicator */}
          <div
            className={`flex items-center gap-1 py-[3px] px-2 rounded-fp-pill border text-[10px] font-semibold font-mono leading-none ${
              connected
                ? "bg-fp-accent-dim border-fp-accent/20 text-fp-accent"
                : "bg-fp-glass border-fp-border text-fp-dim"
            }`}
          >
            <div
              className={`w-[5px] h-[5px] rounded-full transition-all duration-300 ${
                connected
                  ? "bg-fp-accent shadow-[0_0_6px_rgba(16,185,129,0.5)]"
                  : "bg-fp-dim shadow-none"
              }`}
            />
            <span>MCP</span>
          </div>

          {/* Add button */}
          <div className="relative">
            <IconButton
              variant="glassy"
              size="md"
              icon={<span className={addMenu ? "text-fp-accent" : ""}>{Ico.plus(14)}</span>}
              label="Add plan"
              onClick={e => { e.stopPropagation(); setAddMenu(!addMenu); setPlanMenu(null); }}
              className={addMenu ? "border-fp-accent/30" : ""}
            />

            {addMenu && (
              <div className="absolute right-0 top-full mt-1 z-[100]">
                <DropdownMenu>
                  <DropdownItem
                    onClick={() => { onNewPlan(); setAddMenu(false); }}
                    icon={<span className="text-fp-accent">{Ico.plus(14)}</span>}
                    label="New Plan"
                  />
                  <DropdownItem
                    onClick={() => { onImport(); setAddMenu(false); }}
                    icon={<span className="text-fp-accent">{Ico.download(14)}</span>}
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
            <div className="text-[13px] text-fp-dim leading-[1.6] max-w-[160px]">
              {connected
                ? 'Ask your coding agent to "create a plan and show in FlowPlan"'
                : "Connecting to MCP server..."}
            </div>
          </div>
        )}

        {plans.length > 0 && (
          <>
            {/* Section header */}
            <div className="text-[11px] font-mono uppercase tracking-wider text-fp-dim pt-1 px-2.5 pb-2">
              Plans
            </div>

            <ul className="list-none m-0 p-0 flex flex-col gap-px">
              {/* Pinned plans */}
              {pinned.map(p => (
                <PlanItem key={p.id} p={p} />
              ))}

              {/* Separator between pinned and unpinned */}
              {pinned.length > 0 && unpinned.length > 0 && (
                <li className="py-1 px-2.5">
                  <div className="h-px bg-fp-border" />
                </li>
              )}

              {/* Unpinned plans */}
              {unpinned.map(p => (
                <PlanItem key={p.id} p={p} />
              ))}
            </ul>
          </>
        )}
      </nav>

      {/* ---- Footer ---- */}
      <div className="py-2.5 px-3.5 border-t border-t-fp-border shrink-0">
        <div className="text-xs text-fp-dim font-mono text-center leading-[1.5]">
          {plans.length} {plans.length === 1 ? "plan" : "plans"}
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
