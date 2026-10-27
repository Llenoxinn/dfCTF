import { describe, expect, it } from "vitest";
import { parseTheme } from "@/lib/theme";
import { ditherPath, heatLevel, identicon, meterCells, relativeLevels, threshold } from "@/lib/pixel";
import { countdownParts, currentWeekly, dayKey, weekEnd, weekStart } from "@/lib/week";
import { execFileSync } from "node:child_process";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RaceChart } from "@/components/viz";
import { dailyCounts, hourlyCounts, raceRanks, rankStandings, type SolveRow } from "@/server/community";
import { summarize } from "@/server/validation";

describe("theme cookie parsing", () => {
  it("accepts only the two known themes", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("Dark")).toBeNull();
    expect(parseTheme(undefined)).toBeNull();
    expect(parseTheme("dark; Path=/")).toBeNull();
  });
});

describe("pixel helpers", () => {
  it("covers 64 distinct dither levels strictly between 0 and 1", () => {
    const levels = new Set<number>();
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const t = threshold(x, y); expect(t).toBeGreaterThan(0); expect(t).toBeLessThan(1); levels.add(t); }
    expect(levels.size).toBe(64);
    expect(ditherPath(32, 32, 4, () => 0)).toBe("");
    expect(ditherPath(32, 32, 4, () => 1).split("M").length - 1).toBe(8);
  });

  it("draws a stable identicon per codename with at least five lit cells", () => {
    expect(identicon("packet_fox")).toEqual(identicon("packet_fox"));
    expect(identicon("packet_fox")).not.toEqual(identicon("kestrel_7"));
    for (const name of ["a", "n0ise", "rootbeer", "x"]) expect(identicon(name).filter(Boolean).length).toBeGreaterThanOrEqual(5);
  });

  it("fills meters proportionally and never hides a non-zero value", () => {
    expect(meterCells(0, 100)).toBe(0);
    expect(meterCells(1, 6450)).toBe(1);
    expect(meterCells(6450, 6450)).toBe(20);
    expect(meterCells(10, 0)).toBe(0);
  });

  it("maps solve counts to heat levels", () => {
    expect([0, 1, 9, 10, 39, 40, 99, 100].map(n => heatLevel(n))).toEqual([0, 1, 1, 2, 2, 3, 3, 4]);
    expect(relativeLevels([0, 1, 2, 8])).toEqual([0, 1, 1, 4]);
  });
});

