import Avatar from "./ui/Avatar";

export interface CollabCursorPresence {
  sessionId: string;
  username: string;
  avatarSeed: string;
  x: number;
  y: number;
}

interface CollabCursorLayerProps {
  cursors: CollabCursorPresence[];
  frame?: { left: number; top: number; width: number; height: number } | null;
  viewport?: { x: number; y: number; zoom: number } | null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function CollabCursorLayer({ cursors, frame, viewport }: CollabCursorLayerProps) {
  if (cursors.length === 0 || !frame || !viewport || frame.width <= 0 || frame.height <= 0 || viewport.zoom <= 0) {
    return null;
  }

  return (
    <div
      className="fixed z-[8] pointer-events-none overflow-hidden"
      style={{
        left: frame.left,
        top: frame.top,
        width: frame.width,
        height: frame.height,
      }}
    >
      {cursors.map((cursor) => {
        const left = clamp(cursor.x * viewport.zoom + viewport.x, 8, frame.width - 8);
        const top = clamp(cursor.y * viewport.zoom + viewport.y, 10, frame.height - 10);

        return (
          <div
            key={cursor.sessionId}
            className="absolute will-change-transform transition-[left,top,opacity,transform] duration-180 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{
              left,
              top,
              transform: "translate3d(-12px, -14px, 0)",
            }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-[rgba(32,33,36,0.72)] px-2 py-1 shadow-[0_10px_28px_rgba(0,0,0,0.18)] backdrop-blur-[24px] supports-[backdrop-filter]:backdrop-saturate-150">
              <Avatar user={cursor} size="sm" />
              <span className="max-w-[160px] truncate pr-1 text-[11px] font-medium leading-none text-white/86">
                {cursor.username}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
