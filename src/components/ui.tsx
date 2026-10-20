"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { applyTheme, effectiveTheme, type Theme } from "@/lib/theme";

export function Icon({ name, size = 20, className = "" }: { name: string; size?: number; className?: string }) {
  const paths: Record<string, ReactNode> = {
    grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></>,
    flag: <path d="M5 21V4m0 0c4-3 9 3 14 0v10c-5 3-10-3-14 0"/>,
    chart: <path d="M4 4v16h16M8 15l3.5-4 3 2.5L19 8"/>,
    edit: <path d="m14.5 5.5 4 4M4 20l4.5-1L19.3 8.2a2.8 2.8 0 0 0-4-4L4.5 15 4 20Z"/>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></>,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5"/>,
    chevron: <path d="m9 6 6 6-6 6"/>,
    back: <path d="M19 12H5m5-5-5 5 5 5"/>,
    search: <><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></>,
    check: <path d="m5 12.5 4.5 4.5L19 7.5"/>,
    close: <path d="m6.5 6.5 11 11m0-11-11 11"/>,
    download: <path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5M5 19h14"/>,
    upload: <path d="M12 15V4m-4.5 4.5L12 4l4.5 4.5M5 19h14"/>,
    lock: <><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/></>,
    shield: <><path d="M12 3.5 19 6v5.5c0 4.5-3.2 7.7-7 9-3.8-1.3-7-4.5-7-9V6l7-2.5Z"/><path d="m9 12 2.2 2.2L15.5 10"/></>,
    clock: <><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></>,
    file: <><path d="M14 3.5H6.5v17h11V7l-3.5-3.5Z"/><path d="M14 3.5V7h3.5M9.5 12.5h5m-5 3.5h3.5"/></>,
    terminal: <><rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="m7 9.5 3 2.5-3 2.5m5.5 0H17"/></>,
    info: <><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5m0-9v.5"/></>,
    alert: <><path d="M12 4 21 19.5H3L12 4Z"/><path d="M12 10v4.5m0 2.5v.5"/></>,
    mail: <><rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4 7 8 6 8-6"/></>,
    book: <path d="M12 6.5v13m0-13C9.5 4.5 6 4.5 3.5 5.5v13c2.5-1 6-1 8.5 1 2.5-2 6-2 8.5-1v-13C18 4.5 14.5 4.5 12 6.5Z"/>,
    users: <><circle cx="9" cy="8" r="3.5"/><path d="M3 20v-1.5A5.5 5.5 0 0 1 8.5 13h1a5.5 5.5 0 0 1 5.5 5.5V20m.5-15.5a3.5 3.5 0 0 1 0 7M18 13.5a5 5 0 0 1 3 4.5V20"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    exit: <path d="M10 4.5H5.5v15H10m-1-7.5h11.5m-4-4 4 4-4 4"/>,
    copy: <><rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/></>,
    eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></>,
    archive: <><rect x="3.5" y="4.5" width="17" height="4.5" rx="1"/><path d="M5 9v10.5h14V9M10 13h4"/></>,
    spark: <path d="M12 3.5 14 10l6.5 2-6.5 2-2 6.5-2-6.5-6.5-2 6.5-2 2-6.5Z"/>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths[name] ?? paths.flag}</svg>;
}

/** 9×9 pixel drawings. "#" is ink. Drawn for dfCTF, shared by the glyph tiles and the campus scene. */
export const GLYPHS: Record<string, string[]> = {
  flag: ["##.......", "#####....", "########.", "#####....", "##.......", "#........", "#........", "#........", "#........"],
  general: [".........", "#........", ".#.......", "..#......", ".#.......", "#........", ".........", "....####.", "........."],
  osint: ["..####...", ".#....#..", "#......#.", "#..##..#.", "#......#.", ".#....#..", "..####...", "......##.", ".......##"],
  steg: [".........", "..#####..", ".#.....#.", "#..###..#", "#..#.#..#", "#..###..#", ".#.....#.", "..#####..", "........."],
  forensics: ["######...", "#....##..", "#.....#..", "#.###.#..", "#.....#..", "#.###.#..", "#.....#..", "#######..", "........."],
  web: ["..#####..", ".#..#..#.", "#..#.#..#", "#########", "#..#.#..#", "#########", "#..#.#..#", ".#..#..#.", "..#####.."],
  binary: [".#.#.#.#.", "#########", ".#.....#.", "##.###.##", ".#.#.#.#.", "##.###.##", ".#.....#.", "#########", ".#.#.#.#."],
  misc: ["..####...", ".#....#..", "......#..", ".....#...", "....#....", "....#....", ".........", "....#....", "........."],
  crypto: ["..#...#..", "..#...#..", "#########", "..#...#..", "..#...#..", "#########", "..#...#..", "..#...#..", "........."],
  lock: ["...###...", "..#...#..", "..#...#..", ".#######.", ".#######.", ".###.###.", ".###.###.", ".#######.", ".#######."],
  book: [".........", "###...###", "#..#.#..#", "#..#.#..#", "#..#.#..#", "#..#.#..#", "####.####", "....#....", "........."],
  reverse: ["...#.....", "..##.....", ".#######.", "..##....#", "...#....#", "#....#...", "#....##..", ".#######.", ".....#..."],
  sun: ["....#....", ".#.....#.", "...###...", "..#####..", "#.#####.#", "..#####..", "...###...", ".#.....#.", "....#...."],
  moon: ["...###...", ".####....", ".###.....", "###......", "###......", "###......", ".###....#", ".#######.", "...###..."],
  check: [".........", "........#", ".......##", "#.....##.", "##...##..", ".##.##...", "..###....", "...#.....", "........."],
  key: [".###.....", "#...#....", "#.#.#....", "#...#....", ".####....", "....#....", "....###..", "....#....", "....##..."],
};

