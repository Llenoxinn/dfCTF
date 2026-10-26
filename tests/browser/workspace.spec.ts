import { test, expect, type Page, type Route } from "@playwright/test";
import type { Bootstrap, ChallengeDetail, Leaderboard } from "../../src/lib/types";

async function mockWorkspace(page: Page, handle?: (route: Route, url: URL) => Promise<boolean>) {
  const bootstrap: Bootstrap = {
    user: { id: "test-author", email: "author@example.test", codename: "test_author", emailVerified: true, role: "author", twoFactorEnabled: true },
    hasAccess: true, staffVerified: true, providers: { google: false, github: false }, localMail: false,
  };
  const board: Leaderboard = {
    range: "week", weekEndsAt: new Date(Date.now() + 86_400_000).toISOString(), players: 0, standings: [], viewer: null,
    race: { players: [], snapshots: [] }, hourly: { start: new Date().toISOString(), counts: [], firstBlood: [] },
    challenges: [], mine: { start: new Date().toISOString(), days: [] },
  };
  const challenges: ChallengeDetail[] = [];
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    if (await handle?.(route, url)) return;
    let response: unknown;
    if (url.pathname === "/api/v1/auth/bootstrap") response = bootstrap;
    else if (url.pathname === "/api/v1/challenges") response = challenges;
    else if (url.pathname === "/api/v1/progress") response = { totalXp: 0, solvedCount: 0, attemptedCount: 0, categories: [], recentSolves: [] };
    else if (url.pathname === "/api/v1/leaderboard") response = board;
    else if (["/api/auth/list-accounts", "/api/auth/list-sessions"].includes(url.pathname)) response = [];
    else if (url.pathname === "/api/auth/get-session") response = { session: { id: "test-session" } };
    else throw new Error(`Unexpected test request: ${route.request().method()} ${url.pathname}`);
    await route.fulfill({ json: response });
  });
  return { bootstrap, board, challenges };
}

function challenge(id: string, title: string): ChallengeDetail {
  return {
    id, title, slug: id, summary: "A fictional challenge for testing.", description: "Inspect the supplied fictional training file.",
    flagFormat: "dfCTF{...}", category: "General skills", difficulty: "Easy", tags: [], xp: 50, estimatedMinutes: 5,
    solved: false, attempted: false, solveCount: 0, status: "published", author: "test_author", version: 1, files: [],
  };
}

test("a late submission cannot solve or reveal a walkthrough on the next challenge", async ({ page }) => {
  const first = challenge("challenge-a", "First training case");
  const next = { ...challenge("challenge-b", "Weekly training case"), weeklyEndsAt: new Date(Date.now() + 86_400_000).toISOString() };
  let release!: () => void, submitted = false, completed = false;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const state = await mockWorkspace(page, async (route, url) => {
    if (url.pathname === "/api/v1/challenges/challenge-a/submissions") {
      submitted = true; await gate;
      completed = true;
      await route.fulfill({ json: { status: "correct", xp: 50, totalXp: 50, solution: "Walkthrough belonging only to challenge A." } });
    } else if (url.pathname === "/api/v1/challenges/challenge-a") await route.fulfill({ json: first });
    else if (url.pathname === "/api/v1/challenges/challenge-b") await route.fulfill({ json: next });
    else if (url.pathname === "/api/v1/progress") await route.fulfill({ json: { totalXp: completed ? 50 : 0, solvedCount: completed ? 1 : 0, attemptedCount: 0, categories: [], recentSolves: [] } });
    else return false;
    return true;
  });
  state.challenges.push(first, next);
  await page.goto("/?view=practice&challenge=challenge-a");
  await page.getByLabel("Flag", { exact: true }).fill("dfCTF{first_case}");
  await page.getByRole("button", { name: "Submit flag", exact: true }).click();
  await expect.poll(() => submitted).toBe(true);
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "This week", exact: true }).click();
  await expect(page.getByRole("heading", { name: next.title, exact: true })).toBeVisible();
  await page.getByLabel("Flag", { exact: true }).fill("dfCTF{next_case}");
  const refreshed = page.waitForResponse(response => new URL(response.url()).pathname === "/api/v1/progress");
  release();
  await refreshed;
  await expect(page.locator(".standing-pill")).toContainText("50 pts");
  await expect(page.getByRole("heading", { name: next.title, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Flag captured" })).toHaveCount(0);
  await expect(page.getByText("Walkthrough belonging only to challenge A.")).toHaveCount(0);
  await expect(page.getByLabel("Flag", { exact: true })).toHaveValue("dfCTF{next_case}");
  await expect(page.getByRole("button", { name: "Submit flag", exact: true })).toBeEnabled();
});

test("leaderboard errors keep range controls and support cached recovery and retry", async ({ page }) => {
  let fail = true, allRequests = 0;
  await mockWorkspace(page, async (route, url) => {
    if (url.pathname !== "/api/v1/leaderboard" || url.searchParams.get("range") !== "all") return false;
    allRequests++;
    if (fail) await route.fulfill({ status: 503, json: { error: { message: "Leaderboard temporarily unavailable." } } });
    else await route.fulfill({ json: {
      range: "all", weekEndsAt: new Date(Date.now() + 86_400_000).toISOString(), players: 1,
      standings: [{ rank: 1, codename: "all_time_leader", points: 100, solves: 2 }], viewer: null, challenges: [],
    } });
    return true;
  });
  await page.goto("/?view=leaderboard");
  const ranges = page.getByRole("group", { name: "Range", exact: true });
  const error = page.getByRole("main").getByRole("alert");
  await ranges.getByRole("button", { name: "All time", exact: true }).click();
  await expect(error).toContainText("Leaderboard temporarily unavailable.");
  await expect(ranges).toBeVisible();
  await ranges.getByRole("button", { name: "This week", exact: true }).click();
  await expect(error).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Race for #1" })).toBeVisible();
  expect(allRequests).toBe(1);
  await ranges.getByRole("button", { name: "All time", exact: true }).click();
  await expect(error).toContainText("Leaderboard temporarily unavailable.");
  fail = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(error).toHaveCount(0);
  await expect(page.getByText("all_time_leader", { exact: true })).toBeVisible();
  expect(allRequests).toBe(3);
});

test("enrolled staff can unlock Settings with a backup code", async ({ page }) => {
  let submitted: unknown;
  const state = await mockWorkspace(page, async (route, url) => {
    if (url.pathname !== "/api/v1/auth/mfa/verify") return false;
    submitted = route.request().postDataJSON();
    state.bootstrap.staffVerified = true;
    await route.fulfill({ json: { verified: true } });
    return true;
  });
  state.bootstrap.staffVerified = false;
  await page.goto("/?view=settings");
  await page.getByLabel("Authenticator code", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "Use a backup code instead" }).click();
  const code = page.getByLabel("Backup code", { exact: true });
  await expect(code).toHaveValue("");
  await expect(code).toHaveAttribute("inputmode", "text");
  await code.fill("saved-backup-code");
  await page.getByRole("button", { name: "Verify code", exact: true }).click();
  await expect(page.getByText("This session is verified. Staff tools are unlocked.")).toBeVisible();
  expect(submitted).toEqual({ code: "saved-backup-code", method: "backup" });
});

