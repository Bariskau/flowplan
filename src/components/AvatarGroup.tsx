import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CollabParticipant } from "../types";
import Avatar from "./ui/Avatar";

interface AvatarGroupProps {
  users: CollabParticipant[];
}

export default function AvatarGroup({ users }: AvatarGroupProps) {
  if (users.length === 0) return null;

  const MAX_VISIBLE = 5;
  const visibleUsers = users.slice(0, MAX_VISIBLE);
  const hiddenUsers = users.slice(MAX_VISIBLE);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [hovered, setHovered] = useState<{
    key: string;
    label: string;
    anchorX: number;
  } | null>(null);
  const [tooltipLeft, setTooltipLeft] = useState<number | null>(null);

  const closeTooltip = () => {
    setHovered(null);
    setTooltipLeft(null);
  };

  const openTooltip = (key: string, label: string, element: HTMLElement) => {
    if (!rootRef.current) return;
    const rootRect = rootRef.current.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    setHovered({
      key,
      label,
      anchorX: rect.left + rect.width / 2 - rootRect.left,
    });
  };

  useLayoutEffect(() => {
    if (!hovered || !tooltipRef.current || !rootRef.current) return;
    const tooltipWidth = tooltipRef.current.offsetWidth;
    const viewportPadding = 4;
    const halfWidth = tooltipWidth / 2;
    const maxWidth = rootRef.current.offsetWidth;
    const clampedLeft = Math.min(Math.max(hovered.anchorX, viewportPadding + halfWidth), maxWidth - viewportPadding - halfWidth);
    setTooltipLeft(clampedLeft);
  }, [hovered]);

  const hiddenUsersLabel = useMemo(() => hiddenUsers.map((user) => user.username).join(", "), [hiddenUsers]);

  return (
    <div ref={rootRef} className="relative flex items-center overflow-visible">
      {visibleUsers.map((user, index) => {
        return (
          <div
            key={user.sessionId}
            className={`relative ${index > 0 ? "-ml-2.5" : ""}`}
            onMouseEnter={(event) =>
              openTooltip(
                user.sessionId,
                `${user.username}${user.isHost ? " · Host" : ""}${user.isSelf ? " · You" : ""}`,
                event.currentTarget,
              )
            }
            onMouseLeave={closeTooltip}
            onFocus={(event) =>
              openTooltip(
                user.sessionId,
                `${user.username}${user.isHost ? " · Host" : ""}${user.isSelf ? " · You" : ""}`,
                event.currentTarget,
              )
            }
            onBlur={closeTooltip}
          >
            <Avatar user={user} size="md" />
          </div>
        );
      })}
      {hiddenUsers.length > 0 && (
        <div
          className="-ml-2.5"
          onMouseEnter={(event) => openTooltip("hidden-users", hiddenUsersLabel, event.currentTarget)}
          onMouseLeave={closeTooltip}
          onFocus={(event) => openTooltip("hidden-users", hiddenUsersLabel, event.currentTarget)}
          onBlur={closeTooltip}
        >
          <div className="grid h-8 w-8 min-h-8 min-w-8 place-items-center rounded-full border border-white/8 bg-[rgba(32,33,36,0.82)] text-[10px] font-semibold text-white/72 backdrop-blur-[20px] supports-[backdrop-filter]:backdrop-saturate-150">
            +{hiddenUsers.length}
          </div>
        </div>
      )}
      {hovered && (
        <div
          ref={tooltipRef}
          className="pointer-events-none absolute left-0 top-full z-30 mt-2 -translate-x-1/2 rounded-full border border-white/8 bg-[rgba(24,25,28,0.94)] px-2.5 py-1 text-[10px] font-medium text-white/72 shadow-[0_8px_24px_rgba(0,0,0,0.24)] whitespace-nowrap"
          style={{
            left: tooltipLeft ? `${tooltipLeft}px` : `${hovered.anchorX}px`,
          }}
        >
          {hovered.label}
        </div>
      )}
    </div>
  );
}
