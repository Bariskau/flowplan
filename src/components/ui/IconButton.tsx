import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "glassy" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon: ReactNode;
  label?: string;
}

const variantClasses: Record<Variant, string> = {
  glassy:
    "bg-fp-glass border border-fp-border text-fp-muted hover:bg-fp-glass-hover hover:text-fp-text hover:border-fp-border-hover active:bg-fp-glass-active shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
  ghost:
    "bg-transparent border border-transparent text-fp-dim hover:bg-fp-glass-hover hover:text-fp-muted active:bg-fp-glass-active",
  danger:
    "bg-transparent border border-transparent text-fp-dim hover:bg-fp-danger-dim hover:text-fp-danger hover:border-fp-danger/20 active:bg-fp-danger/15",
};

const sizeClasses: Record<Size, string> = {
  sm: "w-6 h-6 min-w-6 min-h-6 aspect-square rounded-fp-sm",
  md: "w-7 h-7 min-w-7 min-h-7 aspect-square rounded-fp-md",
  lg: "w-8 h-8 min-w-8 min-h-8 aspect-square rounded-fp-md",
};

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ variant = "ghost", size = "md", icon, label, className = "", ...props }, ref) => {
    return (
      <button
        ref={ref}
        aria-label={label}
        title={label}
        className={`
          inline-flex items-center justify-center
          backdrop-blur-fp-card
          transition-all duration-150 ease-out
          cursor-pointer select-none shrink-0
          disabled:opacity-40 disabled:cursor-not-allowed
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${className}
        `
          .trim()
          .replace(/\s+/g, " ")}
        {...props}
      >
        {icon}
      </button>
    );
  },
);

IconButton.displayName = "IconButton";
export default IconButton;
