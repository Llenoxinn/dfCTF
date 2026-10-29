import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { appendFile, cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, stat, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { promisify } from "node:util";
import { Client } from "pg";
import { eq } from "drizzle-orm";
import { createStore } from "../src/server/db";
import { createAuth, headersAfterAuth, type Auth } from "../src/server/auth";
import { createChallenge, editChallenge, getProgress, publishChallenge, submitFlag } from "../src/server/challenges";
import { saveArtifact } from "../src/server/files";
import { matchesFlag } from "../src/server/flags";
import { artifactContents, user, challengeVersions } from "../src/server/schema";
import { challengeInput } from "../src/server/validation";
import { GET as protectedDownload } from "../src/app/api/v1/challenges/[id]/files/[fileId]/route";
import { GET as protectedProgress } from "../src/app/api/v1/progress/route";
import type { Viewer } from "../src/lib/types";

// shortcut: synthetic local recovery only; run the separate staging drill before trusting a deployed backup.
const run = promisify(execFile), repository = process.cwd();
const revision = (await run("git", ["rev-parse", "HEAD"], { cwd: repository })).stdout.trim();
const rehearsalScriptSha256 = createHash("sha256").update(await readFile(path.join(repository, "scripts", "rehearse-restore.ts"))).digest("hex");
const tools = process.env.DFCTF_POSTGRES_BIN ?? "";
const executable = (name: string) => path.join(tools, `${name}${process.platform === "win32" ? ".exe" : ""}`);
const toolVersion = (await run(executable("pg_dump"), ["--version"])).stdout.trim();
const root = path.join(repository, ".data", "release-rehearsals");
await mkdir(root, { recursive: true });
const directory = await mkdtemp(path.join(root, "restore-"));
const cluster = path.join(directory, "postgres"), marker = path.join(directory, ".owner"), token = randomBytes(32).toString("hex");
await writeFile(marker, token, { flag: "wx", mode: 0o600 });
await cp(path.join(repository, "drizzle"), path.join(directory, "drizzle"), { recursive: true });
const migrations = await Promise.all((await readdir(path.join(repository, "drizzle"))).filter(name => name.endsWith(".sql")).sort().map(async name => ({ name, sha256: createHash("sha256").update(await readFile(path.join(repository, "drizzle", name))).digest("hex") })));
const server = net.createServer();
await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
const port = (server.address() as net.AddressInfo).port;
await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
const password = randomBytes(32).toString("hex"), dbUser = "dfctf_restore";
const passwordFile = path.join(directory, "postgres-password.txt");
await writeFile(passwordFile, password, { flag: "wx", mode: 0o600 });
const environment = { ...process.env };
for (const key of Object.keys(environment)) if (key.startsWith("PG")) delete environment[key];
for (const key of Object.keys(process.env)) if (key.startsWith("PG")) delete process.env[key];
Object.assign(environment, { PGHOST: "127.0.0.1", PGPORT: String(port), PGUSER: dbUser, PGPASSWORD: password, PGSSLMODE: "disable" });
const pg = (name: string, args: string[]) => run(executable(name), args, { env: environment, timeout: 60_000, windowsHide: true });
const connection = (database: string) => `postgresql://${dbUser}:${password}@127.0.0.1:${port}/${database}`;
let store: Awaited<ReturnType<typeof createStore>> | undefined, startupAttempted = false;
const globals = globalThis as unknown as { dfctfStore?: Promise<Awaited<ReturnType<typeof createStore>>>; dfctfAuth?: Promise<Auth> };
let failure: unknown;
process.chdir(directory);
try {
  await pg("initdb", ["-D", cluster, "--username", dbUser, "--pwfile", passwordFile, "--auth=scram-sha-256", "--encoding=UTF8", "--no-locale"]);
  await appendFile(path.join(cluster, "postgresql.conf"), "\nunix_socket_directories = ''\n");
  startupAttempted = true;
  await pg("pg_ctl", ["-D", cluster, "-l", path.join(directory, "postgres.log"), "-o", `-h 127.0.0.1 -p ${port}`, "-w", "start"]);
  const admin = new Client({ connectionString: connection("postgres") });
  await admin.connect();
  try { await admin.query("CREATE DATABASE source"); await admin.query("CREATE DATABASE restored TEMPLATE template0"); } finally { await admin.end(); }
  const secrets = { AUTH_SECRET: randomBytes(32).toString("hex"), FLAG_SECRET: randomBytes(32).toString("hex") };
  await writeFile(path.join(directory, "secrets.json"), JSON.stringify(secrets), { flag: "wx", mode: 0o600 });
  Object.assign(process.env, secrets, {
    NODE_ENV: "development", APP_URL: "http://127.0.0.1:3000", DATABASE_URL: connection("source"), DATABASE_MIGRATION_URL: "", TEST_DATABASE_URL: "",
    LOCAL_MAIL: "1", SMTP_URL: "", MAIL_FROM: "dfCTF <noreply@example.test>", ARTIFACT_DIR: path.join(directory, "source-artifacts"),
    GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "", GITHUB_CLIENT_ID: "", GITHUB_CLIENT_SECRET: "", FACEBOOK_CLIENT_ID: "", FACEBOOK_CLIENT_SECRET: "",
  });
  store = await createStore(connection("source"));
  globals.dfctfStore = Promise.resolve(store);
  await store.migrate();
  const auth = createAuth(store.db);
  globals.dfctfAuth = Promise.resolve(auth);
  const fixturePassword = `synthetic-restore-${randomUUID()}`;
  async function identity(role: Viewer["role"]): Promise<Viewer> {
    const email = `restore-${role}@example.test`;
    const registered = await auth.api.signUpEmail({ body: { email, password: fixturePassword, name: "Synthetic recovery fixture" } });
    const codename = `restore_${role}`;
    await store!.db.update(user).set({ role, codename, codenameKey: codename, emailVerified: true }).where(eq(user.id, registered.user.id));
    return { id: registered.user.id, email, codename, emailVerified: true, role, twoFactorEnabled: false };
  }
  const author = await identity("author"), reviewer = await identity("reviewer"), player = await identity("participant");
  const flag = `dfCTF{synthetic_restore_${randomBytes(8).toString("hex")}}`;
  const solution = "The automated rehearsal supplies its own synthetic fixture answer.";
  const bytes = Buffer.from("Fictional evidence for the PostgreSQL recovery rehearsal.\n");
  const draft = await createChallenge(store.db, author, challengeInput.parse({ title: "Recovery rehearsal fixture", description: "Use this fictional artifact to rehearse backup and restoration.", solution, category: "General skills", difficulty: "Easy", xp: 50, estimatedMinutes: 1, flag }));
  const file = await saveArtifact(store.db, author, draft.id, "recovery-evidence.txt", bytes);
  await editChallenge(store.db, author, draft.id, { status: "review" });
  await publishChallenge(store.db, reviewer, draft.id, flag);
  assert.deepEqual(await submitFlag(store.db, player, draft.id, flag), { status: "correct", xp: 50, totalXp: 50, solution });
  assert.equal((await getProgress(store.db, player.id)).totalXp, 50);
  const request = new Request(process.env.APP_URL!, { headers: { origin: process.env.APP_URL!, "x-forwarded-for": "127.0.0.1" } });
  const originalSignIn = await auth.api.signInEmail({ body: { email: player.email, password: fixturePassword }, asResponse: true });
  assert.equal(originalSignIn.status, 200);
  const originalHeaders = headersAfterAuth(request, originalSignIn);
  await store.close(); store = undefined; delete globals.dfctfStore; delete globals.dfctfAuth;

  const dump = path.join(directory, "database.dump"), snapshot = path.join(directory, "artifact-snapshot");
  await pg("pg_dump", ["--format=custom", "--file", dump, "--dbname", "source"]);
  await cp(process.env.ARTIFACT_DIR!, snapshot, { recursive: true, errorOnExist: true, force: false });
  await pg("pg_restore", ["--exit-on-error", "--no-owner", "--no-acl", "--dbname", "restored", dump]);
  const control = new Client({ connectionString: connection("postgres") });
  await control.connect();
  try { await control.query("ALTER DATABASE source ALLOW_CONNECTIONS false"); } finally { await control.end(); }
  await rename(path.join(directory, "source-artifacts"), path.join(directory, "source-artifacts-offline"));
  const restoredArtifacts = path.join(directory, "restored-artifacts");
  await cp(snapshot, restoredArtifacts, { recursive: true, errorOnExist: true, force: false });
  for (const name of await readdir(snapshot)) assert.deepEqual(await readFile(path.join(restoredArtifacts, name)), await readFile(path.join(snapshot, name)));
  process.env.AUTH_SECRET = ""; process.env.FLAG_SECRET = "";
  Object.assign(process.env, JSON.parse(await readFile(path.join(directory, "secrets.json"), "utf8")), { DATABASE_URL: connection("restored"), ARTIFACT_DIR: restoredArtifacts });
  store = await createStore(connection("restored"));
  globals.dfctfStore = Promise.resolve(store);
  const restoredAuth = createAuth(store.db);
  globals.dfctfAuth = Promise.resolve(restoredAuth);
  const oldProgress = await protectedProgress(new Request(`${process.env.APP_URL}/api/v1/progress`, { headers: originalHeaders }), {});
  assert.equal(oldProgress.status, 200);
  assert.equal((await oldProgress.json()).totalXp, 50);
  const signedIn = await restoredAuth.api.signInEmail({ body: { email: player.email, password: fixturePassword }, asResponse: true });
  assert.equal(signedIn.status, 200);
  const headers = headersAfterAuth(request, signedIn);
  const downloadURL = `${process.env.APP_URL}/api/v1/challenges/${draft.id}/files/${file.id}`;
  const context = { params: Promise.resolve({ id: draft.id, fileId: file.id }) };
  assert.equal((await protectedDownload(new Request(downloadURL), context)).status, 401);
  const download = await protectedDownload(new Request(downloadURL, { headers }), context);
  assert.equal(download.status, 200);
  assert.match(download.headers.get("content-disposition")!, /attachment/);
  assert.equal(createHash("sha256").update(Buffer.from(await download.arrayBuffer())).digest("hex"), file.sha256);
  const progress = await protectedProgress(new Request(`${process.env.APP_URL}/api/v1/progress`, { headers }), {});
  assert.equal(progress.status, 200);
  const restoredProgress = await progress.json();
  assert.equal(restoredProgress.totalXp, 50); assert.equal(restoredProgress.solvedCount, 1);
  const [version] = await store.db.select().from(challengeVersions).where(eq(challengeVersions.challengeId, draft.id));
  assert(matchesFlag(flag, version.flagHash));
  const [storedContent] = await store.db.select().from(artifactContents).where(eq(artifactContents.artifactId, file.id));
  await store.db.delete(artifactContents).where(eq(artifactContents.artifactId, file.id));
  try {
    const legacyDownload = await protectedDownload(new Request(downloadURL, { headers }), context);
    assert.equal(legacyDownload.status, 200);
    assert.equal(createHash("sha256").update(Buffer.from(await legacyDownload.arrayBuffer())).digest("hex"), file.sha256);
  } finally { await store.db.insert(artifactContents).values(storedContent); }
  await rename(restoredArtifacts, path.join(directory, "restored-artifacts-offline"));
  const databaseOnly = await protectedDownload(new Request(downloadURL, { headers }), context);
  assert.equal(databaseOnly.status, 200);
  assert.equal(createHash("sha256").update(Buffer.from(await databaseOnly.arrayBuffer())).digest("hex"), file.sha256);
  await rename(path.join(directory, "restored-artifacts-offline"), restoredArtifacts);
  assert.deepEqual(await submitFlag(store.db, player, draft.id, flag), { status: "already_solved", xp: 0, totalXp: 50, solution });
  assert.equal((await getProgress(store.db, player.id)).totalXp, 50);
  const report = {
    checkedAt: new Date().toISOString(), applicationRevision: revision, rehearsalScriptSha256, postgresql: toolVersion, migrations,
    dump: { bytes: (await stat(dump)).size, sha256: createHash("sha256").update(await readFile(dump)).digest("hex") },
    artifact: { bytes: bytes.length, sha256: file.sha256 },
    checks: ["native PostgreSQL custom dump and isolated restore", "artifact snapshot restored byte-for-byte", "original authentication session", "fresh password sign-in", "unauthenticated download denied", "protected download and SHA-256", "one saved solve and 50 XP", "original flag secret", "legacy file-only snapshot download", "database-only artifact download", "repeat solve awards zero XP"],
    limitations: "Synthetic local accounts and direct application route handlers; no deployed HTTPS, SMTP, OAuth, or off-host encrypted backup verification.",
  };
  await writeFile(path.join(directory, "report.json"), JSON.stringify(report, null, 2), { flag: "wx" });
} catch (error) {
  failure = error;
  await writeFile(path.join(directory, "failure.txt"), error instanceof Error ? error.stack ?? error.message : String(error), { mode: 0o600 });
} finally {
  try { await store?.close(); } catch (error) { failure ??= error; }
  delete globals.dfctfStore; delete globals.dfctfAuth;
  if (startupAttempted) {
    try {
      assert.equal(await readFile(marker, "utf8"), token);
      assert(!(await lstat(cluster)).isSymbolicLink());
      assert.equal(await realpath(cluster), path.join(await realpath(directory), "postgres"));
      let running = true;
      try { await pg("pg_ctl", ["-D", cluster, "status"]); } catch (error) { if ((error as { code?: number }).code === 3) running = false; else throw error; }
      if (running) await pg("pg_ctl", ["-D", cluster, "-m", "fast", "-w", "stop"]);
    } catch (error) { failure ??= error; await writeFile(path.join(directory, "shutdown-failure.txt"), String(error), { mode: 0o600 }); }
  }
  process.chdir(repository);
}
if (failure) { console.error(`Recovery rehearsal failed. Private diagnostic files: ${directory}`); process.exitCode = 1; }
else console.log(`Recovery rehearsal passed. Sanitized evidence: ${path.join(directory, "report.json")}`);
