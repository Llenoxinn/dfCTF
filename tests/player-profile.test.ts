import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { createStore } from "@/server/db";
import { allowlist, user, challenges, challengeVersions, solves, xpLedger } from "@/server/schema";
import { getPlayerProfile, profileActivity, profileInput, savePlayerProfile } from "@/server/player-profile";
import { getLeaderboard } from "@/server/community";
import { viewPlayer } from "@/server/socials";
import type { Viewer } from "@/lib/types";
import * as access from "@/server/access";
import * as database from "@/server/db";
import { GET, PATCH } from "@/app/api/v1/profile/route";
import { HttpError } from "@/server/http";

let store: Awaited<ReturnType<typeof createStore>>;
const now = new Date("2026-11-03T10:00:00Z");
async function player(codename = `p_${randomUUID().slice(0,8)}`): Promise<Viewer> {
  const identity: Viewer = { id: randomUUID(), email: `${randomUUID()}@private.test`, codename, emailVerified: true, role: "participant", twoFactorEnabled: false };
  await store.db.insert(user).values({ ...identity, name: "PRIVATE_PROVIDER_NAME", image: "https://private.test/avatar" });
  return identity;
}
async function capture(owner: Viewer, options: { at?: Date; status?: "published" | "archived"; category?: string; award?: number; id?: string } = {}) {
  const id = options.id ?? randomUUID(), version = randomUUID();
  await store.db.insert(challenges).values({ id, slug: id, familyId: id, authorId: owner.id, status: options.status ?? "published" });
  await store.db.insert(challengeVersions).values({ id: version, challengeId: id, version: 1, title: `Fixture ${id}`, summary: "Test fixture", description: "PRIVATE_DESCRIPTION", solution: "PRIVATE_SOLUTION", flagHash: "PRIVATE_FLAG_HASH", category: options.category ?? "Forensics", difficulty: "Easy", tags: [], xp: 999, estimatedMinutes: 5 });
  const solveId = randomUUID();
  await store.db.insert(solves).values({ id: solveId, userId: owner.id, challengeId: id, versionId: version, createdAt: options.at ?? now });
  await store.db.insert(xpLedger).values({ id: randomUUID(), userId: owner.id, familyId: id, solveId, amount: options.award ?? 25 });
  return { id, version, solveId };
}
beforeAll(async () => { store = await createStore(undefined,true); await store.migrate(); });
afterAll(async () => { await store?.close(); });

