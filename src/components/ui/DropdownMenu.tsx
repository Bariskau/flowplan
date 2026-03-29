import { useState, useEffect, useRef, type ReactNode } from "react";

interface DropdownMenuProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
}

export default function DropdownMenu({ trigger, children, align = "left" }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const [above, setAbove] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Determine if menu should open above or below
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setAbove(spaceBelow < 280);
    }
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <div
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
      >
        {trigger}
      </div>
      {open && (
        <div
          ref={menuRef}
          onClick={(e) => e.stopPropagation()}
          className={`absolute z-[100] min-w-[160px] overflow-hidden rounded-[16px] border border-white/8 bg-[rgba(32,33,36,0.55)] backdrop-blur-[40px] animate-dropdown-in origin-[var(--origin)]
            ${align === "right" ? "right-0" : "left-0"}
            ${above ? "bottom-full mb-2" : "top-full mt-2"}
          `}
          style={
            {
              "--origin": above
                ? `${align === "right" ? "100%" : "0%"} 100%`
                : `${align === "right" ? "100%" : "0%"} 0%`,
            } as React.CSSProperties
          }
        >
          <div className="flex flex-col py-2 px-1" onClick={() => setOpen(false)}>
            {typeof children === "function" ? (children as any)(() => setOpen(false)) : children}
          </div>
        </div>
      )}
    </div>
  );
}

interface DropdownItemProps {
  onClick: () => void;
  icon?: ReactNode;
  label: string;
  danger?: boolean;
}

export function DropdownItem({ onClick, icon, label, danger }: DropdownItemProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`relative flex w-full items-center gap-2 bg-transparent px-3 py-1.5 text-left text-xs whitespace-nowrap cursor-pointer select-none border-none outline-none
        before:absolute before:inset-x-1 before:inset-y-0 before:rounded-md before:transition-colors before:duration-100
        hover:before:bg-white/[0.05] active:before:bg-white/8
        ${danger ? "text-fp-danger" : "text-white/80"}`}
    >
      {icon && (
        <span
          className={`relative z-[1] flex shrink-0 items-center justify-center ${danger ? "text-fp-danger" : "text-white/50"}`}
        >
          {icon}
        </span>
      )}
      <span className="relative z-[1] flex-1">{label}</span>
    </button>
  );
}
