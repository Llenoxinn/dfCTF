import { test, expect } from "@playwright/test";

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
