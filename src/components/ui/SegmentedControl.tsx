import type { ReactNode } from "react";

interface SegmentedControlOption {
  id: string;
  label: ReactNode;
  disabled?: boolean;
}

interface SegmentedControlProps {
  options: SegmentedControlOption[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  itemClassName?: string;
}

export default function SegmentedControl({
  options,
  value,
  onChange,
  className = "",
  itemClassName = "",
}: SegmentedControlProps) {
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.id === value),
  );
  const gapPx = 2;
  const insetPx = 2;
  const optionCount = Math.max(1, options.length);

  return (
    <div
      className={`relative grid rounded-full bg-white/[0.04] border border-white/[0.06] p-0.5 ${className}`.trim()}
      style={{ gridTemplateColumns: `repeat(${optionCount}, minmax(0, 1fr))` }}
    >
      <div
        className="absolute top-0.5 bottom-0.5 left-0.5 rounded-full bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_4px_12px_rgba(0,0,0,0.18)] transition-transform duration-250 ease-out pointer-events-none"
        style={{
          width: `calc((100% - ${insetPx * 2}px - ${(optionCount - 1) * gapPx}px) / ${optionCount})`,
          transform: `translateX(calc(${activeIndex * 100}% + ${activeIndex * gapPx}px))`,
        }}
      />

      {options.map((option) => {
        const selected = option.id === value;

        return (
          <button
            key={option.id}
            type="button"
            disabled={option.disabled}
            aria-pressed={selected}
            onClick={() => onChange(option.id)}
            className={`relative z-10 flex items-center justify-center gap-1 px-2.5 py-1 rounded-full border-none text-[10px] font-medium transition-all duration-150 ${
              selected
                ? "text-white/82"
                : option.disabled
                  ? "text-white/18 cursor-default"
                  : "text-white/34 cursor-pointer hover:text-white/60"
            } ${itemClassName}`.trim()}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
