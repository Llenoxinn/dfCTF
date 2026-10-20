import { eq } from "drizzle-orm";
import { route,json,HttpError } from "@/server/http";
import { requireAccess } from "@/server/access";
import { getDb } from "@/server/db";
import { allowlist } from "@/server/schema";
import { audit } from "@/server/challenges";
export const DELETE=route(async(request,context)=>{
  const {user}=await requireAccess(request.headers,{staff:true});if(user.role!=="admin")throw new HttpError(403,"FORBIDDEN","Only administrators can manage access.");const {id}=await context.params;const db=await getDb();
  const [entry]=await db.select().from(allowlist).where(eq(allowlist.id,id));if(!entry)throw new HttpError(404,"NOT_FOUND","Access entry unavailable.");
  if(entry.email===user.email.toLowerCase())throw new HttpError(409,"SELF_REVOKE","Use the server administration command to revoke your own access.");
  await db.update(allowlist).set({revokedAt:new Date()}).where(eq(allowlist.id,id));await audit(db,user.id,"allowlist.revoke",id);return json({revoked:true});
});
