import { route,json } from "@/server/http";
import { getDb } from "@/server/db";
import { getCommunity } from "@/server/community";
import type { Community } from "@/lib/types";

// shortcut: reuse is per instance for 30 seconds; use a shared cache if cross-instance traffic warrants it.
let cached:Community|undefined,expiresAt=0,pending:Promise<Community>|undefined;
// Public on purpose: the landing page shows codenames, challenge titles, and counts. No emails, files, or flags.
export const GET=route(async()=>{
  if(cached&&Date.now()<expiresAt)return json(cached);
  pending??=getDb().then(db=>getCommunity(db)).then(value=>{
    cached=value;expiresAt=Date.now()+30_000;return value;
  }).finally(()=>{pending=undefined;});
  return json(await pending);
});
