// Local-only demo activity so the leaderboard, heatmaps, and feeds look lived-in during development.
// Adds fictional players (no logins) with solves over the last 20 weeks.
// Run with the dev server stopped. `npm run demo -- --remove` deletes everything this script added.
import "../src/server/load-env";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, like } from "drizzle-orm";
import { getDb, closeDatabase } from "../src/server/db";
import { user, challenges, challengeVersions, solves, submissions, xpLedger } from "../src/server/schema";
import { codenameKey } from "../src/server/validation";
import { currentWeekly, dayStart, weekStart } from "../src/lib/week";

if (process.env.NODE_ENV === "production") throw new Error("Demo activity is disabled in production.");
if (process.env.DATABASE_URL && !["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(process.env.DATABASE_URL).hostname)) throw new Error("Demo activity only supports an embedded or loopback database.");

const db = await getDb();
const DEMO = "demo-%@dfctf.local";
const existing = await db.select({ id: user.id }).from(user).where(like(user.email, DEMO));
if (existing.length) {
  const ids = existing.map(u => u.id);
  await db.delete(xpLedger).where(inArray(xpLedger.userId, ids));
  await db.delete(submissions).where(inArray(submissions.userId, ids));
  await db.delete(solves).where(inArray(solves.userId, ids));
  await db.delete(user).where(inArray(user.id, ids));
}
if (process.argv.includes("--remove")) { console.log(`Removed ${existing.length} demo players.`); await closeDatabase(); process.exit(0); }

// Deterministic randomness, so reruns produce the same board.
let seed = 7;
const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

const library = await db.select({ id: challenges.id, familyId: challenges.familyId, publishedAt: challenges.publishedAt, versionId: challengeVersions.id, title: challengeVersions.title, xp: challengeVersions.xp, tags: challengeVersions.tags, difficulty: challengeVersions.difficulty })
  .from(challenges).innerJoin(challengeVersions, and(eq(challengeVersions.challengeId, challenges.id), eq(challengeVersions.version, challenges.currentVersion))).where(eq(challenges.status, "published"));
if (!library.length) throw new Error("Run `npm run seed` first: there are no published challenges.");

const weekly = currentWeekly(library);

const names = ["kestrel_7", "n0ise", "rootbeer", "quietpixel", "null_ptr", "r3dsh1ft", "0xbeef", "lambda_l", "sh4dowc4t", "tinker", "rsa_rookie", "byte_me", "hexhound", "grep_master", "packetmoth", "segfault_sam", "cipher_kid", "nmap_nomad", "bitflip", "stackcanary", "ghost_in_tty", "lsb_larry", "x0r_queen", "chmod_777"];
const now = Date.now(), start = weekStart().getTime(), weekMs = 7 * 86_400_000;
let solveCount = 0;
for (const [i, codename] of names.entries()) {
  const id = randomUUID();
  await db.insert(user).values({ id, name: "Demo player", email: `demo-${i}@dfctf.local`, emailVerified: true, codename, codenameKey: codenameKey(codename), role: "participant" });
  const skill = 1 - i / names.length; // earlier names solve more, so the board has a shape
  for (const c of library) {
    const odds = (c.difficulty === "Hard" ? 0.35 : c.difficulty === "Medium" ? 0.55 : 0.8) * (0.35 + skill * 0.65);
    if (rand() > odds) continue;
    const thisWeek = rand() < 0.45 + skill * 0.25;
    // This week's solves land between Monday and now; older ones spread across the last 19 weeks.
    let at = thisWeek ? start + rand() * Math.max(1, now - start) : start - weekMs * (1 + rand() * 18) + rand() * weekMs;
    if (c.id === weekly?.id) at = start + rand() * Math.max(1, now - start);
    if (rand() < 0.6) at = dayStart(new Date(at)).getTime() + (19 + Math.floor(rand() * 5)) * 3_600_000 + Math.floor(rand() * 60) * 60_000;
    const when = new Date(Math.min(now - 60_000, at));
    const solveId = randomUUID();
    await db.insert(solves).values({ id: solveId, userId: id, challengeId: c.id, versionId: c.versionId, createdAt: when });
    await db.insert(xpLedger).values({ id: randomUUID(), userId: id, familyId: c.familyId, solveId, amount: c.xp, createdAt: when }).onConflictDoNothing();
    await db.insert(submissions).values({ id: randomUUID(), userId: id, challengeId: c.id, versionId: c.versionId, digest: "demo", correct: true, createdAt: when });
    solveCount++;
  }
}
console.log(`Added ${names.length} demo players and ${solveCount} solves. ${weekly ? `"${weekly.title}" is this week's challenge.` : "No weekly challenge was published this week."} Remove demo players with: npm run demo -- --remove`);
await closeDatabase();
