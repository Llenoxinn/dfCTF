import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "./db";
import { challenges, challengeVersions, playerProfiles, solves, xpLedger } from "./schema";
import { practiceStanding } from "./practice-standing";
import { HttpError } from "./http";
import { weekStart, weekEnd } from "@/lib/week";
import { CATEGORIES, type Category, type Viewer } from "@/lib/types";
import { profileMilestones, type PlayerProfile, type ProfileActivityPage, type ProfileScope } from "@/lib/player-profile";

const httpsUrl = z.string().trim().max(240).refine(value => {
  if (!value) return true;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
}, "Use a complete HTTPS URL without a username or password.");
export const profileInput = z.object({
  displayName: z.string().trim().max(48, "Use at most 48 characters."),
  bio: z.string().trim().max(180, "Use at most 180 characters."),
  websiteUrl: httpsUrl,
  githubUrl: httpsUrl.refine(value => { if (!value) return true; try { const url = new URL(value); return url.hostname === "github.com" && !url.port && !url.search && !url.hash && /^\/[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?\/?$/i.test(url.pathname); } catch { return false; } }, "Use a GitHub profile URL, such as https://github.com/your-name."),
}).strict();

const emptyIdentity = { displayName: "", bio: "", websiteUrl: "", githubUrl: "" };
export async function savePlayerProfile(db: Database, owner: Viewer, input: z.infer<typeof profileInput>) {
  const values = profileInput.parse(input);
  await db.insert(playerProfiles).values({ userId: owner.id, ...values }).onConflictDoUpdate({ target: playerProfiles.userId, set: { ...values, updatedAt: new Date() } });
  return { codename: owner.codename!, ...values };
}

const firstSolves = sql`select distinct on (challenge_id) id from solves order by challenge_id,created_at,id`;
const accessible = sql`${challenges.status}='published' and ${challenges.visibility}='practice'`;
const period = (scope: ProfileScope, now: Date) => scope === "all" ? "All-time practice" : `${new Intl.DateTimeFormat("en", { timeZone: "Asia/Manila", day: "numeric", month: "short" }).format(weekStart(now))} – ${new Intl.DateTimeFormat("en", { timeZone: "Asia/Manila", day: "numeric", month: "short", year: "numeric" }).format(weekEnd(now))} · PHT`;
const inScope = (scope: ProfileScope, now: Date) => sql`${solves.createdAt}<=${now} and ${scope === "week" ? sql`${solves.createdAt}>=${weekStart(now)}` : sql`true`}`;
const cursorSchema = z.object({ at: z.iso.datetime(), id: z.string().min(1).max(200), asOf: z.iso.datetime(), scope: z.enum(["all", "week"]) }).strict();

export async function profileActivity(db: Database, ownerId: string, scope: ProfileScope, now = new Date(), cursor?: string): Promise<ProfileActivityPage> {
  let after: z.infer<typeof cursorSchema> | null = null;
  if (cursor) {
    try { after = cursorSchema.parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))); }
    catch { throw new HttpError(422, "INVALID_CURSOR", "Refresh the profile to restart solve history."); }
    if (after.scope !== scope || new Date(after.asOf) > now) throw new HttpError(422, "INVALID_CURSOR", "Refresh the profile after changing scope.");
    now = new Date(after.asOf);
  }
  const result = await db.execute(sql`select ${solves.id} as id,${solves.challengeId} as challenge_id,${solves.createdAt} as at,
    to_char(${solves.createdAt} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as cursor_at,
    ${challengeVersions.title} as title,${challengeVersions.category} as category,coalesce(${xpLedger.amount},0) as points,
    exists(select 1 from (${firstSolves}) firsts where firsts.id=${solves.id}) as first_blood
    from ${solves} inner join ${challenges} on ${challenges.id}=${solves.challengeId}
    inner join ${challengeVersions} on ${challengeVersions.challengeId}=${challenges.id} and ${challengeVersions.version}=${challenges.currentVersion}
    left join ${xpLedger} on ${xpLedger.solveId}=${solves.id}
    where ${solves.userId}=${ownerId} and ${accessible} and ${inScope(scope,now)}
      and ${after ? sql`(${solves.createdAt},${solves.id})<(${after.at}::timestamptz,${after.id})` : sql`true`}
    order by ${solves.createdAt} desc,${solves.id} desc limit 13`);
  const rows = result.rows.slice(0,12), last = rows.at(-1);
  return {
    items: rows.map(row => ({ challengeId: String(row.challenge_id), title: String(row.title), category: row.category as Category, at: new Date(row.at as string).toISOString(), points: Number(row.points), firstBlood: Boolean(row.first_blood) })),
    nextCursor: result.rows.length > 12 && last ? Buffer.from(JSON.stringify({ at: String(last.cursor_at), id: last.id, asOf: now.toISOString(), scope })).toString("base64url") : null,
  };
}

