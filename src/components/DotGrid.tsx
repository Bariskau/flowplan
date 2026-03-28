import React, { useRef, useEffect } from "react";

interface DotGridProps {
  zoom?: number;
  panX?: number;
  panY?: number;
}

const SPACING = 30;
const DOT_RADIUS = 1.2;
const DOT_COLOR: [number, number, number] = [63, 63, 70]; // zinc-700
const GLOW_COLOR: [number, number, number] = [16, 185, 129]; // emerald-500
const ACCENT_COLOR: [number, number, number] = [20, 184, 166]; // teal-500
const INFLUENCE_RADIUS = 160;
const MAX_GLOW_RADIUS = 3.5;
const BASE_DOT_OPACITY = 0.5;

function DotGrid({ zoom = 1, panX = 0, panY = 0 }: DotGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
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

    const observer = new ResizeObserver(() => {
      resizeCanvas();
    });

    const parent = canvas.parentElement;
    if (parent) {
      observer.observe(parent);
    }

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current = null;
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
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      ctx.clearRect(0, 0, width, height);

      const scaledSpacing = SPACING * zoom;
      const scaledDotRadius = DOT_RADIUS * zoom;
      const scaledMaxGlowRadius = MAX_GLOW_RADIUS * zoom;

      // Compute the offset so dots shift with the pan, then wrap within one spacing cell
      const offsetX = ((panX * zoom) % scaledSpacing + scaledSpacing) % scaledSpacing;
      const offsetY = ((panY * zoom) % scaledSpacing + scaledSpacing) % scaledSpacing;

      // How many dots we need to cover the canvas, plus a buffer
      const cols = Math.ceil(width / scaledSpacing) + 2;
      const rows = Math.ceil(height / scaledSpacing) + 2;

      const mouse = mouseRef.current;

      for (let row = -1; row < rows; row++) {
        for (let col = -1; col < cols; col++) {
          const x = offsetX + col * scaledSpacing;
          const y = offsetY + row * scaledSpacing;

          // Skip dots that are well outside the visible area
          if (
            x < -scaledMaxGlowRadius ||
            x > width + scaledMaxGlowRadius ||
            y < -scaledMaxGlowRadius ||
            y > height + scaledMaxGlowRadius
          ) {
            continue;
          }

          let radius = scaledDotRadius;
          let r = DOT_COLOR[0];
          let g = DOT_COLOR[1];
          let b = DOT_COLOR[2];
          let opacity = BASE_DOT_OPACITY;

          if (mouse) {
            const dx = x - mouse.x;
            const dy = y - mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < INFLUENCE_RADIUS) {
              const t = 1 - dist / INFLUENCE_RADIUS;
              // Ease in for a smoother falloff
              const ease = t * t;

              // Interpolate radius
              radius = scaledDotRadius + (scaledMaxGlowRadius - scaledDotRadius) * ease;

              // Interpolate color: teal at edges of influence, emerald at center
              const colorT = ease;
              r = ACCENT_COLOR[0] + (GLOW_COLOR[0] - ACCENT_COLOR[0]) * colorT;
              g = ACCENT_COLOR[1] + (GLOW_COLOR[1] - ACCENT_COLOR[1]) * colorT;
              b = ACCENT_COLOR[2] + (GLOW_COLOR[2] - ACCENT_COLOR[2]) * colorT;

              opacity = BASE_DOT_OPACITY + (1 - BASE_DOT_OPACITY) * ease;
            }
          }

          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${opacity})`;
          ctx.fill();
        }
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
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
