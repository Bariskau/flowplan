import { useMemo } from "react";
import NiceAvatar, { genConfig } from "react-nice-avatar";
import type { CollabParticipant, CollabProfile } from "../../types";

interface AvatarProps {
  user: Pick<CollabParticipant, "username" | "avatarSeed"> | Pick<CollabProfile, "username" | "avatarSeed">;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-7 h-7 min-w-7 min-h-7",
  md: "w-8 h-8 min-w-8 min-h-8",
  lg: "w-10 h-10 min-w-10 min-h-10",
} as const;

export default function Avatar({ user, size = "md", className = "" }: AvatarProps) {
  const config = useMemo(() => genConfig(user.avatarSeed || user.username || "flowplan"), [user.avatarSeed, user.username]);

  return (
    <div className={`relative inline-flex shrink-0 items-center justify-center ${sizeClasses[size]} ${className}`.trim()}>
      <div className="absolute inset-0 overflow-hidden rounded-full [clip-path:circle(50%)]">
        <NiceAvatar
          {...config}
          shape="circle"
          className="absolute inset-0 block !h-full !w-full"
          style={{ width: "100%", height: "100%", display: "block" }}
        />
      </div>
    </div>
  );
}
