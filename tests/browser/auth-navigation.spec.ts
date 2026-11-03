import { test, expect, type Page } from "@playwright/test";

async function mockSignIn(page: Page) {
  let signedIn = false;
  let callbackURL = "";
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let response: unknown;
    if (path === "/api/v1/auth/bootstrap") response = {
      user: signedIn ? { id: "visitor", email: "visitor@example.test", codename: "visitor", emailVerified: true, role: "participant", twoFactorEnabled: false } : null,
      hasAccess: signedIn, staffVerified: false, providers: { google: true, github: true }, localMail: false,
    };
    else if (path === "/api/auth/sign-in/email") {
      callbackURL = route.request().postDataJSON().callbackURL;
      signedIn = true; response = {};
    } else if (path === "/api/v1/community") response = { weekly: null, recent: [], top: [], topAll: [], activity: { start: new Date().toISOString(), days: [] }, totals: { challenges: 0, categories: [] } };
    else if (path === "/api/v1/challenges") response = [{ id: "sample", title: "Sample training", category: "General skills", difficulty: "Easy", tags: [], xp: 50, estimatedMinutes: 5, solved: false, attempted: false, solveCount: 0, status: "published" }];
    else if (path === "/api/v1/progress") response = { totalXp: 0, solvedCount: 0, attemptedCount: 0, categories: [], recentSolves: [] };
    else if (path === "/api/v1/leaderboard") response = { range: "week", weekEndsAt: new Date(Date.now() + 86_400_000).toISOString(), players: 0, standings: [], viewer: null, race: { players: [], snapshots: [] }, hourly: { start: new Date().toISOString(), counts: [], firstBlood: [] }, challenges: [], mine: { start: new Date().toISOString(), days: [] } };
    else throw new Error(`Unexpected request: ${path}`);
    await route.fulfill({ json: response });
  });
  return () => callbackURL;
}

test("a guest challenge link preserves lesson filters through registration toggle and sign-in", async ({ page }) => {
  const callback = await mockSignIn(page);
  await page.goto("/?view=practice&category=General+skills&difficulty=Easy");
  await expect(page.getByRole("status")).toContainText("open General skills challenges");
  const options = page.getByRole("group", { name: "Choose an option" });
  await options.getByRole("button", { name: "Create account", exact: true }).click();
  await options.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill("visitor@example.test");
  await page.getByLabel("Password", { exact: true }).fill("fictional sign-in password");
  await page.locator("form").getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Challenges", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/view=practice&category=General\+skills&difficulty=Easy/);
  await expect(page.getByRole("group", { name: "Category", exact: true }).getByRole("button", { name: /General skills/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("group", { name: "Difficulty", exact: true }).getByRole("button", { name: "Easy", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(callback()).toBe("http://127.0.0.1:3100/?view=practice&category=General+skills&difficulty=Easy");
});

test("the full leaderboard explains sign-in and returns to the leaderboard", async ({ page }) => {
  await mockSignIn(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in for full leaderboard", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("the full leaderboard");
  await page.getByLabel("Email", { exact: true }).fill("visitor@example.test");
  await page.getByLabel("Password", { exact: true }).fill("fictional sign-in password");
  await page.locator("form").getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/?view=leaderboard");
  await expect(page.getByRole("navigation", { name: "Main", exact: true }).getByRole("link", { name: "Leaderboard", exact: true })).toHaveAttribute("aria-current", "page");
});
