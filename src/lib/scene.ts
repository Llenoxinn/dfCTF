/**
 * The dfCTF campus, as two ink-density fields (day and night) that are ordered-dithered to one ink color.
 * Density 0 shows paper, 1 is solid ink. Window pixels carry a delay so lights come on one by one at dusk.
 */
export type SceneField = {
  width: number; height: number;
  day: Float32Array; night: Float32Array;
  /** -1 for ordinary pixels; otherwise the night-progress point (0–1) at which this window lights up. */
  lightDelay: Float32Array;
  flag: { x: number; y: number };
};

const BAYER = [
  [0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26], [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25], [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21],
];

export function threshold(x: number, y: number) { return (BAYER[y & 7][x & 7] + 0.5) / 64; }

function hash(x: number, y: number) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const LIT = 1;

export function frameDensity(scene: SceneField, i: number, t: number) {
  const delay = scene.lightDelay[i];
  const night = delay >= 0 && t >= delay ? LIT : scene.night[i];
  return scene.day[i] + (night - scene.day[i]) * t;
}

export function buildScene(W: number, H: number): SceneField {
  const day = new Float32Array(W * H), night = new Float32Array(W * H), lightDelay = new Float32Array(W * H).fill(-1);
  const solid = new Uint8Array(W * H);
  const horizon = Math.round(H * 0.8);
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const put = (x: number, y: number, d: number, n: number, mask = false) => {
    if (!inside(x, y)) return;
    const i = y * W + x; day[i] = d; night[i] = n; lightDelay[i] = -1; if (mask) solid[i] = 1;
  };
  const rect = (x0: number, y0: number, x1: number, y1: number, d: number, n: number, mask = false) => {
    for (let y = Math.round(y0); y < Math.round(y1); y++) for (let x = Math.round(x0); x < Math.round(x1); x++) put(x, y, d, n, mask);
  };
  const disc = (cx: number, cy: number, r: number, d: number, n: number, mask = false) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) put(x, y, d, n, mask);
  };
  const windowRect = (x0: number, y0: number, w: number, h: number, seed: number) => {
    const lit = hash(seed, 7) > 0.22;
    const delay = 0.12 + hash(seed, 3) * 0.78;
    for (let y = Math.round(y0); y < Math.round(y0 + h); y++) for (let x = Math.round(x0); x < Math.round(x0 + w); x++) {
      if (!inside(x, y)) continue;
      const i = y * W + x; day[i] = 0; night[i] = 0.06; lightDelay[i] = lit ? delay : -1;
    }
  };

  // Sky: a light wash overhead by day; dark with a faint horizon glow and stars by night.
  for (let y = 0; y < horizon; y++) for (let x = 0; x < W; x++) {
    const t = y / horizon;
    const star = t < 0.72 && hash(x, y) < 0.005;
    put(x, y, 0.09 * (1 - t) ** 2.6, star ? 1 : 0.01 + 0.2 * t ** 4);
  }

  // Sun by day, crescent moon by night, in the same place.
  const cx = W * 0.8, cy = H * 0.24, r = H * 0.085;
  for (let y = Math.floor(cy - r * 2.8); y <= cy + r * 2.8; y++) for (let x = Math.floor(cx - r * 2.8); x <= cx + r * 2.8; x++) {
    if (!inside(x, y)) continue;
    const i = y * W + x, dist = Math.hypot(x - cx, y - cy);
    if (dist <= r + 0.6) day[i] = dist > r - 0.8 ? 1 : 0.5;
    const cut = Math.hypot(x - (cx + r * 0.5), y - (cy - r * 0.3)) < r * 0.88;
    if (dist <= r && !cut) night[i] = 1;
    else if (!cut || dist > r) night[i] = Math.max(night[i], 0.26 * Math.max(0, 1 - dist / (r * 2.8)));
  }

  // Clouds: outlined by day, faint by night.
  for (const [ux, uy, s] of [[0.16, 0.2, 1], [0.58, 0.13, 0.8], [0.34, 0.34, 0.65]] as const) {
    const ox = W * ux, oy = H * uy, k = H * 0.05 * s;
    const blobs = [[0, 0, 1.2], [1.5, -0.5, 1.5], [3, 0, 1.15], [1.5, 0.4, 1.1]].map(([bx, by, br]) => [ox + bx * k, oy + by * k, br * k]);
    for (let y = Math.floor(oy - k * 2.4); y <= oy + k * 1.8; y++) for (let x = Math.floor(ox - k * 1.4); x <= ox + k * 4.4; x++) {
      if (!inside(x, y)) continue;
      const d = Math.min(...blobs.map(([bx, by, br]) => Math.hypot(x - bx, y - by) - br));
      if (d >= 0) continue;
      const i = y * W + x;
      day[i] = d > -1.2 ? 1 : y > oy + k * 0.3 ? 0.18 : 0;
      night[i] = d > -1.2 ? 0.12 : 0.05;
    }
  }

  // Two hill lines, then the ground and a lamp-lit path to the tower.
  for (let x = 0; x < W; x++) {
    const far = horizon - H * (0.1 + 0.04 * Math.sin(x / W * Math.PI * 2.6 + 0.6));
    const near = horizon - H * (0.05 + 0.025 * Math.sin(x / W * Math.PI * 4.2 + 2));
    for (let y = Math.round(far); y < horizon; y++) put(x, y, y >= near ? 0.4 : 0.24, y >= near ? 0.08 : 0.05);
  }
  for (let y = horizon; y < H; y++) for (let x = 0; x < W; x++) {
    const depth = (y - horizon) / (H - horizon);
    const half = W * (0.02 + 0.11 * depth);
    const onPath = Math.abs(x - W * 0.5) < half;
    put(x, y, onPath ? 0.06 : 0.46 + 0.22 * depth, onPath ? 0.24 : 0.1 + 0.06 * depth);
  }

  // Trees.
  for (const [ux, ur] of [[0.03, 0.075], [0.41, 0.06], [0.9, 0.085], [0.975, 0.065]] as const) {
    const tx = W * ux, tr = H * ur, ty = horizon - tr * 1.1;
    rect(tx - 1, ty, tx + 1, horizon, 0.85, 0.03, true);
    disc(tx, ty, tr, 0.62, 0.03, true);
  }

  // Lecture hall with a gabled roof and two rows of windows.
  const hall = { x0: W * 0.07, x1: W * 0.37, y0: H * 0.56 };
  rect(hall.x0, hall.y0, hall.x1, horizon, 1, 0.02, true);
  for (let y = Math.round(H * 0.5); y < hall.y0; y++) {
    const inset = (y - H * 0.5) / (hall.y0 - H * 0.5);
    rect(hall.x0 - 2 + (1 - inset) * W * 0.02, y, hall.x1 + 2 - (1 - inset) * W * 0.02, y + 1, 1, 0.3, true);
  }
  const hallWindows = 7, ww = W * 0.02;
  for (let row = 0; row < 2; row++) for (let c = 0; c < hallWindows; c++) {
    const gap = (hall.x1 - hall.x0 - hallWindows * ww) / (hallWindows + 1);
    windowRect(hall.x0 + gap + c * (ww + gap), H * (0.61 + row * 0.085), ww, H * 0.045, row * 31 + c + 1);
  }

  // Library with a dome and tall windows.
  const lib = { x0: W * 0.62, x1: W * 0.86, y0: H * 0.6 };
  rect(lib.x0, lib.y0, lib.x1, horizon, 1, 0.02, true);
  const domeX = (lib.x0 + lib.x1) / 2, domeR = H * 0.11;
  for (let y = Math.floor(lib.y0 - domeR); y < lib.y0; y++) for (let x = Math.floor(domeX - domeR); x <= domeX + domeR; x++) if (Math.hypot(x - domeX, y - lib.y0) <= domeR) put(x, y, 0.82, 0.03, true);
  rect(domeX - 1, lib.y0 - domeR - H * 0.04, domeX + 1, lib.y0 - domeR + 1, 1, 0.3, true);
  for (let c = 0; c < 6; c++) windowRect(lib.x0 + W * 0.018 + c * W * 0.037, H * 0.66, W * 0.014, H * 0.1, 100 + c);

  // Clock tower, spire, clock face, door.
  const tw = { x0: W * 0.46, x1: W * 0.54, y0: H * 0.27 };
  const mid = (tw.x0 + tw.x1) / 2;
  rect(tw.x0, tw.y0, tw.x1, horizon, 1, 0.02, true);
  const spireTop = H * 0.16;
  for (let y = Math.round(spireTop); y < tw.y0; y++) {
    const half = ((y - spireTop) / (tw.y0 - spireTop)) * ((tw.x1 - tw.x0) / 2 + 2);
    rect(mid - half, y, mid + half + 1, y + 1, 1, 0.32, true);
  }
  for (let s = 0; s < 3; s++) windowRect(mid - W * 0.007, H * (0.45 + s * 0.09), W * 0.014, H * 0.05, 200 + s);
  windowRect(mid - W * 0.014, horizon - H * 0.07, W * 0.028, H * 0.07, 299);
  const clockY = H * 0.35, clockR = Math.max(3, H * 0.04);
  for (let y = Math.floor(clockY - clockR); y <= clockY + clockR; y++) for (let x = Math.floor(mid - clockR); x <= mid + clockR; x++) {
    const d = Math.hypot(x - mid, y - clockY);
    if (d > clockR || !inside(x, y)) continue;
    const i = y * W + x;
    const rim = d > clockR - 1;
    day[i] = rim ? 1 : 0; night[i] = rim ? 0.8 : 0.06; lightDelay[i] = rim ? -1 : 0.05;
  }
  rect(mid, clockY - clockR + 2, mid + 1, clockY + 1, 1, 0.1);
  rect(mid, clockY, mid + clockR - 1, clockY + 1, 1, 0.1);

  // Rim light: at night the top and side edges of every solid shape catch the sky.
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    if (!solid[i] || lightDelay[i] >= 0) continue;
    if (!solid[i - W] || !solid[i - 1] || !solid[i + 1]) night[i] = Math.max(night[i], 0.55);
  }

  // The flag on the spire: the one thing that is solid ink in both shifts.
  const poleTop = Math.round(H * 0.04);
  rect(mid, poleTop, mid + 1, spireTop + 1, 1, 1);
  const flagLength = Math.max(6, Math.round(W * 0.06)), flagHeight = Math.max(4, Math.round(H * 0.06));
  for (let dx = 1; dx <= flagLength; dx++) {
    const wave = Math.round(Math.sin(dx / flagLength * Math.PI * 1.6) * 1.2);
    rect(mid + dx, poleTop + wave, mid + dx + 1, poleTop + wave + flagHeight * (1 - dx / (flagLength * 2.2)), 1, 1);
  }

  return { width: W, height: H, day, night, lightDelay, flag: { x: Math.round(mid + 2), y: poleTop + 1 } };
}
