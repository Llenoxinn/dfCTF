"use client";

import { useEffect, useMemo, useRef } from "react";
import { buildScene, frameDensity, threshold } from "@/lib/scene";
import { useTheme } from "./ui";

const DURATION = 900;
const easeInOut = (p: number) => p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;

function inkColor(element: HTMLElement) {
  const match = getComputedStyle(element).color.match(/\d+(\.\d+)?/g);
  return match ? match.slice(0, 3).map(Number) : [27, 31, 179];
}

/** The campus at day or night, dithered to the theme's ink. Switching themes plays dusk or dawn once. */
export default function CampusScene({ width = 384, height = 160, className = "" }: { width?: number; height?: number; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const progress = useRef<number | null>(null);
  const theme = useTheme();
  const scene = useMemo(() => buildScene(width, height), [width, height]);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context || !theme) return;
    const image = context.createImageData(width, height);
    const target = theme === "dark" ? 1 : 0;
    const from = progress.current ?? target;

    const draw = (t: number) => {
      const [r, g, b] = inkColor(element);
      const data = image.data;
      for (let y = 0, i = 0; y < height; y++) for (let x = 0; x < width; x++, i++) {
        const o = i * 4;
        data[o] = r; data[o + 1] = g; data[o + 2] = b;
        data[o + 3] = frameDensity(scene, i, t) > threshold(x, y) ? 255 : 0;
      }
      context.putImageData(image, 0, 0);
      progress.current = t;
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || from === target) { draw(target); return; }
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / DURATION);
      draw(from + (target - from) * easeInOut(p));
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [theme, scene, width, height]);

  return <canvas ref={canvas} width={width} height={height} className={`campus-scene ${className}`} role="img" aria-label={theme === "dark" ? "A pixel campus at night: lit windows, a crescent moon, and a flag on the clock tower." : "A pixel campus by day: clouds, the sun, and a flag on the clock tower."}/>;
}
