import type { Bootstrap } from "@/lib/types";
import { getViewer, hasStaffVerification } from "@/server/access";
import { configuredProviders, isEmailAllowed } from "@/server/auth";
import { json, route } from "@/server/http";
import { localMailEnabled } from "@/server/mail";

export const runtime = "nodejs";
export const GET = route(async (request) => {
  const access = await getViewer(request.headers);
  const hasAccess = Boolean(access && access.user.emailVerified && await isEmailAllowed(access.user.email));
  const bootstrap: Bootstrap = {
    user: access?.user ?? null,
    hasAccess,
    staffVerified: Boolean(access && hasAccess && await hasStaffVerification(access)),
    providers: configuredProviders(),
    localMail: localMailEnabled(),
  };
  return json(bootstrap);
});
