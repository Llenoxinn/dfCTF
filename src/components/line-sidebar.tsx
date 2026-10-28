"use client";

// LineSidebar from React Bits (https://reactbits.dev), MIT. Adapted for dfCTF: every item is a real link (keyboard and
// screen readers reach it), items can open a labelled group, focus lights an item like the pointer does, the item whose
// section is on screen stays lit (`spy`), colors default to the theme tokens, and reduced motion drops the movement.
// Its rules live in globals.css.
import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";

type Falloff = "linear" | "smooth" | "sharp";
export type LineSidebarItem = { label: string; href: string; group?: string };

export interface LineSidebarProps {
  items: LineSidebarItem[];
  label: string;
  accentColor?: string;
  textColor?: string;
  markerColor?: string;
  showIndex?: boolean;
  showMarker?: boolean;
  proximityRadius?: number;
  maxShift?: number;
  falloff?: Falloff;
  markerLength?: number;
  markerGap?: number;
  tickScale?: number;
  scaleTick?: boolean;
  itemGap?: number;
  fontSize?: number;
  smoothing?: number;
  spy?: boolean;
  className?: string;
}

const FALLOFF_CURVES: Record<Falloff, (p: number) => number> = {
  linear: p => p,
  smooth: p => p * p * (3 - 2 * p),
  sharp: p => p * p * p,
};
// How far below the top of the window a section's heading must reach before it counts as the current one.
const SPY_LINE = 140;

export default function LineSidebar({
  items, label,
  accentColor = "var(--accent-text)", textColor = "var(--muted)", markerColor = "var(--line-strong)",
  showIndex = false, showMarker = true, proximityRadius = 100, maxShift = 30, falloff = "smooth",
  markerLength = 60, markerGap = 0, tickScale = 0.5, scaleTick = true, itemGap = 20, fontSize = 1.1, smoothing = 100,
  spy = false, className = "",
}: LineSidebarProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const targetsRef = useRef<number[]>([]);
  const currentRef = useRef<number[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const [active, setActive] = useState<number | null>(null);
  const activeRef = useRef(active);
  const smoothingRef = useRef(smoothing);
  activeRef.current = active;
  smoothingRef.current = smoothing;

  // One rAF loop eases every item's --effect toward its target with frame-rate independent smoothing,
  // so color, shift and marker scale move together without staggered CSS transitions.
  const runFrame = useCallback((now: number) => {
    const dt = Math.min((now - lastRef.current) / 1000, 0.05);
    lastRef.current = now;
    const k = 1 - Math.exp(-dt / (Math.max(smoothingRef.current, 1) / 1000));
    let moving = false;
    itemRefs.current.forEach((el, i) => {
      if (!el) return;
      const target = Math.max(targetsRef.current[i] || 0, activeRef.current === i ? 1 : 0);
      const next = (currentRef.current[i] || 0) + (target - (currentRef.current[i] || 0)) * k;
      const value = Math.abs(target - next) < 0.0015 ? target : next;
      currentRef.current[i] = value;
      el.style.setProperty("--effect", value.toFixed(4));
      if (value !== target) moving = true;
    });
    rafRef.current = moving ? requestAnimationFrame(runFrame) : null;
  }, []);

  const startLoop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    lastRef.current = performance.now();
    rafRef.current = requestAnimationFrame(runFrame);
  }, [runFrame]);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLUListElement>) => {
    // A finger scrolling past the list should not light it up.
    if (event.pointerType === "touch" || !listRef.current) return;
    const pointerY = event.clientY - listRef.current.getBoundingClientRect().top;
    const ease = FALLOFF_CURVES[falloff] ?? FALLOFF_CURVES.linear;
    itemRefs.current.forEach((el, i) => {
      if (!el) return;
      const distance = Math.abs(pointerY - (el.offsetTop + el.offsetHeight / 2));
      targetsRef.current[i] = ease(Math.max(0, 1 - distance / proximityRadius));
    });
    startLoop();
  }, [falloff, proximityRadius, startLoop]);

  const handlePointerLeave = useCallback(() => {
    targetsRef.current = targetsRef.current.map(() => 0);
    startLoop();
  }, [startLoop]);

  const lightUp = (index: number, value: number) => { targetsRef.current[index] = value; startLoop(); };

  useEffect(() => { startLoop(); }, [active, startLoop]);
  useEffect(() => () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); }, []);

  // Scroll spy: the last in-page target whose top has passed the line is the current item.
  useEffect(() => {
    if (!spy) return;
    const targets = items.map(item => item.href.startsWith("#") ? document.getElementById(item.href.slice(1)) : null);
    let frame = 0;
    const pick = () => {
      frame = 0;
      let current = 0;
      targets.forEach((el, i) => { if (el && el.getBoundingClientRect().top <= SPY_LINE) current = i; });
      setActive(current);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(pick); };
    pick();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (frame) cancelAnimationFrame(frame); };
  }, [spy, items]);

  return <nav
    aria-label={label}
    className={`line-sidebar${showMarker ? " line-sidebar--markers" : ""}${scaleTick ? " line-sidebar--scale-tick" : ""}${className ? ` ${className}` : ""}`}
    style={{
      "--accent-color": accentColor, "--text-color": textColor, "--marker-color": markerColor,
      "--marker-length": `${markerLength}px`, "--marker-gap": `${markerGap}px`, "--tick-scale": tickScale,
      "--max-shift": `${maxShift}px`, "--item-gap": `${itemGap}px`, "--font-size": `${fontSize}rem`, "--smoothing": `${smoothing}ms`,
    } as CSSProperties}
  >
    <ul ref={listRef} className="line-sidebar__list" onPointerMove={handlePointerMove} onPointerLeave={handlePointerLeave}>
      {items.map((item, index) => <Fragment key={item.href}>
        {item.group ? <li className="line-sidebar__group">{item.group}</li> : null}
        <li ref={el => { itemRefs.current[index] = el; }} className="line-sidebar__item">
          {showMarker ? <span className="line-sidebar__marker" aria-hidden="true" /> : null}
          <a className="line-sidebar__label" href={item.href} aria-current={active === index ? "location" : undefined}
            onClick={() => setActive(index)} onFocus={() => lightUp(index, 1)} onBlur={() => lightUp(index, 0)}>
            {showIndex ? <span className="line-sidebar__index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span> : null}
            <span className="line-sidebar__text">{item.label}</span>
          </a>
        </li>
      </Fragment>)}
    </ul>
  </nav>;
}
