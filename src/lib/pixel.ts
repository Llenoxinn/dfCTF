/** 1-bit pixel helpers shared by the dither art, identicons, meters, and heatmaps. Everything is deterministic. */

const BAYER = [
  [0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26], [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25], [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21],
];

/** Ordered-dither threshold for a pixel, strictly between 0 and 1. */
export function threshold(x: number, y: number) { return (BAYER[y & 7][x & 7] + 0.5) / 64; }

/** Dithers a density field (0 to 1) into one SVG path, merging horizontal runs. */
export function ditherPath(width: number, height: number, cell: number, density: (x: number, y: number) => number) {
  let d = "";
  const cols = Math.floor(width / cell), rows = Math.floor(height / cell);
  for (let j = 0; j < rows; j++) {
    let run = -1;
    for (let i = 0; i <= cols; i++) {
      const on = i < cols && density((i + 0.5) * cell, (j + 0.5) * cell) > threshold(i, j);
      if (on && run < 0) run = i;
      if (!on && run >= 0) { d += `M${run * cell} ${j * cell}h${(i - run) * cell}v${cell}h${-(i - run) * cell}z`; run = -1; }
    }
  }
  return d;
}

/** FNV-1a, so the same codename always draws the same identicon. */
export function hashString(value: string) {
  let h = 2166136261;
  for (const ch of value) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** 15 cells (5 rows of the 3 left columns); columns 3 and 4 mirror 1 and 0. */
export function identicon(name: string) {
  const h = hashString(name);
  const cells = Array.from({ length: 15 }, (_, i) => (((h >>> ((i + 1) % 32)) ^ (hashString(`${name}:${i + 1}`) >>> 5)) & 1) === 1);
  if (cells.filter(Boolean).length < 5) for (const i of [1, 4, 7, 10, 13]) cells[i] = true;
  return cells;
}

export function identiconPath(name: string, size: number) {
  const cells = identicon(name), unit = size / 7;
  let d = "";
  cells.forEach((on, i) => {
    if (!on) return;
    const row = Math.floor(i / 3), col = i % 3;
    for (const c of col === 2 ? [2] : [col, 4 - col]) d += `M${(c + 1) * unit} ${(row + 1) * unit}h${unit}v${unit}h${-unit}z`;
  });
  return d;
}

/** A density field for ditherPath, seeded by the codename: three overlapping waves, so each player keeps their own pattern. */
export function codenameField(name: string, width: number, height: number) {
  const waves = [0, 1, 2].map(i => {
    const h = hashString(`${name}:field:${i}`);
    return { x: 1 + (h & 3), y: (h >>> 2) & 1, phase: ((h >>> 3) % 628) / 100 };
  });
  return (x: number, y: number) => {
    const sum = waves.reduce((total, w) => total + Math.sin(w.x * (x / width) * Math.PI * 2 + w.y * (y / height) * Math.PI * 2 + w.phase), 0);
    return 0.8 * (0.5 + sum / 6) ** 1.5;
  };
}

/** Filled cells of a segmented meter. Any value above zero shows at least one cell. */
export function meterCells(value: number, max: number, cells = 20) {
  if (max <= 0 || value <= 0) return 0;
  return Math.max(1, Math.min(cells, Math.round((value / max) * cells)));
}

export const HEAT_DENSITY = [0, 0.18, 0.4, 0.65, 0.95];

/** Five heat levels: none, then each threshold reached. */
export function heatLevel(count: number, steps: readonly number[] = [1, 10, 40, 100]) {
  let level = 0;
  for (const step of steps) if (count >= step) level++;
  return level;
}

/** An 8x8 dithered square for one heatmap cell. */
export function heatCellPath(level: number, x0: number, y0: number, size: number) {
  const density = HEAT_DENSITY[level] ?? 0, px = size / 8;
  let d = "";
  if (!density) return d;
  for (let j = 0; j < 8; j++) {
    let run = -1;
    for (let i = 0; i <= 8; i++) {
      const on = i < 8 && density > threshold(i, j);
      if (on && run < 0) run = i;
      if (!on && run >= 0) { d += `M${x0 + run * px} ${y0 + j * px}h${(i - run) * px}v${px}h${-(i - run) * px}z`; run = -1; }
    }
  }
  return d;
}

/** Scales daily counts to heat levels relative to the busiest day. */
export function relativeLevels(counts: number[]) {
  const max = Math.max(0, ...counts);
  return counts.map(n => (n <= 0 || max <= 0 ? 0 : Math.max(1, Math.min(4, Math.ceil((n / max) * 4)))));
}
