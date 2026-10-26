import { test, expect } from "@playwright/test";
import { RULE_FIELD_NOTES } from "../../src/lib/rules";

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
  await page.getByRole("navigation", { name: "Rules sections" }).getByRole("link", { name: "Original challenges and proper credit" }).click();
  await expect(page.getByRole("heading", { name: "Original challenges and proper credit", exact: true })).toBeInViewport();
  expect(await page.getByRole("heading", { name: "Original challenges and proper credit", exact: true }).evaluate(el => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(64);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: "test-results/rules-mobile.png", fullPage: true });
});
