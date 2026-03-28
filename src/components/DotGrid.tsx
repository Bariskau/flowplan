import { useRef, useEffect } from "react";

/**
 * Full-screen background: gradient + dot grid.
 * Fixed behind entire app for glassmorphism panels.
 * Dots scale with viewport, mouse causes subtle brightness (no color change).
 */
export default function DotGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const smoothRef = useRef({ x: -9999, y: -9999 });
  const animRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const onMove = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    const onLeave = () => { mouseRef.current = { x: -9999, y: -9999 }; };
    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);

    const draw = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const s = smoothRef.current;
      const t = mouseRef.current;
      s.x += (t.x - s.x) * 0.06;
      s.y += (t.y - s.y) * 0.06;

      ctx.clearRect(0, 0, w, h);

      // ── Gradient layers ──
      const g1 = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(w, h) * 0.85);
      g1.addColorStop(0, "rgba(16,185,129,0.07)");
      g1.addColorStop(0.4, "rgba(16,185,129,0.02)");
      g1.addColorStop(1, "transparent");
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, w, h);

      const g2 = ctx.createRadialGradient(w, h, 0, w, h, Math.max(w, h) * 0.7);
      g2.addColorStop(0, "rgba(20,184,166,0.05)");
      g2.addColorStop(0.5, "rgba(20,184,166,0.015)");
      g2.addColorStop(1, "transparent");
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, w, h);

      const g3 = ctx.createRadialGradient(w * 0.6, h * 0.3, 0, w * 0.6, h * 0.3, w * 0.5);
      g3.addColorStop(0, "rgba(167,139,250,0.02)");
      g3.addColorStop(1, "transparent");
      ctx.fillStyle = g3;
      ctx.fillRect(0, 0, w, h);

      // Mouse glow
      if (s.x > -1000) {
        const gm = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 280);
        gm.addColorStop(0, "rgba(16,185,129,0.045)");
        gm.addColorStop(0.5, "rgba(16,185,129,0.012)");
        gm.addColorStop(1, "transparent");
        ctx.fillStyle = gm;
        ctx.fillRect(0, 0, w, h);
      }

      // ── Dot grid ──
      const spacing = 28;
      const baseR = 1;
      const baseAlpha = 0.18;
      const cols = Math.ceil(w / spacing) + 1;
      const rows = Math.ceil(h / spacing) + 1;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * spacing;
          const y = row * spacing;

          let alpha = baseAlpha;
          let r = baseR;

          // Near mouse: slightly brighter, slightly bigger — same zinc color
          if (s.x > -1000) {
            const dx = x - s.x;
            const dy = y - s.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 140) {
              const ease = (1 - dist / 140);
              const e2 = ease * ease;
              alpha = baseAlpha + e2 * 0.25;
              r = baseR + e2 * 1.2;
            }
          }

          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(161,161,170,${alpha})`;
          ctx.fill();
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}
    />
  );
}
