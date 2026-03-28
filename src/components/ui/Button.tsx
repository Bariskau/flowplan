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
    "bg-fp-glass border border-fp-border text-fp-text hover:bg-fp-glass-hover hover:border-fp-border-hover active:bg-fp-glass-active shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
  accent:
    "bg-fp-accent-dim border border-fp-accent/25 text-fp-accent hover:bg-fp-accent/20 hover:border-fp-accent/40 active:bg-fp-accent/25 shadow-[0_0_16px_rgba(16,185,129,0.08),inset_0_1px_0_rgba(255,255,255,0.04)]",
  success:
    "bg-fp-success-dim border border-fp-success/25 text-fp-success hover:bg-fp-success/20 hover:border-fp-success/40 active:bg-fp-success/25 shadow-[0_0_16px_rgba(52,211,153,0.08)]",
  info:
    "bg-fp-info-dim border border-fp-info/25 text-fp-info hover:bg-fp-info/20 hover:border-fp-info/40 active:bg-fp-info/25 shadow-[0_0_16px_rgba(56,189,248,0.08)]",
  warning:
    "bg-fp-warning-dim border border-fp-warning/25 text-fp-warning hover:bg-fp-warning/20 hover:border-fp-warning/40 active:bg-fp-warning/25 shadow-[0_0_16px_rgba(251,191,36,0.08)]",
  danger:
    "bg-fp-danger-dim border border-fp-danger/25 text-fp-danger hover:bg-fp-danger/20 hover:border-fp-danger/40 active:bg-fp-danger/25 shadow-[0_0_16px_rgba(248,113,113,0.08)]",
  ghost:
    "bg-transparent border border-transparent text-fp-muted hover:bg-fp-glass-hover hover:text-fp-text active:bg-fp-glass-active",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-7 px-2.5 text-xs gap-1.5 rounded-fp-sm",
  md: "h-8 px-3.5 text-[13px] gap-2 rounded-fp-md",
  lg: "h-9 px-4 text-sm gap-2 rounded-fp-md",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "glassy", size = "md", icon, iconRight, loading, children, className = "", disabled, ...props }, ref) => {
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
        `.trim().replace(/\s+/g, " ")}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-3.5 w-3.5 shrink-0" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="28" strokeDashoffset="8" />
          </svg>
        )}
        {!loading && icon && <span className="shrink-0 flex items-center">{icon}</span>}
        {children && <span>{children}</span>}
        {iconRight && <span className="shrink-0 flex items-center">{iconRight}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
export type { Variant, Size, ButtonProps };
