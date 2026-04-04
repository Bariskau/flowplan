import React, { useState, useMemo } from "react";
import type { CollabSession, CollabTransportState, Plan } from "../types";
import IconButton from "./ui/IconButton";
import Button from "./ui/Button";
import DropdownMenu, { DropdownItem } from "./ui/DropdownMenu";
import {
  Check,
  Plus,
  PushPin,
  PushPinSimple,
  Power,
  Trash,
  Copy,
  DotsThreeVertical,
  DownloadSimple,
  CloudCheck,
  CloudSlash,
  MagnifyingGlass,
  Cards,
  CalendarBlank,
  PlugsConnected,
  Broadcast,
  GearSix,
  WifiHigh,
  Pulse,
  WarningCircle,
  ArrowsClockwise,
} from "@phosphor-icons/react";

interface SidebarProps {
  plans: Plan[];
  activeId: string | null;
  onSelect: (planId: string) => void;
  onDelete: (planId: string) => void;
  onTogglePin: (planId: string) => void;
  onImport: () => void;
  onNewPlan: () => void;
  onOpenSettings: () => void;
  connected: boolean;
  onConnectPlan: () => void;
  onDisconnectPlan?: () => void;
  collabSession: CollabSession | null;
  collabTransportState?: CollabTransportState | null;
  collabSessionCount?: number;
  collabStatusByPlan?: Record<string, CollabSession["status"]>;
}

/* ---- Logo ---- */
const Logo = ({ size = 20 }: { size?: number }) => (
  <div
    style={{ width: size, height: size, borderRadius: size * 0.22 }}
    className="bg-fp-raised flex items-center justify-center shrink-0"
  >
    <svg width={size * 0.72} height={size * 0.72} viewBox="0 0 251 260" fill="none">
      <defs>
        <radialGradient
          id="sbfp1"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="matrix(113.355,0,0,113.355,103.715,138.105)"
        >
          <stop offset=".156" stopColor="#474aff" />
          <stop offset=".995" stopColor="#ff007a" />
        </radialGradient>
        <radialGradient
          id="sbfp2"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="matrix(21.338,0,0,21.338,98.615,170.162)"
        >
          <stop offset=".156" stopColor="#474aff" />
          <stop offset=".995" stopColor="#ff007a" />
        </radialGradient>
      </defs>
      <path
        fill="url(#sbfp1)"
        d="m228.25 106.76c-0.03-17.31-6.06-34.87-14.56-49.62-19.88-34.46-59.16-57.14-98.79-57.14-32.74 0-72 14.2-87.65 45.19-11.24 22.26-6.86 50.57 9.4 69.2 24.28 27.82 66.52 23.83 96.99 8.95 12.31-6.01 25.2-16.76 40.31-2.3 5.84 5.59 9.57 13.14 9.43 21.22-0.25 14.08-10.25 23.07-23.13 26.65-22.33 6.21-39.04 23.02-43.2 46.06-1.87 10.33-0.36 22.55 7.32 30.38 7.63 7.78 20.23 11.02 30.41 6.97 15.81-6.29 20.73-25.4 13.98-39.39-2.98-6.21-0.93-13.67 4.8-17.49 1.36-0.9 2.42-1.62 2.93-1.94 10.26-6.41 19.51-14.42 27.2-23.75 12.13-14.7 20.61-32.79 23.67-51.64q0.91-5.63 0.89-11.35z"
      />
      <path
        fill="url(#sbfp2)"
        fillRule="evenodd"
        d="m104.98 187.72c-8.6 0-15.56-6.96-15.56-15.56 0-8.61 6.96-15.56 15.56-15.56 8.61 0 15.56 6.95 15.56 15.56 0 8.6-6.95 15.56-15.56 15.56z"
      />
    </svg>
  </div>
);

/* ---- Date formatting ---- */
function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getTimeGroup(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const day = 86400000;
  if (diff < day * 7) return "Recent";
  if (diff < day * 30) return "Last 30 days";
  if (diff < day * 365) return "Older";
  return "Last year";
}

