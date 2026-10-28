"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { applyTheme, effectiveTheme, type Theme } from "@/lib/theme";
import { identiconPath, meterCells } from "@/lib/pixel";

export function Icon({ name, size = 20, className = "" }: { name: string; size?: number; className?: string }) {
  const paths: Record<string, ReactNode> = {
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
    close: <path d="m6.5 6.5 11 11m0-11-11 11" />,
    download: <path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5M5 19h14" />,
    upload: <path d="M12 15V4m-4.5 4.5L12 4l4.5 4.5M5 19h14" />,
    copy: <><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" /></>,
    bookmark: <path d="M6 4.5h12v16l-6-4-6 4V4.5Z" />,
    file: <><path d="M14 3.5H6.5v17h11V7l-3.5-3.5Z" /><path d="M14 3.5V7h3.5M9.5 12.5h5m-5 3.5h3.5" /></>,
    back: <path d="M19 12H5m5-5-5 5 5 5" />,
    chevron: <path d="m9 6 6 6-6 6" />,
    down: <path d="m6 9 6 6 6-6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    exit: <path d="M10 4.5H5.5v15H10m-1-7.5h11.5m-4-4 4 4-4 4" />,
    info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5m0-9v.5" /></>,
    alert: <><path d="M12 4 21 19.5H3L12 4Z" /><path d="M12 10v4.5m0 2.5v.5" /></>,
    eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>,
    lock: <><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" /></>,
    archive: <><rect x="3.5" y="4.5" width="17" height="4.5" rx="1" /><path d="M5 9v10.5h14V9M10 13h4" /></>,
    mail: <><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="m4 7 8 6 8-6" /></>,
    terminal: <><rect x="3" y="4.5" width="18" height="15" rx="2" /><path d="m7 9.5 3 2.5-3 2.5m5.5 0H17" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths[name] ?? paths.info}</svg>;
}

/** The text-only wordmark. There is no logo mark. */
export function Wordmark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return <span className={`wordmark wordmark-${size}`}>dfCTF</span>;
}

export function Identicon({ name, size = 28, you = false }: { name: string; size?: number; you?: boolean }) {
  return <svg className={`identicon${you ? " identicon-you" : ""}`} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" shapeRendering="crispEdges">
    <rect width={size} height={size} rx="2" className="identicon-bg" /><path d={identiconPath(name, size)} className="identicon-ink" />
  </svg>;
}

/** A 20-cell pixel meter; replaces ASCII bars, which Geist Mono would ligate. */
export function Meter({ value, max, label, tone = "ink", cells = 20 }: { value: number; max: number; label: string; tone?: "ink" | "accent"; cells?: number }) {
  const on = meterCells(value, max, cells);
  return <span className={`meter meter-${tone}`} role="img" aria-label={label}>{Array.from({ length: cells }, (_, i) => <i key={i} className={i < on ? "on" : ""} />)}</span>;
}

const LEVEL = { Easy: 1, Medium: 2, Hard: 3 } as const;
export function Pips({ value }: { value: string }) {
  const level = LEVEL[value as keyof typeof LEVEL] ?? 1;
  return <span className={`pips pips-${value.toLowerCase()}`} aria-hidden="true">{[1, 2, 3].map(i => <i key={i} className={i <= level ? "on" : ""} />)}</span>;
}
export function Difficulty({ value }: { value: string }) {
  return <span className="difficulty"><Pips value={value} />{value}</span>;
}

let lastTipClose = 0;
/** Info icon with an explanation. First open waits 400ms; neighbors open instantly once one has been open. */
export function InfoTip({ text, label = "What is this?" }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [instant, setInstant] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const id = useId();
  function show() {
    window.clearTimeout(timer.current);
    const quick = Date.now() - lastTipClose < 600;
    setInstant(quick);
    timer.current = window.setTimeout(() => setOpen(true), quick ? 0 : 400);
  }
  function hide() { window.clearTimeout(timer.current); if (open) lastTipClose = Date.now(); setOpen(false); }
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const bubble = useRef<HTMLSpanElement>(null);
  // The page clips sideways overflow, so slide an open bubble back inside a narrow screen instead of cutting it off.
  useLayoutEffect(() => {
    const el = bubble.current; if (!el) return;
    el.style.translate = "";
    if (!open) return;
    const r = el.getBoundingClientRect(), over = r.right - (window.innerWidth - 8);
    if (over > 0) el.style.translate = `${-Math.max(0, Math.min(over, r.left - 8))}px 0`;
  }, [open]);
  return <span className="infotip" onMouseEnter={show} onMouseLeave={hide}>
    <button type="button" className="infotip-button" aria-label={label} aria-describedby={open ? id : undefined} onFocus={show} onBlur={hide} onKeyDown={e => { if (e.key === "Escape") hide(); }} onClick={() => setOpen(v => !v)}><Icon name="info" size={15} /></button>
    <span ref={bubble} role="tooltip" id={id} className="infotip-bubble" data-open={open || undefined} data-instant={instant || undefined}>{text}</span>
  </span>;
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches);
    sync(); media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return reduced;
}

