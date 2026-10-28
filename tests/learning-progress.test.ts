import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createStore } from "@/server/db";
import { user } from "@/server/schema";
import { GET, PATCH } from "@/app/api/v1/learning/progress/route";
import { requireAccess } from "@/server/access";
import { HttpError } from "@/server/http";
import { updateLearningProgress } from "@/server/learning-progress";
import { applyLearningPatch, diffLearningProgress, learningPatchSchema, mergeLearningPatches } from "@/lib/learning-progress";
import { parseLearningProgress } from "@/lib/resource-learning";

vi.mock("@/server/access", () => ({ requireAccess: vi.fn() }));
vi.mock("@/server/db", async original => ({ ...await original<typeof import("@/server/db")>(), getDb: async () => store.db }));
let store: Awaited<ReturnType<typeof createStore>>;
const alice = randomUUID(), bob = randomUUID();
let actor: string | null = alice;
beforeAll(async () => {
  store = await createStore(process.env.TEST_DATABASE_URL, true); await store.migrate();
  for (const id of [alice, bob]) await store.db.insert(user).values({ id, email: `${id}@example.test`, name: "Learning test", emailVerified: true });
});
afterAll(async () => { await store?.close(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
beforeEach(() => {
  actor = alice; vi.stubEnv("APP_URL", "http://learning.example.test");
  vi.mocked(requireAccess).mockImplementation(async () => {
    if (!actor) throw new HttpError(401, "SIGN_IN_REQUIRED", "Sign in to continue.");
    return { user: { id: actor } as never, session: { id: "learning-test-session" } };
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
const request = (method: string, account = alice, body?: unknown, origin = "http://learning.example.test") => new Request("http://learning.example.test/api/v1/learning/progress", {
  method, headers: { "X-dfCTF-Account": account, "Content-Type": "application/json", Origin: origin }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

describe("learning progress changes", () => {
  it("preserves additions, removals, and unrelated device changes while combining offline edits", () => {
    const start = parseLearningProgress(null);
    const offline = mergeLearningPatches({ bookmarks: { add: ["osint"], remove: [] } }, { bookmarks: { add: ["forensics"], remove: ["osint"] } });
    const server = { ...start, bookmarks: ["osint", "general-skills"] };
    const merged = applyLearningPatch(server, offline);
    expect(merged.bookmarks).toEqual(["general-skills", "forensics"]);
    expect(applyLearningPatch(server, diffLearningProgress(server, merged))).toEqual(merged);
  });
  it("rejects forged ownership, unbounded inputs, unknown topics, and invalid paths", () => {
    for (const value of [{ userId: bob }, { completed: { add: ["unknown"], remove: [] } }, { open: { "__proto__": ["x"], unknown: [] } }, { last: { topic: "osint", section: "osint-basics", path: "windows" } }, { bookmarks: { add: Array(101).fill("osint"), remove: [] } }]) expect(learningPatchSchema.safeParse(value).success).toBe(false);
  });
});

describe("account-scoped learning progress", () => {
  it("authenticates reads and mutations and rejects stale account headers before changing data", async () => {
    actor = null;
    expect((await GET(request("GET"), {})).status).toBe(401);
    expect((await PATCH(request("PATCH", alice, {}), {})).status).toBe(401);
    actor = bob;
    expect((await GET(request("GET", alice), {})).status).toBe(409);
    expect((await PATCH(request("PATCH", alice, { bookmarks: { add: ["osint"], remove: [] } }), {})).status).toBe(409);
    expect((await (await GET(request("GET", bob), {})).json()).progress.bookmarks).toEqual([]);
  });
  it("protects writes from cross-origin requests and spoofed payload identities", async () => {
    expect((await PATCH(request("PATCH", alice, {}, "https://untrusted.example.test"), {})).status).toBe(403);
    expect((await PATCH(request("PATCH", alice, { userId: bob }), {})).status).toBe(422);
    expect((await PATCH(request("PATCH", alice, { bookmarks: { add: ["x".repeat(100_001)], remove: [] } }), {})).status).toBe(413);
  });
  it("saves only the current account and keeps other users' state separate", async () => {
    const response = await PATCH(request("PATCH", alice, { bookmarks: { add: ["general-skills/powershell"], remove: [] }, completed: { add: ["general-skills"], remove: [] } }), {});
    expect(response.status).toBe(200);
    expect((await response.json()).progress).toMatchObject({ bookmarks: ["general-skills/powershell"], completed: ["general-skills"] });
    actor = bob;
    expect((await (await GET(request("GET", bob), {})).json()).progress.completed).toEqual([]);
  });
  it("serializes concurrent updates without replacing unrelated bookmarks or completion marks", async () => {
    await Promise.all([
      updateLearningProgress(store.db, bob, { bookmarks: { add: ["osint"], remove: [] } }),
      updateLearningProgress(store.db, bob, { bookmarks: { add: ["forensics"], remove: [] } }),
    ]);
    await Promise.all([
      updateLearningProgress(store.db, bob, { bookmarks: { add: [], remove: ["osint"] } }),
      updateLearningProgress(store.db, bob, { completed: { add: ["forensics"], remove: [] } }),
    ]);
    actor = bob;
    const saved = (await (await GET(request("GET", bob), {})).json()).progress;
    expect(saved.bookmarks).toEqual(["forensics"]); expect(saved.completed).toEqual(["forensics"]);
  });
});
