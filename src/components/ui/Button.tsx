import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "glassy" | "success" | "info" | "warning" | "danger" | "ghost" | "accent";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  glassy:
    "bg-fp-glass text-fp-muted ring-1 ring-inset ring-fp-border hover:bg-fp-glass-hover hover:text-fp-text hover:ring-fp-border-hover active:bg-fp-glass-active",
  accent:
    "bg-fp-accent-dim text-fp-accent ring-1 ring-inset ring-fp-accent/20 hover:bg-fp-accent/20 hover:ring-fp-accent/40 active:bg-fp-accent/25 shadow-[0_0_16px_rgba(16,185,129,0.06)]",
  success:
    "bg-fp-success-dim text-fp-success ring-1 ring-inset ring-fp-success/20 hover:bg-fp-success/20 hover:ring-fp-success/40 active:bg-fp-success/25 shadow-[0_0_16px_rgba(52,211,153,0.06)]",
  info: "bg-fp-info-dim text-fp-info ring-1 ring-inset ring-fp-info/20 hover:bg-fp-info/20 hover:ring-fp-info/40 active:bg-fp-info/25 shadow-[0_0_16px_rgba(56,189,248,0.06)]",
  warning:
    "bg-fp-warning-dim text-fp-warning ring-1 ring-inset ring-fp-warning/20 hover:bg-fp-warning/20 hover:ring-fp-warning/40 active:bg-fp-warning/25 shadow-[0_0_16px_rgba(251,191,36,0.06)]",
  danger:
    "bg-fp-danger-dim text-fp-danger ring-1 ring-inset ring-fp-danger/20 hover:bg-fp-danger/20 hover:ring-fp-danger/40 active:bg-fp-danger/25 shadow-[0_0_16px_rgba(248,113,113,0.06)]",
  ghost: "bg-transparent text-fp-muted hover:bg-fp-glass-hover hover:text-fp-text active:bg-fp-glass-active",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-7 px-2.5 text-xs gap-1.5 rounded-full",
  md: "h-8 px-3.5 text-[13px] gap-2 rounded-full",
  lg: "h-9 px-4 text-sm gap-2 rounded-full",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "glassy", size = "md", icon, iconRight, loading, children, className = "", disabled, ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center font-medium
          backdrop-blur-fp-card
          transition-all duration-150 ease-out
          cursor-pointer select-none
          disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${className}
        `
          .trim()
          .replace(/\s+/g, " ")}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" fill="none">
            <circle
              cx="8"
              cy="8"
              r="6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="28"
              strokeDashoffset="8"
            />
          </svg>
        )}
        {!loading && icon && <span className="shrink-0 flex items-center">{icon}</span>}
        {children && <span>{children}</span>}
        {iconRight && <span className="shrink-0 flex items-center">{iconRight}</span>}
      </button>
    );
  },
);

Button.displayName = "Button";
export default Button;
export type { Variant, Size, ButtonProps };
