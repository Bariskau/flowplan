import { useRef, useEffect } from "react";

interface DotGridProps {
  zoom?: number;
  panX?: number;
  panY?: number;
}

/**
 * Protocol-inspired gradient background with subtle interactive glow.
 * Replaces the dot grid with smooth radial gradients that respond to mouse.
 */
function DotGrid({ zoom = 1, panX = 0, panY = 0 }: DotGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef<{ x: number; y: number }>({ x: -9999, y: -9999 });
  const targetRef = useRef<{ x: number; y: number }>({ x: -9999, y: -9999 });
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resizeCanvas();
    const observer = new ResizeObserver(() => resizeCanvas());
    const parent = canvas.parentElement;
    if (parent) observer.observe(parent);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      targetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const handleMouseLeave = () => {
      targetRef.current = { x: -9999, y: -9999 };
    };

    window.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      observer.disconnect();
      window.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      // Smooth mouse tracking
      const target = targetRef.current;
      const mouse = mouseRef.current;
      mouse.x += (target.x - mouse.x) * 0.08;
      mouse.y += (target.y - mouse.y) * 0.08;

      // Clear
      ctx.clearRect(0, 0, w, h);

      // --- Static gradient layers (Protocol-inspired) ---
      // Top-left emerald glow
      const g1 = ctx.createRadialGradient(w * 0.15, h * 0.1, 0, w * 0.15, h * 0.1, w * 0.6);
      g1.addColorStop(0, "rgba(16, 185, 129, 0.06)");
      g1.addColorStop(0.5, "rgba(16, 185, 129, 0.02)");
      g1.addColorStop(1, "transparent");
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, w, h);

      // Bottom-right subtle teal
      const g2 = ctx.createRadialGradient(w * 0.85, h * 0.85, 0, w * 0.85, h * 0.85, w * 0.5);
      g2.addColorStop(0, "rgba(20, 184, 166, 0.04)");
      g2.addColorStop(0.6, "rgba(20, 184, 166, 0.01)");
      g2.addColorStop(1, "transparent");
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, w, h);

      // Center very subtle warm glow
      const g3 = ctx.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.4, w * 0.7);
      g3.addColorStop(0, "rgba(167, 139, 250, 0.025)");
      g3.addColorStop(1, "transparent");
      ctx.fillStyle = g3;
      ctx.fillRect(0, 0, w, h);

      // --- Interactive mouse glow (very subtle) ---
      if (mouse.x > -1000 && mouse.y > -1000) {
        const gMouse = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 250);
        gMouse.addColorStop(0, "rgba(16, 185, 129, 0.04)");
        gMouse.addColorStop(0.5, "rgba(16, 185, 129, 0.015)");
        gMouse.addColorStop(1, "transparent");
        ctx.fillStyle = gMouse;
        ctx.fillRect(0, 0, w, h);
      }

      // --- Subtle grid dots (fixed spacing, zoom-aware position only) ---
      const spacing = 32 * zoom;
      const dotRadius = Math.max(0.4, 0.7 * zoom);
      const dotOpacity = 0.12;

      // Skip dots if zoomed out too much (would be too dense)
      if (spacing >= 8) {
        const offsetX = ((panX * zoom) % spacing + spacing) % spacing;
        const offsetY = ((panY * zoom) % spacing + spacing) % spacing;
        const cols = Math.ceil(w / spacing) + 2;
        const rows = Math.ceil(h / spacing) + 2;

        for (let row = -1; row < rows; row++) {
          for (let col = -1; col < cols; col++) {
            const x = offsetX + col * spacing;
            const y = offsetY + row * spacing;
            if (x < -2 || x > w + 2 || y < -2 || y > h + 2) continue;

            // Near mouse: slightly brighter but same color (no color change)
            let opacity = dotOpacity;
            if (mouse.x > -1000) {
              const dx = x - mouse.x;
              const dy = y - mouse.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < 150) {
                const t = 1 - dist / 150;
                opacity = dotOpacity + t * t * 0.12;
              }
            }

            ctx.beginPath();
            ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(161, 161, 170, ${opacity})`;
            ctx.fill();
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [zoom, panX, panY]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    />
  );
}

export default DotGrid;
