import { useEffect, useRef, useState } from "react";

/**
 * SVG dot grid background with mouse glow.
 * Based on user's example-dot-bg.html.
 * - Dots zoom with React Flow (pattern size scales)
 * - Mouse glow follows cursor during drag too
 * - Glow radius matches the example (180px mask, 300px light — but subtle)
 */

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

  // Dot pattern scales with zoom
  const size = 24 * zoom;
  const r = Math.max(0.3, 0.8 * zoom);
  const cx = Math.max(0.3, 1 * zoom);

  // Pattern offset for pan
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

    // Listen on window so drag events still update glow
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
    <div ref={containerRef} className="fixed inset-0 z-0 pointer-events-none overflow-hidden" style={{ background: "#09090b" }}>
      {/* Gradient underlays */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 0% 0%, rgba(16,185,129,0.07) 0%, transparent 60%),
            radial-gradient(ellipse 60% 80% at 100% 100%, rgba(20,184,166,0.05) 0%, transparent 50%),
            radial-gradient(ellipse 50% 50% at 60% 30%, rgba(167,139,250,0.025) 0%, transparent 50%)
          `,
        }}
      />

      {/* Base dot grid */}
      <svg className="absolute inset-0 w-full h-full z-[1]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="fp-dots" x={ox} y={oy} width={size} height={size} patternUnits="userSpaceOnUse">
            <circle cx={cx} cy={cx} r={r} fill="#555" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#fp-dots)" />
      </svg>

      {/* Mouse glow light */}
      <div
        ref={glowRef}
        className="absolute inset-0 z-[2]"
        style={{
          background: "radial-gradient(200px circle at var(--mx, -500px) var(--my, -500px), rgba(255,255,255,0.06) 0%, transparent 100%)",
          mixBlendMode: "screen",
        }}
      />

      {/* Bright dots near cursor (SVG mask) */}
      <svg
        className="absolute inset-0 w-full h-full z-[3] transition-opacity duration-200"
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
