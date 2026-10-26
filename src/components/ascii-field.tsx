"use client";

import { useEffect, useRef } from "react";

const CHARS = " .:-=+x*#%";
const SCRAMBLE = "#%&*+=?@$!<>/\\";

/**
 * Animated ASCII light field on canvas 2D: characters brighten toward a glowing source, drift slowly,
 * decode in on load, and scramble under the cursor. Cheap enough for low-memory laptops (no WebGL).
 * Colors come from the theme tokens. Pauses off-screen; one still frame under reduced motion.
 */
export default function AsciiField({ className = "", cell = 16, ox = 0.78, oy = 1.05, rx = 0.5, ry = 0.85, fadeFrom = 0.4, fadeTo = 0.62 }: {
  className?: string; cell?: number; ox?: number; oy?: number; rx?: number; ry?: number; fadeFrom?: number; fadeTo?: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = host.current, canvas = canvasRef.current, ctx = canvas?.getContext("2d");
    if (!el || !canvas || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const origin = [ox, oy], reach = [rx, ry], fade = [fadeFrom, fadeTo];
    let cols = 0, rows = 0, cw = cell * 0.6, raf = 0, visible = true, lastDraw = 0, t = 0, intro = reduced ? 1 : 0;
    const pointer = { x: -1e4, y: -1e4, at: 0 };
    const palette = { faint: "#8a877f", muted: "#a09d95", accent: "#ffd23f" };
    const hash = (a: number, b: number) => { let h = Math.imul(a, 374761393) + Math.imul(b, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const smooth = (a: number, b: number, x: number) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

    const readColors = () => {
      const s = getComputedStyle(document.documentElement);
      palette.faint = s.getPropertyValue("--faint").trim() || palette.faint;
      palette.muted = s.getPropertyValue("--muted").trim() || palette.muted;
      palette.accent = s.getPropertyValue("--accent-text").trim() || palette.accent;
    };
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2), w = el.clientWidth, h = el.clientHeight;
      canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio); ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      cw = cell * 0.6; cols = Math.ceil(w / cw); rows = Math.ceil(h / (cell * 1.25));
      ctx.font = `${cell * 0.82}px ${getComputedStyle(document.body).getPropertyValue("--font-code") || "monospace"}`;
      ctx.textBaseline = "top";
      draw();
    };

    const draw = () => {
      const w = el.clientWidth, h = el.clientHeight, lh = cell * 1.25, tick = Math.floor(t * 9), now = performance.now();
      ctx.clearRect(0, 0, w, h);
      const scrambleLive = now - pointer.at < 700;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c / cols, y = r / rows;
          const d = Math.hypot((x - origin[0]) / reach[0], (y - origin[1]) / reach[1]);
          const drift = 0.75 + 0.25 * Math.sin(c * 0.21 + t * 0.9) * Math.cos(r * 0.17 - t * 0.6);
          let v = Math.pow(Math.max(0, 1 - d), 1.05) * 1.25 * drift * smooth(fade[0], fade[1], x);
          v *= 0.75 + 0.25 * hash(c, r + (tick >> 3));
          // The decode intro sweeps outward from the light source.
          const order = Math.min(1, d * 0.9);
          const revealed = intro * 1.4 - order;
          if (revealed <= 0) continue;
          if (hash(c + 91, r + 17) > 0.85 * (0.2 + v)) continue;
          let level = Math.max(0, Math.min(CHARS.length - 1, Math.round(v * 9)));
          if (level === 0) continue;
          let ch = CHARS[level];
          const px = c * cw, py = r * lh;
          const near = scrambleLive && Math.hypot(px - pointer.x, py - pointer.y) < 70;
          if (revealed < 0.3 || near) { ch = SCRAMBLE[(c * 7 + r * 13 + tick) % SCRAMBLE.length]; level = Math.max(level, 5); }
          ctx.fillStyle = level >= 7 ? palette.accent : level >= 4 ? palette.muted : palette.faint;
          ctx.globalAlpha = level >= 7 ? 0.9 : level >= 4 ? 0.7 : 0.55;
          ctx.fillText(ch, px, py);
        }
      }
      ctx.globalAlpha = 1;
    };

    // About 24 redraws a second is plenty for drifting glyphs and keeps the CPU cost low.
    const frame = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      const elapsed = Math.min(0.1, (now - lastDraw) / 1000);
      if (elapsed > 1 / 24) { t += elapsed * 0.5; intro = Math.min(1, intro + elapsed / 1.6); lastDraw = now; draw(); }
      raf = requestAnimationFrame(frame);
    };
    const wake = () => { if (!reduced && !raf && visible && !document.hidden) { lastDraw = performance.now(); raf = requestAnimationFrame(frame); } };
    const onMove = (e: PointerEvent) => { const r = el.getBoundingClientRect(); pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; pointer.at = performance.now(); };
    const onTheme = () => { readColors(); draw(); };

    readColors();
    const ro = new ResizeObserver(resize); ro.observe(el);
    const io = new IntersectionObserver(entries => { visible = entries.some(e => e.isIntersecting); wake(); }); io.observe(el);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("dfctf-theme", onTheme);
    document.addEventListener("visibilitychange", wake);
    resize(); wake();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); window.removeEventListener("pointermove", onMove); window.removeEventListener("dfctf-theme", onTheme); document.removeEventListener("visibilitychange", wake); };
  }, [cell, ox, oy, rx, ry, fadeFrom, fadeTo]);

  return <div ref={host} className={`ascii-field ${className}`} aria-hidden="true"><canvas ref={canvasRef} /></div>;
}
