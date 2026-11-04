import { z } from "zod";
import { requireAccess } from "@/server/access";
import { getDb } from "@/server/db";
import { HttpError, json, readJson, route } from "@/server/http";
import { getPlayerProfile, profileInput, savePlayerProfile } from "@/server/player-profile";

export const runtime = "nodejs";
export const GET = route(async request => {
  const { user } = await requireAccess(request.headers);
  const scope = z.enum(["all", "week"]).parse(new URL(request.url).searchParams.get("scope") ?? "all");
  return json(await getPlayerProfile(await getDb(),user,scope));
});
export const PATCH = route(async request => {
  const { user } = await requireAccess(request.headers);
  if (request.headers.get("x-dfctf-account") !== user.id) throw new HttpError(409, "ACCOUNT_CHANGED", "Your signed-in account changed. Refresh this page before saving.");
  const input = await readJson(request,profileInput);
  return json(await savePlayerProfile(await getDb(),user,input));
});
