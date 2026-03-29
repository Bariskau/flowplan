import type { ReactNode } from "react";

interface FileTagProps {
  children: ReactNode;
  dot?: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
  className?: string;
}

export default function FileTag({ children, dot, icon, onClick, className = "" }: FileTagProps) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      onClick={onClick}
      className={`inline-flex items-center gap-1 h-[18px] px-1.5 rounded text-[9px] font-mono text-white/50 bg-white/[0.04] border border-white/[0.06] max-w-[120px] shrink-0 transition-colors duration-100 ${
        onClick ? "cursor-pointer hover:bg-white/[0.07] hover:border-white/[0.09] hover:text-white/65 border-none" : ""
      } ${className}`}
    >
      {dot}
      {icon}
      <span className="overflow-hidden text-ellipsis whitespace-nowrap mt-0.5">{children}</span>
    </Tag>
  );
}