export async function getPlayerProfile(db: Database, owner: Viewer, scope: ProfileScope, now = new Date()): Promise<PlayerProfile> {
  if (!owner.codename) throw new HttpError(409, "CODENAME_REQUIRED", "Choose a codename before opening Profile.");
  return db.transaction(async tx => {
    const [profile, standing, totals, categories, activity] = await Promise.all([
      tx.select({ displayName: playerProfiles.displayName, bio: playerProfiles.bio, websiteUrl: playerProfiles.websiteUrl, githubUrl: playerProfiles.githubUrl }).from(playerProfiles).where(eq(playerProfiles.userId,owner.id)).limit(1),
      practiceStanding(tx,owner.id,now,scope === "week" ? weekStart(now) : undefined),
      tx.execute(sql`select count(*) as solved,coalesce(sum(${xpLedger.amount}),0) as points,
        count(*) filter (where firsts.id is not null) as first_bloods
        from ${solves} left join ${xpLedger} on ${xpLedger.solveId}=${solves.id}
        left join (${firstSolves}) firsts on firsts.id=${solves.id}
        where ${solves.userId}=${owner.id} and ${inScope(scope,now)}`),
      tx.execute(sql`select ${challengeVersions.category} as category,count(*) as total,count(${solves.id}) as solved,coalesce(sum(${xpLedger.amount}),0) as points
        from ${challenges} inner join ${challengeVersions} on ${challengeVersions.challengeId}=${challenges.id} and ${challengeVersions.version}=${challenges.currentVersion}
        left join ${solves} on ${solves.challengeId}=${challenges.id} and ${solves.userId}=${owner.id} and ${inScope(scope,now)}
        left join ${xpLedger} on ${xpLedger.solveId}=${solves.id}
        where ${accessible} group by ${challengeVersions.category}`),
      profileActivity(tx,owner.id,scope,now),
    ]);
    const raw = totals.rows[0];
    const stats = { rank: standing?.rank ?? null, points: Number(raw.points), solved: Number(raw.solved), firstBloods: Number(raw.first_bloods) };
    const identity = { codename: owner.codename!, ...(profile[0] ?? emptyIdentity) };
    const scopeInfo = { id: scope, label: scope === "all" ? "Practice · all time" : "Practice · this week", period: period(scope,now) };
    const milestones = profileMilestones(stats);
    return {
      identity, scope: scopeInfo, asOf: now.toISOString(), stats, milestones, activity,
      categories: CATEGORIES.map(category => { const row = categories.rows.find(row => row.category === category); return { category, total: Number(row?.total ?? 0), solved: Number(row?.solved ?? 0), points: Number(row?.points ?? 0) }; }),
      // Deliberate allowlist: never spread an auth user or database row into export input.
      card: { codename: identity.codename, displayName: identity.displayName, bio: identity.bio, scope: scopeInfo.label, period: scopeInfo.period, asOf: now.toISOString(), rank: stats.rank, points: stats.points, solved: stats.solved, firstBloods: stats.firstBloods, milestones },
    };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
