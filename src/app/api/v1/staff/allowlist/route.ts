import { randomUUID } from "node:crypto";
import { z } from "zod";
import { and,gt,isNull,or } from "drizzle-orm";
import { route,json,readJson,HttpError } from "@/server/http";
import { requireAccess } from "@/server/access";
import { getDb } from "@/server/db";
import { allowlist } from "@/server/schema";
import { audit } from "@/server/challenges";
async function admin(request:Request){const access=await requireAccess(request.headers,{staff:true});if(access.user.role!=="admin")throw new HttpError(403,"FORBIDDEN","Only administrators can manage access.");return access;}
export const GET=route(async request=>{await admin(request);return json(await (await getDb()).select().from(allowlist).where(and(isNull(allowlist.revokedAt),or(isNull(allowlist.expiresAt),gt(allowlist.expiresAt,new Date())))));});
export const POST=route(async request=>{
  const {user}=await admin(request);const {email}=await readJson(request,z.object({email:z.email().max(254).transform(v=>v.toLowerCase())}).strict());const db=await getDb();
  const [entry]=await db.insert(allowlist).values({id:randomUUID(),email}).onConflictDoUpdate({target:allowlist.email,set:{revokedAt:null,expiresAt:null}}).returning();await audit(db,user.id,"allowlist.add",entry.id);return json(entry,201);
});
