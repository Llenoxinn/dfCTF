import { test, expect } from "@playwright/test";

test("a failed draft load blocks editing and allows reopening or creating a new draft", async ({ page }) => {
  const identity = { id: "test-author", email: "author@example.test", codename: "test_author", emailVerified: true, role: "author", twoFactorEnabled: true };
  const detail = { id: "test-draft", slug: "test-draft", title: "Training challenge", summary: "A fictional challenge for testing.", description: "Inspect the supplied fictional training file.", solution: "Read the file to recover the complete training flag.", flagFormat: "dfCTF{...}", category: "General skills", difficulty: "Easy", tags: [], xp: 50, estimatedMinutes: 5, solved: false, attempted: false, solveCount: 0, status: "draft", author: "test_author", authorId: identity.id, version: 1, files: [] };
  let failRead = true, created = false, refreshing = false;
  let releaseRead!: () => void;
  const readGate = new Promise<void>(resolve => { releaseRead = resolve; });
  const mutations: string[] = [];
  await page.route("**/api/**", async route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() !== "GET") mutations.push(`${request.method()} ${url.pathname}`);
    let response: unknown;
    if (url.pathname === "/api/v1/auth/bootstrap") response = { user: identity, hasAccess: true, staffVerified: true, providers: { google: false, github: false }, localMail: false };
    else if (url.pathname === "/api/v1/challenges") response = [];
    else if (url.pathname === "/api/v1/progress") response = { totalXp: 0, solvedCount: 0, attemptedCount: 0, categories: [], recentSolves: [] };
    else if (url.pathname === "/api/v1/leaderboard") response = { range: "week", weekEndsAt: new Date(Date.now() + 86_400_000).toISOString(), players: 0, standings: [], viewer: null, race: { players: [], snapshots: [] }, hourly: { start: "2026-10-19T00:00:00+08:00", counts: [], firstBlood: [] }, challenges: [], mine: { days: [] } };
    else if (url.pathname === "/api/v1/staff/challenges") {
      if (request.method() === "POST") {
        created = true;
        Object.assign(detail, request.postDataJSON(), { id: "created-draft" });
        response = { id: detail.id };
      } else response = [detail];
    }
    else if (url.pathname === "/api/v1/staff/challenges/test-draft") {
      if (failRead) { await route.fulfill({ status: 503, json: { error: { message: "Draft temporarily unavailable." } } }); return; }
      response = detail;
    } else if (url.pathname === "/api/v1/staff/challenges/created-draft") {
      refreshing = true; await readGate; response = detail;
    } else throw new Error(`Unexpected test request: ${request.method()} ${url.pathname}`);
    await route.fulfill({ json: response });
  });
  await page.goto("/?view=authoring");
  await page.getByRole("row", { name: /Training challenge/ }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Draft temporarily unavailable.");
  await expect(page.locator("#challenge-editor")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save draft", exact: true })).toHaveCount(0);
  expect(mutations).toEqual([]);

  await page.getByRole("button", { name: "Back to authoring" }).click();
  failRead = false;
  await page.getByRole("row", { name: /Training challenge/ }).click();
  await expect(page.getByLabel(/^Description/)).toHaveValue(detail.description);
  await expect(page.getByRole("button", { name: "Save draft", exact: true })).toBeDisabled();

  await page.getByRole("button", { name: "Back to authoring" }).click();
  await page.getByRole("button", { name: "New challenge", exact: true }).click();
  await expect(page.getByLabel(/^Description/)).toBeEditable();
  await expect(page.getByLabel(/^Description/)).toHaveValue("");
  await expect(page.getByRole("button", { name: "Save draft", exact: true })).toBeEnabled();
  await page.getByLabel(/^Title/).fill("New training challenge");
  await page.getByLabel(/^Description/).fill(detail.description);
  await page.getByLabel(/^Walkthrough/).fill(detail.solution);
  await page.getByLabel(/^Correct flag/).fill("dfCTF{new_training_flag}");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect.poll(() => created && refreshing).toBe(true);
  await expect(page.getByRole("heading", { name: "Could not open this challenge" })).toHaveCount(0);
  await expect(page.getByLabel(/^Description/)).not.toBeEditable();
  await expect(page.getByRole("button", { name: "Back to authoring" })).toBeDisabled();
  releaseRead();
  await expect(page.getByLabel(/^Description/)).toBeEditable();
  await expect(page.getByLabel(/^Title/)).toHaveValue("New training challenge");
  expect(mutations).toEqual(["POST /api/v1/staff/challenges"]);
});

