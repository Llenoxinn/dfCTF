import { createHmac, randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createStore } from "@/server/db";
import { createAuth, headersAfterAuth, type Auth } from "@/server/auth";
import { getViewer, hasStaffVerification, markStaffVerified, requireAccess } from "@/server/access";
import { account, allowlist, rateLimit, session, staffVerification, user, verification } from "@/server/schema";
import { POST as setupMfa } from "@/app/api/v1/auth/mfa/setup/route";
import { POST as verifyMfa } from "@/app/api/v1/auth/mfa/verify/route";
import { GET as listAllowlist, POST as addAllowlist } from "@/app/api/v1/staff/allowlist/route";

const outbound = vi.hoisted(() => ({ messages: [] as { to: string; url: string }[] }));
vi.mock("@/server/mail", () => ({
  sendAuthEmail: vi.fn(async (to: string, _subject: string, url: string) => { outbound.messages.push({ to, url }); }),
  localMailEnabled: () => false,
  listLocalMail: async () => [],
}));

const base = "http://localhost:3000";
const password = "a long test password with spaces";
let store: Awaited<ReturnType<typeof createStore>>;
let auth: Auth;
const globals = globalThis as unknown as {
  dfctfStore?: Promise<Awaited<ReturnType<typeof createStore>>>;
  dfctfAuth?: Promise<Auth>;
};

function applicationRequest(path: string, body: unknown, headers = new Headers()) {
  const next = new Headers(headers);
  next.set("origin", base);
  next.set("content-type", "application/json");
  return new Request(new URL(path, base), { method: "POST", headers: next, body: JSON.stringify(body) });
}

