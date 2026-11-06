import { sql } from "drizzle-orm";
import type { Database } from "./db";
import { solves, user, xpLedger } from "./schema";
import type { Standing } from "@/lib/types";
import { notSuspended } from "./player-eligibility";

/** SQL form of rankStandings: identical millisecond tie precision and C codename order. */
function rankings(now: Date, since?: Date) {
  return sql`select scores.*, row_number() over (order by points desc, reached_at asc, codename collate "C" asc) as rank
    from (select ${solves.userId} as user_id, ${user.codename} as codename,
      sum(coalesce(${xpLedger.amount},0)) as points, count(*) as solves,
      date_trunc('milliseconds',coalesce(max(case when ${xpLedger.amount}>0 then ${solves.createdAt} end),min(${solves.createdAt}))) as reached_at
      from ${solves} inner join ${user} on ${user.id}=${solves.userId}
      left join ${xpLedger} on ${xpLedger.solveId}=${solves.id}
      where ${user.codename}<>'' and ${solves.createdAt}<=${now} and ${notSuspended(now)}
        and ${since ? sql`${solves.createdAt}>=${since}` : sql`true`}
      group by ${solves.userId},${user.codename}) scores`;
}
const standing = (row: Record<string, unknown>): Standing => ({ rank: Number(row.rank), codename: String(row.codename), points: Number(row.points), solves: Number(row.solves) });

export async function practiceStanding(db: Database, userId: string, now: Date, since?: Date): Promise<Standing | null> {
  const result = await db.execute(sql`select * from (${rankings(now,since)}) ranked where user_id=${userId}`);
  return result.rows[0] ? standing(result.rows[0]) : null;
}
export async function topPracticeStandings(db: Database, now: Date, since?: Date): Promise<Standing[]> {
  const result = await db.execute(sql`select * from (${rankings(now,since)}) ranked order by rank limit 5`);
  return result.rows.map(standing);
}
