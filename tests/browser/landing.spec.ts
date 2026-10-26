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
  await expect(page.getByText("fresh_solver", { exact: true })).toBeVisible();
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
