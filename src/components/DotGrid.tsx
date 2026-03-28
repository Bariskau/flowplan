import { useEffect, useRef, useState } from "react";

interface DotGridProps {
  zoom?: number;
  panX?: number;
  panY?: number;
}

export default function DotGrid({ zoom = 1, panX = 0, panY = 0 }: DotGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const maskRef = useRef<SVGCircleElement>(null);
  const [hovering, setHovering] = useState(false);

  const size = 24 * zoom;
  const r = Math.max(0.3, 0.8 * zoom);
  const cx = Math.max(0.3, 1 * zoom);

  const ox = ((panX * zoom) % size + size) % size;
  const oy = ((panY * zoom) % size + size) % size;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onMove = (e: MouseEvent) => {
      const x = e.clientX;
      const y = e.clientY;
      if (glowRef.current) {
        glowRef.current.style.setProperty("--mx", x + "px");
        glowRef.current.style.setProperty("--my", y + "px");
      }
      if (maskRef.current) {
        maskRef.current.setAttribute("cx", String(x));
        maskRef.current.setAttribute("cy", String(y));
      }
    };

    const onEnter = () => setHovering(true);
    const onLeave = () => {
      setHovering(false);
      if (glowRef.current) {
        glowRef.current.style.setProperty("--mx", "-500px");
        glowRef.current.style.setProperty("--my", "-500px");
      }
      if (maskRef.current) {
        maskRef.current.setAttribute("cx", "-500");
        maskRef.current.setAttribute("cy", "-500");
      }
    };

    window.addEventListener("mousemove", onMove);
    container.addEventListener("mouseenter", onEnter);
    document.addEventListener("mouseleave", onLeave);

    return () => {
      window.removeEventListener("mousemove", onMove);
      container.removeEventListener("mouseenter", onEnter);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div ref={containerRef} className="fixed inset-0 z-0 pointer-events-none overflow-hidden" style={{ background: "#191A1F" }}>

      {/* Base dot grid - #777 like example */}
      <svg className="absolute inset-0 w-full h-full z-[1]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="fp-dots" x={ox} y={oy} width={size} height={size} patternUnits="userSpaceOnUse">
            <circle cx={cx} cy={cx} r={r} fill="#777" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#fp-dots)" />
      </svg>

      {/* Mouse glow light - 300px like example */}
      <div
        ref={glowRef}
        className="absolute inset-0 z-[2]"
        style={{
          background: "radial-gradient(300px circle at var(--mx, -500px) var(--my, -500px), rgba(255,255,255,0.06) 0%, transparent 100%)",
          mixBlendMode: "screen",
        }}
      />

      {/* Bright dots near cursor - 180px mask like example */}
      <svg
        className="absolute inset-0 w-full h-full z-[3] transition-opacity duration-150"
        style={{ opacity: hovering ? 1 : 0 }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="fp-dots-bright" x={ox} y={oy} width={size} height={size} patternUnits="userSpaceOnUse">
            <circle cx={cx} cy={cx} r={r} fill="#b4b4b4" />
          </pattern>
          <radialGradient id="fp-glow-grad">
            <stop offset="0%" stopColor="white" />
            <stop offset="100%" stopColor="black" />
          </radialGradient>
          <mask id="fp-glow-mask">
            <circle ref={maskRef} cx="-500" cy="-500" r="180" fill="url(#fp-glow-grad)" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="url(#fp-dots-bright)" mask="url(#fp-glow-mask)" />
      </svg>
    </div>
  );
}
