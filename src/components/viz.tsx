"use client";

import { useEffect, useMemo, useState } from "react";
import type { Leaderboard, SolveEvent } from "@/lib/types";
import { ditherPath, heatCellPath, heatLevel, relativeLevels } from "@/lib/pixel";
import { countdownParts } from "@/lib/week";
import { clock, Identicon } from "./ui";

export function DitherArt({ width, height, cell = 4, density, className = "", label }: { width: number; height: number; cell?: number; density: (x: number, y: number) => number; className?: string; label?: string }) {
  const d = useMemo(() => ditherPath(width, height, cell, density), [width, height, cell, density]);
  return <svg className={`dither ${className}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid slice" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} shapeRendering="crispEdges"><path d={d} /></svg>;
}

const dayLabel = (start: string, i: number) => new Date(new Date(start).getTime() + i * 86_400_000).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric" });

/** Days laid out in Monday-first columns, one column per week; the last column is this week. Each day is an 8x8 dithered square.
 *  With `start`, month labels run along the top and each day shows its date on hover. */
export function Heatmap({ days, start, cell = 14, gap = 3, label, relative = true, weekdays = false }: { days: number[]; start?: string; cell?: number; gap?: number; label: string; relative?: boolean; weekdays?: boolean }) {
  const levels = relative ? relativeLevels(days) : days.map(n => heatLevel(n));
  const weeks = Math.ceil(days.length / 7), step = cell + gap;
  const w = weeks * step - gap, h = 7 * step - gap;
  let outline = "", fill = "";
  for (let i = 0; i < weeks * 7; i++) {
    const x = Math.floor(i / 7) * step, y = (i % 7) * step;
    outline += `M${x + 0.5} ${y + 0.5}h${cell - 1}v${cell - 1}h${-(cell - 1)}z`;
    if (i < levels.length) fill += heatCellPath(levels[i], x, y, cell);
  }
  const total = days.reduce((a, b) => a + b, 0);
  const left = weekdays ? 36 : 3, top = start ? 18 : 3;
  // A month label sits over the first week that starts in that month, unless the previous label is too close.
  const months: { x: number; text: string }[] = [];
  if (start) for (let wk = 0; wk < weeks; wk++) {
    const month = new Date(new Date(start).getTime() + wk * 7 * 86_400_000).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short" });
    if (months.at(-1)?.text !== month && (!months.length || wk * step - months.at(-1)!.x >= 3 * step)) months.push({ x: wk * step, text: month });
  }
  return <svg className="heatmap" viewBox={`${-left} ${-top} ${w + left + 3} ${h + top + 3}`} width={w + left + 3} height={h + top + 3} role="img" aria-label={`${label}: ${total} solves`} shapeRendering="crispEdges">
    {months.map(m => <text key={m.x} x={m.x} y={-6} className="heat-day">{m.text}</text>)}
    {weekdays ? ["Mon", "Wed", "Fri", "Sun"].map((d, i) => <text key={d} x={-left} y={i * 2 * step + cell / 2 + 4} className="heat-day">{d}</text>) : null}
    <path d={outline} className="heat-outline" /><path d={fill} className="heat-fill" />
    {start ? days.map((n, i) => <rect key={i} x={Math.floor(i / 7) * step} y={(i % 7) * step} width={cell} height={cell} className="heat-hit"><title>{`${dayLabel(start, i)}: ${n} ${n === 1 ? "solve" : "solves"}`}</title></rect>) : null}
    <rect x={(weeks - 1) * step - 2.5} y={-2.5} width={cell + 5} height={h + 5} rx="2" className="heat-current" />
  </svg>;
}

export function HeatLegend() {
  return <span className="heat-legend"><span>fewer</span>{[0, 1, 2, 3, 4].map(l => <svg key={l} width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" shapeRendering="crispEdges"><path d="M.5 .5h11v11H.5z" className="heat-outline" /><path d={heatCellPath(l, 0, 0, 12)} className="heat-fill" /></svg>)}<span>more</span></span>;
}

/** The busiest day in a run of daily counts, for a one-line summary under a heatmap. */
export function busiestDay(days: number[], start: string) {
  let best = -1;
  days.forEach((n, i) => { if (n > 0 && (best < 0 || n >= days[best])) best = i; });
  return best < 0 ? null : { label: dayLabel(start, best), count: days[best] };
}

/** Your solves per category as a dithered polygon. */
export function Radar({ values }: { values: { label: string; solved: number; total: number }[] }) {
  const S = 360, R = 120, cx = S / 2, cy = 172, n = values.length;
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i: number, v: number) => [cx + Math.cos(ang(i)) * R * v, cy + Math.sin(ang(i)) * R * v] as const;
  const poly = values.map((v, i) => pt(i, Math.max(v.total ? v.solved / v.total : 0, 0.04)));
  const inside = (x: number, y: number) => { let c = false; for (let i = 0, j = n - 1; i < n; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
  const fill = useMemo(() => ditherPath(S, 344, 3, (x, y) => (inside(x, y) ? 0.55 : 0)), [values]); // eslint-disable-line react-hooks/exhaustive-deps
  const ring = (k: number) => values.map((_, i) => `${i ? "L" : "M"}${pt(i, k).map(v => v.toFixed(1)).join(" ")}`).join("") + "Z";
  return <svg className="radar" viewBox={`0 0 ${S} 344`} role="img" aria-label={values.map(v => `${v.label} ${v.solved} of ${v.total}`).join(", ")}>
    {[0.25, 0.5, 0.75, 1].map(k => <path key={k} d={ring(k)} className="radar-grid" />)}
    {values.map((_, i) => { const [x, y] = pt(i, 1); return <path key={i} d={`M${cx} ${cy}L${x} ${y}`} className="radar-grid" />; })}
    <path d={fill} className="radar-fill" shapeRendering="crispEdges" />
    <path d={poly.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("") + "Z"} className="radar-edge" />
    {values.map((v, i) => { const [x, y] = pt(i, 1.2); return <text key={v.label} x={x} y={y} textAnchor="middle" className="radar-label"><tspan x={x}>{v.label}</tspan><tspan x={x} dy="14" className={v.solved ? "radar-count on" : "radar-count"}>{v.solved}/{v.total}</tspan></text>; })}
  </svg>;
}

/** One square per challenge, densest where the most players solved it. */
export function SolveGrid({ challenges }: { challenges: Leaderboard["challenges"] }) {
  const groups = useMemo(() => { const m = new Map<string, Leaderboard["challenges"]>(); for (const c of challenges) m.set(c.category, [...(m.get(c.category) ?? []), c]); return [...m.entries()]; }, [challenges]);
  if (!groups.length) return <p className="muted">Challenges appear here once they are published.</p>;
  return <div className="solve-grid">{groups.map(([category, items]) => <div className="solve-row" key={category}>
    <span className="solve-cat">{category}</span>
    <span className="solve-cells">{items.map(c => <svg key={c.id} width="24" height="24" viewBox="0 0 24 24" className={c.solved ? "solved" : ""} role="img" aria-label={`${c.title}, ${c.difficulty}, ${c.xp} points, ${c.solveCount} solves${c.solved ? ", solved by you" : ""}`} shapeRendering="crispEdges"><title>{`${c.title}: ${c.solveCount} solves`}</title><path d="M.5 .5h23v23H.5z" className="heat-outline" /><path d={heatCellPath(heatLevel(c.solveCount), 0, 0, 24)} className="heat-fill" /></svg>)}</span>
  </div>)}
  <div className="heat-key">{[["0", 0], ["1–9", 1], ["10–39", 2], ["40–99", 3], ["100+", 4]].map(([l, v]) => <span key={l}><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" shapeRendering="crispEdges"><path d="M.5 .5h11v11H.5z" className="heat-outline" /><path d={heatCellPath(Number(v), 0, 0, 12)} className="heat-fill" /></svg>{l}</span>)}<span className="solve-you"><i />solved by you</span></div>
</div>;
}

/** Ranks of this week's top players, with solves per hour underneath on the same time axis. */
export function RaceChart({ race, hourly, viewer }: { race: Leaderboard["race"]; hourly: Leaderboard["hourly"]; viewer?: string | null }) {
  const [focus, setFocus] = useState<string | null>(null);
  const start = new Date(hourly.start).getTime(), hours = Math.max(1, hourly.counts.length);
  const W = 760, X0 = 42, X1 = W - 12, top = 18, gapY = 34, rows = Math.max(2, race.players.length);
  const maxRank = Math.max(1, ...race.players.flatMap(p => p.ranks.filter((r): r is number => r !== null)));
  const ticks = [...new Set(Array.from({ length: rows }, (_, i) => 1 + Math.round(i * (maxRank - 1) / (rows - 1))))];
  const X = (h: number) => X0 + (h / hours) * (X1 - X0), Y = (r: number) => top + (r - 1) / Math.max(1, maxRank - 1) * (rows - 1) * gapY;
  const HB = top + rows * gapY + 24, HH = 56, H = HB + HH + 26;
  const snapH = race.snapshots.map(s => (new Date(s).getTime() - start) / 3_600_000);
  const ease = (f: number) => f * f * (3 - 2 * f);
  const yAt = (ranks: (number | null)[], h: number): number | null => {
    if (h < snapH[0]) return null;
    for (let i = 0; i < ranks.length - 1; i++) {
      if (h >= snapH[i + 1]) continue;
      const a = ranks[i], b = ranks[i + 1];
      if (a === null || b === null) return null;
      return Y(a) + (Y(b) - Y(a)) * ease((h - snapH[i]) / Math.max(0.0001, snapH[i + 1] - snapH[i]));
    }
    const rank = ranks[ranks.length - 1];
    return rank === null ? null : Y(rank);
  };
  const lines = useMemo(() => race.players.map(p => {
    const set = new Set<string>(); const thick = p.ranks[p.ranks.length - 1] === 1 ? 2 : 1;
    for (let h = 0; h <= snapH[snapH.length - 1]; h += 0.05) { const y = yAt(p.ranks, h); if (y === null) continue; const gx = Math.floor(X(h) / 4) * 4, gy = Math.floor((y - thick * 2) / 4) * 4; for (let k = 0; k < thick; k++) set.add(`${gx},${gy + k * 4}`); }
    let d = ""; for (const k of set) { const [x, y] = k.split(",").map(Number); d += `M${x} ${y}h4v4h-4z`; }
    for (let i = 0; i < snapH.length; i++) { const rank = p.ranks[i]; if (rank === null) continue; const x = Math.floor(X(snapH[i]) / 4) * 4 - 3, y = Y(rank) - 5; d += `M${x} ${y}h10v10h-10z`; }
    return { ...p, d };
  }), [race, hourly]); // eslint-disable-line react-hooks/exhaustive-deps
  const maxCount = Math.max(1, ...hourly.counts), barW = Math.max(2, Math.floor((X1 - X0) / hours) - 2);
  const tier = (p: { ranks: (number | null)[] }) => { const r = p.ranks[p.ranks.length - 1]!; return r === 1 ? "lead" : r <= 3 ? "mid" : "dim"; };
  if (!race.players.length) return <p className="muted panel-pad">The race starts with the first solve this week.</p>;
  const days = Math.ceil(hours / 24);
  return <div className="race">
    <svg className="race-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Rank of the top ${race.players.length} players over this week`} shapeRendering="crispEdges">
      {ticks.map(rank => <g key={rank}><text x={4} y={Y(rank) + 4} className={`race-rank${rank === 1 ? " on" : ""}`}>#{rank}</text><path d={`M${X0} ${Y(rank)}H${X1}`} className="race-guide" /></g>)}
      {Array.from({ length: days - 1 }, (_, i) => <path key={i} d={`M${X((i + 1) * 24)} 6V${HB + HH}`} className="race-day" />)}
      {lines.map(l => <path key={l.codename} d={l.d} className={`race-line ${tier(l)}${focus && focus !== l.codename ? " faded" : ""}${focus === l.codename ? " focused" : ""}`} />)}
      {hourly.counts.map((n, h) => { const bh = Math.round((n / maxCount) * (HH - 8) / 4) * 4; return n ? <g key={h}><rect x={X(h) + 1} y={HB + HH - bh} width={barW} height={bh} className="race-bar" />{hourly.firstBlood[h] ? <rect x={X(h) + 1} y={HB + HH - bh - 7} width={barW} height={5} className="race-blood" /> : null}</g> : null; })}
      <path d={`M${X(snapH[snapH.length - 1])} 4V${HB + HH + 2}`} className="race-now" />
      <text x={X(snapH[snapH.length - 1]) - 4} y={HB - 6} textAnchor="end" className="race-axis">now</text>
      {Array.from({ length: days }, (_, i) => <text key={i} x={X(i * 24) + 4} y={HB + HH + 18} className="race-axis">{new Date(start + i * 86_400_000).toLocaleDateString(undefined, { weekday: "short", timeZone: "Asia/Manila" })}</text>)}
      <text x={X0} y={HB - 6} className="race-axis">Solves per hour</text>
    </svg>
    <ol className="race-table" aria-label="Current order">
      <li className="race-head" aria-hidden="true"><span>Player</span><span>Points</span><span>Move</span></li>
      {[...race.players].sort((a, b) => a.ranks[a.ranks.length - 1]! - b.ranks[b.ranks.length - 1]!).map(p => { const move = p.ranks[0] === null ? null : p.ranks[0] - p.ranks[p.ranks.length - 1]!; return <li key={p.codename} className={`race-entry ${tier(p)}`} onMouseEnter={() => setFocus(p.codename)} onMouseLeave={() => setFocus(null)}>
        <button type="button" onFocus={() => setFocus(p.codename)} onBlur={() => setFocus(null)} aria-label={`Highlight ${p.codename}`}><Identicon name={p.codename} size={22} you={p.codename === viewer} /><span className="mono">{p.codename}</span></button>
        <span className="mono num">{p.points.toLocaleString()}</span><span className={move !== null && move > 0 ? "move up" : "move"}>{move === null ? "new" : move > 0 ? `up ${move}` : move < 0 ? `down ${-move}` : "same"}</span>
      </li>; })}
    </ol>
  </div>;
}

/** Live countdown to the weekly close: unit cells, then a 7-day meter. Seconds swap without animation. */
export function Countdown({ endsAt }: { endsAt: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, []);
  const end = new Date(endsAt).getTime(), left = now === null ? 0 : end - now;
  const { days, hours, minutes, seconds } = countdownParts(left);
  const weekMs = 7 * 86_400_000, elapsed = now === null ? 0 : Math.min(7, Math.max(0, (weekMs - left) / 86_400_000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return <div className={`countdown${left > 0 && left < 3_600_000 ? " urgent" : ""}`}>
    <div className="countdown-units" role="timer" aria-label={`${days} days, ${hours} hours, ${minutes} minutes left`}>
      {[[days, "days"], [hours, "hours"], [minutes, "min"], [seconds, "sec"]].map(([v, l], i) => <span key={l} className="countdown-unit" data-unit={l}>{i ? <i className="countdown-sep" aria-hidden="true">:</i> : null}<span className="countdown-cell"><b>{now === null ? "--" : pad(Number(v))}</b><small>{l}</small></span></span>)}
    </div>
    <div className="week-meter" aria-hidden="true">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => <span key={d} className={i < Math.floor(elapsed) ? "past" : i === Math.floor(elapsed) ? "today" : ""}><i style={i === Math.floor(elapsed) ? { ["--p" as string]: `${(elapsed % 1) * 100}%` } : undefined} />{d}</span>)}</div>
  </div>;
}

/** Recent solves as a slow, endless ASCII strip. It pauses on hover and stays still under reduced motion. */
export function Ticker({ events }: { events: SolveEvent[] }) {
  if (!events.length) return null;
  const items = events.map((e, i) => <span className="tick" key={i}><span className="faint mono">{clock(e.at)}</span><span className="mono strong">{e.codename}</span><span className={e.firstBlood ? "mono accent" : "mono muted"}>{e.firstBlood ? "first blood" : "solved"}</span><span className="muted">{e.title}</span>{e.points ? <span className="mono accent strong">+{e.points}</span> : null}<span className="faint mono">//</span></span>);
  return <div className="ticker" aria-label="Recent solves"><span className="ticker-live mono">[live]</span><div className="ticker-track"><div className="ticker-run">{items}</div><div className="ticker-run" aria-hidden="true">{items}</div></div></div>;
}