describe("authoritative owner profile", () => {
  it("distinguishes an unranked empty profile and exposes no authentication or challenge secrets", async () => {
    const owner = await player();
    const profile = await getPlayerProfile(store.db,owner,"all",now);
    expect(profile.stats).toEqual({ rank: null, points: 0, solved: 0, firstBloods: 0 });
    expect(profile.milestones).toEqual([]);
    expect(profile.activity.items).toEqual([]);
    expect(JSON.stringify(profile)).not.toMatch(/private.test|PRIVATE_|userId|email|password|token|role/);
  });
  it("matches official ranks, retains historical awards and hides archived details", async () => {
    const owner = await player();
    await capture(owner,{ at: new Date("2026-11-01T12:00:00Z"),status:"archived",award:75 });
    await capture(owner,{ at: new Date("2026-11-03T09:00:00Z"),award:25 });
    for (const scope of ["all","week"] as const) {
      const profile = await getPlayerProfile(store.db,owner,scope,now);
      const board = await getLeaderboard(store.db,owner.id,scope,now);
      expect(profile.stats.rank).toBe(board.viewer!.rank);
      expect(profile.stats.points).toBe(board.viewer!.points);
      expect(profile.stats.solved).toBe(board.viewer!.solves);
      expect(profile.stats.points).toBe(scope === "all" ? 100 : 25);
      expect(profile.stats.firstBloods).toBe(scope === "all" ? 2 : 1);
      expect(profile.activity.items).toHaveLength(1);
      expect(profile.categories.find(c=>c.category==="Forensics")).toMatchObject({ solved:1,points:25 });
      expect(profile.card.scope).toBe(profile.scope.label);
      expect(profile.card.points).toBe(profile.stats.points);
    }
  });
  it("uses the same timestamp/codename ties as the official board and one First Blood on a solve tie", async () => {
    const a = await player("Zeta_fixture"), b = await player("alpha_fixture");
    const first = await capture(a,{ at: now,award:40 });
    await store.db.insert(solves).values({ id:`zz-${randomUUID()}`,userId:b.id,challengeId:first.id,versionId:first.version,createdAt:now });
    const [row] = await store.db.select().from(solves).where(eq(solves.userId,b.id));
    await store.db.insert(xpLedger).values({ id:randomUUID(),userId:b.id,familyId:first.id,solveId:row.id,amount:40 });
    const pa = await getPlayerProfile(store.db,a,"all",now), pb = await getPlayerProfile(store.db,b,"all",now);
    expect(pa.stats.rank!).toBeLessThan(pb.stats.rank!);
    expect(pa.stats.firstBloods).toBe(1); expect(pb.stats.firstBloods).toBe(0);
    expect(pb.activity.items[0].firstBlood).toBe(false);
  });
  it("paginates equal timestamps without duplicates and rejects a cursor from another scope", async () => {
    const owner = await player();
    for (let i=0;i<15;i++) {
      const row=await capture(owner,{ at:new Date(now.getTime()-1000),award:0 });
      // Preserve database precision in cursors, even though displayed JS dates use milliseconds.
      await store.db.execute(sql`update ${solves} set created_at=created_at+(${i+1}::int*interval '1 microsecond') where id=${row.solveId}`);
    }
    const first = await profileActivity(store.db,owner.id,"all",now);
    expect(first.items).toHaveLength(12); expect(first.nextCursor).toBeTruthy();
    const next = await profileActivity(store.db,owner.id,"all",now,first.nextCursor!);
    expect(next.items).toHaveLength(3);
    expect(new Set([...first.items,...next.items].map(item=>item.challengeId)).size).toBe(15);
    await expect(profileActivity(store.db,owner.id,"week",now,first.nextCursor!)).rejects.toMatchObject({code:"INVALID_CURSOR"});
  });
  it("keeps profile, activity, and card First Blood aligned with eligible solvers without rewriting awards", async () => {
    const suspended=await player(),successor=await player();
    const first=await capture(suspended,{at:new Date(now.getTime()-1000),award:100});
    const solveId=randomUUID(),restriction=randomUUID();
    await store.db.insert(solves).values({id:solveId,userId:successor.id,challengeId:first.id,versionId:first.version,createdAt:now});
    await store.db.insert(xpLedger).values({id:randomUUID(),userId:successor.id,familyId:first.id,solveId,amount:50});
    await store.db.insert(allowlist).values({id:restriction,email:suspended.email,revokedAt:now});
    for(const scope of ["all","week"] as const) {
      const profile=await getPlayerProfile(store.db,successor,scope,now);
      expect(profile.stats).toMatchObject({points:50,solved:1,firstBloods:1});
      expect(profile.activity.items[0].firstBlood).toBe(true);
      expect(profile.card.firstBloods).toBe(1);
      expect(profile.card.milestones.map(m=>m.id)).toContain("first-blood");
    }
    await expect(viewPlayer(store.db,successor.id,suspended.codename!,"all",now)).rejects.toMatchObject({status:404});
    const visible=await viewPlayer(store.db,suspended.id,successor.codename!,"all",now);
    expect(visible.stats.firstBloods).toBe(1);
    expect(JSON.stringify(visible)).not.toMatch(/private\.test|PRIVATE_|"userId"|"email"|"card"|"solution"|"flagHash"/);
    await store.db.update(allowlist).set({revokedAt:null}).where(eq(allowlist.id,restriction));
    const restored=await getPlayerProfile(store.db,suspended,"all",now),later=await getPlayerProfile(store.db,successor,"all",now);
    expect(restored.stats).toMatchObject({points:100,solved:1,firstBloods:1});
    expect(later.stats).toMatchObject({points:50,solved:1,firstBloods:0});
    expect(later.activity.items[0].firstBlood).toBe(false);
    expect(later.card.firstBloods).toBe(0);
    expect(later.card.milestones.map(m=>m.id)).not.toContain("first-blood");
    expect(await store.db.select().from(solves).where(eq(solves.challengeId,first.id))).toHaveLength(2);
    expect(await store.db.select().from(xpLedger).where(eq(xpLedger.familyId,first.id))).toHaveLength(2);
  });
  it("validates owner-only writes, rejects mass assignment and unsafe URLs, and isolates accounts", async () => {
    const owner = await player(), other = await player();
    const fields = { displayName:"Learner <&>",bio:"Learning in public",websiteUrl:"https://example.test/",githubUrl:"https://github.com/example" };
    await savePlayerProfile(store.db,owner,fields);
    expect((await getPlayerProfile(store.db,other,"all",now)).identity.displayName).toBe("");
    expect((await getPlayerProfile(store.db,owner,"all",now)).identity.displayName).toBe(fields.displayName);
    for (const value of ["javascript:alert(1)","data:text/html,hi","https://user:password@example.test","not a URL"]) {
      expect(profileInput.safeParse({...fields,websiteUrl:value}).success).toBe(false);
      expect(profileInput.safeParse({...fields,githubUrl:value}).success).toBe(false);
    }
    expect(profileInput.safeParse({...fields,displayName:"Invalid \ud800"}).success).toBe(false);
    const dbMock=vi.spyOn(database,"getDb").mockResolvedValue(store.db);
    const authMock=vi.spyOn(access,"requireAccess").mockResolvedValue({user:owner,session:{id:"test"}});
    vi.stubEnv("APP_URL","http://localhost:3000");
    const log=vi.spyOn(console,"error").mockImplementation(()=>{});
    try {
      const response=await PATCH(new Request("http://localhost:3000/api/v1/profile",{method:"PATCH",headers:{origin:"http://localhost:3000","content-type":"application/json","x-dfctf-account":owner.id},body:JSON.stringify({...fields,userId:other.id,points:999})}),{});
      expect(response.status).toBe(422);
      const switchedAccount=await PATCH(new Request("http://localhost:3000/api/v1/profile",{method:"PATCH",headers:{origin:"http://localhost:3000","content-type":"application/json","x-dfctf-account":other.id},body:JSON.stringify(fields)}),{});
      expect(switchedAccount.status).toBe(409);
      expect(await switchedAccount.json()).toMatchObject({error:{code:"ACCOUNT_CHANGED"}});
      expect((await getPlayerProfile(store.db,owner,"all",now)).identity.displayName).toBe(fields.displayName);
      const own=await GET(new Request(`http://localhost:3000/api/v1/profile?userId=${other.id}`),{});
      expect((await own.json()).identity.codename).toBe(owner.codename);
      authMock.mockRejectedValue(new HttpError(401,"SIGN_IN_REQUIRED","Sign in to continue."));
      expect((await GET(new Request("http://localhost:3000/api/v1/profile"),{})).status).toBe(401);
    } finally { authMock.mockRestore();dbMock.mockRestore();log.mockRestore();vi.unstubAllEnvs(); }
  });
});