test("holds the editor read-only until a slow save, upload, and refresh finish", async ({ page }) => {
  const identity = { id: "test-author", email: "author@example.test", codename: "test_author", emailVerified: true, role: "author", twoFactorEnabled: true };
  const detail = { id: "test-draft", slug: "test-draft", title: "Training challenge", summary: "A fictional challenge for testing.", description: "Inspect the supplied fictional training file.", solution: "Read the file to recover the complete training flag.", flagFormat: "dfCTF{...}", category: "General skills", difficulty: "Easy", tags: [], xp: 50, estimatedMinutes: 5, solved: false, attempted: false, solveCount: 0, status: "draft", author: "test_author", authorId: identity.id, version: 1, files: [] as { id: string; name: string; size: number; sha256: string }[] };
  let releaseSave!: () => void, releaseUpload!: () => void, releaseRead!: () => void;
  const saveGate = new Promise<void>(resolve => { releaseSave = resolve; });
  const uploadGate = new Promise<void>(resolve => { releaseUpload = resolve; });
  const readGate = new Promise<void>(resolve => { releaseRead = resolve; });
  let saved = false, uploading = false, rereading = false;
  await page.route("**/api/**", async route => {
    const request = route.request(), url = new URL(request.url());
    let response: unknown;
    if (url.pathname === "/api/v1/auth/bootstrap") response = { user: identity, hasAccess: true, staffVerified: true, providers: { google: false, github: false }, localMail: false };
    else if (url.pathname === "/api/v1/challenges") response = [];
    else if (url.pathname === "/api/v1/progress") response = { totalXp: 0, solvedCount: 0, attemptedCount: 0, categories: [], recentSolves: [] };
    else if (url.pathname === "/api/v1/leaderboard") response = { range: "week", weekEndsAt: new Date(Date.now() + 86_400_000).toISOString(), players: 0, standings: [], viewer: null, race: { players: [], snapshots: [] }, hourly: { start: "2026-10-19T00:00:00+08:00", counts: [], firstBlood: [] }, challenges: [], mine: { days: [] } };
    else if (url.pathname === "/api/v1/staff/challenges") response = [detail];
    else if (url.pathname.endsWith("/files")) {
      uploading = true;
      await uploadGate;
      detail.files = [{ id: "file-1", name: "evidence.txt", size: 8, sha256: "a".repeat(64) }];
      response = detail.files[0];
    } else if (url.pathname === "/api/v1/staff/challenges/test-draft") {
      if (request.method() === "PATCH") {
        saved = true;
        await saveGate;
        Object.assign(detail, request.postDataJSON());
        response = { id: detail.id };
      } else {
        if (saved) { rereading = true; await readGate; }
        response = detail;
      }
    } else throw new Error(`Unexpected test request: ${request.method()} ${url.pathname}`);
    await route.fulfill({ json: response });
  });
  await page.goto("/?view=authoring");
  await page.getByRole("row", { name: /Training challenge/ }).click();
  const description = page.getByLabel(/^Description/);
  await description.fill("Updated description that must survive the upload.");
  const picker = page.locator('input[type="file"]');
  await picker.setInputFiles({ name: "oversized.txt", mimeType: "text/plain", buffer: Buffer.alloc(3 * 1024 * 1024 + 1, 97) });
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Each file must be 3 MiB or smaller.");
  expect(saved || uploading).toBe(false);
  await picker.setInputFiles({ name: "evidence.txt", mimeType: "text/plain", buffer: Buffer.from("evidence") });
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect.poll(() => saved).toBe(true);
  await expect(description).not.toBeEditable();
  await expect(picker).toBeDisabled();
  await expect(page.getByLabel(/^Replace the correct flag/)).toBeDisabled();
  await expect(page.getByRole("button", { name: "Back to authoring" })).toBeDisabled();
  releaseSave();
  await expect.poll(() => uploading).toBe(true);
  await expect(description).not.toBeEditable();
  await expect(picker).toBeDisabled();
  releaseUpload();
  await expect.poll(() => rereading).toBe(true);
  await expect(description).not.toBeEditable();
  releaseRead();
  await expect(description).toBeEditable();
  await expect(description).toHaveValue("Updated description that must survive the upload.");
  await expect(picker).toBeEnabled();
  await expect(page.getByRole("link", { name: "Download" })).toBeVisible();
});
