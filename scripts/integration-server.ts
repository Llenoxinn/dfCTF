import { randomUUID } from "node:crypto";
import { cp, readdir, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createStore } from "../src/server/db";
import { createAuth } from "../src/server/auth";
import { createChallenge, editChallenge, publishChallenge } from "../src/server/challenges";
import { saveArtifact } from "../src/server/files";
import { user } from "../src/server/schema";
import { challengeInput } from "../src/server/validation";
import { eq } from "drizzle-orm";
import type { Viewer } from "../src/lib/types";

const source = process.cwd();
const directory = path.resolve(process.env.DFCTF_INTEGRATION_DIR ?? "");
const temporaryRoot = path.dirname(source);
if (path.dirname(directory) !== path.resolve(temporaryRoot) || !/^dfctf-integration-[A-Za-z0-9]+$/.test(path.basename(directory))) {
  throw new Error("Integration server requires its own dfctf-integration-* temporary directory.");
}
const ownershipToken = process.env.DFCTF_INTEGRATION_TOKEN ?? "";
if (!/^[a-f0-9]{64}$/.test(ownershipToken) || (await readdir(directory)).length) {
  throw new Error("Integration server requires an empty directory and a valid run ownership token.");
}
await writeFile(path.join(directory, ".dfctf-integration-owner"), ownershipToken, { flag: "wx", mode: 0o600 });
// ponytail: Copy only the app into a disposable cwd so Next output, mail and secrets cannot touch a developer's data.
for (const entry of ["src", "drizzle", "public", "package.json", "tsconfig.json", "next.config.ts", "postcss.config.mjs"]) {
  await cp(path.join(source, entry), path.join(directory, entry), { recursive: true });
}
await symlink(path.join(source, "node_modules"), path.join(directory, "node_modules"), process.platform === "win32" ? "junction" : "dir");
process.chdir(directory);
process.env.PGLITE_DIR = path.join(directory, ".data", "postgres");
process.env.ARTIFACT_DIR = path.join(directory, ".data", "artifacts");

const store = await createStore();
try {
  await store.migrate();
  const auth = createAuth(store.db), password = `synthetic-fixture-${randomUUID()}`;
  async function fixtureAccount(role: "author" | "reviewer" | "participant", label = role as string): Promise<Viewer> {
    const email = `fixture-${label}@example.test`, codename = `fixture_${label}`;
    const registered = await auth.api.signUpEmail({ body: { email, password, name: "Synthetic integration fixture" } });
    await store.db.update(user).set({ role, codename, codenameKey: codename, emailVerified: true }).where(eq(user.id, registered.user.id));
    return { id: registered.user.id, email, codename, emailVerified: true, role, twoFactorEnabled: false };
  }
  const author = await fixtureAccount("author"), reviewer = await fixtureAccount("reviewer");
  const learner = await fixtureAccount("participant", "learner"), otherLearner = await fixtureAccount("participant", "other_learner");
  const flag = "dfCTF{synthetic_integration_fixture}";
  const content = "This is synthetic integration-test evidence.\n";
  const draft = await createChallenge(store.db, author, challengeInput.parse({
    title: "Integration training case", summary: "A synthetic case used only by the integration smoke test.",
    description: "Download the synthetic evidence file, then submit the fixture flag supplied by the test.",
    solution: "The synthetic fixture deliberately supplies its answer to the integration test.",
    category: "General skills", difficulty: "Easy", tags: [], xp: 50, estimatedMinutes: 1, flag,
  }));
  const file = await saveArtifact(store.db, author, draft.id, "fixture.txt", Buffer.from(content));
  await editChallenge(store.db, author, draft.id, { status: "review" });
  await publishChallenge(store.db, reviewer, draft.id, flag);
  await writeFile(path.join(directory, "fixture.json"), JSON.stringify({ challengeId: draft.id, file, flag, content, staff: { author: author.email, reviewer: reviewer.email, password }, learners: { learner: learner.email, otherLearner: otherLearner.email, password } }), { mode: 0o600 });
} finally {
  await store.close();
}

const child = spawn(process.execPath, [path.join(source, "node_modules", "next", "dist", "bin", "next"), "dev", "--turbopack", "--hostname", "127.0.0.1", "--port", "3200"], { cwd: directory, env: process.env, stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => child.kill(signal));
child.on("error", error => { console.error(error.message); process.exitCode = 1; });
child.on("exit", code => process.exit(code ?? 0));
