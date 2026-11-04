import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { createStore } from "@/server/db";
import { allowlist, challenges, challengeVersions, friendships, user, solves, xpLedger } from "@/server/schema";
import { changeFriendship, listPlayers, relationship, viewPlayer } from "@/server/socials";
import { getPlayerProfile, savePlayerProfile } from "@/server/player-profile";
import { HttpError } from "@/server/http";
import * as access from "@/server/access";
import * as database from "@/server/db";
import { GET as directory } from "@/app/api/v1/players/route";
import { GET as socialList, POST as connect } from "@/app/api/v1/socials/route";
import { GET as playerRoute } from "@/app/api/v1/players/[codename]/route";
import type { Viewer } from "@/lib/types";

let store: Awaited<ReturnType<typeof createStore>>;
const now=new Date("2026-11-03T10:00:00Z");
async function player(codename=`social_${randomUUID().slice(0,8)}`,verified=true):Promise<Viewer>{
  const viewer:Viewer={id:randomUUID(),email:`${randomUUID()}@private.test`,codename,emailVerified:verified,role:"participant",twoFactorEnabled:false};
  await store.db.insert(user).values({...viewer,name:"PRIVATE_PROVIDER_NAME",image:"https://private.test/avatar",codenameKey:codename.toLowerCase()});return viewer;
}
const fields={displayName:"PRIVATE_DISPLAY_NAME",bio:"PRIVATE_BIO",websiteUrl:"https://private.test",githubUrl:"https://github.com/fixture-user"};
beforeAll(async()=>{store=await createStore(undefined,true);await store.migrate();});
afterAll(async()=>{await store?.close();});

