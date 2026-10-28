import { test, expect, type Page } from "@playwright/test";
import type { ChallengeDetail, ChallengeStatus } from "../../src/lib/types";

const discardMessage = "Discard unsaved changes? Your draft edits will be lost.";

async function mockDraft(page: Page, status: ChallengeStatus = "draft") {
  const user = { id: "test-author", email: "author@example.test", codename: "test_author", emailVerified: true, role: "author", twoFactorEnabled: true };
  const detail: ChallengeDetail & { authorId: string } = {
    id: "test-draft", slug: "test-draft", title: "Training challenge", summary: "A fictional challenge for testing.",
    description: "Inspect the supplied fictional training file.", solution: "Read the fictional training evidence and explain the intended approach.",
    flagFormat: "dfCTF{...}", category: "General skills", difficulty: "Easy", tags: [], xp: 50, estimatedMinutes: 5,
    solved: false, attempted: false, solveCount: 0, status, author: user.codename, authorId: user.id, version: 1, visibility: "practice",
    files: [
      { id: "file-one", name: "evidence.txt", size: 8, sha256: "a".repeat(64) },
      { id: "file-two", name: "notes.txt", size: 12, sha256: "b".repeat(64) },
    ],
  };
  const state = { failSave: false, failRemove: false, removals: [] as { id: string; body: string | null; header: string | undefined }[] };
  await page.route("**/api/**", async route => {
    const request = route.request(), url = new URL(request.url());
    let response: unknown;
    if (url.pathname === "/api/v1/auth/bootstrap") response = { user, hasAccess: true, staffVerified: true, providers: { google: false, github: false }, localMail: false };
    else if (url.pathname === "/api/v1/challenges") response = [];
    else if (url.pathname === "/api/v1/progress") response = { totalXp: 0, solvedCount: 0, attemptedCount: 0, categories: [], recentSolves: [] };
    else if (url.pathname === "/api/v1/leaderboard") response = {
      range: "week", weekEndsAt: new Date(Date.now() + 86_400_000).toISOString(), players: 0, standings: [], viewer: null,
      race: { players: [], snapshots: [] }, hourly: { start: new Date().toISOString(), counts: [], firstBlood: [] }, challenges: [], mine: { days: [] },
    };
    else if (url.pathname === "/api/v1/staff/challenges") response = [detail];
    else if (url.pathname === "/api/v1/staff/challenges/test-draft") {
      if (request.method() === "PATCH") {
        if (state.failSave) { await route.fulfill({ status: 503, json: { error: { message: "Draft save temporarily unavailable." } } }); return; }
        Object.assign(detail, request.postDataJSON()); response = { id: detail.id };
      } else response = detail;
    } else if (request.method() === "DELETE" && url.pathname.startsWith("/api/v1/staff/challenges/test-draft/files/")) {
      const id = url.pathname.split("/").at(-1)!;
      state.removals.push({ id, body: request.postData(), header: request.headers()["x-dfctf-request"] });
      if (state.failRemove) { await route.fulfill({ status: 503, json: { error: { message: "File removal temporarily unavailable." } } }); return; }
      detail.files = detail.files.filter(file => file.id !== id); response = { removed: true };
    } else throw new Error(`Unexpected test request: ${request.method()} ${url.pathname}`);
    await route.fulfill({ json: response });
  });
  return state;
}

async function openDraft(page: Page) {
  await page.getByRole("row", { name: /Training challenge/ }).click();
  await expect(page.getByLabel(/^Description/)).toHaveValue("Inspect the supplied fictional training file.");
}

test("unchanged drafts close silently and canceled Back or header navigation keeps unsaved edits", async ({ page }) => {
  await mockDraft(page);
  const prompts: string[] = []; let accept = false;
  page.on("dialog", async dialog => { prompts.push(dialog.message()); await (accept ? dialog.accept() : dialog.dismiss()); });
  await page.goto("/?view=authoring");
  await openDraft(page);
  await page.getByRole("button", { name: "Back to authoring", exact: true }).click();
  await expect(page.getByRole("button", { name: "New challenge", exact: true })).toBeVisible();
  expect(prompts).toEqual([]);
  await openDraft(page);
  const description = page.getByLabel(/^Description/);
  await description.fill("Unsaved description that must survive canceled navigation.");
  await page.getByRole("button", { name: "Back to authoring", exact: true }).click();
  await expect(description).toHaveValue("Unsaved description that must survive canceled navigation.");
  const challenges = page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Challenges", exact: true });
  await challenges.click();
  await expect(page).toHaveURL(/view=authoring/);
  await expect(description).toHaveValue("Unsaved description that must survive canceled navigation.");
  expect(prompts).toEqual([discardMessage, discardMessage]);
  accept = true;
  await challenges.click();
  await expect(page).toHaveURL(/view=practice/);
  await expect(page.locator("#challenge-editor")).toHaveCount(0);
  expect(prompts).toEqual([discardMessage, discardMessage, discardMessage]);
});

