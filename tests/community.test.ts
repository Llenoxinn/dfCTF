import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createStore } from "@/server/db";
import { eq } from "drizzle-orm";
import { allowlist, challenges, challengeVersions, solves, xpLedger, user } from "@/server/schema";
import { challengeDetail, getProgress, listChallenges } from "@/server/challenges";
import { dailyCounts, getCommunity, getLeaderboard, rankStandings, type SolveRow } from "@/server/community";
import { DAY_MS, weekStart } from "@/lib/week";
import type { Viewer } from "@/lib/types";

const now = new Date("2026-10-21T12:00:00+08:00");
const viewer: Viewer = { id: "weekly-player", email: "weekly@example.test", codename: "weekly_player", emailVerified: true, role: "participant", twoFactorEnabled: false };
let store: Awaited<ReturnType<typeof createStore>>;

beforeAll(async () => {
  store = await createStore(undefined, true);
  await store.migrate();
  await store.db.insert(user).values({ ...viewer, name: "Private player" });
  for (const [id, publishedAt, createdAt, status] of [
    ["previous-week", "2026-10-18T23:59:59+08:00", "2026-10-18T10:00:00+08:00", "published"],
    ["latest-created", "2026-10-19T12:00:00+08:00", "2026-10-19T10:00:00+08:00", "published"],
    ["latest-published", "2026-10-20T12:00:00+08:00", "2026-10-01T10:00:00+08:00", "published"],
    ["hidden-draft", null, "2026-10-21T10:00:00+08:00", "draft"],
  ] as const) {
    await store.db.insert(challenges).values({ id, slug: id, familyId: id, authorId: viewer.id, status, publishedAt: publishedAt ? new Date(publishedAt) : null, createdAt: new Date(createdAt) });
    await store.db.insert(challengeVersions).values({ id: `${id}-v1`, challengeId: id, version: 1, title: id, summary: "Weekly test challenge.", description: "Inspect the fictional test file.", solution: "Read the supplied test file to recover the flag.", category: "General skills", difficulty: "Easy", tags: ["weekly"], xp: 50, estimatedMinutes: 5, flagHash: "unused" });
  }
});
afterAll(async () => { await store?.close(); });
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(now); });
afterEach(() => { vi.useRealTimers(); });

