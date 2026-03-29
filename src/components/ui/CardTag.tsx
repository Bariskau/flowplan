import type { ReactNode } from "react";

type TagVariant = "default" | "accent" | "success" | "info" | "warning" | "danger" | "purple" | "orange" | "teal";

interface CardTagProps {
  children: ReactNode;
  icon?: ReactNode;
  variant?: TagVariant;
  className?: string;
}

const colors: Record<TagVariant, string> = {
  default: "text-white/50 bg-white/[0.05] border-white/[0.06]",
  accent: "text-fp-accent/80 bg-fp-accent/[0.08] border-fp-accent/10",
  success: "text-fp-success/80 bg-fp-success/[0.08] border-fp-success/10",
  info: "text-fp-info/80 bg-fp-info/[0.08] border-fp-info/10",
  warning: "text-fp-warning/80 bg-fp-warning/[0.08] border-fp-warning/10",
  danger: "text-fp-danger/80 bg-fp-danger/[0.08] border-fp-danger/10",
  purple: "text-fp-purple/80 bg-fp-purple/[0.08] border-fp-purple/10",
  orange: "text-fp-orange/80 bg-fp-orange/[0.08] border-fp-orange/10",
  teal: "text-fp-teal/80 bg-fp-teal/[0.08] border-fp-teal/10",
};

export default function CardTag({ children, icon, variant = "default", className = "" }: CardTagProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 h-5 px-1.5 rounded-md text-[9px] font-semibold uppercase tracking-wide border shrink-0 ${colors[variant]} ${className}`}
    >
      {icon && <span className="shrink-0 flex items-center">{icon}</span>}
      <span className={icon ? "mt-px" : ""}>{children}</span>
    </span>
  );
}

export type { TagVariant };
