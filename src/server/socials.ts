import { and, eq, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "./db";
import { allowlist, friendships, playerProfiles, user } from "./schema";
import { HttpError } from "./http";
import { getPlayerProfile } from "./player-profile";
import { consumeLimit } from "./challenges";
import type { ProfileScope } from "@/lib/player-profile";
import type { FriendAction, FriendshipState, PlayerPage, SocialKind, ViewedPlayer } from "@/lib/socials";

export const playerName = z.string().min(3).max(24).regex(/^[a-zA-Z0-9_.-]+$/);
export const friendInput = z.object({ codename: playerName, action: z.enum(["request", "accept", "decline", "cancel", "remove"]) }).strict();
export const directoryInput = z.object({ q: z.string().trim().max(24).regex(/^[a-zA-Z0-9_.-]*$/).default(""), cursor: z.string().max(300).optional() });
export const socialInput = z.object({ kind: z.enum(["friends", "incoming", "outgoing"]).default("friends"), cursor: z.string().max(300).optional() });
const nameKey = sql<string>`lower(${user.codename}) collate "C"`;
const eligible = (now: Date) => sql`${user.emailVerified}=true and ${user.codename} is not null and ${user.codename}<>''
  and not exists(select 1 from ${allowlist} where ${allowlist.email}=${user.email}
    and (${allowlist.revokedAt} is not null or ${allowlist.expiresAt}<=${now}))`;
const pair = (a: string, b: string) => a < b ? [a,b] as const : [b,a] as const;
const pairWhere = (a: string,b: string) => { const [low,high]=pair(a,b);return and(eq(friendships.lowUserId,low),eq(friendships.highUserId,high)); };

function state(row: { status: string; requestedBy: string } | undefined, viewerId: string): FriendshipState {
  if (!row || row.status === "declined") return "none";
  return row.status === "accepted" ? "friends" : row.requestedBy === viewerId ? "outgoing" : "incoming";
}
async function targetPlayer(db: Database, codename: string, now: Date) {
  const [target] = await db.select({ id:user.id,codename:user.codename }).from(user)
    .where(and(sql`${nameKey}=${playerName.parse(codename).toLowerCase()}`,eligible(now))).limit(1);
  if (!target) throw new HttpError(404,"PLAYER_UNAVAILABLE","This player is unavailable.");
  return { id:target.id,codename:target.codename! };
}
export async function relationship(db: Database, viewerId: string, otherId: string): Promise<FriendshipState> {
  if(viewerId===otherId)return "self";
  const [row]=await db.select({status:friendships.status,requestedBy:friendships.requestedBy}).from(friendships).where(pairWhere(viewerId,otherId)).limit(1);
  return state(row,viewerId);
}

const cursorValue = z.object({ key:z.string().max(24).regex(/^[a-z0-9_.-]+$/), filter:z.string().max(40) }).strict();
function afterCursor(cursor:string|undefined,filter:string) {
  if(!cursor)return null;
  try { const value=cursorValue.parse(JSON.parse(Buffer.from(cursor,"base64url").toString("utf8")));if(value.filter===filter)return value.key; }catch{}
  throw new HttpError(422,"INVALID_CURSOR","Refresh this player list to continue.");
}

export async function listPlayers(db: Database, viewerId: string, options: {q?:string;cursor?:string;kind?:SocialKind}={}, now=new Date()):Promise<PlayerPage> {
  const q=directoryInput.shape.q.parse(options.q),kind=options.kind;
  const filter=kind??`search:${q.toLowerCase()}`,after=afterCursor(options.cursor,filter);
  const relationshipFilter = kind === "friends" ? sql`${friendships.status}='accepted'`
    : kind === "incoming" ? sql`${friendships.status}='pending' and ${friendships.requestedBy}<>${viewerId}`
    : kind === "outgoing" ? sql`${friendships.status}='pending' and ${friendships.requestedBy}=${viewerId}` : sql`true`;
  const rows=await db.select({codename:user.codename,displayName:sql<string>`case when ${playerProfiles.shareProfile} then ${playerProfiles.displayName} else '' end`,status:friendships.status,requestedBy:friendships.requestedBy,key:nameKey})
    .from(user).leftJoin(playerProfiles,eq(playerProfiles.userId,user.id))
    .leftJoin(friendships,sql`(${friendships.lowUserId}=${viewerId} and ${friendships.highUserId}=${user.id}) or (${friendships.highUserId}=${viewerId} and ${friendships.lowUserId}=${user.id})`)
    .where(and(eligible(now),sql`${user.id}<>${viewerId}`,relationshipFilter,
      q?sql`${nameKey}>=${q.toLowerCase()} and ${nameKey}<${q.toLowerCase()+"\uffff"}`:sql`true`,after?sql`${nameKey}>${after}`:sql`true`))
    .orderBy(nameKey).limit(21);
  const visible=rows.slice(0,20),last=visible.at(-1);
  return {items:visible.map(row=>({codename:row.codename!,displayName:row.displayName??"",relationship:state(row.status&&row.requestedBy?{status:row.status,requestedBy:row.requestedBy}:undefined,viewerId)})),nextCursor:rows.length>20&&last?Buffer.from(JSON.stringify({key:last.key,filter})).toString("base64url"):null};
}

export async function viewPlayer(db: Database,viewerId:string,codename:string,scope:ProfileScope,now=new Date()):Promise<ViewedPlayer> {
  const target=await targetPlayer(db,codename,now);
  const [profile,connection]=await Promise.all([getPlayerProfile(db,target,scope,now),relationship(db,viewerId,target.id)]);
  const shared=profile.identity.shareProfile;
  // Explicit projection: the other player's auth record, export inputs and friend list never leave the server.
  return {
    identity:{codename:target.codename,displayName:shared?profile.identity.displayName:"",bio:shared?profile.identity.bio:"",websiteUrl:shared?profile.identity.websiteUrl:"",githubUrl:shared?profile.identity.githubUrl:""},
    detailsShared:shared,relationship:connection,scope:profile.scope,asOf:profile.asOf,stats:profile.stats,categories:profile.categories,milestones:profile.milestones,activity:profile.activity.items,
  };
}

export async function changeFriendship(db: Database,viewerId:string,codename:string,action:FriendAction,now=new Date()) {
  const target=await targetPlayer(db,codename,now);
  if(target.id===viewerId)throw new HttpError(422,"SELF_REQUEST","This is your own profile.");
  if(action==="request") {
    await consumeLimit(db,`friends:request:${viewerId}`,20,86_400_000);
    const [lowUserId,highUserId]=pair(viewerId,target.id);
    // One canonical pair: repeated and simultaneous cross-requests cannot create duplicate friendships.
    await db.insert(friendships).values({lowUserId,highUserId,requestedBy:viewerId,status:"pending",updatedAt:now}).onConflictDoNothing();
    const [existing]=await db.select().from(friendships).where(pairWhere(viewerId,target.id)).limit(1);
    if(existing?.status==="declined") {
      if(existing.requestedBy===viewerId&&now.getTime()-existing.updatedAt.getTime()<7*86_400_000)throw new HttpError(429,"REQUEST_COOLDOWN","A friend request between you and this player was declined. You can send another request seven days after that decline.");
      await db.update(friendships).set({status:"pending",requestedBy:viewerId,updatedAt:now}).where(and(pairWhere(viewerId,target.id),eq(friendships.status,"declined"),or(sql`${friendships.requestedBy}<>${viewerId}`,sql`${friendships.updatedAt}<=${new Date(now.getTime()-7*86_400_000)}`)));
    }
  } else {
    await consumeLimit(db,`friends:manage:${viewerId}`,60);
    const incoming=and(pairWhere(viewerId,target.id),eq(friendships.status,"pending"),sql`${friendships.requestedBy}<>${viewerId}`);
    const changed=action==="accept"||action==="decline"
      ?await db.update(friendships).set({status:action==="accept"?"accepted":"declined",updatedAt:now}).where(incoming).returning({id:friendships.lowUserId})
      :await db.delete(friendships).where(and(pairWhere(viewerId,target.id),eq(friendships.status,action==="cancel"?"pending":"accepted"),action==="cancel"?eq(friendships.requestedBy,viewerId):sql`true`)).returning({id:friendships.lowUserId});
    if(!changed.length)throw new HttpError(409,"RELATIONSHIP_CHANGED","This connection changed. Refresh before trying again.");
  }
  return {relationship:await relationship(db,viewerId,target.id)};
}
