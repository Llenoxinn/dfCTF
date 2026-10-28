import { test, expect, type Page } from "@playwright/test";
import { RESOURCE_GUIDES } from "../../src/lib/resources";

const sections = RESOURCE_GUIDES.map(guide => [guide.id, guide.title]);

async function mockHome(page: Page, signedIn = false, featured = false) {
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    let response: unknown;
    if (url.pathname === "/api/v1/auth/bootstrap") response = {
      user: signedIn ? { id: "test-author", email: "author@example.test", codename: "test_author", emailVerified: true, role: "author", twoFactorEnabled: true } : null,
      hasAccess: signedIn, staffVerified: signedIn, providers: { google: false, github: false }, localMail: false,
    };
    else if (url.pathname === "/api/v1/community") response = {
      weekly: featured ? {
        id: "featured-training", title: "Fictional weekly training", summary: "A fictional exercise for the weekly feature.", category: "General skills", difficulty: "Easy",
        xp: 50, solveCount: 0, solvers: [], endsAt: new Date(Date.now() + 86_400_000).toISOString(),
      } : null,
      recent: [], top: [], topAll: [], activity: { start: new Date().toISOString(), days: [] }, totals: { challenges: 0, categories: [] },
    };
    else if (url.pathname === "/api/v1/challenges" || url.pathname === "/api/v1/staff/challenges") response = [];
    else if (url.pathname === "/api/v1/progress") response = { totalXp: 0, solvedCount: 0, attemptedCount: 0, categories: [], recentSolves: [] };
    else if (url.pathname === "/api/v1/leaderboard") response = {
      range: "week", weekEndsAt: new Date(Date.now() + 86_400_000).toISOString(), players: 0, standings: [], viewer: null,
      race: { players: [], snapshots: [] }, hourly: { start: new Date().toISOString(), counts: [], firstBlood: [] }, challenges: [], mine: { days: [] },
    };
    else throw new Error(`Unexpected test request: ${route.request().method()} ${url.pathname}`);
    await route.fulfill({ json: response });
  });
}

