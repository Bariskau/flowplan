import { CaretDown } from "@phosphor-icons/react";
import { useId, useState, type ReactNode } from "react";

interface AccordionProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}

export default function Accordion({
  title,
  description,
  defaultOpen = false,
  children,
  className = "",
}: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className={`rounded-[18px] border border-white/[0.06] bg-white/[0.025] ${className}`.trim()}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.02]"
      >
        <div className="min-w-0">
          <div className="text-[12px] font-medium text-white/78">{title}</div>
          {description ? <div className="mt-1 text-[11px] leading-relaxed text-white/34">{description}</div> : null}
        </div>
        <div
          className={`shrink-0 rounded-full border border-white/[0.06] bg-white/[0.03] p-1.5 text-white/48 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        >
          <CaretDown size={12} weight="bold" />
        </div>
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-250 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div
            id={panelId}
            aria-hidden={!open}
            className={`border-t border-white/[0.06] px-4 transition-[opacity,padding] duration-200 ease-out ${
              open ? "opacity-100 pt-4 pb-4" : "opacity-0 pt-0 pb-0"
            }`}
          >
            <div className="flex flex-col gap-4">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