test("initial authenticator enrollment still requires a TOTP code", async ({ page }) => {
  let submitted: unknown;
  const state = await mockWorkspace(page, async (route, url) => {
    if (url.pathname === "/api/v1/auth/mfa/setup") await route.fulfill({ json: {
      totpURI: "otpauth://totp/dfCTF?secret=JBSWY3DPEHPK3PXP", backupCodes: ["saved-backup-code"],
    } });
    else if (url.pathname === "/api/v1/auth/mfa/verify") {
      submitted = route.request().postDataJSON();
      state.bootstrap.staffVerified = true;
      state.bootstrap.user!.twoFactorEnabled = true;
      await route.fulfill({ json: { verified: true } });
    } else return false;
    return true;
  });
  state.bootstrap.staffVerified = false;
  state.bootstrap.user!.twoFactorEnabled = false;
  await page.goto("/?view=settings");
  await page.getByRole("button", { name: "Set up authenticator", exact: true }).click();
  await expect(page.getByRole("button", { name: "Use a backup code instead" })).toHaveCount(0);
  await page.getByLabel("Authenticator code", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "Verify code", exact: true }).click();
  await expect(page.getByText("This session is verified. Staff tools are unlocked.")).toBeVisible();
  expect(submitted).toEqual({ code: "123456", method: "totp" });
});

test("authors can return a challenge from review to an editable draft", async ({ page }) => {
  const detail = {
    ...challenge("review-case", "Review training case"), status: "review", authorId: "test-author", canPublish: false,
    solution: "Read the supplied file to recover the training flag.",
    files: [{ id: "review-file", name: "evidence.txt", size: 8, sha256: "a".repeat(64) }],
  };
  let submitted: unknown;
  await mockWorkspace(page, async (route, url) => {
    if (url.pathname === "/api/v1/staff/challenges") await route.fulfill({ json: [detail] });
    else if (url.pathname === "/api/v1/staff/challenges/review-case") {
      if (route.request().method() === "PATCH") { submitted = route.request().postDataJSON(); detail.status = "draft"; }
      await route.fulfill({ json: detail });
    } else return false;
    return true;
  });
  await page.goto("/?view=authoring");
  await page.getByRole("row", { name: /Review training case/ }).click();
  const description = page.getByLabel(/^Description/);
  await expect(description).not.toBeEditable();
  await page.getByRole("button", { name: "Return to draft", exact: true }).click();
  await expect(description).toBeEditable();
  expect(submitted).toEqual({ status: "draft" });
  await expect(page.getByText("Returned to draft.", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Download" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Return to draft", exact: true })).toHaveCount(0);
});
