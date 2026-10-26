import { requireAccess } from "@/server/access";
import { getDb } from "@/server/db";
import { listCompetitions } from "@/server/competitions";
import { json, route } from "@/server/http";
export const GET=route(async request=>{await requireAccess(request.headers);return json(await listCompetitions(await getDb()));});