describe("player discovery and connections",()=>{
  it("keeps optional details private until explicit opt-in, even for friends, and never exposes auth records",async()=>{
    const owner=await player(),viewer=await player();await savePlayerProfile(store.db,owner,fields);
    const before=await viewPlayer(store.db,viewer.id,owner.codename!,"all",now);
    expect(before.identity).toEqual({codename:owner.codename,displayName:"",bio:"",websiteUrl:"",githubUrl:""});
    await changeFriendship(store.db,viewer.id,owner.codename!,"request",now);await changeFriendship(store.db,owner.id,viewer.codename!,"accept",now);
    expect((await viewPlayer(store.db,viewer.id,owner.codename!,"all",now)).identity.bio).toBe("");
    await savePlayerProfile(store.db,owner,{...fields,shareProfile:true});
    const shared=await viewPlayer(store.db,viewer.id,owner.codename!.toUpperCase(),"all",now);
    expect(shared.identity).toEqual({codename:owner.codename,...fields});expect(shared.relationship).toBe("friends");
    expect(shared.detailsShared).toBe(true);
    expect(JSON.stringify(shared)).not.toMatch(/PRIVATE_PROVIDER_NAME|avatar|userId|email|password|token|requestedBy|nextCursor|shareProfile/);
    expect(JSON.stringify(shared)).not.toContain(owner.id);
    // Old clients omitting the new flag must not silently reset its saved value.
    await savePlayerProfile(store.db,owner,fields);expect((await getPlayerProfile(store.db,owner,"all",now)).identity.shareProfile).toBe(true);
    await savePlayerProfile(store.db,owner,{...fields,shareProfile:false});expect((await viewPlayer(store.db,viewer.id,owner.codename!,"all",now)).identity.bio).toBe("");
  });
  it("reuses scoped authoritative scores and hides archived and competition challenge details",async()=>{
    const owner=await player(),viewer=await player();
    for(const [status,visibility,title] of [["published","practice","Visible fixture"],["archived","practice","PRIVATE_ARCHIVED_TITLE"],["published","competition","PRIVATE_EVENT_TITLE"]] as const){
      const id=randomUUID(),version=randomUUID(),solveId=randomUUID();
      await store.db.insert(challenges).values({id,slug:id,familyId:id,authorId:owner.id,status,visibility});
      await store.db.insert(challengeVersions).values({id:version,challengeId:id,version:1,title,summary:"fixture",description:"PRIVATE_DESCRIPTION",solution:"PRIVATE_SOLUTION",flagHash:"PRIVATE_FLAG",category:"Forensics",difficulty:"Easy",tags:[],xp:999,estimatedMinutes:5});
      if(visibility==="practice"){
        await store.db.insert(solves).values({id:solveId,userId:owner.id,challengeId:id,versionId:version,createdAt:now});
        await store.db.insert(xpLedger).values({id:randomUUID(),userId:owner.id,familyId:id,solveId,amount:25});
      }
    }
    for(const scope of ["all","week"] as const){const viewed=await viewPlayer(store.db,viewer.id,owner.codename!,scope,now),own=await getPlayerProfile(store.db,owner,scope,now);expect(viewed.stats).toEqual(own.stats);expect(viewed.scope).toEqual(own.scope);expect(viewed.activity).toHaveLength(1);expect(viewed.activity[0].title).toBe("Visible fixture");expect(JSON.stringify(viewed)).not.toContain("PRIVATE_");}
  });
  it("deduplicates cross-requests and permits acceptance only by the recipient",async()=>{
    const a=await player(),b=await player(),third=await player();
    await Promise.all([changeFriendship(store.db,a.id,b.codename!,"request",now),changeFriendship(store.db,b.id,a.codename!,"request",now),changeFriendship(store.db,a.id,b.codename!,"request",now)]);
    const rows=await store.db.select().from(friendships).where(sql`${friendships.lowUserId} in (${a.id},${b.id}) and ${friendships.highUserId} in (${a.id},${b.id})`);expect(rows).toHaveLength(1);
    const sender=rows[0].requestedBy===a.id?a:b,recipient=sender.id===a.id?b:a;
    expect(await relationship(store.db,sender.id,recipient.id)).toBe("outgoing");expect(await relationship(store.db,recipient.id,sender.id)).toBe("incoming");
    await expect(changeFriendship(store.db,sender.id,recipient.codename!,"accept",now)).rejects.toMatchObject({status:409});
    await expect(changeFriendship(store.db,third.id,recipient.codename!,"accept",now)).rejects.toMatchObject({status:409});
    await expect(changeFriendship(store.db,recipient.id,sender.codename!,"cancel",now)).rejects.toMatchObject({status:409});
    expect(await changeFriendship(store.db,recipient.id,sender.codename!,"accept",now)).toEqual({relationship:"friends"});
    expect((await listPlayers(store.db,sender.id,{kind:"friends"},now)).items.map(p=>p.codename)).toEqual([recipient.codename]);
    expect((await listPlayers(store.db,third.id,{kind:"friends"},now)).items).toEqual([]);
    await changeFriendship(store.db,sender.id,recipient.codename!,"remove",now);expect(await relationship(store.db,recipient.id,sender.id)).toBe("none");
    await expect(changeFriendship(store.db,a.id,a.codename!,"request",now)).rejects.toMatchObject({status:422});
  });
  it("supports cancellation and decline cooldown without pretending a rejection is an accepted friendship",async()=>{
    const a=await player(),b=await player();
    await changeFriendship(store.db,a.id,b.codename!,"request",now);await changeFriendship(store.db,a.id,b.codename!,"cancel",now);
    expect((await listPlayers(store.db,a.id,{kind:"outgoing"},now)).items).toEqual([]);
    await changeFriendship(store.db,a.id,b.codename!,"request",now);await changeFriendship(store.db,b.id,a.codename!,"decline",now);
    expect(await relationship(store.db,a.id,b.id)).toBe("none");await expect(changeFriendship(store.db,a.id,b.codename!,"request",now)).rejects.toMatchObject({status:429,code:"REQUEST_COOLDOWN",message:"A friend request between you and this player was declined. You can send another request seven days after that decline."});
    expect((await listPlayers(store.db,b.id,{kind:"incoming"},now)).items).toEqual([]);
    await expect(changeFriendship(store.db,a.id,b.codename!,"cancel",now)).rejects.toMatchObject({status:409});
    await expect(changeFriendship(store.db,a.id,b.codename!,"request",new Date(now.getTime()+7*86_400_000-1))).rejects.toMatchObject({code:"REQUEST_COOLDOWN"});
    const later=new Date(now.getTime()+7*86_400_000);expect(await changeFriendship(store.db,a.id,b.codename!,"request",later)).toEqual({relationship:"outgoing"});
  });
  it("limits repeated requests instead of allowing unlimited notification spam",async()=>{
    const a=await player(),b=await player();
    for(let i=0;i<20;i++)await changeFriendship(store.db,a.id,b.codename!,"request",now);
    await expect(changeFriendship(store.db,a.id,b.codename!,"request",now)).rejects.toMatchObject({status:429});
    expect(await relationship(store.db,b.id,a.id)).toBe("incoming");
  });
  it("paginates searchable directory rows, omits inactive accounts and private display names",async()=>{
    const owner=await player(),prefix=`dir_${randomUUID().slice(0,5)}`;
    const players=[];for(let i=0;i<23;i++)players.push(await player(`${prefix}_${String(i).padStart(2,"0")}`));
    await savePlayerProfile(store.db,players[0],fields);
    await savePlayerProfile(store.db,players[1],{...fields,displayName:"Shared fixture",shareProfile:true});
    await player(`${prefix}_unverified`,false);const suspended=await player(`${prefix}_suspended`);
    await store.db.insert(allowlist).values({id:randomUUID(),email:suspended.email,revokedAt:now});
    const first=await listPlayers(store.db,owner.id,{q:prefix.toUpperCase()},now);expect(first.items).toHaveLength(20);expect(first.items[0].displayName).toBe("");expect(first.items[1].displayName).toBe("Shared fixture");
    const next=await listPlayers(store.db,owner.id,{q:prefix,cursor:first.nextCursor!},now);expect(next.items).toHaveLength(3);expect(new Set([...first.items,...next.items].map(p=>p.codename)).size).toBe(23);expect(next.nextCursor).toBeNull();
    await expect(listPlayers(store.db,owner.id,{kind:"friends",cursor:first.nextCursor!},now)).rejects.toMatchObject({status:422});
    await expect(viewPlayer(store.db,owner.id,suspended.codename!,"all",now)).rejects.toMatchObject({status:404});
    await expect(changeFriendship(store.db,owner.id,suspended.codename!,"request",now)).rejects.toMatchObject({status:404});
  });
  it("protects APIs with session, origin and strict schemas, ignoring forged viewer IDs",async()=>{
    const a=await player(),b=await player();const auth=vi.spyOn(access,"requireAccess").mockResolvedValue({user:a,session:{id:"fixture"}}),db=vi.spyOn(database,"getDb").mockResolvedValue(store.db),log=vi.spyOn(console,"warn").mockImplementation(()=>{});
    vi.stubEnv("APP_URL","http://localhost:3000");
    try{
      const post=(body:unknown,origin="http://localhost:3000")=>connect(new Request("http://localhost:3000/api/v1/socials",{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify(body)}),{});
      expect((await post({codename:b.codename,action:"accept",userId:b.id,status:"accepted"})).status).toBe(422);
      expect((await post({codename:b.codename,action:"request"},"https://attacker.test")).status).toBe(403);
      expect((await post({codename:b.codename,action:"request"})).status).toBe(200);
      const list=await socialList(new Request(`http://localhost:3000/api/v1/socials?kind=outgoing&userId=${b.id}`),{});expect((await list.json()).items[0].codename).toBe(b.codename);
      auth.mockRejectedValue(new HttpError(401,"SIGN_IN_REQUIRED","Sign in to continue."));
      expect((await directory(new Request("http://localhost:3000/api/v1/players"),{})).status).toBe(401);
      expect((await playerRoute(new Request("http://localhost:3000/api/v1/players/fixture"),{params:Promise.resolve({codename:b.codename})})).status).toBe(401);
      expect((await post({codename:b.codename,action:"accept"})).status).toBe(401);
    }finally{auth.mockRestore();db.mockRestore();log.mockRestore();vi.unstubAllEnvs();}
  });
});
