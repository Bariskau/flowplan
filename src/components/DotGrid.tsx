import { useEffect, useRef } from "react";

/**
 * SVG pattern-based dot grid with mouse glow effect.
 * Based on user's example-dot-bg.html.
 * Uses SVG patterns (zoom-aware via patternUnits) + CSS radial-gradient glow.
 */
export default function DotGrid() {
  const glowRef = useRef<HTMLDivElement>(null);
  const maskRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (glowRef.current) {
        glowRef.current.style.setProperty("--mx", e.clientX + "px");
        glowRef.current.style.setProperty("--my", e.clientY + "px");
      }
      if (maskRef.current) {
        maskRef.current.setAttribute("cx", String(e.clientX));
        maskRef.current.setAttribute("cy", String(e.clientY));
      }
    };
    const onLeave = () => {
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
    document.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" style={{ background: "#09090b" }}>
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

      {/* Base dot grid (SVG pattern) */}
      <svg className="absolute inset-0 w-full h-full z-[1]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="fp-dot-grid" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.8" fill="#555" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#fp-dot-grid)" />
      </svg>

      {/* Mouse glow overlay */}
      <div
        ref={glowRef}
        className="absolute inset-0 z-[2]"
        style={{
          background: "radial-gradient(300px circle at var(--mx, -500px) var(--my, -500px), rgba(255,255,255,0.06) 0%, transparent 100%)",
          mixBlendMode: "screen",
        }}
      />

      {/* Hover-bright dots (SVG with mask) */}
      <svg className="absolute inset-0 w-full h-full z-[3] opacity-0 transition-opacity duration-150 [.fixed:hover_&]:opacity-100" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="fp-dot-grid-hover" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.8" fill="#b4b4b4" />
          </pattern>
          <radialGradient id="fp-glow-mask-grad">
            <stop offset="0%" stopColor="white" />
            <stop offset="100%" stopColor="black" />
          </radialGradient>
          <mask id="fp-glow-mask">
            <circle ref={maskRef} cx="-500" cy="-500" r="180" fill="url(#fp-glow-mask-grad)" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="url(#fp-dot-grid-hover)" mask="url(#fp-glow-mask)" />
      </svg>
    </div>
  );
}
