"use client";

import { useEffect, useRef } from "react";

/**
 * A FaultyTerminal-style field of block glyphs on canvas 2D, written for dfCTF so it adds no dependency.
 * Each cell is a 2x2 quadrant pattern; brightness drifts, the cursor lifts cells near it, and a click glitches rows.
 * It pauses off-screen and draws one still frame under reduced motion.
 */
export default function FaultyTerminal({ tint = "#FFD23F", cell = 16, brightness = 0.35, timeScale = 0.5, className = "" }: { tint?: string; cell?: number; brightness?: number; timeScale?: number; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = host.current, canvas = canvasRef.current, ctx = canvas?.getContext("2d");
    if (!el || !canvas || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cols = 0, rows = 0, raf = 0, visible = true, t = 0, last = 0;
    let glitchUntil = 0, glitchSeed = 0;
    const pointer = { x: -1e4, y: -1e4 };
    const hash = (a: number, b: number) => { let h = Math.imul(a, 374761393) + Math.imul(b, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2), w = el.clientWidth, h = el.clientHeight;
      canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio); ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      cols = Math.ceil(w / cell); rows = Math.ceil(h / cell); draw();
    };

    const draw = () => {
      const w = el.clientWidth;
      ctx.clearRect(0, 0, w, el.clientHeight); ctx.fillStyle = tint;
      const q = cell / 2, step = Math.floor(t * 4);
      for (let y = 0; y < rows; y++) {
        const shift = performance.now() < glitchUntil && hash(y, glitchSeed) > 0.7 ? Math.round((hash(y + 9, glitchSeed) - 0.5) * 8) : 0;
        for (let x = 0; x < cols; x++) {
          const u = x / cols;
          // Brighter toward the right edge so copy on the left stays readable.
          let v = Math.max(0, Math.min(1, (u - 0.35) / 0.55)) * (0.55 + 0.45 * Math.sin(y * 0.7 + x * 0.13 + t * 0.6));
          const dx = x * cell - pointer.x, dy = y * cell - pointer.y;
          v += 0.6 * Math.exp(-(dx * dx + dy * dy) / (2 * 90 * 90));
          if (hash(x + shift, y) > v * 1.15) continue;
          const flick = hash(x * 3 + step, y * 7 + (step >> 2));
          const pattern = Math.floor(hash(x + 7 + (flick > 0.92 ? step : 0), y + 3) * 15) + 1;
          ctx.globalAlpha = Math.min(1, brightness * (0.6 + v * 1.6));
          for (let k = 0; k < 4; k++) if (pattern & (1 << k)) ctx.fillRect((x + shift) * cell + (k % 2) * q + 1, y * cell + Math.floor(k / 2) * q + 1, q - 2, q - 2);
        }
      }
      ctx.globalAlpha = 1;
    };

    const frame = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      t += (last ? Math.min(0.05, (now - last) / 1000) : 0) * timeScale; last = now;
      draw();
      raf = requestAnimationFrame(frame);
    };
    const wake = () => { if (!reduced && !raf && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } };
    const onMove = (e: PointerEvent) => { const r = el.getBoundingClientRect(); pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; if (reduced) draw(); };
    const onLeave = () => { pointer.x = pointer.y = -1e4; if (reduced) draw(); };
    const onDown = () => { if (reduced) return; glitchUntil = performance.now() + 260; glitchSeed = Math.floor(Math.random() * 1e6); };

    const ro = new ResizeObserver(resize); ro.observe(el);
    const io = new IntersectionObserver(entries => { visible = entries.some(e => e.isIntersecting); wake(); }); io.observe(el);
    el.addEventListener("pointermove", onMove); el.addEventListener("pointerleave", onLeave); el.addEventListener("pointerdown", onDown);
    document.addEventListener("visibilitychange", wake);
    resize(); wake();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); el.removeEventListener("pointermove", onMove); el.removeEventListener("pointerleave", onLeave); el.removeEventListener("pointerdown", onDown); document.removeEventListener("visibilitychange", wake); };
  }, [tint, cell, brightness, timeScale]);

  return <div ref={host} className={`faulty-terminal ${className}`} aria-hidden="true"><canvas ref={canvasRef} /></div>;
}
