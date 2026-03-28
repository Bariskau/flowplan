import { useRef, useEffect } from "react";

/**
 * Full-screen gradient background inspired by protocol.tailwindui.com.
 * Renders soft radial gradients with a subtle mouse-following glow.
 * Sits behind the entire app so glassmorphism panels show the gradient through blur.
 */
export default function DotGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const smoothMouse = useRef({ x: -9999, y: -9999 });
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

    const onMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    const onLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };
    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);

    const draw = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      // Smooth mouse
      const t = mouseRef.current;
      const s = smoothMouse.current;
      s.x += (t.x - s.x) * 0.06;
      s.y += (t.y - s.y) * 0.06;

      ctx.clearRect(0, 0, w, h);

      // --- Protocol-inspired gradient layers ---

      // Large top-left emerald wash
      const g1 = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(w, h) * 0.8);
      g1.addColorStop(0, "rgba(16, 185, 129, 0.07)");
      g1.addColorStop(0.4, "rgba(16, 185, 129, 0.02)");
      g1.addColorStop(1, "transparent");
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, w, h);

      // Bottom-right teal/cyan accent
      const g2 = ctx.createRadialGradient(w, h, 0, w, h, Math.max(w, h) * 0.7);
      g2.addColorStop(0, "rgba(20, 184, 166, 0.05)");
      g2.addColorStop(0.5, "rgba(20, 184, 166, 0.015)");
      g2.addColorStop(1, "transparent");
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, w, h);

      // Very subtle center warm accent
      const g3 = ctx.createRadialGradient(w * 0.6, h * 0.3, 0, w * 0.6, h * 0.3, w * 0.5);
      g3.addColorStop(0, "rgba(167, 139, 250, 0.02)");
      g3.addColorStop(1, "transparent");
      ctx.fillStyle = g3;
      ctx.fillRect(0, 0, w, h);

      // --- Mouse glow (very subtle) ---
      if (s.x > -1000 && s.y > -1000) {
        const gm = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 300);
        gm.addColorStop(0, "rgba(16, 185, 129, 0.04)");
        gm.addColorStop(0.5, "rgba(16, 185, 129, 0.01)");
        gm.addColorStop(1, "transparent");
        ctx.fillStyle = gm;
        ctx.fillRect(0, 0, w, h);
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
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}
