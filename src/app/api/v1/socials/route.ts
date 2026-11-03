import { requireAccess } from "@/server/access";
import { getDb } from "@/server/db";
import { json, readJson, route } from "@/server/http";
import { changeFriendship, friendInput, listPlayers, socialInput } from "@/server/socials";

export const GET=route(async request=>{
  const {user}=await requireAccess(request.headers);
  const params=new URL(request.url).searchParams;
  const input=socialInput.parse({kind:params.get("kind")??"friends",cursor:params.get("cursor")??undefined});
  return json(await listPlayers(await getDb(),user.id,input));
});
export const POST=route(async request=>{
  const {user}=await requireAccess(request.headers);
  const input=await readJson(request,friendInput);
  return json(await changeFriendship(await getDb(),user.id,input.codename,input.action));
});