/** Eight pixels around a 3x3 ring with one bright cell chasing its fading tail. CSS-only, so it keeps moving while the main thread is busy. */
export function Spinner() {
  return <span className="pixel-spin" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <i key={i} />)}</span>;
}

const GLYPHS = "#%&*+=?@$!<>/\\";
/** Resolves scrambled glyphs into the final text, left to right. Plays once when mounted. */
export function DecodeText({ text, className = "" }: { text: string; className?: string }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(text);
  useEffect(() => {
    if (reduced) { setShown(text); return; }
    let frame = 0; const start = performance.now();
    const step = (now: number) => {
      const done = Math.floor((now - start) / 40);
      setShown([...text].map((ch, i) => (i < done || ch === " " ? ch : GLYPHS[(i * 7 + Math.floor(now / 50)) % GLYPHS.length])).join(""));
      if (done < text.length) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [text, reduced]);
  return <span className={className}><span aria-hidden="true">{shown}</span><span className="sr-only">{text}</span></span>;
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => {
    const sync = () => setTheme(effectiveTheme());
    sync(); window.addEventListener("dfctf-theme", sync);
    return () => window.removeEventListener("dfctf-theme", sync);
  }, []);
  return theme;
}

export function Notice({ children, type = "info" }: { children: ReactNode; type?: "info" | "error" | "success" }) {
  return <div className={`notice notice-${type}`} role={type === "error" ? "alert" : "status"}><Icon name={type === "success" ? "check" : type === "error" ? "alert" : "info"} size={17} /><div>{children}</div></div>;
}

/** A pixel meter with a light sweeping through it, the same cells the progress meters use. */
export function Loading({ label = "Loading" }: { label?: string }) {
  return <div className="loading" role="status"><span className="pixel-scan" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} />)}</span><span className="mono">{label}</span><span className="sr-only">. Please wait.</span></div>;
}

/** A native modal dialog: the page behind goes inert, Escape and the backdrop close it, and focus returns to whatever opened it. */
export function Modal({ labelledBy, onClose, children, className = "" }: { labelledBy: string; onClose: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const downOnBackdrop = useRef(false);
  useEffect(() => {
    const dialog = ref.current!;
    opener.current ??= document.activeElement as HTMLElement | null;
    if (!dialog.open) dialog.showModal();
    return () => { if (opener.current?.isConnected) opener.current.focus({ preventScroll: true }); };
  }, []);
  // The dialog scrolls itself, so a click on its scrollbar also targets it; only a point outside its box is the backdrop.
  const outside = (e: { clientX: number; clientY: number; target: EventTarget; currentTarget: HTMLDialogElement }) => {
    const r = e.currentTarget.getBoundingClientRect();
    return e.target === e.currentTarget && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom);
  };
  return <dialog ref={ref} className={`modal ${className}`} aria-labelledby={labelledBy} onClose={onClose}
    onPointerDown={e => { downOnBackdrop.current = outside(e); }}
    onClick={e => { if (downOnBackdrop.current && outside(e)) ref.current?.close(); }}>{children}</dialog>;
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="empty"><strong>{title}</strong>{children ? <div className="empty-body">{children}</div> : null}{action}</div>;
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (!copied) return; const t = window.setTimeout(() => setCopied(false), 1600); return () => window.clearTimeout(t); }, [copied]);
  return <button type="button" className="copy-button" onClick={() => navigator.clipboard.writeText(value).then(() => setCopied(true), () => undefined)} aria-label={copied ? "Copied" : label}>{copied ? "copied" : "copy"}<span className="sr-only" aria-live="polite">{copied ? "Copied" : ""}</span></button>;
}

export function SettingsSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="settings-section"><div className="settings-intro"><h2>{title}</h2><p>{description}</p></div><div className="settings-body">{children}</div></section>;
}

export function ThemeToggle() {
  const theme = useTheme();
  return <div className="theme-cards" role="group" aria-label="Theme">
    {(["dark", "light"] as const).map(option => <button key={option} type="button" className="theme-card" data-option={option} aria-pressed={theme === option} onClick={() => applyTheme(option)}>
      <span className="theme-swatch" aria-hidden="true"><i /><i /><i /></span>
      <span className="theme-label"><span className="ascii-check">{theme === option ? "[x]" : "[ ]"}</span>{option === "dark" ? "Dark" : "Light"}</span>
    </button>)}
  </div>;
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (!["GET", "HEAD", "OPTIONS"].includes((options?.method ?? "GET").toUpperCase())) headers.set("X-dfCTF-Request", "1");
  if (options?.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { credentials: "same-origin", ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || data.message || `Request failed (${response.status}). Please try again.`);
  return data as T;
}

export function humanSize(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
}

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function clock(value: string) {
  return new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}