const CATEGORY_GLYPH: Record<string, string> = {
  "General skills": "general", OSINT: "osint", Steganography: "steg", Forensics: "forensics",
  "Web exploitation": "web", "Binary exploitation": "binary", Miscellaneous: "misc",
};
export function categoryGlyph(category: string) { return CATEGORY_GLYPH[category] ?? "flag"; }

export function Pixel({ name, size = 18, className = "" }: { name: string; size?: number; className?: string }) {
  const rows = GLYPHS[name] ?? GLYPHS.flag;
  const rects: ReactNode[] = [];
  rows.forEach((row, y) => [...row].forEach((cell, x) => { if (cell === "#") rects.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1"/>); }));
  return <svg className={`pixel ${className}`} width={size} height={size} viewBox="0 0 9 9" fill="currentColor" shapeRendering="crispEdges" aria-hidden="true">{rects}</svg>;
}

export function GlyphTile({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  return <span className={`glyph-tile glyph-${size}`}><Pixel name={name} size={size === "lg" ? 26 : size === "sm" ? 14 : 18}/></span>;
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return <span className={`brand ${compact ? "brand-compact" : ""}`}><span className="brand-mark"><Pixel name="flag" size={compact ? 14 : 16}/></span><span className="brand-word">dfCTF</span></span>;
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setTheme(effectiveTheme());
    sync();
    window.addEventListener("dfctf-theme", sync);
    media.addEventListener("change", sync);
    return () => { window.removeEventListener("dfctf-theme", sync); media.removeEventListener("change", sync); };
  }, []);
  return theme;
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const theme = useTheme();
  return <div className={`shift-toggle ${compact ? "shift-compact" : ""}`} role="group" aria-label="Theme">
    {(["light", "dark"] as const).map(option => <button key={option} type="button" aria-pressed={theme === option} onClick={() => applyTheme(option)} title={option === "light" ? "Day shift (light theme)" : "Night shift (dark theme)"}>
      <Pixel name={option === "light" ? "sun" : "moon"} size={13}/><span className={compact ? "sr-only" : ""}>{option === "light" ? "Day shift" : "Night shift"}</span>
    </button>)}
  </div>;
}

export function Notice({ children, type = "info" }: { children: ReactNode; type?: "info" | "error" | "success" }) {
  return <div className={`notice notice-${type}`} role={type === "error" ? "alert" : "status"}><Icon name={type === "success" ? "check" : type === "error" ? "alert" : "info"} size={18}/><div>{children}</div></div>;
}

export function Loading({ label = "Loading your workspace" }: { label?: string }) {
  return <div className="loading" role="status"><span className="spinner" aria-hidden="true"/>{label}<span className="sr-only">. Please wait.</span></div>;
}

/** Segmented when the total is small enough to count; a continuous bar otherwise. */
export function Meter({ value, total, label }: { value: number; total: number; label: string }) {
  const percent = total ? Math.min(100, Math.max(0, value / total * 100)) : 0;
  const props = { role: "progressbar", "aria-label": label, "aria-valuenow": Math.round(percent), "aria-valuemin": 0, "aria-valuemax": 100 } as const;
  if (total > 0 && total <= 12) return <div className="meter meter-segmented" {...props}>{Array.from({ length: total }, (_, i) => <span key={i} className={i < value ? "on" : ""}/>)}</div>;
  return <div className="meter meter-bar" {...props}><span style={{ "--progress": `${percent}%` } as CSSProperties}/></div>;
}

export function Empty({ glyph = "flag", title, children }: { glyph?: string; title: string; children: ReactNode }) {
  return <div className="empty-state"><GlyphTile name={glyph} size="lg"/><h3>{title}</h3><div className="empty-body">{children}</div></div>;
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (!copied) return; const t = window.setTimeout(() => setCopied(false), 1600); return () => window.clearTimeout(t); }, [copied]);
  return <button type="button" className="icon-button copy-button" onClick={() => navigator.clipboard.writeText(value).then(() => setCopied(true), () => undefined)} aria-label={copied ? "Copied" : label} title={copied ? "Copied" : label}><Icon name={copied ? "check" : "copy"} size={16}/><span className="sr-only" aria-live="polite">{copied ? "Copied" : ""}</span></button>;
}

export function SettingsSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="settings-section"><div className="settings-intro"><h2>{title}</h2><p>{description}</p></div><div className="settings-body">{children}</div></section>;
}

export function Difficulty({ value }: { value: string }) {
  const level = value === "Hard" ? 3 : value === "Medium" ? 2 : 1;
  return <span className="difficulty" title={`${value} difficulty`}><span className="difficulty-bars" aria-hidden="true">{[1, 2, 3].map(i => <i key={i} className={i <= level ? "on" : ""}/>)}</span>{value}</span>;
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (options?.body instanceof FormData) headers.set("X-dfCTF-Request", "1");
  else if (options?.body) headers.set("Content-Type", "application/json");
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