test("resources are public and offer expandable tool tutorials with official references and clear practice scope", async ({ page }) => {
  const apiRequests: string[] = [];
  page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api/")) apiRequests.push(request.url()); });
  await page.goto("/resources");
  await expect(page.getByRole("heading", { name: "Tutorials & Resources", exact: true })).toBeVisible();
  await expect(page).toHaveTitle(/Tutorials & Resources/);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Start with the big picture", exact: true })).toBeVisible();
  await expect(main.getByRole("heading", { name: "Practice with permission", exact: true })).toBeVisible();
  await expect(main.getByRole("link", { name: "Rules / Mechanics", exact: true })).toHaveAttribute("href", "/rules");
  const index = page.getByRole("navigation", { name: "Resource sections", exact: true });
  await expect(index.getByRole("link")).toHaveCount(sections.length + 2);
  await expect(index.getByRole("link", { name: "Start here", exact: true })).toHaveAttribute("href", "#getting-started");
  await expect(index.getByRole("link", { name: "Practice with permission", exact: true })).toHaveAttribute("href", "#practice-safely");
  for (const [id, title] of sections) {
    await expect(index.getByRole("link", { name: title, exact: true })).toHaveAttribute("href", `#${id}`);
    await expect(main.getByRole("heading", { name: title, exact: true })).toBeVisible();
  }
  await expect(main.locator(".resource-tool[open]")).toHaveCount(0);
  await expect(main.locator(".resource-exercise[open]")).toHaveCount(0);
  await expect(main.locator("pre:visible")).toHaveCount(0);
  for (const id of ["powershell", "wireshark", "ghidra", "openssl"]) {
    await expect(main.locator(`#${id} > summary`)).toBeVisible();
  }
  await main.locator("#general-skills-deeper > summary").click();
  const tutorial = main.locator("#cyberchef");
  await tutorial.locator(":scope > summary").click();
  await expect(tutorial).toHaveAttribute("open", "");
  await expect(tutorial.locator("ol")).toBeHidden();
  await tutorial.locator(".resource-exercise > summary").click();
  await expect(tutorial.locator("ol")).toBeVisible();
  await expect(tutorial.getByRole("link").first()).toHaveAttribute("href", /^https:\/\//);
  const externalLinks = await main.locator('a[href^="https://"]').evaluateAll(links => links.map(link => ({
    href: link.getAttribute("href"), target: link.getAttribute("target"), rel: link.getAttribute("rel"),
  })));
  expect(externalLinks.length).toBeGreaterThan(8);
  expect(externalLinks.every(link => link.target !== "_blank" || link.rel?.split(" ").includes("noopener"))).toBe(true);
  expect(apiRequests).toEqual([]);
});

test("every area introduces its basics before tools and makes exercises an explicit next step", async ({ page }) => {
  await page.goto("/resources");
  for (const guide of RESOURCE_GUIDES) {
    const section = page.locator(`#${guide.id}`);
    const basics = section.locator(".resource-area-notes");
    const tool = section.locator(":scope > .resource-tools > details").first();
    await expect(tool).toHaveAttribute("id", guide.tools[0].id);
    await expect(section.getByRole("list", { name: `${guide.title} tool recommendations` }).getByRole("listitem")).toHaveCount(guide.tools.length - 1 + guide.deeper.length);
    const toolToggle = tool.locator(":scope > summary");
    const exercise = tool.locator(".resource-exercise");
    const exerciseToggle = exercise.locator(":scope > summary");
    const steps = exercise.locator("ol");
    await expect(basics.getByRole("definition")).toHaveCount(guide.concepts.length);
    await expect(basics.getByRole("definition").first()).toBeVisible();
    expect(await basics.evaluate(element => !!(element.compareDocumentPosition(element.parentElement!.querySelector(".resource-tools")!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
    await expect(tool.locator(".resource-tool-copy")).toBeHidden();
    await toolToggle.focus();
    await page.keyboard.press("Enter");
    await expect(tool.locator(".resource-tool-copy > p")).toBeVisible();
    await expect(steps).toBeHidden();
    await exerciseToggle.focus();
    await page.keyboard.press("Enter");
    await expect(steps).toBeVisible();
    await exerciseToggle.focus();
    await page.keyboard.press("Space");
    await expect(steps).toBeHidden();
    await expect(tool.locator(".resource-tool-copy > p")).toBeVisible();
    await toolToggle.focus();
    await page.keyboard.press("Enter");
  }
  await expect(page.locator(".resource-exercise[open]")).toHaveCount(0);
});

test("every area offers keyboard-controlled deeper guides without opening the other disclosures", async ({ page }) => {
  const apiRequests: string[] = [];
  page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api/")) apiRequests.push(request.url()); });
  await page.goto("/resources");
  await expect(page.locator("details.resource-deep-dive[open]")).toHaveCount(0);
  for (const guide of RESOURCE_GUIDES) {
    const section = page.locator(`#${guide.id}`);
    const deeper = section.locator("details.resource-deep-dive");
    const toggle = deeper.locator(":scope > summary");
    const tools = deeper.locator("details.resource-tool");
    const firstTool = tools.first();
    const toolToggle = firstTool.locator(":scope > summary");
    const workflow = firstTool.locator(".resource-tool-copy");
    await expect(tools).toHaveCount(guide.tools.length - 1 + guide.deeper.length);
    await expect(toolToggle).toBeHidden();
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(deeper).toHaveAttribute("open", "");
    await expect(section.getByRole("definition")).toHaveCount(guide.concepts.length);
    await expect(section.getByRole("definition").first()).toBeVisible();
    await expect(toolToggle).toBeVisible();
    await expect(workflow).toBeHidden();
    await toolToggle.focus();
    await page.keyboard.press("Space");
    await expect(workflow).toBeVisible();
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(workflow).toBeHidden();
    await expect(firstTool).toHaveAttribute("open", "");
    await expect(section.locator(":scope > .resource-tools > details").first()).not.toHaveAttribute("open", "");
    await page.keyboard.press("Enter");
    await expect(workflow).toBeVisible();
    await toolToggle.focus();
    await page.keyboard.press("Space");
    await expect(workflow).toBeHidden();
    await toggle.focus();
    await page.keyboard.press("Enter");
  }
  await expect(page.locator("details.resource-deep-dive[open]")).toHaveCount(0);
  expect(apiRequests).toEqual([]);
});

test("expanded deeper workflows fit mobile and desktop and new areas support direct links", async ({ page }) => {
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    await page.goto("about:blank");
    await page.goto("/resources#audio-recovery");
    const audio = page.locator("#audio-recovery");
    await expect(audio.getByRole("heading", { level: 2 })).toBeInViewport();
    // Expand every path to stress long commands and tool names, after keyboard behavior is checked above.
    await page.locator("details.resource-deep-dive").evaluateAll(disclosures => disclosures.forEach(disclosure => {
      disclosure.setAttribute("open", "");
      disclosure.querySelectorAll("details").forEach(tool => tool.setAttribute("open", ""));
    }));
    await expect(audio.locator(".resource-deep-dive .resource-tool-copy").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const overflowingExamples = await page.locator(".resource-deep-dive pre").evaluateAll(examples => examples.filter(example => {
      const bounds = example.getBoundingClientRect();
      return bounds.left < 0 || bounds.right > innerWidth;
    }).length);
    expect(overflowingExamples).toBe(0);
    if (width !== 320) {
      await audio.locator(".resource-deep-dive > summary").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `test-results/resources-deeper-${width}.png` });
    }
  }
});

test("resource navigation works by keyboard on desktop and mobile without horizontal overflow", async ({ page }) => {
  await mockHome(page, false, true);
  for (const width of [320, 390, 768, 1024, 1440]) {
    const viewport = { width, height: width < 768 ? 844 : 1000 };
    await page.setViewportSize(viewport);
    await page.goto("/resources");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 390 || width === 1440) await page.screenshot({ path: `test-results/resources-overview-${width}.png` });
    const link = page.getByRole("navigation", { name: "Resource sections", exact: true }).getByRole("link", { name: "Forensics", exact: true });
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/resources#forensics$/);
    const section = page.locator("#forensics");
    await expect(section).toBeFocused();
    await expect(section.getByRole("heading", { name: "Forensics", exact: true })).toBeInViewport();
    const headerBottom = await page.getByRole("banner").evaluate(element => element.getBoundingClientRect().bottom);
    expect(await section.evaluate(element => element.getBoundingClientRect().top)).toBeGreaterThanOrEqual(Math.max(64, headerBottom));
    if (width === 390 || width === 1440) await page.screenshot({ path: `test-results/resources-${width}.png` });
    await page.goto("/rules");
    await expect(page.getByRole("heading", { name: "Rules / Mechanics", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto("/");
    await expect(page.getByRole("banner").getByRole("link", { name: "dfCTF home", exact: true })).toBeVisible();
    await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("main").locator('a[href="#this-week"]').filter({ hasText: "Fictional weekly training" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.goto("/resources#binary-exploitation");
  await expect(page.getByRole("heading", { name: "Binary exploitation", exact: true })).toBeInViewport();
});

test("landing navigation, footer, tools FAQ, and rules link to the resources page", async ({ page }) => {
  await mockHome(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.getByRole("banner").getByRole("navigation", { name: "Sections", exact: true }).getByRole("link", { name: "Resources", exact: true })).toHaveAttribute("href", "/resources");
  await expect(page.getByRole("contentinfo").getByRole("navigation", { name: "Footer", exact: true }).getByRole("link", { name: "Resources", exact: true })).toHaveAttribute("href", "/resources");
  await page.getByRole("button", { name: /What tools do I need\?/ }).click();
  const guide = page.getByRole("region", { name: "What tools do I need?", exact: true }).getByRole("link", { name: "Tutorials & Resources", exact: true });
  await expect(guide).toBeVisible();
  await guide.click();
  await expect(page.getByRole("heading", { name: "Tutorials & Resources", exact: true })).toBeVisible();
  await page.goto("/rules");
  await expect(page.getByRole("banner").getByRole("link", { name: "Resources", exact: true })).toHaveAttribute("href", "/resources");
});

test("public pages keep the full sticky navigation and link back to home sections", async ({ page }) => {
  await mockHome(page);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of ["/resources", "/rules"]) {
      await page.goto(path);
      const header = page.getByRole("banner");
      const sections = header.getByRole("navigation", { name: "Sections", exact: true });
      await expect(sections.getByRole("link")).toHaveText(["Leaderboard", "This week", "Categories", "Resources", "Rules", "FAQ"]);
      for (const [name, hash] of [["Leaderboard", "leaderboard"], ["This week", "this-week"], ["Categories", "categories"], ["FAQ", "faq"]]) {
        await expect(sections.getByRole("link", { name, exact: true })).toHaveAttribute("href", `/?view=home#${hash}`);
      }
      await expect(header.getByRole("link", { name: "Start solving", exact: true })).toHaveAttribute("href", "/?auth=signup");
      if (width === 1440) await expect(header.getByRole("link", { name: "Sign in", exact: true })).toHaveAttribute("href", "/?auth=signin");
      await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
      expect(await header.evaluate(element => element.getBoundingClientRect().top)).toBe(0);
      const next = sections.getByRole("link", { name: path === "/resources" ? "Rules" : "Resources", exact: true });
      await next.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("heading", { level: 1, name: path === "/resources" ? "Rules / Mechanics" : "Tutorials & Resources", exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.getByRole("banner").getByRole("link", { name: "FAQ", exact: true }).click();
    await expect(page).toHaveURL(/\/\?view=home#faq$/);
    await expect(page.locator("#faq")).toBeInViewport();
    const headerBottom = await page.getByRole("banner").evaluate(element => element.getBoundingClientRect().bottom);
    expect(await page.locator("#faq-title").evaluate(element => element.getBoundingClientRect().top)).toBeGreaterThanOrEqual(headerBottom);
  }
});

test("signed-in navigation opens the public resources page", async ({ page }) => {
  await mockHome(page, true);
  await page.goto("/?view=practice");
  const resources = page.getByRole("navigation", { name: "Main", exact: true }).getByRole("link", { name: "Resources", exact: true });
  await expect(resources).toHaveAttribute("href", "/resources");
  await resources.click();
  await expect(page.getByRole("heading", { name: "Tutorials & Resources", exact: true })).toBeVisible();
});

test("signed-in Resources navigation respects the native warning for an unsaved draft", async ({ page }) => {
  await mockHome(page, true);
  await page.goto("/?view=authoring");
  await page.getByRole("button", { name: "New challenge", exact: true }).click();
  const title = page.getByPlaceholder("Night shift");
  await title.fill("Keep this unsaved resource-navigation draft");
  const resources = page.getByRole("navigation", { name: "Main", exact: true }).getByRole("link", { name: "Resources", exact: true });
  await expect(resources).toHaveAttribute("href", "/resources");
  const prompts: string[] = []; let accept = false;
  page.on("dialog", async dialog => { prompts.push(dialog.type()); await (accept ? dialog.accept() : dialog.dismiss()); });
  await resources.click();
  await expect(title).toHaveValue("Keep this unsaved resource-navigation draft");
  await expect(page).toHaveURL(/view=authoring/);
  expect(prompts).toEqual(["beforeunload"]);
  accept = true;
  await resources.click();
  await expect(page.getByRole("heading", { name: "Tutorials & Resources", exact: true })).toBeVisible();
  expect(prompts).toEqual(["beforeunload", "beforeunload"]);
});
