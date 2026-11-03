import { test, expect, type Page } from "@playwright/test";
import type { ChallengeDetail } from "../../src/lib/types";

async function mockReview(page: Page, selfReview = false, administrator = false) {
  const user = { id: selfReview ? "author-id" : "reviewer-id", email: "reviewer@example.test", codename: "test_reviewer", emailVerified: true, role: administrator ? "admin" : "reviewer", twoFactorEnabled: true };
  const detail: ChallengeDetail & { authorId: string; canPublish: boolean } = {
    id: "review-id", slug: "review-fixture", title: "Review fixture", summary: "A fictional review exercise.",
    description: "Inspect the fictional evidence and recover its flag.", solution: "Read the fictional file and recover its complete training flag.",
    flagFormat: "dfCTF{...}", category: "General skills", difficulty: "Easy", tags: [], xp: 50, estimatedMinutes: 5,
    solved: false, attempted: false, solveCount: 0, status: administrator ? "published" : "review", author: "test_author", authorId: "author-id", version: 1,
    canPublish: !selfReview && !administrator, files: [{ id: "old-file", name: "original.txt", size: 8, sha256: "a".repeat(64) }],
  };
  const state = { failSave: false, saves: 0, uploads: 0, removals: 0, publications: [] as unknown[] };
  await page.route("**/api/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    let response: unknown;
    if (path === "/api/v1/auth/bootstrap") response = { user, hasAccess: true, staffVerified: true, providers: { google: false, github: false }, localMail: false };
    else if (path === "/api/v1/challenges") response = [];
    else if (path === "/api/v1/progress") response = { totalXp: 0, solvedCount: 0, attemptedCount: 0, categories: [], recentSolves: [] };
    else if (path === "/api/v1/leaderboard") response = { range: "week", weekEndsAt: new Date(Date.now() + 86_400_000).toISOString(), players: 0, standings: [], viewer: null, race: { players: [], snapshots: [] }, hourly: { start: new Date().toISOString(), counts: [], firstBlood: [] }, challenges: [], mine: { days: [] } };
    else if (path === "/api/v1/staff/challenges") response = [detail];
    else if (path === "/api/v1/staff/challenges/review-id") {
      if (request.method() === "PATCH") {
        state.saves++;
        if (state.failSave) { await route.fulfill({ status: 503, json: { error: { message: "Review save temporarily unavailable." } } }); return; }
        Object.assign(detail, request.postDataJSON());
        if (administrator) { detail.status = "review"; detail.version = 2; }
      }
      response = detail;
    } else if (path.endsWith("/files/old-file") && request.method() === "DELETE") {
      state.removals++; detail.files = []; response = { removed: true };
    } else if (path.endsWith("/files") && request.method() === "POST") {
      state.uploads++; detail.files.push({ id: "new-file", name: "corrected.txt", size: 10, sha256: "b".repeat(64) }); response = detail.files[0];
    } else if (path.endsWith("/publish") && request.method() === "POST") {
      state.publications.push(request.postDataJSON()); detail.status = "published"; response = { id: detail.id, status: detail.status };
    } else throw new Error(`Unexpected test request: ${request.method()} ${path}`);
    await route.fulfill({ json: response });
  });
  await page.goto("/?view=authoring");
  if (!administrator) await page.getByRole("row", { name: /Review fixture/ }).click();
  return state;
}

