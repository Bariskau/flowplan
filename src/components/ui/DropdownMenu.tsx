import { useState, useEffect, useRef, type ReactNode } from "react";

interface DropdownMenuProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
}

export default function DropdownMenu({ trigger, children, align = "left" }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      {open && (
        <div
          className={`absolute top-full mt-1.5 z-[100] min-w-[180px] fp-glass border border-fp-border rounded-fp-lg p-1 shadow-[0_8px_30px_rgba(0,0,0,0.4)] ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {typeof children === "function" ? (children as any)(() => setOpen(false)) : children}
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
      onClick={onClick}
      className={`w-full bg-transparent border-none cursor-pointer py-2 px-3 rounded-fp-sm flex items-center gap-2.5 text-[13px] font-sans whitespace-nowrap transition-colors duration-150 ${
        danger
          ? "text-fp-danger hover:bg-fp-danger-dim"
          : "text-fp-text hover:bg-fp-glass-hover"
      }`}
    >
      {icon && <span className="shrink-0 flex items-center w-4 h-4">{icon}</span>}
      <span>{label}</span>
    </button>
  );
}