test("new untouched drafts close silently while edited drafts require a discard decision", async ({ page }) => {
  await mockDraft(page);
  const prompts: string[] = []; let accept = false;
  page.on("dialog", async dialog => { prompts.push(dialog.message()); await (accept ? dialog.accept() : dialog.dismiss()); });
  await page.goto("/?view=authoring");
  await page.getByRole("button", { name: "New challenge", exact: true }).click();
  await page.getByRole("button", { name: "Back to authoring", exact: true }).click();
  await expect(page.getByRole("button", { name: "New challenge", exact: true })).toBeVisible();
  expect(prompts).toEqual([]);
  await page.getByRole("button", { name: "New challenge", exact: true }).click();
  await page.getByPlaceholder("Night shift").fill("An unfinished draft");
  await page.getByRole("button", { name: "Back to authoring", exact: true }).click();
  await expect(page.getByPlaceholder("Night shift")).toHaveValue("An unfinished draft");
  expect(prompts).toEqual([discardMessage]);
  accept = true;
  await page.getByRole("button", { name: "Back to authoring", exact: true }).click();
  await expect(page.getByRole("button", { name: "New challenge", exact: true })).toBeVisible();
  expect(prompts).toEqual([discardMessage, discardMessage]);
});

test("failed saves retain the guard and a successful save clears it", async ({ page }) => {
  const state = await mockDraft(page);
  const prompts: string[] = [];
  page.on("dialog", async dialog => { prompts.push(dialog.message()); await dialog.dismiss(); });
  await page.goto("/?view=authoring");
  await openDraft(page);
  const description = page.getByLabel(/^Description/);
  await description.fill("The corrected description should survive a failed save.");
  state.failSave = true;
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Draft save temporarily unavailable.");
  await page.getByRole("button", { name: "Back to authoring", exact: true }).click();
  await expect(description).toHaveValue("The corrected description should survive a failed save.");
  expect(prompts).toEqual([discardMessage]);
  state.failSave = false;
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("All changes saved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to authoring", exact: true }).click();
  await expect(page.getByRole("button", { name: "New challenge", exact: true })).toBeVisible();
  expect(prompts).toEqual([discardMessage]);
});

for (const direction of ["back", "forward"] as const) {
  test(`browser ${direction} cancellation restores the URL and retains the draft until discard is accepted`, async ({ page }) => {
    await mockDraft(page);
    await page.goto("/?view=practice");
    const navigation = page.getByRole("navigation", { name: "Main" });
    await navigation.getByRole("link", { name: "Authoring", exact: true }).click();
    if (direction === "forward") {
      await navigation.getByRole("link", { name: "Challenges", exact: true }).click();
      await page.evaluate(() => history.back());
      await expect(page).toHaveURL(/view=authoring/);
    }
    await openDraft(page);
    const description = page.getByLabel(/^Description/);
    await description.fill("Keep this draft when browser history navigation is canceled.");
    const prompts: string[] = []; let accept = false;
    page.on("dialog", async dialog => { prompts.push(dialog.message()); await (accept ? dialog.accept() : dialog.dismiss()); });
    await page.evaluate(direction => history[direction](), direction);
    await expect.poll(() => prompts.length).toBe(1);
    await expect(page).toHaveURL(/view=authoring/);
    await expect(description).toHaveValue("Keep this draft when browser history navigation is canceled.");
    accept = true;
    await page.evaluate(direction => history[direction](), direction);
    await expect(page).toHaveURL(/view=practice/);
    await expect(page.locator("#challenge-editor")).toHaveCount(0);
    expect(prompts).toEqual([discardMessage, discardMessage]);
  });
}

test("canceling the browser reload warning retains unsaved edits", async ({ page }) => {
  await mockDraft(page);
  await page.goto("/?view=authoring");
  await openDraft(page);
  const description = page.getByLabel(/^Description/);
  await description.fill("Unsaved work that should survive a canceled reload.");
  const dialogPromise = page.waitForEvent("dialog");
  const reload = page.reload({ timeout: 10_000 }).catch(() => null);
  const dialog = await dialogPromise;
  expect(dialog.type()).toBe("beforeunload");
  await dialog.dismiss();
  await reload;
  await expect(description).toHaveValue("Unsaved work that should survive a canceled reload.");
});