// Independent RFC 6238 authenticator: consume the standard base32 URI secret,
// rather than relying on the server's own verification helper in these tests.
function authenticatorCode(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const character of secret.replace(/=/g, "")) bits += alphabet.indexOf(character).toString(2).padStart(5, "0");
  const bytes = Buffer.from(bits.match(/.{8}/g)!.map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac("sha1", bytes).update(counter).digest();
  return ((digest.readUInt32BE(digest.at(-1)! & 15) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
}

async function provision(email: string, role: "participant" | "admin" = "participant") {
  await store.db.insert(allowlist).values({ id: randomUUID(), email });
  const registered = await auth.api.signUpEmail({ body: { email, name: "Private Provider Name", password } });
  const emailMessage = outbound.messages.filter((message) => message.to === email).at(-1)!;
  expect(emailMessage).toBeDefined();
  await auth.api.verifyEmail({ query: { token: new URL(emailMessage.url).searchParams.get("token")! } });
  if (role !== "participant") await store.db.update(user).set({ role }).where(eq(user.id, registered.user.id));
  const response = await auth.api.signInEmail({ body: { email, password }, asResponse: true });
  expect(response.ok).toBe(true);
  const headers = headersAfterAuth(new Request(base), response);
  return { id: registered.user.id, email, headers };
}

beforeAll(async () => {
  process.env.AUTH_SECRET = "test-auth-secret-that-is-at-least-thirty-two-characters";
  process.env.APP_URL = base;
  store = await createStore(undefined, true);
  await store.migrate();
  auth = createAuth(store.db);
  globals.dfctfStore = Promise.resolve(store);
  globals.dfctfAuth = Promise.resolve(auth);
});

afterAll(async () => {
  delete globals.dfctfAuth;
  delete globals.dfctfStore;
  await store?.close();
});
beforeEach(async () => { await store.db.delete(rateLimit); });

describe("authentication and private access", () => {
  it("lists only active access entries and reactivates revoked or expired addresses", async () => {
    const identity=await provision("list-admin@example.test","admin");
    await store.db.update(user).set({twoFactorEnabled:true}).where(eq(user.id,identity.id));
    await markStaffVerified((await getViewer(identity.headers))!);
    const entries=[
      {id:randomUUID(),email:"list-active@example.test"},
      {id:randomUUID(),email:"list-future@example.test",expiresAt:new Date(Date.now()+86_400_000)},
      {id:randomUUID(),email:"list-expired@example.test",expiresAt:new Date(Date.now()-1000)},
      {id:randomUUID(),email:"list-revoked@example.test",revokedAt:new Date()},
    ];
    await store.db.insert(allowlist).values(entries);
    const request=()=>new Request(`${base}/api/v1/staff/allowlist`,{headers:identity.headers});
    const response=await listAllowlist(request(),undefined);
    expect(response.status).toBe(200);
    const emails=(await response.json() as {email:string}[]).map(e=>e.email);
    expect(emails).toContain("list-active@example.test");
    expect(emails).toContain("list-future@example.test");
    expect(emails).not.toContain("list-expired@example.test");
    expect(emails).not.toContain("list-revoked@example.test");
    for(const entry of entries.slice(2)) {
      const restored=await addAllowlist(applicationRequest("/api/v1/staff/allowlist",{email:entry.email},identity.headers),undefined);
      expect(restored.status).toBe(201);
      expect(await restored.json()).toMatchObject({id:entry.id,revokedAt:null,expiresAt:null});
    }
    const restoredEmails=(await (await listAllowlist(request(),undefined)).json() as {email:string}[]).map(e=>e.email);
    expect(restoredEmails).toEqual(expect.arrayContaining(entries.map(e=>e.email)));
  });
  it("rejects signup without an active allowlist entry", async () => {
    // Better Auth deliberately returns a synthetic success for denied signup to
    // avoid disclosing whether an email already exists. No identity is created.
    await auth.api.signUpEmail({ body: { email: "outsider@example.test", name: "Outsider", password } });
    expect(await store.db.select().from(user).where(eq(user.email, "outsider@example.test"))).toHaveLength(0);
    expect(outbound.messages.some((message) => message.to === "outsider@example.test")).toBe(false);
    await store.db.insert(allowlist).values({ id: randomUUID(), email: "expired@example.test", expiresAt: new Date(Date.now() - 1000) });
    await auth.api.signUpEmail({ body: { email: "expired@example.test", name: "Expired", password } });
    expect(await store.db.select().from(user).where(eq(user.email, "expired@example.test"))).toHaveLength(0);
  });

  it("rejects unverified password login and rechecks verification on protected operations", async () => {
    await store.db.insert(allowlist).values({ id: randomUUID(), email: "unverified@example.test" });
    await auth.api.signUpEmail({ body: { email: "unverified@example.test", name: "Private", password } });
    await expect(auth.api.signInEmail({ body: { email: "unverified@example.test", password } })).rejects.toMatchObject({ statusCode: 403 });
    const identity = await provision("verification-revoked@example.test");
    await store.db.update(user).set({ emailVerified: false }).where(eq(user.id, identity.id));
    expect((await getViewer(identity.headers))?.user.emailVerified).toBe(false);
    await expect(requireAccess(identity.headers)).rejects.toMatchObject({ status: 403, code: "EMAIL_UNVERIFIED" });
  });

  it("blocks an existing session and new login immediately after allowlist revocation", async () => {
    const identity = await provision("revoked@example.test");
    expect((await requireAccess(identity.headers)).user.id).toBe(identity.id);
    await store.db.update(allowlist).set({ revokedAt: new Date() }).where(eq(allowlist.email, identity.email));
    await expect(requireAccess(identity.headers)).rejects.toMatchObject({ status: 403, code: "ACCESS_REVOKED" });
    await expect(auth.api.signInEmail({ body: { email: identity.email, password } })).rejects.toMatchObject({ statusCode: 403 });
  });

  it("keeps provider names private and rejects participant staff access", async () => {
    const identity = await provision("participant@example.test");
    const viewer = await getViewer(identity.headers);
    expect(viewer?.user.codename).toBeNull();
    expect(viewer?.user).not.toHaveProperty("name");
    expect(viewer?.user).not.toHaveProperty("image");
    await expect(requireAccess(identity.headers, { staff: true })).rejects.toMatchObject({ status: 403, code: "STAFF_REQUIRED" });
    const [credential] = await store.db.select().from(account).where(eq(account.userId, identity.id));
    expect(credential.password).toMatch(/^\$argon2id\$/);
  });

  it("does not permit role or codename escalation through signup input", async () => {
    const email = "spoofed-role@example.test";
    await store.db.insert(allowlist).values({ id: randomUUID(), email });
    const response = await auth.handler(applicationRequest("/api/auth/sign-up/email", { email, name: "Private", password, role: "admin", codename: "claimed" }));
    const [identity] = await store.db.select().from(user).where(eq(user.email, email));
    if (response.ok) {
      expect(identity.role).toBe("participant");
      expect(identity.codename).toBeNull();
    } else {
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(identity).toBeUndefined();
    }
  });

  it("blocks common passwords even when they meet the minimum length", async () => {
    const email = "common-password@example.test";
    await store.db.insert(allowlist).values({ id: randomUUID(), email });
    await expect(auth.api.signUpEmail({ body: { email, name: "Private", password: "passwordpassword123" } })).rejects.toMatchObject({ statusCode: 400, body: { code: "PASSWORD_TOO_COMMON" } });
    expect(await store.db.select().from(user).where(eq(user.email, email))).toHaveLength(0);
  });

  it("hashes reset-token identifiers, consumes tokens once, and revokes existing sessions", async () => {
    const identity = await provision("password-reset@example.test");
    await auth.api.requestPasswordReset({ body: { email: identity.email, redirectTo: `${base}/reset-password` } });
    const message = outbound.messages.filter((entry) => entry.to === identity.email).at(-1)!;
    const token = new URL(message.url).pathname.split("/").at(-1)!;
    const entries = await store.db.select().from(verification);
    expect(entries.some((entry) => entry.value === identity.id)).toBe(true);
    expect(entries.some((entry) => entry.identifier.includes(token))).toBe(false);
    const nextPassword = "another long and different password";
    await auth.api.resetPassword({ body: { token, newPassword: nextPassword } });
    await expect(requireAccess(identity.headers)).rejects.toMatchObject({ status: 401 });
    await expect(auth.api.resetPassword({ body: { token, newPassword: password } })).rejects.toMatchObject({ statusCode: 400 });
    await expect(auth.api.signInEmail({ body: { email: identity.email, password } })).rejects.toMatchObject({ statusCode: 401 });
    const response = await auth.api.signInEmail({ body: { email: identity.email, password: nextPassword }, asResponse: true });
    expect(response.status).toBe(200);
  });

  it("requires a verified second factor for the current staff session and expires that grant", async () => {
    const identity = await provision("staff@example.test", "admin");
    await expect(requireAccess(identity.headers, { staff: true })).rejects.toMatchObject({ code: "MFA_REQUIRED" });
    const enrollment = await setupMfa(applicationRequest("/api/v1/auth/mfa/setup", { password }, identity.headers), undefined);
    expect(enrollment.status).toBe(200);
    const setup = await enrollment.json() as { totpURI: string; backupCodes: string[] };
    expect(setup.backupCodes.length).toBeGreaterThan(0);
    const secret = new URL(setup.totpURI).searchParams.get("secret")!;
    const invalid = await verifyMfa(applicationRequest("/api/v1/auth/mfa/verify", { code: "invalid" }, identity.headers), undefined);
    expect(invalid.status).toBe(401);
    const before = await getViewer(identity.headers);
    expect(before && await hasStaffVerification(before)).toBe(false);
    const code = authenticatorCode(secret);
    const verified = await verifyMfa(applicationRequest("/api/v1/auth/mfa/verify", { code }, identity.headers), undefined);
    expect(verified.status).toBe(200);
    const verifiedHeaders = headersAfterAuth(new Request(base, { headers: identity.headers }), verified);
    const access = await requireAccess(verifiedHeaders, { staff: true });
    expect(access.user.id).toBe(identity.id);
    // A different session with enrolled MFA still has no current-session grant.
    const pending = await auth.api.signInEmail({ body: { email: identity.email, password }, asResponse: true });
    expect((await pending.json()).twoFactorRedirect).toBe(true);
    const pendingHeaders = headersAfterAuth(new Request(base), pending);
    const secondFactor = await auth.api.verifyTOTP({ body: { code: authenticatorCode(secret) }, headers: pendingHeaders, asResponse: true });
    expect(secondFactor.status).toBe(200);
    const secondHeaders = headersAfterAuth(new Request(base, { headers: pendingHeaders }), secondFactor);
    // Native provider/2FA endpoints cannot bypass the application's staff grant.
    await expect(requireAccess(secondHeaders, { staff: true })).rejects.toMatchObject({ code: "MFA_REQUIRED" });
    const stepUp = await verifyMfa(applicationRequest("/api/v1/auth/mfa/verify", { code: authenticatorCode(secret) }, secondHeaders), undefined);
    expect(stepUp.status).toBe(200);
    expect((await requireAccess(secondHeaders, { staff: true })).user.id).toBe(identity.id);
    await store.db.update(staffVerification).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(staffVerification.sessionId, access.session.id));
    await expect(requireAccess(verifiedHeaders, { staff: true })).rejects.toMatchObject({ code: "MFA_REQUIRED" });
    // The account throttle applies to re-verification across authenticated sessions.
    await store.db.delete(rateLimit).where(eq(rateLimit.key, `staff-mfa:${identity.id}`));
    const attempts = [];
    for (let index = 0; index < 6; index++) attempts.push(await verifyMfa(applicationRequest("/api/v1/auth/mfa/verify", { code: "invalid" }, verifiedHeaders), undefined));
    expect(attempts.at(-1)?.status).toBe(429);
    expect(await store.db.select().from(session).where(eq(session.userId, identity.id))).not.toHaveLength(0);
  });

  it("accepts a saved backup code for staff step-up once", async () => {
    const identity=await provision("backup-step-up@example.test","admin");
    const enrollment=await setupMfa(applicationRequest("/api/v1/auth/mfa/setup",{password},identity.headers),undefined);
    expect(enrollment.status).toBe(200);
    const setup=await enrollment.json() as {totpURI:string;backupCodes:string[]};
    const code=authenticatorCode(new URL(setup.totpURI).searchParams.get("secret")!);
    const confirmed=await verifyMfa(applicationRequest("/api/v1/auth/mfa/verify",{code},identity.headers),undefined);
    expect(confirmed.status).toBe(200);
    const headers=headersAfterAuth(new Request(base,{headers:identity.headers}),confirmed);
    const access=await requireAccess(headers,{staff:true});
    await store.db.delete(staffVerification).where(eq(staffVerification.sessionId,access.session.id));
    await expect(requireAccess(headers,{staff:true})).rejects.toMatchObject({code:"MFA_REQUIRED"});
    const body={code:setup.backupCodes[0],method:"backup"};
    const verified=await verifyMfa(applicationRequest("/api/v1/auth/mfa/verify",body,headers),undefined);
    expect(verified.status).toBe(200);
    const verifiedHeaders=headersAfterAuth(new Request(base,{headers}),verified);
    expect((await requireAccess(verifiedHeaders,{staff:true})).user.id).toBe(identity.id);
    const reused=await verifyMfa(applicationRequest("/api/v1/auth/mfa/verify",body,verifiedHeaders),undefined);
    expect(reused.status).toBe(401);
  });

  it("prevents OAuth-only staff sessions from retrieving or replacing MFA credentials before step-up", async () => {
    const identity = await provision("oauth-only-staff@example.test", "admin");
    // Obtain two genuine primary sessions before enrollment. Replacing the
    // credential account models OAuth-only identities without an external IdP;
    // Better Auth sessions do not encode the primary authentication provider.
    const secondPrimary = await auth.api.signInEmail({ body: { email: identity.email, password }, asResponse: true });
    const unverifiedHeaders = headersAfterAuth(new Request(base), secondPrimary);
    await store.db.delete(account).where(eq(account.userId, identity.id));
    await store.db.insert(account).values({ id: randomUUID(), userId: identity.id, providerId: "google", accountId: `oauth-${identity.id}` });
    const enrollment = await setupMfa(applicationRequest("/api/v1/auth/mfa/setup", {}, identity.headers), undefined);
    expect(enrollment.status).toBe(200);
    const setup = await enrollment.json() as { totpURI: string; backupCodes: string[] };
    const secret = new URL(setup.totpURI).searchParams.get("secret")!;
    const confirmed = await verifyMfa(applicationRequest("/api/v1/auth/mfa/verify", { code: authenticatorCode(secret) }, identity.headers), undefined);
    expect(confirmed.status).toBe(200);
    const staffHeaders = headersAfterAuth(new Request(base, { headers: identity.headers }), confirmed);
    expect((await requireAccess(staffHeaders, { staff: true })).user.id).toBe(identity.id);
    await expect(requireAccess(unverifiedHeaders, { staff: true })).rejects.toMatchObject({ code: "MFA_REQUIRED" });

    for (const path of ["/two-factor/get-totp-uri", "/two-factor/disable", "/two-factor/generate-backup-codes", "/two-factor/enable"]) {
      const result = await auth.handler(applicationRequest(`/api/auth${path}`, {}, unverifiedHeaders));
      expect(result.status, path).toBe(403);
      expect((await result.json()).code, path).toBe("MFA_REQUIRED");
    }
    const serverOnly = await auth.handler(applicationRequest("/api/auth/two-factor/view-backup-codes", { userId: identity.id }, unverifiedHeaders));
    expect(serverOnly.status).toBeGreaterThanOrEqual(400);
    const setupAgain = await setupMfa(applicationRequest("/api/v1/auth/mfa/setup", {}, unverifiedHeaders), undefined);
    expect(setupAgain.status).toBe(403);
    // The native helper is available only after proof for this session.
    const permitted = await auth.handler(applicationRequest("/api/auth/two-factor/get-totp-uri", {}, staffHeaders));
    expect(permitted.status).toBe(200);
    expect((await permitted.json()).totpURI).toBe(setup.totpURI);

    await store.db.delete(rateLimit).where(eq(rateLimit.key, `staff-mfa:${identity.id}`));
    // Direct native endpoint calls share an account budget with the wrapper,
    // regardless of the HTTP/IP limiter or the session making the attempt.
    for (let attempt = 0; attempt < 5; attempt++) {
      const failure = await auth.api.verifyTOTP({ body: { code: "invalid" }, headers: unverifiedHeaders, asResponse: true });
      expect(failure.status).toBe(401);
    }
    const [budget] = await store.db.select().from(rateLimit).where(eq(rateLimit.key, `staff-mfa:${identity.id}`));
    expect(budget.count).toBe(5);
    const wrapper = await verifyMfa(applicationRequest("/api/v1/auth/mfa/verify", { code: authenticatorCode(secret) }, unverifiedHeaders), undefined);
    expect(wrapper.status).toBe(429);
    expect((await wrapper.json()).error.code).toBe("TOO_MANY_ATTEMPTS");
    const [exhausted] = await store.db.select().from(rateLimit).where(eq(rateLimit.key, `staff-mfa:${identity.id}`));
    expect(exhausted.count).toBe(6);
    await expect(requireAccess(unverifiedHeaders, { staff: true })).rejects.toMatchObject({ code: "MFA_REQUIRED" });
  });
});
