import type { CollabParticipant } from "../types";
import AvatarGroup from "./AvatarGroup";

interface PresenceBarProps {
  status: "hosting" | "joined" | "local";
  roomId?: string;
  users: CollabParticipant[];
  rightOffset: string;
}

export default function PresenceBar({ status, roomId, users, rightOffset }: PresenceBarProps) {
  const statusLabel = status === "hosting" ? "Hosting" : status === "joined" ? "Joined" : "Local";
  const dotColor = status === "hosting" ? "bg-fp-accent" : status === "joined" ? "bg-fp-info" : "bg-white/28";

  return (
    <div className="fixed z-10" style={{ top: "var(--spacing-fp-gap)", right: rightOffset }}>
      <div className="h-[var(--spacing-fp-toolbar)] border border-white/8 bg-[rgba(32,33,36,0.58)] backdrop-blur-[28px] supports-[backdrop-filter]:backdrop-saturate-150 rounded-full inline-flex items-center gap-3 px-3.5 shrink-0 animate-toolbar-in">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.03] px-2.5 py-1">
          <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
          <span className="text-[11px] font-medium text-white/62">{statusLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-[11px] font-medium text-white/74">{users.length} active</div>
            <div className="text-[10px] text-white/28">{roomId ?? "Current plan"}</div>
          </div>
          <AvatarGroup users={users} />
        </div>
      </div>
    </div>
  );
}
