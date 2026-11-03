import { z } from "zod";
import { requireAccess } from "@/server/access";
import { getDb } from "@/server/db";
import { json, route } from "@/server/http";
import { profileActivity } from "@/server/player-profile";

export const GET = route(async request => {
  const { user } = await requireAccess(request.headers);
  const params = new URL(request.url).searchParams;
  const scope = z.enum(["all", "week"]).parse(params.get("scope") ?? "all");
  const cursor = z.string().max(500).optional().parse(params.get("cursor") ?? undefined);
  return json(await profileActivity(await getDb(),user.id,scope,new Date(),cursor));
});
