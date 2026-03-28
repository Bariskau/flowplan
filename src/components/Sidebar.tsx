import { useState, useEffect, useCallback } from "react";
import type { Plan } from "../types";
import IconButton from "./ui/IconButton";
import DropdownMenu, { DropdownItem } from "./ui/DropdownMenu";
import {
  Plus,
  PushPin,
  PushPinSimple,
  Trash,
  DotsThreeVertical,
  DownloadSimple,
  CloudCheck,
  CloudSlash,
} from "@phosphor-icons/react";

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

/* ---- Sidebar Component ---- */
function Sidebar({ plans, activeId, onSelect, onDelete, onTogglePin, onImport, onNewPlan, connected, feedbackPerPlan }: SidebarProps) {
  /* Sort plans: pinned first, then by creation date descending */
  const sorted = [...plans].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  const pinned = sorted.filter(p => p.pinned);
  const unpinned = sorted.filter(p => !p.pinned);

  /* Render a single plan row */
  const PlanItem = ({ p }: { p: Plan }) => {
    const act = p.id === activeId;
    const nc = feedbackPerPlan[p.id] || 0;

    return (
      <li className="relative plan-row">
        <div
          onClick={() => onSelect(p.id)}
          className={`flex items-center gap-2 py-2 px-4 cursor-pointer rounded-fp-sm transition-all duration-150 ${
            act
              ? "bg-fp-glass-active"
              : "hover:bg-fp-glass-hover"
          }`}
        >
          {/* Pin icon for pinned plans */}
          {p.pinned && (
            <span className="shrink-0 flex items-center text-fp-muted">
              <PushPinSimple size={12} weight="fill" />
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

            {/* Three dots menu */}
            <DropdownMenu
              align="right"
              trigger={
                <IconButton
                  variant="ghost"
                  size="sm"
                  icon={<DotsThreeVertical size={14} />}
                  label="Plan options"
                  onClick={e => e.stopPropagation()}
                  className="opacity-0 plan-actions"
                />
              }
            >
              <DropdownItem
                onClick={() => onTogglePin(p.id)}
                icon={<span className="text-fp-muted">{p.pinned ? <PushPinSimple size={14} weight="fill" /> : <PushPin size={14} />}</span>}
                label={p.pinned ? "Unpin" : "Pin to top"}
              />
              <DropdownItem
                onClick={() => onDelete(p.id)}
                icon={<span className="text-fp-danger"><Trash size={14} /></span>}
                label="Delete plan"
                danger
              />
            </DropdownMenu>
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="w-[--spacing-fp-sidebar] h-screen fp-glass border-r border-r-fp-border flex flex-col shrink-0 font-sans">
      {/* ---- Header ---- */}
      <div className="py-3 px-4 flex items-center justify-between border-b border-b-fp-border">
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
            {connected
              ? <CloudCheck size={12} weight="fill" />
              : <CloudSlash size={12} />
            }
            <span>MCP</span>
          </div>

          {/* Add button with dropdown */}
          <DropdownMenu
            align="right"
            trigger={
              <IconButton
                variant="glassy"
                size="md"
                icon={<Plus size={14} />}
                label="Add plan"
              />
            }
          >
            <DropdownItem
              onClick={() => onNewPlan()}
              icon={<span className="text-fp-accent"><Plus size={14} /></span>}
              label="New Plan"
            />
            <DropdownItem
              onClick={() => onImport()}
              icon={<span className="text-fp-accent"><DownloadSimple size={14} /></span>}
              label="Import JSON"
            />
          </DropdownMenu>
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
            <div className="text-[11px] font-mono uppercase tracking-wider text-fp-dim pt-1 px-4 pb-2">
              Plans
            </div>

            <ul className="list-none m-0 p-0 flex flex-col gap-px">
              {/* Pinned plans */}
              {pinned.map(p => (
                <PlanItem key={p.id} p={p} />
              ))}

              {/* Separator between pinned and unpinned */}
              {pinned.length > 0 && unpinned.length > 0 && (
                <li className="py-1 px-4">
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
      <div className="py-2.5 px-4 border-t border-t-fp-border shrink-0">
        <div className="text-xs text-fp-dim font-mono text-center leading-[1.5]">
          {plans.length} {plans.length === 1 ? "plan" : "plans"}
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
