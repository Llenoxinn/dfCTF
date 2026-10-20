import { eq } from "drizzle-orm";
import { z } from "zod";
import { route,json,readJson,HttpError } from "@/server/http";
import { requireAccess } from "@/server/access";
import { getDb } from "@/server/db";
import { user as users } from "@/server/schema";
import { codenameSchema,codenameKey } from "@/server/validation";
import { audit } from "@/server/challenges";
export const GET=route(async request=>json((await requireAccess(request.headers)).user));
export const PATCH=route(async request=>{
  const {user}=await requireAccess(request.headers);const body=await readJson(request,z.object({codename:codenameSchema}).strict());
  const db=await getDb();
  if(user.codename&&user.codename!==body.codename)throw new HttpError(409,"CODENAME_LOCKED","Codename changes require staff help during the private MVP.");
  const [existing]=await db.select({id:users.id}).from(users).where(eq(users.codenameKey,codenameKey(body.codename)));
  if(existing&&existing.id!==user.id)throw new HttpError(409,"CODENAME_TAKEN","That codename or a similar spelling is already in use.");
  await db.update(users).set({codename:body.codename,codenameKey:codenameKey(body.codename)}).where(eq(users.id,user.id));
  await audit(db,user.id,"profile.codename",user.id);return json({...user,codename:body.codename});
});
