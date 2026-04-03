import { Children, cloneElement, isValidElement, useState, useEffect, useRef, type ReactNode } from "react";

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
          className={`absolute z-[100] min-w-[168px] overflow-hidden rounded-2xl border border-white/8 bg-[rgba(32,33,36,0.58)] backdrop-blur-[28px] supports-[backdrop-filter]:backdrop-saturate-150 animate-dropdown-in origin-[var(--origin)]
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
          <div className="flex flex-col gap-0.5 p-1.5">
            {typeof children === "function"
              ? (children as any)(() => setOpen(false))
              : Children.map(children, (child) => {
                  if (!isValidElement(child)) return child;
                  return cloneElement(child, { closeMenu: () => setOpen(false) });
                })}
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
  closeMenu?: () => void;
}

export function DropdownItem({ onClick, icon, label, danger, closeMenu }: DropdownItemProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
        closeMenu?.();
      }}
      className={`relative flex w-full items-center gap-2.5 rounded-[12px] bg-transparent px-3 py-2 text-left text-[12px] whitespace-nowrap cursor-pointer select-none border-none outline-none transition-colors duration-150
        hover:bg-white/[0.05] active:bg-white/[0.08]
        ${danger ? "text-fp-danger" : "text-white/78"}`}
    >
      {icon && (
        <span
          className={`flex shrink-0 items-center justify-center ${danger ? "text-fp-danger" : "text-white/46"}`}
        >
          {icon}
        </span>
      )}
      <span className="flex-1">{label}</span>
    </button>
  );
}
