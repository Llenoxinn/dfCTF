import { requireAccess } from "@/server/access";
import { getDb } from "@/server/db";
import { json, route } from "@/server/http";
import { directoryInput, listPlayers } from "@/server/socials";

export const GET=route(async request=>{
  const {user}=await requireAccess(request.headers);
  const params=new URL(request.url).searchParams;
  const input=directoryInput.parse({q:params.get("q")??"",cursor:params.get("cursor")??undefined});
  return json(await listPlayers(await getDb(),user.id,input));
});
