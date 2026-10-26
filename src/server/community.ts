import { and, eq, ne, gte, lte, desc, asc, sql } from "drizzle-orm";
import type { Database } from "./db";
import { challenges, challengeVersions, solves, xpLedger, user } from "./schema";
import { CATEGORIES, type Category, type Community, type Difficulty, type Leaderboard, type SolveEvent, type Standing } from "@/lib/types";
import { currentWeekly, DAY_MS, dayKey, dayStart, weekEnd, weekStart } from "@/lib/week";

export type SolveRow = { userId: string; codename: string | null; challengeId: string; at: Date; points: number };
type Ranked = Standing & { userId: string; reachedAt: number };

const current = and(eq(challengeVersions.challengeId, challenges.id), eq(challengeVersions.version, challenges.currentVersion));

/** Points desc; ties go to whoever reached their score first. Players without a codename stay off the board. */
export function rankStandings(rows: SolveRow[]): Ranked[] {
  const players = new Map<string, Ranked>();
  for (const row of rows) {
    if (!row.codename) continue;
    const entry = players.get(row.userId) ?? { userId: row.userId, codename: row.codename, points: 0, solves: 0, rank: 0, reachedAt: row.at.getTime() };
    entry.points += row.points; entry.solves += 1;
    if (row.points > 0) entry.reachedAt = row.at.getTime();
    players.set(row.userId, entry);
  }
  return [...players.values()]
    .sort((a, b) => b.points - a.points || a.reachedAt - b.reachedAt || (a.codename < b.codename ? -1 : a.codename > b.codename ? 1 : 0))
    .map((entry, i) => ({ ...entry, rank: i + 1 }));
}

/** Ranks of the current top players at 20:00 each elapsed day, ending at now. */
export function raceRanks(rows: SolveRow[], start: Date, now: Date, top = 8) {
  const elapsed = rows.filter(r => r.at <= now);
  const finalists = rankStandings(elapsed).slice(0, top);
  const snapshots: Date[] = [];
  for (let d = 0; d < 7; d++) {
    const cut = new Date(start.getTime() + d * DAY_MS + 20 * 3_600_000);
    if (cut >= now) break;
    snapshots.push(cut);
  }
  snapshots.push(now);
  const ranksAt = snapshots.map(cut => new Map(rankStandings(elapsed.filter(r => r.at <= cut)).map(r => [r.userId, r.rank])));
  return {
    snapshots: snapshots.map(s => s.toISOString()),
    players: finalists.map(f => ({ codename: f.codename, points: f.points, ranks: ranksAt.map(ranks => ranks.get(f.userId) ?? null) })),
  };
}

export function hourlyCounts(rows: SolveRow[], firstSolves: Map<string, number>, start: Date, now: Date) {
  const hours = Math.max(1, Math.ceil((now.getTime() - start.getTime()) / 3_600_000));
  const counts = new Array<number>(hours).fill(0), firstBlood = new Array<boolean>(hours).fill(false);
  for (const row of rows) {
    const h = Math.floor((row.at.getTime() - start.getTime()) / 3_600_000);
    if (h < 0 || h >= hours) continue;
    counts[h]++;
    if (firstSolves.get(row.challengeId) === row.at.getTime()) firstBlood[h] = true;
  }
  return { start: start.toISOString(), counts, firstBlood };
}

export function dailyCounts(dates: Date[], start: Date, now: Date) {
  const index = new Map<string, number>(), days: number[] = [];
  for (let at = dayStart(start).getTime(); at <= now.getTime(); at += DAY_MS) { index.set(dayKey(new Date(at)), days.length); days.push(0); }
  for (const date of dates) { const i = index.get(dayKey(date)); if (i !== undefined) days[i]++; }
  return { start: start.toISOString(), days };
}

async function solveRows(db: Database, since?: Date): Promise<SolveRow[]> {
  const rows = await db.select({ userId: solves.userId, codename: user.codename, challengeId: solves.challengeId, at: solves.createdAt, points: sql<number>`coalesce(${xpLedger.amount}, 0)` })
    .from(solves).innerJoin(user, eq(user.id, solves.userId)).leftJoin(xpLedger, eq(xpLedger.solveId, solves.id))
    .where(since ? gte(solves.createdAt, since) : undefined).orderBy(solves.createdAt);
  return rows.map(r => ({ ...r, points: Number(r.points) }));
}

async function firstSolveTimes(db: Database) {
  const rows = await db.select({ challengeId: solves.challengeId, first: sql<Date>`min(${solves.createdAt})` }).from(solves).groupBy(solves.challengeId);
  return new Map(rows.map(r => [r.challengeId, new Date(r.first).getTime()]));
}

async function publishedLibrary(db: Database) {
  return db.select({ id: challenges.id, publishedAt: challenges.publishedAt, title: challengeVersions.title, summary: challengeVersions.summary, category: challengeVersions.category, difficulty: challengeVersions.difficulty, xp: challengeVersions.xp, tags: challengeVersions.tags })
    .from(challenges).innerJoin(challengeVersions, current).where(eq(challenges.status, "published"));
}

async function solveCounts(db: Database) {
  const rows = await db.select({ challengeId: solves.challengeId, total: sql<number>`count(*)` }).from(solves).groupBy(solves.challengeId);
  return new Map(rows.map(r => [r.challengeId, Number(r.total)]));
}

const plain = ({ rank, codename, points, solves }: Standing): Standing => ({ rank, codename, points, solves });

