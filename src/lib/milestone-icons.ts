import type { ProfileMilestone } from "./player-profile";

/** 16x16 1-bit emblems, each with its own silhouette so they stay distinct in one color. */
export const MILESTONE_ICON_SIZE = 16;
export const MILESTONE_ICONS: Record<ProfileMilestone["id"], string[]> = {
  // A planted flag with a check cut out of it.
  "first-capture": [
    "................",
    ".##############.",
    ".##############.",
    ".###########..#.",
    ".##########..##.",
    ".#####..##..###.",
    ".######....####.",
    ".#######..#####.",
    ".##############.",
    ".##############.",
    ".##.............",
    ".##.............",
    ".##.............",
    ".##.............",
    ".####...........",
    "................",
  ],
  // A medal on a ribbon with "10" cut out of it.
  "ten-captures": [
    "................",
    "....########....",
    "..############..",
    ".##############.",
    ".###..##.....##.",
    ".####.##.###.##.",
    ".####.##.###.##.",
    ".####.##.###.##.",
    ".####.##.###.##.",
    ".###...#.....##.",
    ".##############.",
    "..############..",
    "....########....",
    "....###..###....",
    "....##....##....",
    "................",
  ],
  // A pointed pennant with a first-place "1" cut out of it.
  "first-blood": [
    "................",
    ".##########.....",
    ".#######.#####..",
    ".######..#######",
    ".#######.#######",
    ".#######.#######",
    ".#######.#####..",
    ".#####.....##...",
    ".##########.....",
    ".##.............",
    ".##.............",
    ".##.............",
    ".##.............",
    ".##.............",
    ".####...........",
    "................",
  ],
};

/** One SVG path in a 16-unit box, merging horizontal runs. */
export function milestoneIconPath(id: ProfileMilestone["id"]) {
  let d = "";
  MILESTONE_ICONS[id].forEach((row, y) => {
    for (const run of row.matchAll(/#+/g)) d += `M${run.index} ${y}h${run[0].length}v1h-${run[0].length}z`;
  });
  return d;
}
