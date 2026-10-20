import { and, eq, gt } from "drizzle-orm";
import type { Viewer } from "@/lib/types";
import { getDb } from "./db";
import { getAuth, isEmailAllowed } from "./auth";
import { user, session, staffVerification } from "./auth-schema";
import { HttpError } from "./http";

export type Access = { user: Viewer; session: { id: string } };

export async function getViewer(headers: Headers): Promise<Access | null> {
  const authSession = await (await getAuth()).api.getSession({ headers, query: { disableCookieCache: true } });
  if (!authSession) return null;
  // Read current server-owned identity fields; provider names never become public codenames.
  const db = await getDb();
  const [identity] = await db.select({
    id: user.id, email: user.email, codename: user.codename,
    emailVerified: user.emailVerified, role: user.role, twoFactorEnabled: user.twoFactorEnabled,
  }).from(user).where(eq(user.id, authSession.user.id)).limit(1);
  return identity ? { user: identity, session: { id: authSession.session.id } } : null;
}

export async function hasStaffVerification(access: Access) {
  if (!access.user.twoFactorEnabled || access.user.role === "participant") return false;
  const db = await getDb();
  const [verification] = await db.select({ id: staffVerification.sessionId }).from(staffVerification).where(and(
    eq(staffVerification.sessionId, access.session.id), gt(staffVerification.expiresAt, new Date()),
  )).limit(1);
  return Boolean(verification);
}

export async function requireAccess(headers: Headers, options: { staff?: boolean } = {}): Promise<Access> {
  const access = await getViewer(headers);
  if (!access) throw new HttpError(401, "SIGN_IN_REQUIRED", "Sign in to continue.");
  if (!access.user.emailVerified) throw new HttpError(403, "EMAIL_UNVERIFIED", "Verify your email before continuing.");
  if (!(await isEmailAllowed(access.user.email))) throw new HttpError(403, "ACCESS_REVOKED", "Your account does not currently have access to dfCTF.");
  if (options.staff) {
    if (access.user.role === "participant") throw new HttpError(403, "STAFF_REQUIRED", "This action requires staff access.");
    if (!(await hasStaffVerification(access))) throw new HttpError(403, "MFA_REQUIRED", "Verify your authenticator code to continue with staff tools.");
  }
  return access;
}

export async function markStaffVerified(access: Access) {
  if (!access.user.twoFactorEnabled) throw new HttpError(403, "MFA_REQUIRED", "Complete authenticator setup first.");
  const db = await getDb();
  const [activeSession] = await db.select({ expiresAt: session.expiresAt }).from(session).where(eq(session.id, access.session.id)).limit(1);
  if (!activeSession) throw new HttpError(401, "SIGN_IN_REQUIRED", "Sign in to continue.");
  const now = new Date();
  const expiresAt = new Date(Math.min(now.getTime() + 12 * 60 * 60 * 1000, activeSession.expiresAt.getTime()));
  await db.insert(staffVerification).values({ sessionId: access.session.id, verifiedAt: now, expiresAt }).onConflictDoUpdate({
    target: staffVerification.sessionId, set: { verifiedAt: now, expiresAt },
  });
}