test("skip-link focus and native fragment history preserve unsaved edits when Back is canceled", async ({ page }) => {
  await mockDraft(page);
  await page.goto("/?view=practice");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Authoring", exact: true }).click();
  await openDraft(page);
  await page.evaluate(() => { window.location.hash = "main-content"; });
  await expect(page).toHaveURL(/view=authoring#main-content$/);
  const fragmentUrl = page.url();
  const description = page.getByLabel(/^Description/);
  await description.fill("Unsaved edits must survive fragment history navigation.");
  const prompts: string[] = []; let accept = false;
  page.on("dialog", async dialog => { prompts.push(dialog.message()); await (accept ? dialog.accept() : dialog.dismiss()); });
  await page.getByRole("link", { name: "Skip to content", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  expect(page.url()).toBe(fragmentUrl);
  expect(prompts).toEqual([]);
  await page.evaluate(() => history.back());
  await expect.poll(() => prompts.length).toBe(1);
  await expect(page).toHaveURL(fragmentUrl);
  await expect(description).toHaveValue("Unsaved edits must survive fragment history navigation.");
  accept = true;
  await page.evaluate(() => history.back());
  await expect(page).toHaveURL(/\?view=authoring$/);
  await expect(description).toHaveValue("Unsaved edits must survive fragment history navigation.");
  accept = false;
  await page.evaluate(() => history.back());
  await expect.poll(() => prompts.length).toBe(3);
  await expect(page).toHaveURL(/\?view=authoring$/);
  await expect(description).toHaveValue("Unsaved edits must survive fragment history navigation.");
  expect(prompts).toEqual([discardMessage, discardMessage, discardMessage]);
});

test("confirmed file removal preserves typed edits and failed removal leaves both files intact", async ({ page }) => {
  const state = await mockDraft(page);
  const prompts: string[] = []; let accept = false;
  page.on("dialog", async dialog => { prompts.push(dialog.message()); await (accept ? dialog.accept() : dialog.dismiss()); });
  await page.goto("/?view=authoring");
  await openDraft(page);
  const description = page.getByLabel(/^Description/);
  await description.fill("An unsaved description must survive file removal.");
  const remove = page.getByRole("button", { name: "Remove evidence.txt", exact: true });
  await remove.click();
  expect(state.removals).toEqual([]);
  await expect(remove).toBeVisible();
  accept = true; state.failRemove = true;
  await remove.click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("File removal temporarily unavailable.");
  await expect(remove).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove notes.txt", exact: true })).toBeVisible();
  await expect(description).toHaveValue("An unsaved description must survive file removal.");
  state.failRemove = false;
  await remove.click();
  await expect(remove).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Remove notes.txt", exact: true })).toBeVisible();
  await expect(description).toHaveValue("An unsaved description must survive file removal.");
  expect(state.removals).toEqual([
    { id: "file-one", body: null, header: "1" },
    { id: "file-one", body: null, header: "1" },
  ]);
  accept = false;
  await page.getByRole("button", { name: "Back to authoring", exact: true }).click();
  await expect(description).toHaveValue("An unsaved description must survive file removal.");
  expect(prompts).toEqual([
    "Remove evidence.txt from this draft?", "Remove evidence.txt from this draft?", "Remove evidence.txt from this draft?", discardMessage,
  ]);
});

test("removing the last saved file leaves an unchanged draft ready for review", async ({ page }) => {
  await mockDraft(page);
  const prompts: string[] = [];
  page.on("dialog", async dialog => { prompts.push(dialog.message()); await dialog.accept(); });
  await page.goto("/?view=authoring");
  await openDraft(page);
  await page.getByRole("button", { name: "Remove evidence.txt", exact: true }).click();
  await page.getByRole("button", { name: "Remove notes.txt", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Send for review", exact: true })).toBeEnabled();
  await expect(page.getByText("All changes saved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to authoring", exact: true }).click();
  await expect(page.getByRole("button", { name: "New challenge", exact: true })).toBeVisible();
  expect(prompts).toEqual(["Remove evidence.txt from this draft?", "Remove notes.txt from this draft?"]);
});

for (const status of ["review", "published"] as const) {
  test(`${status} challenge files have no Remove action`, async ({ page }) => {
    await mockDraft(page, status);
    await page.goto("/?view=authoring");
    await openDraft(page);
    await expect(page.getByRole("link", { name: "Download", exact: true })).toHaveCount(2);
    await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(0);
  });
}