/* ---- Sidebar Component ---- */
function Sidebar({
  plans,
  activeId,
  onSelect,
  onDelete,
  onTogglePin,
  onImport,
  onNewPlan,
  onOpenSettings,
  connected,
  onConnectPlan,
  onDisconnectPlan,
  collabSession,
  collabTransportState,
  collabSessionCount = 0,
  collabStatusByPlan = {},
}: SidebarProps) {
  const [search, setSearch] = useState("");
  const [copiedInvite, setCopiedInvite] = useState(false);

  const copyInvite = async () => {
    if (!collabSession?.roomId || !collabSession.joinSecret) return;
    try {
      await navigator.clipboard.writeText(`Room ID: ${collabSession.roomId}\nSecret: ${collabSession.joinSecret}`);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 1400);
    } catch {}
  };

  /* Filter & group plans */
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = q ? plans.filter((p) => p.title.toLowerCase().includes(q)) : plans;
    return [...list].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }, [plans, search]);

  const grouped = useMemo(() => {
    const groups: { label: string; plans: Plan[] }[] = [];
    const map = new Map<string, Plan[]>();
    const pinned = filtered.filter((p) => p.pinned);
    const rest = filtered.filter((p) => !p.pinned);
    if (pinned.length) groups.push({ label: "Pinned", plans: pinned });
    for (const p of rest) {
      const g = getTimeGroup(p.createdAt || 0);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(p);
    }
    for (const [label, plans] of map) {
      groups.push({ label, plans });
    }
    return groups;
  }, [filtered]);

  const signalMeta = useMemo(() => {
    switch (collabTransportState?.signal) {
      case "connected":
        return {
          icon: <WifiHigh size={11} weight="fill" />,
          className: "text-fp-info bg-fp-info/[0.10] border-fp-info/12",
          label: "Signal connected",
        };
      case "reconnecting":
        return {
          icon: <ArrowsClockwise size={11} weight="bold" className="animate-spin" />,
          className: "text-fp-warning bg-fp-warning/[0.10] border-fp-warning/12",
          label: "Signal reconnecting",
        };
      case "disconnected":
        return {
          icon: <WarningCircle size={11} weight="fill" />,
          className: "text-fp-danger bg-fp-danger/[0.10] border-fp-danger/12",
          label: "Signal disconnected",
        };
      default:
        return {
          icon: <ArrowsClockwise size={11} weight="bold" className="animate-spin" />,
          className: "text-white/56 bg-white/[0.05] border-white/[0.08]",
          label: "Signal connecting",
        };
    }
  }, [collabTransportState?.signal]);

  const p2pMeta = useMemo(() => {
    switch (collabTransportState?.peer) {
      case "connected":
        return {
          icon: <Pulse size={11} weight="fill" />,
          className: "text-fp-accent bg-fp-accent/[0.10] border-fp-accent/12",
          label: "P2P connected",
        };
      case "connecting":
        return {
          icon: <ArrowsClockwise size={11} weight="bold" className="animate-spin" />,
          className: "text-fp-warning bg-fp-warning/[0.10] border-fp-warning/12",
          label: "P2P connecting",
        };
      case "failed":
        return {
          icon: <WarningCircle size={11} weight="fill" />,
          className: "text-fp-danger bg-fp-danger/[0.10] border-fp-danger/12",
          label: "P2P failed",
        };
      default:
        return {
          icon: <Pulse size={11} weight="duotone" />,
          className: "text-white/56 bg-white/[0.05] border-white/[0.08]",
          label: "P2P idle",
        };
    }
  }, [collabTransportState?.peer]);

  /* Render a single plan row */
  const PlanItem = ({ p }: { p: Plan }) => {
    const act = p.id === activeId;
    const collabStatus = collabStatusByPlan[p.id] ?? null;
    const hasLiveRoom = Boolean(collabStatus);

    return (
      <div
        onClick={() => onSelect(p.id)}
        className={`plan-row group flex items-center gap-2 px-3 py-2.5 rounded-[10px] cursor-pointer transition-all duration-150 ${
          act ? "bg-white/8" : "hover:bg-white/[0.04] active:bg-white/8"
        }`}
      >
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            {hasLiveRoom && (
              <span
                className="mt-px h-2 w-2 shrink-0 rounded-full bg-[#62f58c] shadow-[0_0_0_2px_rgba(98,245,140,0.12),0_0_12px_rgba(98,245,140,0.65)]"
                title={collabStatus === "hosting" ? "Hosting room" : "Joined room"}
              />
            )}
            <div
              className={`min-w-0 text-sm leading-snug whitespace-nowrap overflow-hidden text-ellipsis ${act ? "text-white" : "text-white/80"}`}
            >
              {p.title}
            </div>
          </div>
          <div className="flex items-center gap-1 mt-1 text-[11px] text-white/30">
            <Cards size={12} weight="regular" className="shrink-0 -mt-px" />
            <span>{p.steps.length}</span>
            <span>·</span>
            <CalendarBlank size={11} weight="regular" className="shrink-0 -mt-px" />
            <span>{formatDate(p.createdAt)}</span>
          </div>
        </div>

        {/* Three dots menu */}
        <DropdownMenu
          align="right"
          trigger={
            <IconButton
              variant="ghost"
              size="sm"
              icon={<DotsThreeVertical size={14} />}
              label="Plan options"
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-150"
            />
          }
        >
          <DropdownItem
            onClick={() => onTogglePin(p.id)}
            icon={p.pinned ? <PushPinSimple size={14} weight="fill" /> : <PushPin size={14} />}
            label={p.pinned ? "Unpin" : "Pin to top"}
          />
          <DropdownItem onClick={() => onDelete(p.id)} icon={<Trash size={14} />} label="Delete plan" danger />
        </DropdownMenu>
      </div>
    );
  };

  return (
    <div className="w-[var(--spacing-fp-sidebar)] h-full rounded-2xl border border-white/8 bg-[rgba(32,33,36,0.58)] backdrop-blur-[28px] supports-[backdrop-filter]:backdrop-saturate-150 flex flex-col shrink-0 font-sans overflow-hidden animate-sidebar-in">
      {/* ---- Header ---- */}
      <div className="py-3 px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Logo size={20} />
          <span className="text-[13px] font-semibold text-white tracking-[-0.01em]">FlowPlan</span>
          {/* MCP indicator */}
          <div
            className={`flex items-center gap-1.5 py-1 px-2 rounded-full text-[11px] font-semibold font-mono leading-none ${
              connected ? "text-fp-accent bg-fp-accent-dim" : "text-fp-danger bg-fp-danger-dim"
            }`}
          >
            {connected ? <CloudCheck size={13} weight="fill" /> : <CloudSlash size={13} />}
            <span className="mt-px">MCP</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <DropdownMenu
            align="right"
            trigger={<IconButton variant="ghost" size="sm" icon={<Plus size={14} />} label="Add plan" />}
          >
            <DropdownItem onClick={() => onNewPlan()} icon={<Plus size={14} />} label="New Plan" />
            <DropdownItem onClick={() => onImport()} icon={<DownloadSimple size={14} />} label="Import JSON" />
          </DropdownMenu>
          <IconButton
            variant="ghost"
            size="sm"
            onClick={onOpenSettings}
            icon={<GearSix size={14} />}
            label="Settings"
          />
        </div>
      </div>

      {/* ---- Search bar ---- */}
      <div className="mx-3 mb-1 flex items-center px-3 py-1.5 rounded-full bg-white/4 transition-colors duration-200 focus-within:bg-white/8">
        <MagnifyingGlass size={14} className="text-white/30 mr-2 shrink-0" />
        <input
          type="text"
          placeholder="Search plans"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent border-none outline-none text-white text-sm font-sans placeholder:text-white/25"
        />
      </div>

      {/* ---- Plan list ---- */}
      <div className="flex-1 min-h-0 overflow-y-auto px-1.5" style={{ scrollbarWidth: "none" }}>
        {plans.length === 0 && (
          <div className="py-10 px-3 text-center flex flex-col items-center gap-3">
            <div className="opacity-[0.15]">
              <Logo size={36} />
            </div>
            <div className="text-[12px] text-white/35 leading-[1.6] max-w-[160px]">
              {connected
                ? 'Ask your coding agent to "create a plan and show in FlowPlan"'
                : "Connecting to MCP server..."}
            </div>
          </div>
        )}

        {grouped.map((group) => (
          <div key={group.label}>
            <div className="px-3 pt-4 pb-1 text-[11px] font-medium text-white/25 tracking-wide">{group.label}</div>
            <div className="flex flex-col gap-1">
              {group.plans.map((p) => (
                <PlanItem key={p.id} p={p} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t border-white/[0.06] px-3 pb-3 pt-3">
        <div className="rounded-[18px] border border-white/[0.06] bg-white/[0.025] px-3.5 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.12em] text-white/26 font-mono">Collaboration</div>
              <div className="mt-1 text-[13px] font-medium text-white/78">
                {collabSession ? (collabSession.status === "hosting" ? "Hosting room" : "Connected to room") : "Connect plan"}
              </div>
              <div className="mt-1 min-w-0 text-[11px] text-white/34 leading-relaxed">
                {collabSession
                  ? collabSessionCount > 1
                    ? `${collabSession.roomId} · ${collabSessionCount} live sessions`
                    : collabSession.roomId
                  : collabSessionCount > 0
                    ? `${collabSessionCount} live sessions open in this app`
                    : "Start a host session or join a shared plan room."}
              </div>
            </div>

            <div className="shrink-0">
              <div className="group relative">
                <div
                  className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                    collabSession
                      ? collabSession.status === "hosting"
                        ? "bg-fp-accent-dim text-fp-accent"
                        : "bg-fp-info-dim text-fp-info"
                      : "bg-white/[0.04] text-white/34"
                  } cursor-help`}
                  aria-label={
                    collabSession && collabTransportState
                      ? `${signalMeta.label}. ${p2pMeta.label}.`
                      : collabSession
                        ? "Collaboration active"
                        : "No active collaboration session"
                  }
                >
                  {collabSession ? (collabSession.status === "hosting" ? "Host" : "Live") : "Idle"}
                </div>
                {collabSession && collabTransportState && (
                  <div className="pointer-events-none absolute right-0 top-full z-20 mt-2 min-w-[168px] rounded-2xl border border-white/8 bg-[rgba(24,25,28,0.94)] px-2.5 py-2 text-[10px] text-white/72 opacity-0 shadow-[0_8px_24px_rgba(0,0,0,0.24)] transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full border backdrop-blur-[18px] supports-[backdrop-filter]:backdrop-saturate-150 ${signalMeta.className}`}
                      >
                        {signalMeta.icon}
                      </span>
                      <span className="font-medium text-white/48">Signal</span>
                      <span className="ml-auto font-medium text-white/82">{signalMeta.label.replace(/^Signal\s+/i, "")}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full border backdrop-blur-[18px] supports-[backdrop-filter]:backdrop-saturate-150 ${p2pMeta.className}`}
                      >
                        {p2pMeta.icon}
                      </span>
                      <span className="font-medium text-white/48">P2P</span>
                      <span className="ml-auto font-medium text-white/82">{p2pMeta.label.replace(/^P2P\s+/i, "")}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {collabSession && (
            <div className="mt-2 flex flex-wrap gap-2">
              {collabSession.joinSecret && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={copiedInvite ? <Check size={12} weight="bold" /> : <Copy size={12} />}
                  onClick={copyInvite}
                  className="text-white/60 hover:text-white"
                >
                  {copiedInvite ? "Copied" : "Copy invite"}
                </Button>
              )}
            </div>
          )}

          <Button
            variant={collabSession ? "danger" : "glassy"}
            size="md"
            icon={collabSession ? <Power size={13} weight="bold" /> : <PlugsConnected size={13} weight="bold" />}
            onClick={collabSession ? onDisconnectPlan : onConnectPlan}
            className="w-full mt-2"
          >
            {collabSession ? "Disconnect" : "Connect plan"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(Sidebar);