describe("weekly feature across public and signed-in responses", () => {
  it("selects the same latest publication for the landing page, library, and detail", async () => {
    const community = await getCommunity(store.db, now);
    const library = await listChallenges(store.db, viewer.id);
    expect(community.weekly?.id).toBe("latest-published");
    expect(library.filter(c => c.weeklyEndsAt).map(c => c.id)).toEqual(["latest-published"]);
    expect(community.weekly?.endsAt).toBe("2026-10-25T15:59:59.999Z");
    expect((await challengeDetail(store.db, viewer, "latest-published")).weeklyEndsAt).toBe(community.weekly?.endsAt);
    expect((await challengeDetail(store.db, viewer, "latest-created")).weeklyEndsAt).toBeUndefined();
  });

  it("expires the feature without removing old challenges or renewing their deadlines", async () => {
    const nextWeek = new Date("2026-10-26T00:00:00+08:00");
    vi.setSystemTime(nextWeek);
    expect((await getCommunity(store.db, nextWeek)).weekly).toBeNull();
    const library = await listChallenges(store.db, viewer.id);
    expect(library).toHaveLength(3);
    expect(library.some(c => c.weeklyEndsAt)).toBe(false);
    expect((await challengeDetail(store.db, viewer, "latest-published")).weeklyEndsAt).toBeUndefined();
  });

  it("returns the authoritative Manila deadline for the leaderboard", async () => {
    expect((await getLeaderboard(store.db, viewer.id, "week", now)).weekEndsAt).toBe("2026-10-25T15:59:59.999Z");
  });

  it("aggregates public standings and daily activity without changing score ties or Manila day boundaries", async () => {
    const rows: SolveRow[]=[];
    for(const [codename, points, at] of [
      ["old_leader",200,"2026-05-01T12:00:00+08:00"],
      ["charlie",100,"2026-10-20T12:00:00+08:00"],
      ["delta",50,"2026-10-19T12:00:00+08:00"],
      ["alfa",50,"2026-10-19T23:59:59.999+08:00"],
      ["bravo",50,"2026-10-20T00:00:00+08:00"],
      ["echo",50,"2026-10-20T08:00:00+08:00"],
      ["Zulu",50,"2026-10-20T08:00:00+08:00"],
      ["foxtrot",10,"2026-10-20T09:00:00+08:00"],
      ["zero",0,"2026-10-20T09:00:00+08:00"],
      [null,1000,"2026-10-20T09:00:00+08:00"],
    ] as const) {
      const userId=`aggregate-${codename ?? "private"}`;
      await store.db.insert(user).values({id:userId,name:"Private name",email:`${userId}@example.test`,codename});
      const id=`${userId}-solve`,challengeId="latest-published";
      await store.db.insert(solves).values({id,userId,challengeId,versionId:`${challengeId}-v1`,createdAt:new Date(at)});
      if(points)await store.db.insert(xpLedger).values({id:`${id}-xp`,userId,familyId:challengeId,solveId:id,amount:points});
      rows.push({userId,codename,challengeId,at:new Date(at),points});
    }
    // A later family variant adds a solve but neither XP nor a later tie-break time.
    const variant={userId:"aggregate-alfa",codename:"alfa",challengeId:"latest-created",at:new Date("2026-10-20T10:00:00+08:00"),points:0};
    await store.db.insert(solves).values({id:"alfa-variant",userId:variant.userId,challengeId:variant.challengeId,versionId:"latest-created-v1",createdAt:variant.at});
    rows.push(variant);
    rows.sort((a,b)=>a.at.getTime()-b.at.getTime());
    const start=weekStart(now),activityStart=new Date(start.getTime()-19*7*DAY_MS);
    const response=await getCommunity(store.db,now);
    const publicRows=(input:SolveRow[])=>rankStandings(input).slice(0,5).map(({rank,codename,points,solves})=>({rank,codename,points,solves}));
    expect(response.top).toEqual(publicRows(rows.filter(r=>r.at>=start)));
    expect(response.topAll).toEqual(publicRows(rows));
    expect(response.top.map(r=>r.codename)).toEqual(["charlie","delta","alfa","bravo","Zulu"]);
    expect(response.top.find(r=>r.codename==="alfa")?.solves).toBe(2);
    expect(response.activity).toEqual(dailyCounts(rows.map(r=>r.at),activityStart,now));
    expect(response.activity.days.slice(-3)).toEqual([2,8,0]);
    expect(response.activity.days.length).toBeLessThanOrEqual(140);
    expect(JSON.stringify(response)).not.toContain("Private name");
    expect(JSON.stringify(response)).not.toContain("@example.test");
  });

  it("excludes revoked and expired players before ranking, counting, and selecting First Blood", async () => {
    const before = await getCommunity(store.db,now), population = (await getLeaderboard(store.db,viewer.id,"week",now)).players;
    const id = "eligibility-weekly";
    await store.db.insert(challenges).values({id,slug:id,familyId:id,authorId:viewer.id,status:"published",publishedAt:now});
    await store.db.insert(challengeVersions).values({id:`${id}-v1`,challengeId:id,version:1,title:id,summary:"Eligibility fixture",description:"Public eligibility test.",solution:"Fixture solution",category:"Forensics",difficulty:"Easy",tags:["weekly"],xp:50,estimatedMinutes:5,flagHash:"unused"});
    for (const [name,points,age] of [["revoked",10000,4000],["expired",9000,3000],["active",5000,2000],["future",4000,1000]] as const) {
      const userId=`eligibility-${name}`,solveId=`${userId}-solve`,email=`${userId}@example.test`;
      await store.db.insert(user).values({...viewer,id:userId,email,codename:userId,name:"Private eligibility name"});
      await store.db.insert(solves).values({id:solveId,userId,challengeId:id,versionId:`${id}-v1`,createdAt:new Date(now.getTime()-age)});
      await store.db.insert(xpLedger).values({id:`${solveId}-xp`,userId,familyId:id,solveId,amount:points});
      if(name!=="active")await store.db.insert(allowlist).values({id:userId,email,...(name==="revoked"?{revokedAt:now}:{expiresAt:new Date(now.getTime()+(name==="future"?1:0))})});
    }
    for (const range of ["week","all"] as const) {
      const board=await getLeaderboard(store.db,"eligibility-active",range,now);
      expect(board.standings.slice(0,2).map(row=>[row.rank,row.codename])).toEqual([[1,"eligibility-active"],[2,"eligibility-future"]]);
      expect(board.standings.some(row=>["eligibility-revoked","eligibility-expired"].includes(row.codename))).toBe(false);
      expect(board.viewer).toMatchObject({rank:1,points:5000});
      expect(board.challenges.find(c=>c.id===id)?.solveCount).toBe(2);
      if(range==="week")expect(board.players).toBe(population+2);
      expect(board.race.players.some(row=>["eligibility-revoked","eligibility-expired"].includes(row.codename))).toBe(false);
    }
    const community=await getCommunity(store.db,now);
    for(const top of [community.top,community.topAll]) {
      expect(top).toHaveLength(5);
      expect(top.slice(0,2).map(row=>row.codename)).toEqual(["eligibility-active","eligibility-future"]);
    }
    expect(community.weekly).toMatchObject({id,solveCount:2,solvers:["eligibility-future","eligibility-active"]});
    expect(community.recent.filter(row=>row.title===id).map(row=>[row.codename,row.firstBlood])).toEqual([["eligibility-future",false],["eligibility-active",true]]);
    expect(community.activity.days.reduce((a,b)=>a+b,0)).toBe(before.activity.days.reduce((a,b)=>a+b,0)+2);
    expect((await listChallenges(store.db,viewer.id)).find(c=>c.id===id)?.solveCount).toBe(2);
    const detail=await challengeDetail(store.db,viewer,id);
    expect(detail.solveCount).toBe(2);
    expect(detail.solvers?.map(row=>[row.codename,row.firstBlood])).toEqual([["eligibility-active",true],["eligibility-future",false]]);
    expect(JSON.stringify({community,solvers:detail.solvers})).not.toMatch(/Private eligibility name|@example\.test|"userId"|"flagHash"|"solution"/);
    const hidden=await getLeaderboard(store.db,"eligibility-revoked","all",now);
    expect(hidden.viewer).toBeNull();
    expect(hidden.mine.days.reduce((a,b)=>a+b,0)).toBe(1);
    expect(hidden.challenges.find(c=>c.id===id)?.solved).toBe(true);
    const history=await getProgress(store.db,"eligibility-revoked");
    expect(history.totalXp).toBe(10000);
    expect(history.recentSolves.map(solve=>solve.id)).toContain(id);
    expect(await store.db.select().from(solves).where(eq(solves.challengeId,id))).toHaveLength(4);
    expect(await store.db.select().from(xpLedger).where(eq(xpLedger.familyId,id))).toHaveLength(4);
  });
});
