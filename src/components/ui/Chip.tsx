import type { ReactNode } from "react";
import { XIcon as X } from "@phosphor-icons/react";

type ChipVariant = "default" | "accent" | "success" | "info" | "warning" | "danger" | "purple" | "orange" | "teal";
type ChipSize = "xs" | "sm" | "md";

interface ChipProps {
  children: ReactNode;
  icon?: ReactNode;
  variant?: ChipVariant;
  size?: ChipSize;
  className?: string;
  onClick?: () => void;
  onRemove?: () => void;
}

const variantClasses: Record<ChipVariant, string> = {
  default: "text-white/60",
  accent: "text-fp-accent/80",
  success: "text-fp-success/80",
  info: "text-fp-info/80",
  warning: "text-fp-warning/80",
  danger: "text-fp-danger/80",
  purple: "text-fp-purple/80",
  orange: "text-fp-orange/80",
  teal: "text-fp-teal/80",
};

export default function Chip({
  children,
  icon,
  variant = "default",
  size = "sm",
  className = "",
  onClick,
  onRemove,
}: ChipProps) {
  const h = size === "xs" ? 20 : size === "sm" ? 24 : 32;
  const px = size === "xs" ? 6 : size === "sm" ? 8 : 10;
  const fs = size === "xs" ? 9 : size === "sm" ? 10 : 12;
  const g = size === "xs" ? 3 : size === "sm" ? 5 : 7;
  return (
    <div
      role={onClick ? "button" : "group"}
      onClick={onClick}
      style={{ height: h, paddingLeft: px, paddingRight: onRemove ? 2 : px, gap: g, fontSize: fs }}
      className={`
        inline-flex items-center rounded-full
        font-semibold uppercase tracking-wide
        bg-[rgba(42,45,53,0.55)] backdrop-blur-[20px] border border-white/[0.07] shadow-sm
        shrink-0 transition-all duration-150 ease-out
        ${onClick ? "cursor-pointer hover:bg-white/8 hover:border-white/12 active:bg-white/10" : ""}
        ${variantClasses[variant]}
        ${className}
      `
        .trim()
        .replace(/\s+/g, " ")}
    >
      {icon && <span className="shrink-0 flex items-center">{icon}</span>}
      <span className={`whitespace-nowrap truncate min-w-0 ${icon ? "mt-px" : ""}`}>{children}</span>
      {onRemove && (
        <button
          type="button"
          aria-label="Remove"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="flex items-center justify-center rounded-full hover:bg-white/10 transition-colors p-1 bg-transparent border-none text-inherit cursor-pointer"
        >
          <X size={12} weight="regular" />
        </button>
      )}
    </div>
  );
}

export type { ChipVariant, ChipSize, ChipProps };
