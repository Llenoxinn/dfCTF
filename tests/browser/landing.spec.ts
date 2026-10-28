import { test, expect, type Page } from "@playwright/test";
import { CATEGORIES, type Community } from "../../src/lib/types";

function community(): Community {
  return {
    weekly: null, recent: [], top: [], topAll: [],
    activity: { start: "2026-10-01T00:00:00+08:00", days: [0, 0, 0] },
    totals: { challenges: 0, categories: CATEGORIES.map(category => ({ category, easy: 0, medium: 0, hard: 0 })) },
  };
}

async function anonymous(page: Page) {
  await page.route("**/api/v1/auth/bootstrap", route => route.fulfill({ json: {
    user: null, hasAccess: false, staffVerified: false, providers: { google: false, github: false }, localMail: false,
  } }));
}

test("failed landing data shows an error and retry restores real standings and activity", async ({ page }) => {
  await anonymous(page);
  let fail = true, requests = 0;
  await page.route("**/api/v1/community", async route => {
    requests++;
    if (fail) await route.fulfill({ status: 503, json: { error: { message: "Unavailable" } } });
    else {
      const data = community();
      data.top = [{ rank: 1, codename: "fresh_solver", points: 100, solves: 3 }];
      data.activity.days = [2, 1, 0];
      await route.fulfill({ json: data });
    }
  });
  await page.goto("/");
  const main = page.getByRole("main");
  await expect(main.getByRole("alert")).toContainText("Could not load the latest standings and activity.");
  await expect(page.getByText("Standings are temporarily unavailable.", { exact: true })).toBeVisible();
  await expect(page.getByText("No points yet this week.", { exact: false })).toHaveCount(0);
  const activity = page.getByRole("region", { name: "Solves across dfCTF", exact: true });
  await expect(activity.locator(".stat strong")).toHaveText("—");
  fail = false;
  await main.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(main.getByRole("alert")).toHaveCount(0);
  // The leader also appears in the live stats strip; this checks the standings list itself.
  await expect(page.locator(".standings").getByText("fresh_solver", { exact: true })).toBeVisible();
  await expect(activity.locator(".stat strong")).toHaveText("3");
  expect(requests).toBe(2);
});

test("loading data is distinct from a successfully loaded empty leaderboard", async ({ page }) => {
  await anonymous(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/v1/community", async route => { await gate; await route.fulfill({ json: community() }); });
  await page.goto("/");
  await expect(page.getByText("Loading standings…", { exact: true })).toBeVisible();
  await expect(page.getByText("No solves yet. Be the first.", { exact: true })).toHaveCount(0);
  release();
  await expect(page.getByText("No points yet this week.", { exact: false })).toBeVisible();
  await expect(page.getByText("No solves yet. Be the first.", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Solves across dfCTF", exact: true }).locator(".stat strong")).toHaveText("0");
});

test("the closing cursor effect follows foreground text and buttons without blocking selection or clicks", async ({ page }) => {
  await anonymous(page);
  await page.route("**/api/v1/community", route => route.fulfill({ json: community() }));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const closing = page.locator('section[aria-labelledby="closing-title"]');
  await closing.scrollIntoViewIfNeeded();
  const canvas = closing.locator("canvas");
  await expect.poll(() => canvas.evaluate(node => (node as HTMLCanvasElement).width)).toBeGreaterThan(1000);
  const pixels = () => canvas.evaluate(node => (node as HTMLCanvasElement).toDataURL());
  await page.mouse.move(0, 0);
  const idle = await pixels();
  await closing.getByRole("heading").hover();
  await expect.poll(pixels).not.toBe(idle);
  const overText = await pixels();
  await closing.getByRole("button", { name: "Start solving", exact: true }).hover();
  await expect.poll(pixels).not.toBe(overText);
  await expect(canvas).toHaveCSS("pointer-events", "none");
  const paragraph = closing.locator("p");
  const selection = await paragraph.evaluate(element => {
    const range = document.createRange();
    range.setStart(element.firstChild!, 0);
    range.setEnd(element.firstChild!, "Create an account in a minute.".length);
    const box = range.getBoundingClientRect();
    return { left: box.left + 1, right: box.right - 1, y: box.top + box.height / 2 };
  });
  await page.mouse.move(selection.left, selection.y);
  await page.mouse.down();
  await page.mouse.move(selection.right, selection.y, { steps: 12 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe("Create an account in a minute.");
  await closing.getByRole("button", { name: "Start solving", exact: true }).click();
  await expect(page).toHaveURL(/auth=signup/);
  await expect(page.locator("form").getByRole("button", { name: "Create account", exact: true })).toBeVisible();
  await page.goBack();
  await closing.getByRole("button", { name: "See the leaderboard", exact: true }).click();
  await expect(page).toHaveURL(/auth=signin/);
  await expect(page.locator("form").getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
});