async function topStandings(db: Database, now: Date, since?: Date): Promise<Standing[]> {
  const points = sql<number>`sum(coalesce(${xpLedger.amount}, 0))`;
  // Keep exact ties consistent with rankStandings: JavaScript Date precision and binary codename order.
  const reachedAt = sql`date_trunc('milliseconds', coalesce(max(case when ${xpLedger.amount} > 0 then ${solves.createdAt} end), min(${solves.createdAt})))`;
  const rows = await db.select({ codename: user.codename, points, solves: sql<number>`count(*)` })
    .from(solves).innerJoin(user, eq(user.id, solves.userId)).leftJoin(xpLedger, eq(xpLedger.solveId, solves.id))
    .where(and(ne(user.codename, ""), lte(solves.createdAt, now), since ? gte(solves.createdAt, since) : undefined))
    .groupBy(solves.userId, user.codename).orderBy(desc(points), asc(reachedAt), asc(sql`${user.codename} COLLATE "C"`)).limit(5);
  return rows.map((r, i) => ({ rank: i + 1, codename: r.codename!, points: Number(r.points), solves: Number(r.solves) }));
}

/** Public data for the landing page: codenames and challenge titles only. */
export async function getCommunity(db: Database, now = new Date()): Promise<Community> {
  const start = weekStart(now), activityStart = new Date(start.getTime() - 19 * 7 * DAY_MS);
  const activityDay = sql<string>`to_char(${solves.createdAt} AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD')`;
  const [library, counts, firsts, top, topAll, recentRows, activityRows] = await Promise.all([
    publishedLibrary(db), solveCounts(db), firstSolveTimes(db), topStandings(db, now, start), topStandings(db, now),
    db.select({ at: solves.createdAt, challengeId: solves.challengeId, codename: user.codename, title: challengeVersions.title, points: sql<number>`coalesce(${xpLedger.amount}, 0)` })
      .from(solves).innerJoin(user, eq(user.id, solves.userId)).innerJoin(challengeVersions, eq(challengeVersions.id, solves.versionId)).leftJoin(xpLedger, eq(xpLedger.solveId, solves.id))
      .orderBy(desc(solves.createdAt)).limit(12),
    db.select({ day: activityDay, total: sql<number>`count(*)` }).from(solves)
      .where(and(gte(solves.createdAt, activityStart), lte(solves.createdAt, now))).groupBy(activityDay),
  ]);
  const weeklyRow = currentWeekly(library, now);
  let weekly: Community["weekly"] = null;
  if (weeklyRow) {
    const solvers = await db.select({ codename: user.codename }).from(solves).innerJoin(user, eq(user.id, solves.userId)).where(eq(solves.challengeId, weeklyRow.id)).orderBy(desc(solves.createdAt)).limit(5);
    weekly = { id: weeklyRow.id, title: weeklyRow.title, summary: weeklyRow.summary, category: weeklyRow.category as Category, difficulty: weeklyRow.difficulty as Difficulty, xp: weeklyRow.xp, solveCount: counts.get(weeklyRow.id) ?? 0, solvers: solvers.flatMap(s => (s.codename ? [s.codename] : [])), endsAt: weekEnd(now).toISOString() };
  }
  const recent: SolveEvent[] = recentRows.flatMap(r => (r.codename ? [{ at: r.at.toISOString(), codename: r.codename, title: r.title, points: Number(r.points), firstBlood: firsts.get(r.challengeId) === r.at.getTime() }] : []));
  const activity = dailyCounts([], activityStart, now);
  const activityTotals = new Map(activityRows.map(r => [r.day, Number(r.total)]));
  activity.days = activity.days.map((_, i) => activityTotals.get(dayKey(new Date(activityStart.getTime() + i * DAY_MS))) ?? 0);
  const level = (d: string) => d.toLowerCase();
  return {
    weekly, recent, top, topAll, activity,
    totals: { challenges: library.length, categories: CATEGORIES.map(category => {
      const inCat = library.filter(c => c.category === category);
      return { category, easy: inCat.filter(c => level(c.difficulty) === "easy").length, medium: inCat.filter(c => level(c.difficulty) === "medium").length, hard: inCat.filter(c => level(c.difficulty) === "hard").length };
    }) },
  };
}

export async function getLeaderboard(db: Database, viewerId: string, range: "week" | "all", now = new Date()): Promise<Leaderboard> {
  const start = weekStart(now), mineStart = new Date(start.getTime() - 15 * 7 * DAY_MS);
  const [rangeRows, weekRows, firsts, library, counts, mySolves] = await Promise.all([
    range === "week" ? solveRows(db, start) : solveRows(db), solveRows(db, start), firstSolveTimes(db), publishedLibrary(db), solveCounts(db),
    db.select({ challengeId: solves.challengeId, at: solves.createdAt }).from(solves).where(eq(solves.userId, viewerId)),
  ]);
  const standings = rankStandings(rangeRows);
  const me = standings.find(s => s.userId === viewerId);
  const above = me && me.rank > 1 ? standings[me.rank - 2] : null;
  const solved = new Set(mySolves.map(s => s.challengeId));
  const order = { Easy: 0, Medium: 1, Hard: 2 } as Record<string, number>;
  return {
    range, weekEndsAt: weekEnd(now).toISOString(), players: standings.length, standings: standings.slice(0, 50).map(plain),
    viewer: me ? { ...plain(me), gap: above ? { codename: above.codename, points: above.points - me.points } : null } : null,
    race: raceRanks(weekRows, start, now),
    hourly: hourlyCounts(weekRows, firsts, start, now),
    challenges: library.map(c => ({ id: c.id, title: c.title, category: c.category as Category, difficulty: c.difficulty as Difficulty, xp: c.xp, solveCount: counts.get(c.id) ?? 0, solved: solved.has(c.id) }))
      .sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || order[a.difficulty] - order[b.difficulty] || a.xp - b.xp),
    mine: dailyCounts(mySolves.map(s => s.at).filter(at => at >= mineStart), mineStart, now),
  };
}