test("reviewers edit and save in review, replace files, then test-solve and publish", async ({ page }) => {
  const state = await mockReview(page);
  const title = page.getByLabel(/^Title/), flag = page.getByLabel("Your test-solve flag");
  const publish = page.getByRole("button", { name: "Verify and publish", exact: true });
  await expect(title).toBeEditable();
  await expect(page.getByRole("button", { name: "New challenge", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Send for review", exact: true })).toHaveCount(0);
  await expect(publish).toBeDisabled();
  await flag.fill("dfCTF{fictional_review}");
  await expect(publish).toBeEnabled();
  await title.fill("Corrected review fixture");
  await expect(publish).toBeDisabled();
  await expect(flag).toBeDisabled();
  state.failSave = true;
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Review save temporarily unavailable.");
  await expect(title).toHaveValue("Corrected review fixture");
  await expect(publish).toBeDisabled();
  page.on("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Remove original.txt", exact: true }).click();
  await expect(page.getByText("original.txt", { exact: true })).toHaveCount(0);
  await page.locator('input[type="file"]').setInputFiles({ name: "corrected.txt", mimeType: "text/plain", buffer: Buffer.from("Fictional!") });
  state.failSave = false;
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText("Review changes saved. Test-solve the updated challenge before publishing.")).toBeVisible();
  await expect(page.locator(".title-row")).toContainText("In review");
  await expect(flag).toHaveValue("");
  await expect(publish).toBeDisabled();
  await flag.fill("dfCTF{fictional_review}");
  await publish.click();
  await expect(page.getByText("Published. The challenge is now on the board.")).toBeVisible();
  await expect(title).not.toBeEditable();
  await expect(page.getByRole("button", { name: "Save changes", exact: true })).toHaveCount(0);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  expect(state).toMatchObject({ saves: 2, uploads: 1, removals: 1, publications: [{ flag: "dfCTF{fictional_review}" }] });
});

test("administrator row actions appear on hover, open the full editor, and save for independent review", async ({ page }, testInfo) => {
  const state = await mockReview(page, false, true);
  const row = page.getByRole("row", { name: /Review fixture/ });
  const actions = page.getByRole("button", { name: "Actions for Review fixture", exact: true });
  await page.getByRole("heading", { name: "Authoring", exact: true }).hover();
  await expect(actions).toHaveCSS("opacity", "0");
  await row.hover();
  await expect(actions).toHaveCSS("opacity", "1");
  await actions.click();
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("administrator-edit-menu.png") });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Edit", exact: true })).not.toBeVisible();
  await page.getByRole("heading", { name: "Authoring", exact: true }).click();
  await expect(actions).toHaveCSS("opacity", "0");
  await row.getByRole("button", { name: "Review fixture", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(actions).toBeFocused();
  await expect(actions).toHaveCSS("opacity", "1");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  for (const label of [/^Title/, "Walkthrough", "Points", "Minutes", "Tags", "Replace the correct flag"]) await expect(page.getByLabel(label)).toBeEditable();
  for (const label of ["Availability", "Category"]) await expect(page.getByLabel(label)).toBeEnabled();
  await expect(page.locator('input[type="file"]')).toBeEnabled();
  await page.getByLabel(/^Title/).fill("Administrator revised fixture");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator(".title-row")).toContainText("In review");
  await expect(page.getByText("Changes saved and awaiting independent review. Another reviewer must test-solve and approve them before publishing.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Verify and publish", exact: true })).toHaveCount(0);
  expect(state.saves).toBe(1);
});

test("administrator edit actions remain reachable on a narrow touch screen", async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await mockReview(page, false, true);
    const actions = page.getByRole("button", { name: "Actions for Review fixture", exact: true });
    await expect(actions).toHaveCSS("opacity", "1");
    await actions.tap();
    await page.getByRole("button", { name: "Edit", exact: true }).tap();
    await expect(page.getByLabel(/^Title/)).toBeEditable();
  } finally { await context.close(); }
});

test("a reviewer who originally authored the challenge cannot edit or self-publish it", async ({ page }) => {
  await mockReview(page, true);
  await expect(page.getByLabel(/^Title/)).not.toBeEditable();
  await expect(page.getByRole("button", { name: "Save changes", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Verify and publish", exact: true })).toHaveCount(0);
  await expect(page.getByText("Waiting for an independent reviewer. Authors and administrators who edited this version can’t approve it.")).toBeVisible();
});