describe("week math", () => {
  it("runs Monday 00:00 through Sunday 23:59:59", () => {
    const thursday = new Date("2026-10-22T15:30:00+08:00");
    expect(weekStart(thursday)).toEqual(new Date("2026-10-19T00:00:00+08:00"));
    expect(weekEnd(thursday)).toEqual(new Date("2026-10-25T23:59:59.999+08:00"));
    expect(weekStart(new Date("2026-10-25T23:00:00+08:00"))).toEqual(new Date("2026-10-19T00:00:00+08:00"));
    expect(countdownParts(90061000)).toEqual({ days: 1, hours: 1, minutes: 1, seconds: 1 });
    expect(countdownParts(-5)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });
  it.each(["UTC", "Asia/Manila", "America/New_York"])("uses the same week boundaries on a %s host", timezone => {
    const code = `import { weekStart, weekEnd, dayKey } from './src/lib/week.ts';
      const now = new Date('2026-10-25T16:00:00Z');
      console.log(JSON.stringify([weekStart(now).toISOString(), weekEnd(now).toISOString(), dayKey(now)]));`;
    const output = execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", code], { encoding: "utf8", env: { ...process.env, TZ: timezone } });
    expect(JSON.parse(output)).toEqual(["2026-10-25T16:00:00.000Z", "2026-11-01T15:59:59.999Z", "2026-10-26"]);
  });
  it("expires weekly features at the publication week's boundary and ignores future publications", () => {
    const old = { id: "old", tags: ["weekly"], publishedAt: new Date("2026-10-18T23:59:59.999+08:00") };
    const current = { id: "current", tags: ["weekly"], publishedAt: new Date("2026-10-19T00:00:00+08:00") };
    const newer = { id: "newer", tags: ["WEEKLY"], publishedAt: new Date("2026-10-21T10:00:00+08:00") };
    const future = { id: "future", tags: ["weekly"], publishedAt: new Date("2026-10-26T00:00:00+08:00") };
    const items = [old, current, newer, future, { id: "unpublished", tags: ["weekly"], publishedAt: null }];
    expect(currentWeekly(items, new Date("2026-10-19T00:00:00+08:00"))?.id).toBe("current");
    expect(currentWeekly(items, new Date("2026-10-25T23:59:59.999+08:00"))?.id).toBe("newer");
    expect(currentWeekly([old, current, newer], new Date("2026-10-26T00:00:00+08:00"))).toBeUndefined();
    expect(currentWeekly(items, new Date("2026-10-26T00:00:00+08:00"))?.id).toBe("future");
  });
});

describe("community standings", () => {
  const monday = new Date("2026-10-19T00:00:00+08:00");
  const at = (day: number, hour: number) => new Date(monday.getTime() + (day * 24 + hour) * 3_600_000);
  const row = (userId: string, codename: string | null, points: number, when: Date, challengeId = "c" + Math.random()): SolveRow => ({ userId, codename, points, at: when, challengeId });

  it("ranks by points and breaks ties by who reached the score first", () => {
    const ranked = rankStandings([row("a", "alpha", 100, at(0, 9)), row("b", "bravo", 100, at(0, 8)), row("c", "charlie", 200, at(1, 9)), row("d", null, 900, at(0, 1))]);
    expect(ranked.map(r => [r.rank, r.codename, r.points])).toEqual([[1, "charlie", 200], [2, "bravo", 100], [3, "alpha", 100]]);
  });

  it("records daily rank snapshots ending at now", () => {
    const rows = [row("a", "alpha", 300, at(0, 10)), row("b", "bravo", 100, at(0, 11)), row("b", "bravo", 400, at(1, 12))];
    const race = raceRanks(rows, monday, at(2, 9));
    expect(race.snapshots).toHaveLength(3);
    expect(race.players.find(p => p.codename === "alpha")!.ranks).toEqual([1, 2, 2]);
    expect(race.players.find(p => p.codename === "bravo")!.ranks).toEqual([2, 1, 1]);
    expect(race.snapshots[0]).toBe("2026-10-19T12:00:00.000Z");
  });
  it("ranks finalists against the entire field and leaves unsolved snapshots unranked", () => {
    const rows = [row("early", "early_leader", 500, at(0, 8)), row("a", "alpha", 100, at(0, 9)), row("a", "alpha", 1000, at(1, 9)), row("b", "bravo", 1050, at(1, 10))];
    const race = raceRanks(rows, monday, at(2, 9), 2);
    expect(race.players.map(p => p.codename)).toEqual(["alpha", "bravo"]);
    expect(race.players[0].ranks).toEqual([2, 1, 1]);
    expect(race.players[1].ranks).toEqual([null, 2, 2]);
  });
  it("renders historical ranks beyond the plotted players without invalid SVG coordinates", () => {
    const race = { snapshots: [at(0, 20).toISOString(), at(1, 20).toISOString()], players: [
      { codename: "alpha", points: 1000, ranks: [20, 1] },
      { codename: "bravo", points: 900, ranks: [null, 2] },
    ] };
    const markup = renderToStaticMarkup(createElement(RaceChart, { race, hourly: { start: monday.toISOString(), counts: new Array(45).fill(0), firstBlood: new Array(45).fill(false) } }));
    expect(markup).toContain("#20");
    expect(markup).toContain(">new</span>");
    expect(markup).not.toMatch(/NaN|Infinity/);
  });

  it("buckets solves by hour and day and marks first bloods", () => {
    const first = at(0, 1);
    const rows = [row("a", "alpha", 50, first, "x"), row("b", "bravo", 50, at(0, 1), "y"), row("c", "charlie", 50, at(0, 3), "x")];
    const hourly = hourlyCounts(rows, new Map([["x", first.getTime()]]), monday, at(0, 5));
    expect(hourly.counts).toEqual([0, 2, 0, 1, 0]);
    expect(hourly.firstBlood).toEqual([false, true, false, false, false]);
    expect(dailyCounts([at(0, 1), at(0, 5), at(2, 9)], monday, at(2, 10)).days).toEqual([2, 0, 1]);
  });
  it("buckets solves around Manila midnight even when UTC is still on the previous day", () => {
    const before = new Date("2026-10-19T15:59:59.999Z"), after = new Date("2026-10-19T16:00:00Z");
    expect(dayKey(before)).toBe("2026-10-19");
    expect(dayKey(after)).toBe("2026-10-20");
    expect(dailyCounts([before, after], monday, after).days).toEqual([1, 1]);
  });
});

describe("challenge summary", () => {
  it("takes the first sentence of the description", () => {
    const description = "A temple climbs the hillside of Beverly Hills, Cebu, and its staircase has a very deliberate number of steps, one per chapter of a sacred text. Don’t just count the steps. Tell me the title of the text whose chapters they stand for.";
    expect(summarize(description)).toBe("A temple climbs the hillside of Beverly Hills, Cebu, and its staircase has a very deliberate number of steps, one per chapter of a sacred text.");
  });
  it("skips headings and code, drops backticks, and keeps version numbers intact", () => {
    expect(summarize("## Brief\n\n```\nls -la\n```\n\nRun `strings` on build v1.2 of the tool. Then look closer.")).toBe("Run strings on build v1.2 of the tool.");
    expect(summarize("No sentence ending here")).toBe("No sentence ending here");
  });
  it("cuts a long first sentence at a word boundary within 240 characters", () => {
    const long = `${"word ".repeat(80)}end.`;
    const summary = summarize(long);
    expect(summary.length).toBeLessThanOrEqual(240);
    expect(summary.endsWith("word…")).toBe(true);
  });
});
