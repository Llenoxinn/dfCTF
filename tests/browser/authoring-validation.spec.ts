import { test, expect, type Page } from "@playwright/test";

async function openEditor(page: Page, existing = false) {
  const user = { id: "test-author", email: "author@example.test", codename: "test_author", emailVerified: true, role: "author", twoFactorEnabled: true };
  const state = {
    saves: [] as Record<string, unknown>[],
    errors: null as Record<string, string[]> | null,
    detail: {
      id: "test-draft", slug: "test-draft", title: "Training challenge", summary: "A fictional challenge for testing.",
      description: "Inspect the supplied fictional training file.", solution: "Read the fictional evidence and explain the intended approach.",
      flagFormat: "dfCTF{...}", category: "General skills", difficulty: "Easy", tags: [], xp: 50, estimatedMinutes: 5,
      solved: false, attempted: false, solveCount: 0, status: "draft", author: user.codename, authorId: user.id, version: 1, files: [],
    },
  };
  await page.route("**/api/**", async route => {
    const request = route.request(), url = new URL(request.url());
    let response: unknown;
    if (url.pathname === "/api/v1/auth/bootstrap") response = { user, hasAccess: true, staffVerified: true, providers: { google: false, github: false }, localMail: false };
    else if (url.pathname === "/api/v1/challenges") response = [];
    else if (url.pathname === "/api/v1/progress") response = { totalXp: 0, solvedCount: 0, attemptedCount: 0, categories: [], recentSolves: [] };
    else if (url.pathname === "/api/v1/leaderboard") response = { range: "week", weekEndsAt: new Date(Date.now() + 86_400_000).toISOString(), players: 0, standings: [], viewer: null, race: { players: [], snapshots: [] }, hourly: { start: new Date().toISOString(), counts: [], firstBlood: [] }, challenges: [], mine: { days: [] } };
    else if (url.pathname.startsWith("/api/v1/staff/challenges")) {
      if (request.method() !== "GET") {
        const payload = request.postDataJSON(); state.saves.push(payload);
        if (state.errors) {
          await route.fulfill({ status: 422, json: { error: { code: "VALIDATION_FAILED", message: "Check the highlighted fields.", details: { fieldErrors: state.errors, formErrors: [] } } } });
          return;
        }
        Object.assign(state.detail, payload); response = { id: state.detail.id };
      } else response = url.pathname.endsWith("/test-draft") ? state.detail : existing ? [state.detail] : [];
    } else throw new Error(`Unexpected test request: ${request.method()} ${url.pathname}`);
    await route.fulfill({ json: response });
  });
  await page.goto("/?view=authoring");
  if (existing) await page.getByRole("row", { name: /Training challenge/ }).click();
  else await page.getByRole("button", { name: "New challenge", exact: true }).click();
  return state;
}

async function fillRequired(page: Page) {
  await page.getByLabel(/^Title/).fill("A new training challenge");
  await page.getByLabel(/^Description/).fill("Inspect the fictional evidence supplied for this challenge.");
  await page.getByLabel(/^Walkthrough/).fill("Read the supplied file and explain how to recover the training flag.");
  await page.getByLabel(/^Correct flag/).fill("dfCTF{training_flag}");
}

test("an empty draft identifies every required field and summary actions reveal and focus the input", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const state = await openEditor(page);
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  const summary = page.getByRole("main").getByRole("alert");
  await expect(summary).toContainText("Check these fields before saving:");
  for (const label of ["Title", "Description", "Walkthrough", "Correct flag"]) {
    await expect(summary.getByRole("button", { name: new RegExp(`^${label}:`) })).toBeVisible();
    const input = page.getByLabel(new RegExp(`^${label}`));
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(input).toHaveAccessibleDescription(/(at least|Use dfCTF)/);
  }
  await expect(page.getByLabel(/^Title/)).toBeFocused();
  await expect(page.getByLabel(/^Description/)).toBeVisible();
  expect(state.saves).toHaveLength(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("empty-draft-errors-mobile.png"), fullPage: true });
  // A summary action must also reopen an invalid description after Preview is selected again.
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await summary.getByRole("button", { name: /^Description:/ }).click();
  await expect(page.getByLabel(/^Description/)).toBeVisible();
  await expect(page.getByLabel(/^Description/)).toBeFocused();
  await fillRequired(page);
  await expect(summary).toHaveCount(0);
  await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText("All changes saved", { exact: true })).toBeVisible();
  expect(state.saves).toHaveLength(1);
});

test("invalid flags, whitespace, tags, empty numbers and out-of-range values get field messages before saving", async ({ page }) => {
  const state = await openEditor(page);
  await fillRequired(page);
  await page.getByLabel(/^Title/).fill("   ");
  await page.getByLabel(/^Correct flag/).fill("missing-wrapper");
  await page.getByLabel(/^Tags/).fill("one,two,three,four,five,six,seven,eight,nine");
  await page.getByLabel(/^Points/).fill("");
  await page.getByLabel(/^Minutes/).fill("481");
  await page.getByLabel(/^Format shown/).fill("x");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  const summary = page.getByRole("main").getByRole("alert");
  await expect(summary).toContainText("Title: Enter a title with at least 3 characters.");
  await expect(summary).toContainText("Points: Enter a whole number of points from 0 to 1,000.");
  await expect(summary).toContainText("Minutes: Minutes must be 480 or fewer.");
  await expect(summary).toContainText("Tags: Use no more than 8 tags.");
  await expect(summary).toContainText("Correct flag: Use dfCTF{your_flag}.");
  await expect(summary).toContainText("Format shown to players: Enter a flag format with at least 3 characters.");
  expect(state.saves).toHaveLength(0);
  await page.getByLabel(/^Points/).fill("1.5");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(summary).toContainText("Points: Enter a whole number of points.");
});

for (const existing of [false, true]) {
  test(`server validation highlights fields and allows a corrected ${existing ? "existing" : "new"} draft to be saved`, async ({ page }) => {
    const state = await openEditor(page, existing);
    if (!existing) await fillRequired(page);
    state.errors = { description: ["Clarify the objective in this description."] };
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    const description = page.getByLabel(/^Description/);
    await expect(description).toBeFocused();
    await expect(description).toHaveAttribute("aria-invalid", "true");
    await expect(description).toHaveAccessibleDescription(/Clarify the objective/);
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Description: Clarify the objective in this description.");
    await expect(page.getByLabel(/^Title/)).toHaveValue(existing ? "Training challenge" : "A new training challenge");
    if (existing) expect(state.saves[0]).not.toHaveProperty("flag");
    state.errors = null;
    await description.fill("Find the objective in the supplied fictional evidence file.");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(page.getByText("All changes saved", { exact: true })).toBeVisible();
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    await expect(description).not.toHaveAttribute("aria-invalid", "true");
    expect(state.saves).toHaveLength(2);
  });
}
