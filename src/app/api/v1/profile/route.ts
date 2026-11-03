import { z } from "zod";
import { requireAccess } from "@/server/access";
import { getDb } from "@/server/db";
import { json, readJson, route } from "@/server/http";
import { getPlayerProfile, profileInput, savePlayerProfile } from "@/server/player-profile";

export const runtime = "nodejs";
export const GET = route(async request => {
  const { user } = await requireAccess(request.headers);
  const scope = z.enum(["all", "week"]).parse(new URL(request.url).searchParams.get("scope") ?? "all");
  return json(await getPlayerProfile(await getDb(),user,scope));
});
export const PATCH = route(async request => {
  const { user } = await requireAccess(request.headers);
  const input = await readJson(request,profileInput);
  return json(await savePlayerProfile(await getDb(),user,input));
});
