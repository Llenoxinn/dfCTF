import { z } from "zod";
import { requireAccess } from "@/server/access";
import { forwardAuthCookies, invokeAuth } from "@/server/auth";
import { HttpError, json, readJson, route } from "@/server/http";

export const runtime = "nodejs";
export const POST = route(async (request) => {
  await requireAccess(request.headers);
  const body = await readJson(request, z.object({ password: z.string().max(128).optional() }));
  const response = await invokeAuth(request, "/two-factor/enable", { ...body, method: "totp" });
  const result = await response.json() as { code?: string; message?: string; totpURI?: string; backupCodes?: string[] };
  if (!response.ok) throw new HttpError(response.status, result.code || "MFA_SETUP_FAILED", result.message || "Could not start authenticator setup.");
  if (!result.totpURI || !Array.isArray(result.backupCodes)) throw new HttpError(500, "MFA_SETUP_FAILED", "Could not start authenticator setup.");
  const output = json({ totpURI: result.totpURI, backupCodes: result.backupCodes });
  forwardAuthCookies(response, output);
  return output;
});
