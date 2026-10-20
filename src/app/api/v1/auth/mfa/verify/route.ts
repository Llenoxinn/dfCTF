import { z } from "zod";
import { getViewer, markStaffVerified, requireAccess } from "@/server/access";
import { forwardAuthCookies, headersAfterAuth, invokeAuth } from "@/server/auth";
import { HttpError, json, readJson, route } from "@/server/http";

export const runtime = "nodejs";
export const POST = route(async (request) => {
  const body = await readJson(request, z.object({
    code: z.string().trim().min(1).max(64),
    method: z.enum(["totp", "backup"]).default("totp"),
  }));
  const current = await getViewer(request.headers);
  if (current) {
    await requireAccess(request.headers);
  }
  const endpoint = body.method === "backup" ? "/two-factor/verify-backup-code" : "/two-factor/verify-totp";
  const response = await invokeAuth(request, endpoint, { code: body.code, trustDevice: false });
  if (!response.ok) {
    const result = await response.json() as { code?: string; message?: string };
    throw new HttpError(response.status, result.code || "MFA_VERIFICATION_FAILED", result.message || "That authenticator code could not be verified.");
  }
  // Enrollment and credential challenges can rotate/create the session. Resolve
  // the session from the returned cookies before granting any staff permission.
  const access = await requireAccess(headersAfterAuth(request, response));
  await markStaffVerified(access);
  const output = json({ verified: true });
  forwardAuthCookies(response, output);
  return output;
});
