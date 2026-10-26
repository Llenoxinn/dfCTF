import { route,json } from "@/server/http";
import { getDb } from "@/server/db";
import { getCommunity } from "@/server/community";
// Public on purpose: the landing page shows codenames, challenge titles, and counts. No emails, files, or flags.
export const GET=route(async()=>json(await getCommunity(await getDb())));
