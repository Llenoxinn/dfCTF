import { z } from "zod";
import { requireAccess } from "@/server/access";
import { getDb } from "@/server/db";
import { json, route } from "@/server/http";
import { playerName, viewPlayer } from "@/server/socials";

export const GET=route(async (request,context)=>{
  const {user}=await requireAccess(request.headers);
  const name=playerName.parse((await context.params).codename);
  const scope=z.enum(["all","week"]).parse(new URL(request.url).searchParams.get("scope")??"all");
  return json(await viewPlayer(await getDb(),user.id,name,scope));
});
