import { test, expect } from "@playwright/test";
import { RULE_FIELD_NOTES, RULE_SECTIONS } from "../../src/lib/rules";

test("public rules explain fair play and contain readable field notes on desktop and mobile", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/rules");
  await expect(page.getByRole("heading", { name: "Rules / Mechanics", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No LLM-assisted solving", exact: true })).toBeVisible();
  await expect(page.getByText("Do not attack dfCTF", { exact: false })).toBeVisible();
  await expect(page.getByText("Renaming or lightly rewriting a copied problem", { exact: false })).toBeVisible();
  expect(await page.locator(".rules-note code").allTextContents()).toEqual([...RULE_FIELD_NOTES]);
  await expect(page.getByRole("link", { name: "Find the challenge", exact: true })).toHaveAttribute("href", "/?view=practice");
  await page.screenshot({ path: "test-results/rules-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator(".rules-sections > summary").click();
  await page.getByRole("navigation", { name: "Rules sections" }).getByRole("link", { name: "Original challenges and proper credit" }).click();
  await expect(page.getByRole("heading", { name: "Original challenges and proper credit", exact: true })).toBeInViewport();
  expect(await page.getByRole("heading", { name: "Original challenges and proper credit", exact: true }).evaluate(el => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(64);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: "test-results/rules-mobile.png", fullPage: true });
});

test.describe("mobile Rules section navigation", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  for (const signedIn of [false, true]) {
    test(`touch navigation stays accessible while reading ${signedIn ? "the signed-in Rules tab" : "the public rules"}`, async ({ page }, testInfo) => {
      if (signedIn) await page.route("**/api/**", async route => {
        const path = new URL(route.request().url()).pathname;
        let response: unknown;
        if (path === "/api/v1/auth/bootstrap") response = { user: { id: "rules-reader", email: "reader@example.test", codename: "rules_reader", role: "participant", emailVerified: true, twoFactorEnabled: false }, hasAccess: true, staffVerified: false, providers: { google: false, github: false }, localMail: false };
        else if (path === "/api/v1/challenges") response = [];
        else if (path === "/api/v1/progress") response = { totalXp: 0, solvedCount: 0, attemptedCount: 0, categories: [], recentSolves: [] };
        else if (path === "/api/v1/leaderboard") response = { range: "week", weekEndsAt: new Date(Date.now() + 86_400_000).toISOString(), players: 0, standings: [], viewer: null, race: { players: [], snapshots: [] }, hourly: { start: new Date().toISOString(), counts: [], firstBlood: [] }, challenges: [], mine: { days: [] } };
        else throw new Error(`Unexpected Rules request: ${path}`);
        await route.fulfill({ json: response });
      });
      await page.goto(signedIn ? "/?view=rules" : "/rules");
      const trigger = page.locator(".rules-sections > summary");
      const disclosure = page.locator(".rules-sections");
      const navigation = page.getByRole("navigation", { name: "Rules sections", exact: true });
      await trigger.tap();
      expect(await navigation.getByRole("link").allTextContents()).toEqual(RULE_SECTIONS.map(section => section.title));
      for (const link of await navigation.getByRole("link").all()) {
        expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      await navigation.getByRole("link", { name: "Original challenges and proper credit", exact: true }).tap();
      await expect(disclosure).not.toHaveAttribute("open");
      await expect(page.locator("#original-work")).toBeFocused();
      await expect(page.getByRole("heading", { name: "Original challenges and proper credit", exact: true })).toBeInViewport();
      expect(await page.evaluate(() => scrollY)).toBeGreaterThan(500);
      await expect(trigger).toBeInViewport();
      const header = await page.locator("header").boundingBox();
      const control = await trigger.boundingBox();
      expect(control!.y).toBeGreaterThanOrEqual(header!.y + header!.height);
      expect((await page.locator("#original-work").boundingBox())!.y).toBeGreaterThanOrEqual(control!.y + control!.height);
      await trigger.tap();
      await page.screenshot({ path: testInfo.outputPath("rules-navigation-open.png") });
      await page.getByRole("button", { name: "Close sections", exact: true }).tap();
      await expect(disclosure).not.toHaveAttribute("open");
      await expect(trigger).toBeFocused();
      await trigger.tap();
      await navigation.getByRole("link", { name: "No LLM-assisted solving", exact: true }).tap();
      await expect(page).toHaveURL(/#no-llms$/);
      await expect(page.locator("#no-llms")).toBeFocused();
      await expect.poll(() => page.locator("#no-llms").evaluate(element => Math.abs(element.getBoundingClientRect().top - parseFloat(getComputedStyle(element).scrollMarginTop)))).toBeLessThan(2);
      await expect(trigger).toBeInViewport();
      await page.screenshot({ path: testInfo.outputPath("rules-navigation-closed.png") });
    });
  }

  test("keyboard opens the disclosure, jumps to a section, and closes with Escape or focus leaving", async ({ page }) => {
    await page.goto("/rules");
    const trigger = page.locator(".rules-sections > summary");
    const disclosure = page.locator(".rules-sections");
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(disclosure).toHaveAttribute("open", "");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Close sections", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Solve independently", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#independent-play")).toBeFocused();
    await expect(disclosure).not.toHaveAttribute("open");
    await trigger.focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Escape");
    await expect(disclosure).not.toHaveAttribute("open");
    await expect(trigger).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Shift+Tab");
    await expect(disclosure).not.toHaveAttribute("open");
    await trigger.focus();
    await page.keyboard.press("Enter");
    // A quick return to the menu must not be overridden by a deferred section focus.
    await page.getByRole("link", { name: "Solve independently", exact: true }).evaluate(link => {
      (link as HTMLAnchorElement).click();
      document.querySelector<HTMLElement>(".rules-sections > summary")!.focus();
    });
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
    await expect(trigger).toBeFocused();
  });

  test("the menu fits a short viewport, scrolls its links, and dismisses on an outside tap", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 568, height: 320 });
    await page.goto("/rules");
    await page.evaluate(() => document.documentElement.dataset.theme = "light");
    const trigger = page.locator(".rules-sections > summary");
    await trigger.tap();
    await expect(page.locator(".rules-sections-panel")).toBeInViewport({ ratio: 1 });
    const panel = await page.locator(".rules-sections-panel").boundingBox();
    expect(panel!.y + panel!.height).toBeLessThanOrEqual(320);
    await expect(page.getByRole("button", { name: "Close sections", exact: true })).toBeInViewport();
    const navigation = page.locator(".rules-sections-panel nav");
    expect(await navigation.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("rules-navigation-landscape.png") });
    await page.getByRole("navigation", { name: "Rules sections", exact: true }).getByRole("link").last().tap();
    await expect(page).toHaveURL(/#weekly$/);
    await trigger.tap();
    await page.locator("header").tap({ position: { x: 4, y: 4 } });
    await expect(page.locator(".rules-sections")).not.toHaveAttribute("open");
    await page.setViewportSize({ width: 320, height: 740 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => document.documentElement.style.fontSize = "200%");
    await trigger.tap();
    await expect(page.locator(".rules-sections-panel")).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole("button", { name: "Close sections", exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("rules-navigation-large-text.png") });
    await page.getByRole("navigation", { name: "Rules sections", exact: true }).getByRole("link", { name: "Original challenges and proper credit", exact: true }).tap();
    await expect(page.locator("#original-work")).toBeFocused();
    await expect.poll(async () => (await page.locator("#original-work").boundingBox())!.y - ((await trigger.boundingBox())!.y + (await trigger.boundingBox())!.height)).toBeGreaterThanOrEqual(8);
  });
});
