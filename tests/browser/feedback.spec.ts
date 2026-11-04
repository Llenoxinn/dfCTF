import { test, expect, type Page, type Route } from "@playwright/test";

const SUBJECT = "Fictional footer idea", MESSAGE = "A fictional message about the footer.";

async function openDialog(page: Page, respond: (route: Route) => Promise<void>) {
  const requests: Record<string, string>[] = [];
  await page.route("**/api/v1/feedback", async route => { requests.push(route.request().postDataJSON()); await respond(route); });
  await page.goto("/privacy");
  const trigger = page.getByRole("contentinfo").getByRole("button", { name: "Send feedback", exact: true });
  await trigger.click();
  return { requests, trigger, dialog: page.getByRole("dialog", { name: "Send feedback", exact: true }) };
}
const accept = (route: Route) => route.fulfill({ status: 201, json: { received: true } });
const fill = async (page: Page) => {
  await page.getByLabel(/^Subject/).fill(SUBJECT);
  await page.getByLabel(/^Feedback message/).fill(MESSAGE);
};
const submit = (page: Page) => page.getByRole("button", { name: "Submit feedback", exact: true }).click();

test("the dialog opens from the footer, closes with Escape and returns focus", async ({ page }) => {
  const { dialog, trigger, requests } = await openDialog(page, accept);
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel(/^Subject/)).toBeFocused();
  await expect(page.getByLabel(/^Contact email/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(requests).toEqual([]);
});

test("required fields and the contact email are validated before anything is sent", async ({ page }) => {
  const { requests } = await openDialog(page, accept);
  await submit(page);
  await expect(page.getByLabel(/^Subject/)).toBeFocused();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("This field is required.");
  await page.getByLabel(/^Subject/).fill("   ");
  await submit(page);
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Enter more than spaces.");
  await fill(page);
  await page.getByLabel(/^Contact email/).fill("not-an-email");
  await submit(page);
  await expect(page.getByLabel(/^Contact email/)).toBeFocused();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Enter a valid email address.");
  expect(requests).toEqual([]);
});

test("success shows only after the server accepts, and repeat clicks send once", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const { requests, dialog, trigger } = await openDialog(page, async route => { await held; await accept(route); });
  await fill(page);
  await page.getByLabel(/^Contact email/).fill("player@example.test");
  await page.getByRole("button", { name: "Submit feedback", exact: true }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  const sending = page.getByRole("button", { name: "Sending feedback", exact: true });
  await expect(sending).toBeDisabled();
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
  await expect(page.getByLabel(/^Subject/)).not.toBeEditable();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(page.getByText("Feedback sent", { exact: true })).toHaveCount(0);
  release();
  const done = page.getByRole("button", { name: "Done", exact: true });
  await expect(done).toBeFocused();
  await expect(page.getByRole("dialog", { name: "Feedback sent", exact: true })).toContainText("player@example.test");
  expect(requests).toEqual([{ subject: SUBJECT, message: MESSAGE, email: "player@example.test" }]);
  await done.click();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(page.getByLabel(/^Subject/)).toHaveValue("");
});

test("a failed send explains the problem, keeps the text and can be retried", async ({ page }) => {
  let status = 404;
  const { requests } = await openDialog(page, async route => { if (status === 201) await accept(route); else await route.fulfill({ status, json: { error: { message: "Too many requests. Try again soon." } } }); });
  await fill(page);
  await submit(page);
  const alert = page.getByRole("dialog").getByRole("alert");
  await expect(alert).toContainText("We couldn’t send your feedback.");
  await expect(alert.getByRole("link", { name: "Help / Contact", exact: true })).toHaveAttribute("href", "/support");
  await expect(page.getByLabel(/^Subject/)).toHaveValue(SUBJECT);
  await expect(page.getByLabel(/^Feedback message/)).toHaveValue(MESSAGE);
  await expect(page.getByRole("button", { name: "Submit feedback", exact: true })).toBeFocused();
  status = 429;
  await submit(page);
  await expect(alert).toContainText("Too many requests. Try again soon.");
  status = 201;
  await submit(page);
  await expect(page.getByRole("dialog", { name: "Feedback sent", exact: true })).toBeVisible();
  expect(requests).toHaveLength(3);
});

test("server field errors point at the field and an unsent draft survives closing", async ({ page }) => {
  const { dialog, trigger } = await openDialog(page, route => route.fulfill({ status: 422, json: { error: { message: "Check the highlighted fields.", details: { fieldErrors: { message: ["Add a little more detail."] } } } } }));
  await fill(page);
  await submit(page);
  const message = page.getByLabel(/^Feedback message/);
  await expect(message).toBeFocused();
  await expect(message).toHaveAttribute("aria-invalid", "true");
  await expect(message).toHaveAccessibleDescription("Add a little more detail.");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await trigger.click();
  await expect(page.getByLabel(/^Feedback message/)).toHaveValue(MESSAGE);
});

test("the dialog fits a phone and works by touch", async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 320, height: 640 } });
  try {
    const page = await context.newPage();
    await page.goto("/privacy");
    await page.getByRole("contentinfo").getByRole("button", { name: "Send feedback", exact: true }).tap();
    await expect(page.getByRole("dialog", { name: "Send feedback", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Close", exact: true }).tap();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  } finally { await context.close(); }
});
