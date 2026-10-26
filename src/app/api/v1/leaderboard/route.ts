import { route,json } from "@/server/http";
import { requireAccess } from "@/server/access";
import { getDb } from "@/server/db";
import { getLeaderboard } from "@/server/community";
export const GET=route(async request=>{
  const {user}=await requireAccess(request.headers);
  const range=new URL(request.url).searchParams.get("range")==="all"?"all":"week";
  return json(await getLeaderboard(await getDb(),user.id,range));
});
