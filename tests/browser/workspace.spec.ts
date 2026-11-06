import { test, expect, type Page, type Route } from "@playwright/test";
import type { Bootstrap, ChallengeDetail, Community, Leaderboard } from "../../src/lib/types";

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
    else if (url.pathname === "/api/v1/community") response = { weekly: null, recent: [], top: [], topAll: [], activity: { start: new Date().toISOString(), days: [0] }, totals: { challenges: 0, categories: [] } } satisfies Community;
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

test.describe("weekly reset details",()=>{
  test.use({hasTouch:true,timezoneId:"America/Los_Angeles"});
  test("shares the Manila deadline across hover, keyboard and touch without layout shifts or overflow",async({page,context})=>{
    const {board}=await mockWorkspace(page);board.weekEndsAt="2026-11-08T15:59:59.999Z";
    await page.clock.install({time:new Date("2026-11-05T04:00:00Z")});
    for(const theme of ["dark","light"]){
      await context.addCookies([{name:"dfctf-theme",value:theme,url:"http://127.0.0.1:3100"}]);
      await page.setViewportSize({width:1440,height:900});await page.goto("/?view=practice");
      const trigger=page.getByRole("button",{name:"Weekly reset details",exact:true}),tip=page.getByRole("tooltip");
      const account=page.getByRole("button",{name:/^Account menu for/}),before=await account.boundingBox();
      await expect(trigger).toContainText(theme==="dark"?"3d 11h 59m":"3d 11h 58m");
      if(theme==="dark"){
        await page.clock.fastForward(60_000);await expect(trigger).toContainText("3d 11h 58m");
        const after=await account.boundingBox();expect(Math.abs(before!.x-after!.x)).toBeLessThan(.5);expect(before!.width).toBe(after!.width);
      }
      await trigger.hover();await expect(tip).toBeVisible();await expect(trigger).toHaveAttribute("aria-expanded","true");
      await expect(tip).toContainText("Resets Monday, Nov 9, 2026 at 00:00");
      await expect(tip).toContainText("Today: Thursday, Nov 5, 2026");
      await expect(tip).toContainText("Monday, Nov 2, 2026 through Sunday, Nov 8, 2026");
      await expect(tip).toContainText("Asia/Manila (UTC+08:00)");await expect(tip).toContainText("solves, and saved progress remain");
      await tip.hover();await expect(tip).toBeVisible();
      await page.getByRole("heading",{name:"Challenges",exact:true}).hover();await expect(tip).toBeHidden();
      await trigger.focus();await expect(tip).toBeVisible();await expect(trigger).toHaveAccessibleDescription(/Resets Monday.*UTC\+08:00/);
      await expect(trigger).toHaveAccessibleName("Weekly reset details");expect(await trigger.getAttribute("aria-live")).toBeNull();
      await page.keyboard.press("Tab");await expect(tip).toBeHidden();await trigger.focus();await expect(tip).toBeVisible();
      await page.keyboard.press("Escape");await expect(tip).toBeHidden();await expect(trigger).toHaveAttribute("aria-expanded","false");
      await trigger.tap();await expect(tip).toBeVisible();
      await page.getByRole("heading",{name:"Challenges",exact:true}).tap();await expect(tip).toBeHidden();
      await page.setViewportSize({width:320,height:680});await trigger.tap();await expect(tip).toBeVisible();
      expect(await tip.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=document.documentElement.clientWidth&&r.bottom<=innerHeight;})).toBe(true);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.screenshot({path:`test-results/assigned-weekly-reset-${theme}.png`,animations:"disabled"});
      await page.keyboard.press("Escape");
      await page.setViewportSize({width:568,height:320});await page.evaluate(()=>document.documentElement.style.fontSize="200%");
      await trigger.tap();await expect(tip).toBeVisible();
      expect(await tip.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=document.documentElement.clientWidth&&r.bottom<=innerHeight;})).toBe(true);
      await page.touchscreen.tap(2,2);await expect(tip).toBeHidden();await expect(page).toHaveURL(/view=practice$/);
    }
  });
});

test("sign-out clears a protected destination only after success and preserves later intentional sign-in routes",async({page})=>{
  let fail=true;
  const {bootstrap}=await mockWorkspace(page,async(route,url)=>{
    if(url.pathname!=="/api/auth/sign-out")return false;
    if(fail){await route.fulfill({status:503,json:{error:{message:"Sign-out temporarily unavailable."}}});return true;}
    bootstrap.user=null;bootstrap.hasAccess=false;bootstrap.staffVerified=false;
    await route.fulfill({json:{success:true}});return true;
  });
  await page.goto("/?view=practice");await expect(page.getByRole("heading",{name:"Challenges",exact:true})).toBeVisible();
  const account=page.getByRole("button",{name:/^Account menu for/});
  await account.click();await page.getByRole("navigation",{name:"Account",exact:true}).getByRole("button",{name:"Sign out",exact:true}).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Sign-out temporarily unavailable.");
  await expect(page).toHaveURL(/view=practice$/);await expect(account).toBeVisible();
  fail=false;await account.click();await page.getByRole("navigation",{name:"Account",exact:true}).getByRole("button",{name:"Sign out",exact:true}).click();
  await expect(page).toHaveURL("http://127.0.0.1:3100/");
  await expect(page.getByRole("navigation",{name:"Sections",exact:true})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Sign in to dfCTF",exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Sign in for full leaderboard",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Sign in to dfCTF",exact:true})).toBeVisible();
  await expect(page.getByRole("status").filter({hasText:"the full leaderboard"})).toBeVisible();
  await expect(page).toHaveURL(/returnTo=.*leaderboard/);
  await page.goto("/?view=practice");await expect(page.getByRole("status").filter({hasText:"the challenge library"})).toBeVisible();
});

test("compact navigation keeps personal pages and staff tools in an accessible account disclosure",async({page})=>{
  await mockWorkspace(page);await page.setViewportSize({width:1440,height:1000});await page.goto("/?view=practice");
  const main=page.getByRole("navigation",{name:"Main",exact:true}),account=page.getByRole("button",{name:"Account menu for test_author",exact:true});
  await expect(main.getByRole("link")).toHaveText(["Challenges","Leaderboard","Competitions","Resources"]);
  await account.click();const menu=page.getByRole("navigation",{name:"Account",exact:true});
  await expect(menu.getByRole("group",{name:"Staff tools",exact:true}).getByRole("link",{name:"Authoring",exact:true})).toHaveAttribute("href","/?view=authoring");
  await expect(menu.getByRole("group",{name:"Your space",exact:true}).getByRole("link")).toHaveText(["Profile","Progress","Socials"]);
  await expect(menu.getByRole("group",{name:"Help & account",exact:true}).getByRole("link")).toHaveText(["Settings","Rules"]);
  await expect(menu.locator(".account-nav-label")).toHaveCount(0);await expect(menu.locator(".account-role")).toHaveText("Staff");
  await page.screenshot({path:"test-results/account-navigation-desktop.png",animations:"disabled"});
  await page.keyboard.press("Tab");await expect(menu.getByRole("link",{name:"Profile",exact:true})).toBeFocused();
  await page.keyboard.press("ArrowDown");await expect(menu.getByRole("link",{name:"Progress",exact:true})).toBeFocused();
  await page.keyboard.press("End");await expect(menu.getByRole("button",{name:"Sign out",exact:true})).toBeFocused();
  await page.keyboard.press("ArrowDown");await expect(menu.getByRole("link",{name:"Profile",exact:true})).toBeFocused();
  await page.keyboard.press("Escape");await expect(account).toBeFocused();await expect(menu).toHaveCount(0);
  await account.click();await menu.getByRole("link",{name:"Progress",exact:true}).click();await expect(page.getByRole("heading",{name:"Progress",exact:true})).toBeVisible();
  await expect(account).not.toContainText("Progress");await account.click();await expect(menu.getByRole("link",{name:"Progress",exact:true})).toHaveAttribute("aria-current","page");
  await page.keyboard.press("Escape");await page.goBack();await expect(main.getByRole("link",{name:"Challenges",exact:true})).toHaveAttribute("aria-current","page");
});

test("player navigation fits narrow screens, hides staff tools and remains usable in light mode",async({page})=>{
  const {bootstrap,board}=await mockWorkspace(page);bootstrap.user!.role="participant";bootstrap.user!.codename="long_player_codename_2026";
  board.viewer={codename:bootstrap.user!.codename,rank:2,points:50,solves:1,gap:null};
  await page.setViewportSize({width:320,height:680});await page.goto("/?view=practice");
  const account=page.getByRole("button",{name:"Account menu for long_player_codename_2026",exact:true}),nav=page.getByRole("navigation",{name:"Main",exact:true});
  await expect(nav.getByRole("link")).toHaveCount(4);expect(await nav.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  const brandBounds=await page.getByRole("link",{name:"dfCTF home",exact:true}).boundingBox(),accountBounds=await account.boundingBox();
  expect(Math.abs((brandBounds!.y+brandBounds!.height/2)-(accountBounds!.y+accountBounds!.height/2))).toBeLessThan(3);
  await account.click();const menu=page.getByRole("navigation",{name:"Account",exact:true});
  await expect(menu.getByRole("link",{name:"Authoring",exact:true})).toHaveCount(0);await expect(menu.locator(".account-role, .account-staff-tag")).toHaveCount(0);
  expect(await menu.locator(".account-identity strong").evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  const bounds=await menu.boundingBox();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(320);expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(680);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:"test-results/account-navigation-mobile-dark.png",animations:"disabled"});
  await page.context().addCookies([{name:"dfctf-theme",value:"light",domain:"127.0.0.1",path:"/"}]);await page.reload();await account.click();await expect(page.locator("html")).toHaveAttribute("data-theme","light");await page.screenshot({path:"test-results/account-navigation-mobile-light.png",animations:"disabled"});
  await menu.getByRole("link",{name:"Rules",exact:true}).click();await expect(page.getByRole("heading",{name:"Rules / Mechanics",exact:true})).toBeVisible();
});

test("slash focuses visible search without typing and leaves modified keys, composition, and hidden search alone", async ({ page }) => {
  await mockWorkspace(page);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/?view=practice");
  const search = page.getByRole("searchbox", { name: "Search challenges" });
  const main = page.getByRole("main");
  await expect(search).toBeVisible();
  await main.focus();
  await page.keyboard.press("/");
  await expect(search).toBeFocused();
  await expect(search).toHaveValue("");
  await search.fill("training");
  await search.press("Escape");
  await expect(search).toHaveValue("");
  await main.focus();
  for (const key of ["Control+/", "Meta+/", "Alt+/", "Shift+/"]) {
    await page.keyboard.press(key);
    await expect(main).toBeFocused();
  }
  await main.dispatchEvent("keydown", { key: "/", isComposing: true, bubbles: true, cancelable: true });
  await expect(main).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(search).toBeVisible();
  await main.focus();
  await page.keyboard.press("/");
  await expect(search).toBeFocused();
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Leaderboard", exact: true }).click();
  await expect(search).toBeHidden();
  await main.focus();
  await page.keyboard.press("/");
  await expect(main).toBeFocused();
});

test("slash remains normal text in staff form fields and editable content", async ({ page }) => {
  await mockWorkspace(page, async (route, url) => {
    if (url.pathname !== "/api/v1/staff/challenges") return false;
    await route.fulfill({ json: [] }); return true;
  });
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/?view=authoring");
  await page.getByRole("button", { name: "New challenge", exact: true }).click();
  for (const field of [page.getByPlaceholder("Night shift"), page.getByLabel(/^Description/)]) {
    await field.press("/");
    await expect(field).toBeFocused();
    await expect(field).toHaveValue("/");
  }
  const category = page.locator("#challenge-editor").getByRole("combobox", { name: "Category", exact: true });
  await category.press("/");
  await expect(category).toBeFocused();
  await page.evaluate(() => {
    const editor = document.createElement("div");
    editor.contentEditable = "true"; editor.setAttribute("aria-label", "Editable notes"); editor.setAttribute("role", "textbox");
    document.getElementById("main-content")!.append(editor);
  });
  const notes = page.getByRole("textbox", { name: "Editable notes" });
  await notes.press("/");
  await expect(notes).toBeFocused();
  await expect(notes).toHaveText("/");
});

test("description formatting survives saving and matches the player's view", async ({ page }, testInfo) => {
  const detail: ChallengeDetail & { authorId: string } = { ...challenge("format-draft", "Formatted training case"), status: "draft", authorId: "test-author", solution: "Read the fictional evidence to recover the flag." };
  let saved = "";
  const state = await mockWorkspace(page, async (route, url) => {
    if (url.pathname === "/api/v1/staff/challenges") await route.fulfill({ json: [detail] });
    else if (url.pathname === "/api/v1/staff/challenges/format-draft") {
      if (route.request().method() === "PATCH") { Object.assign(detail, route.request().postDataJSON()); saved = detail.description; }
      await route.fulfill({ json: detail });
    } else if (url.pathname === "/api/v1/challenges/format-draft") await route.fulfill({ json: detail });
    else return false;
    return true;
  });
  state.challenges.push(detail);
  await page.goto("/?view=authoring");
  await page.getByRole("row", { name: /Formatted training case/ }).click();
  const description = page.getByLabel("Description", { exact: true });
  const toolbar = page.getByRole("group", { name: "Text formatting" });
  async function select(word: string) {
    await description.evaluate((element, word) => { const input = element as HTMLTextAreaElement; input.focus(); const start = input.value.indexOf(word); input.setSelectionRange(start, start + word.length); }, word);
  }
  await description.fill("Inspect the evidence carefully and recover the flag.");
  // Hold animation frames so a stale selection restore cannot hide behind a fast local browser.
  const heldFrames = await page.evaluateHandle(() => {
    const request = window.requestAnimationFrame;
    const callbacks: FrameRequestCallback[] = [];
    window.requestAnimationFrame = callback => { callbacks.push(callback); return -callbacks.length; };
    return () => { window.requestAnimationFrame = request; for (const callback of callbacks) callback(performance.now()); };
  });
  await select("evidence"); await toolbar.getByRole("button", { name: "Bold", exact: true }).click();
  await select("carefully");
  await heldFrames.evaluate(resume => resume());
  await heldFrames.dispose();
  await description.press("Control+i");
  await select("flag"); await toolbar.getByRole("button", { name: "Underline", exact: true }).click();
  await select("Inspect"); await toolbar.getByRole("button", { name: "Link", exact: true }).click();
  await page.getByLabel("Link URL", { exact: true }).fill("https://example.com/guide");
  await page.getByRole("button", { name: "Insert link", exact: true }).click();
  await expect(description).toHaveValue("[Inspect](https://example.com/guide) the **evidence** *carefully* and recover the <u>flag</u>.");
  await page.locator(".description-field").screenshot({ path: testInfo.outputPath("formatting-desktop.png") });
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  const preview = page.getByRole("region", { name: "Formatted preview" });
  await expect(preview.locator("strong")).toHaveText("evidence");
  await expect(preview.locator("em")).toHaveText("carefully");
  await expect(preview.locator("u")).toHaveText("flag");
  await expect(preview.getByRole("link", { name: "Inspect" })).toHaveAttribute("href", "https://example.com/guide");
  await expect(toolbar.getByRole("button", { name: "Bold", exact: true })).toBeDisabled();
  await preview.screenshot({ path: testInfo.outputPath("formatted-preview.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(preview.locator("strong")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator(".description-field").screenshot({ path: testInfo.outputPath("formatting-mobile.png") });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole("button", { name: "Write", exact: true }).click();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect.poll(() => saved).toContain("**evidence**");
  await expect(description).toHaveValue(saved);
  await page.getByRole("button", { name: "Back to authoring" }).click();
  await page.getByRole("row", { name: /Formatted training case/ }).click();
  await expect(description).toHaveValue(saved);
  // Non-editable review versions still have a preview, with formatting controls locked.
  detail.status = "review";
  await page.reload();
  await page.getByRole("row", { name: /Formatted training case/ }).click();
  await expect(description).not.toBeEditable();
  await expect(toolbar.getByRole("button", { name: "Bold", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(preview.locator("u")).toHaveText("flag");
  await page.goto("/?view=practice&challenge=format-draft");
  const playerDescription = page.getByRole("dialog").getByRole("region", { name: "Description", exact: true });
  await expect(playerDescription.locator("strong")).toHaveText("evidence");
  await expect(playerDescription.locator("em")).toHaveText("carefully");
  await expect(playerDescription.locator("u")).toHaveText("flag");
});

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
  // The challenge is a modal, so the header behind it is inert until the dialog closes.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("region", { name: "This week’s challenge", exact: true }).getByRole("link", { name: "Open challenge", exact: true }).click();
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

function standingsFixture(count: number) {
  return Array.from({ length: count }, (_, i) => ({ rank: i + 1, codename: `player_${i + 1}`, points: 1000 - i, solves: 3 }));
}

async function mockLongStandings(page: Page) {
  const { board } = await mockWorkspace(page, async (route, url) => {
    if (url.pathname !== "/api/v1/leaderboard" || url.searchParams.get("range") !== "all") return false;
    await route.fulfill({ json: { ...board, range: "all", players: 20, standings: standingsFixture(20), viewer: null } });
    return true;
  });
  board.players = 120;
  board.standings = standingsFixture(50);
  board.standings[39].codename = "test_author";
  board.viewer = { ...board.standings[39], gap: { codename: "player_39", points: 1 } };
}

test("standings expand in rank order, drop the duplicate viewer row, and reset between ranges", async ({ page }) => {
  await mockLongStandings(page);
  await page.goto("/?view=leaderboard");
  const panel = page.getByRole("region", { name: "Standings", exact: true });
  const rows = panel.locator(".standings li:not(.standings-head):not(.gap)");
  const you = panel.locator(".standings .you");
  const showMore = panel.getByRole("button", { name: "Show more", exact: true });
  const count = panel.getByRole("status");
  await expect(panel.locator(".panel-head")).toContainText("120 players");
  await expect(rows).toHaveCount(16);
  await expect(count).toHaveText("Showing 15 of the top 50");
  await expect(you.locator(".rank")).toHaveText("40");

  await showMore.focus();
  await page.keyboard.press("Enter");
  await expect(rows).toHaveCount(31);
  await expect(showMore).toBeFocused();
  await expect(you).toHaveCount(1);
  await expect(count).toHaveText("Showing 30 of the top 50");

  await page.keyboard.press("Space");
  await expect(rows).toHaveCount(45);
  await expect(you).toHaveCount(1);
  await expect(panel.locator(".standings .gap")).toHaveCount(0);
  await expect(rows.nth(39)).toHaveClass(/you/);

  await page.keyboard.press("Enter");
  await expect(rows).toHaveCount(50);
  await expect(showMore).toHaveCount(0);
  await expect(panel.getByRole("link", { name: "View player_46's profile", exact: true })).toBeFocused();
  await expect(rows.locator(".rank")).toHaveText(Array.from({ length: 50 }, (_, i) => String(i + 1).padStart(2, "0")));
  await expect(count).toHaveText("Showing the top 50 of 120 players");
  await expect(panel.locator(".panel-head")).toContainText("120 players");

  const ranges = page.getByRole("group", { name: "Range", exact: true });
  await ranges.getByRole("button", { name: "All time", exact: true }).click();
  await expect(rows).toHaveCount(15);
  await expect(count).toHaveText("Showing 15 of 20 players");
  await showMore.click();
  await expect(rows).toHaveCount(20);
  await expect(showMore).toHaveCount(0);
  await expect(count).toHaveText("Showing all 20 players");

  await ranges.getByRole("button", { name: "This week", exact: true }).click();
  await expect(rows).toHaveCount(16);
  await expect(count).toHaveText("Showing 15 of the top 50");
  await expect(showMore).toBeVisible();
});

test("standings stay compact when every row already fits", async ({ page }) => {
  const { board } = await mockWorkspace(page);
  board.players = 15;
  board.standings = standingsFixture(15);
  await page.goto("/?view=leaderboard");
  const panel = page.getByRole("region", { name: "Standings", exact: true });
  await expect(panel.locator(".standings li:not(.standings-head)")).toHaveCount(15);
  await expect(panel.getByRole("button", { name: "Show more", exact: true })).toHaveCount(0);
  await expect(panel.getByRole("status")).toHaveCount(0);
});

test("standings expansion works by touch on a narrow screen", async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await mockLongStandings(page);
    await page.goto("/?view=leaderboard");
    const panel = page.getByRole("region", { name: "Standings", exact: true });
    const showMore = panel.getByRole("button", { name: "Show more", exact: true });
    await expect(showMore).toBeVisible();
    expect((await showMore.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await showMore.tap();
    await expect(panel.locator(".standings li:not(.standings-head):not(.gap)")).toHaveCount(31);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally { await context.close(); }
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

test("players need email verification without an administrator approval step", async ({ page }) => {
  const state = await mockWorkspace(page);
  state.bootstrap.user!.role = "participant";
  state.bootstrap.user!.emailVerified = false;
  state.bootstrap.user!.codename = null;
  state.bootstrap.hasAccess = false;
  state.bootstrap.staffVerified = false;
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Check your inbox.", exact: true })).toBeVisible();
  await expect(page.getByText("Access enabled", { exact: false })).toHaveCount(0);
  state.bootstrap.user!.emailVerified = true;
  state.bootstrap.hasAccess = true;
  await page.getByRole("button", { name: "Check again", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Choose your codename", exact: true })).toBeVisible();
});

test("a verified suspended account gets an honest access message and can retry after restoration", async ({ page }) => {
  const state = await mockWorkspace(page);
  state.bootstrap.hasAccess = false;
  state.bootstrap.staffVerified = false;
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Access suspended", exact: true })).toBeVisible();
  await expect(page.getByText("An admin needs to enable", { exact: false })).toHaveCount(0);
  state.bootstrap.hasAccess = true;
  await page.getByRole("button", { name: "Check again", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Challenges", exact: true })).toBeVisible();
});

test("Settings sends a bodyless revoke request with the required application header", async ({ page }) => {
  const entries = [{ id: "target-player", email: "target@example.test" }];
  let revoked = false;
  const state = await mockWorkspace(page, async (route, url) => {
    if (url.pathname === "/api/v1/staff/allowlist/target-player") {
      expect(route.request().method()).toBe("DELETE");
      expect(route.request().headers()["x-dfctf-request"]).toBe("1");
      expect(route.request().postData()).toBeNull();
      revoked = true; entries.length = 0;
      await route.fulfill({ json: { revoked: true } });
    } else if (url.pathname === "/api/v1/staff/allowlist") await route.fulfill({ json: entries });
    else return false;
    return true;
  });
  state.bootstrap.user!.role = "admin";
  page.on("dialog", dialog => dialog.accept());
  await page.goto("/?view=settings");
  await page.getByRole("button", { name: "Revoke access for target@example.test" }).click();
  await expect(page.getByText("Revoked access for target@example.test.", { exact: true })).toBeVisible();
  expect(revoked).toBe(true);
});

test("a password reset link works in an authenticated browser and refreshes the revoked session", async ({ page }) => {
  let body: unknown;
  const state = await mockWorkspace(page, async (route, url) => {
    if (url.pathname !== "/api/auth/reset-password") return false;
    body = route.request().postDataJSON();
    state.bootstrap.user = null; state.bootstrap.hasAccess = false; state.bootstrap.staffVerified = false;
    await route.fulfill({ json: { status: true } });
    return true;
  });
  await page.goto("/?reset=1&token=valid-reset-token");
  await expect(page.getByRole("heading", { name: "Choose a new password", exact: true })).toBeVisible();
  const password = page.getByLabel("New password", { exact: true });
  await password.fill("a different long passphrase");
  await page.getByRole("button", { name: "Update password", exact: true }).click();
  await expect(page.locator(".validation-popover")).toContainText("at least one uppercase letter, one lowercase letter, one number, and one symbol");
  expect(body).toBeUndefined();
  await password.fill("Abcdef1!");
  await page.getByRole("button", { name: "Update password", exact: true }).click();
  await expect(page.getByText("Password updated. Sign in with your new password.", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sign in to dfCTF", exact: true })).toBeVisible();
  expect(body).toEqual({ token: "valid-reset-token", newPassword: "Abcdef1!" });
  expect(page.url()).not.toContain("valid-reset-token");
});

test("every challenge shows all solvers and a first blood across desktop and mobile", async ({ page }) => {
  const detail = { ...challenge("solver-case", "Solver attribution case"), solveCount: 22, solvers: Array.from({ length: 22 }, (_, i) => ({
    codename: `solver_${String(i).padStart(2,"0")}`, solvedAt: new Date(Date.UTC(2026,9,20,4,i)).toISOString(), firstBlood: i === 0,
  })) };
  await mockWorkspace(page, async (route, url) => {
    if (url.pathname !== "/api/v1/challenges/solver-case") return false;
    await route.fulfill({ json: detail }); return true;
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/?view=practice&challenge=solver-case");
  await expect(page.getByRole("region", { name: "Solvers", exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "Solvers 22", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Solvers 22", exact: true })).toHaveAttribute("aria-selected", "true");
  const solvers = page.getByRole("region", { name: "Solvers", exact: true });
  await expect(solvers.locator(".first-blood")).toContainText("solver_00");
  await expect(solvers.locator(".challenge-solvers li")).toHaveCount(20);
  await solvers.getByRole("button", { name: "Show more solvers" }).click();
  await expect(solvers.locator(".challenge-solvers li")).toHaveCount(22);
  await expect(solvers.locator(".challenge-solvers li").last()).toContainText("solver_21");
  await expect(solvers.locator("time").first()).toContainText("12:00:00");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: "test-results/solvers-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(solvers).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator(".submit").evaluate(el => el.compareDocumentPosition(document.querySelector('[aria-labelledby="solvers-title"]')!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();
  await page.screenshot({ path: "test-results/solvers-mobile.png", fullPage: true });
});

test("an empty solver list refreshes to the new first blood immediately after a correct flag", async ({ page }) => {
  const detail = { ...challenge("new-blood", "Unsolved training case"), solvers: [] as { codename: string; solvedAt: string; firstBlood: boolean }[] };
  await mockWorkspace(page, async (route, url) => {
    if (url.pathname === "/api/v1/challenges/new-blood/submissions") {
      detail.solved = true; detail.solveCount = 1;
      detail.solvers.push({ codename: "test_author", solvedAt: "2026-10-20T04:00:00Z", firstBlood: true });
      await route.fulfill({ json: { status: "correct", xp: 50, totalXp: 50, solution: "Read the supplied training file." } });
    } else if (url.pathname === "/api/v1/challenges/new-blood") await route.fulfill({ json: detail });
    else return false;
    return true;
  });
  await page.goto("/?view=practice&challenge=new-blood");
  const solversTab = page.getByRole("tab", { name: /^Solvers/ });
  await solversTab.click();
  await expect(page.getByText("No solves yet. Capture the flag to claim first blood.")).toBeVisible();
  // Arrow keys move between the two tabs, as the tabs pattern expects.
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("tab", { name: "Challenge", exact: true })).toBeFocused();
  await page.getByLabel("Flag", { exact: true }).fill("dfCTF{correct}");
  await page.getByRole("button", { name: "Submit flag", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Flag captured" })).toBeVisible();
  await solversTab.click();
  const solvers = page.getByRole("region", { name: "Solvers", exact: true });
  await expect(solvers.locator(".first-blood")).toContainText("test_author");
  await expect(solvers.locator(".challenge-solvers li")).toHaveCount(1);
});

for (const reduced of [false, true]) {
  test(`capture feedback waits for server success and stays readable${reduced ? " with reduced motion on mobile" : " on desktop"}`, async ({ page }, testInfo) => {
    await page.setViewportSize(reduced ? { width: 375, height: 812 } : { width: 1440, height: 1000 });
    await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
    if (reduced) await page.context().addCookies([{ name: "dfctf-theme", value: "light", domain: "127.0.0.1", path: "/" }]);
    // Hold the short animation so its actual keyframes can be inspected without a timing race.
    await page.addInitScript(() => {
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (...args) {
        const animation = animate.apply(this, args);
        if (this.classList.contains("captured")) animation.pause();
        return animation;
      };
    });
    const detail = { ...challenge("capture-feedback", "Capture feedback training"), description: Array(12).fill("Inspect the fictional evidence carefully before submitting your answer.").join("\n\n") };
    let outcome: "error" | "incorrect" | "correct" = "error";
    let confirm!: () => void;
    const confirmation = new Promise<void>(resolve => { confirm = resolve; });
    await mockWorkspace(page, async (route, url) => {
      if (url.pathname === "/api/v1/challenges/capture-feedback/submissions") {
        if (outcome === "error") await route.fulfill({ status: 503, json: { error: { message: "Temporary submission failure." } } });
        else if (outcome === "incorrect") await route.fulfill({ json: { status: "incorrect", xp: 0, totalXp: 100 } });
        else {
          await confirmation;
          detail.solved = true;
          detail.solution = "Read the fictional evidence.";
          await route.fulfill({ json: { status: "correct", xp: 37, totalXp: 137, solution: detail.solution } });
        }
      } else if (url.pathname === "/api/v1/challenges/capture-feedback") await route.fulfill({ json: detail });
      else return false;
      return true;
    });
    await page.goto("/?view=practice&challenge=capture-feedback");
    const announcement = page.locator(".capture-announcement");
    await expect(announcement).toHaveText("");
    await page.getByLabel("Flag", { exact: true }).fill("dfCTF{training}");
    await page.getByRole("button", { name: "Submit flag", exact: true }).click();
    await expect(page.getByText("Temporary submission failure.", { exact: true })).toBeVisible();
    await expect(page.locator(".capture-heading")).toHaveCount(0);
    await expect(announcement).toHaveText("");
    outcome = "incorrect";
    await page.getByRole("button", { name: "Submit flag", exact: true }).click();
    await expect(page.locator("#flag-verdict")).toBeVisible();
    await expect(page.locator(".capture-heading")).toHaveCount(0);
    await expect(announcement).toHaveText("");
    outcome = "correct";
    await page.getByLabel("Flag", { exact: true }).fill("dfCTF{training}");
    await page.getByRole("button", { name: "Submit flag", exact: true }).click();
    await expect(page.getByRole("button", { name: "Checking", exact: true })).toBeVisible();
    await expect(page.locator(".capture-heading")).toHaveCount(0);
    confirm();
    const captured = page.locator(".captured");
    await expect(captured.getByRole("heading", { name: "Flag captured!", exact: true })).toBeVisible();
    await expect(captured.locator(".capture-points")).toHaveText("+37 points earned");
    await expect(announcement).toHaveAttribute("role", "status");
    await expect(announcement).toHaveAttribute("aria-live", "polite");
    await expect(announcement).toHaveText("Flag captured! 37 points earned.");
    const frames = await captured.evaluate(element => element.getAnimations().map(animation => (animation.effect as KeyframeEffect).getKeyframes()));
    expect(frames).toHaveLength(1);
    expect(frames[0].some(frame => "transform" in frame)).toBe(!reduced);
    await captured.evaluate(element => element.getAnimations().forEach(animation => animation.finish()));
    await expect(captured).toHaveCSS("opacity", "1");
    await expect(captured).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole("heading", { name: "Walkthrough", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("capture-feedback.png") });
    await page.getByRole("tab", { name: /^Solvers/ }).click();
    await page.getByRole("tab", { name: "Challenge", exact: true }).click();
    expect(await captured.evaluate(element => element.getAnimations().length)).toBe(0);
    await page.reload();
    await expect(page.locator(".captured")).toBeVisible();
    await expect(page.locator(".capture-heading")).toHaveCount(0);
    await expect(page.locator(".capture-announcement")).toHaveText("");
    expect(await page.locator(".captured").evaluate(element => element.getAnimations().length)).toBe(0);
  });
}

test("already accepted flags do not replay capture feedback", async ({ page }) => {
  const detail = challenge("already-captured", "Already captured training");
  await mockWorkspace(page, async (route, url) => {
    if (url.pathname === "/api/v1/challenges/already-captured/submissions") {
      detail.solved = true;
      await route.fulfill({ json: { status: "already_solved", xp: 0, totalXp: 50 } });
    } else if (url.pathname === "/api/v1/challenges/already-captured") await route.fulfill({ json: detail });
    else return false;
    return true;
  });
  await page.goto("/?view=practice&challenge=already-captured");
  await page.getByLabel("Flag", { exact: true }).fill("dfCTF{training}");
  await page.getByRole("button", { name: "Submit flag", exact: true }).click();
  await expect(page.locator(".captured")).toContainText("You had already solved this one");
  await expect(page.locator(".capture-heading")).toHaveCount(0);
  await expect(page.locator(".capture-announcement")).toHaveText("");
  expect(await page.locator(".captured").evaluate(element => element.getAnimations().length)).toBe(0);
});

test("staff can create the rules challenge draft from Authoring", async ({ page }) => {
  const detail = { ...challenge("rules-draft", "Read the fine print"), status: "draft", authorId: "test-author", tags: ["rules", "onboarding"], solution: "Collect the field notes from the rules page in reading order.", files: [{ id: "briefing", name: "briefing.txt", size: 180, sha256: "a".repeat(64) }] };
  let created = false;
  let releaseCreation!: () => void;
  const creationGate = new Promise<void>(resolve => { releaseCreation = resolve; });
  await mockWorkspace(page, async (route, url) => {
    if (url.pathname === "/api/v1/staff/challenges") await route.fulfill({ json: [] });
    else if (url.pathname === "/api/v1/staff/challenges/rules") {
      expect(route.request().method()).toBe("POST");
      expect(route.request().headers()["x-dfctf-request"]).toBe("1");
      created = true; await creationGate; await route.fulfill({ json: { id: detail.id } });
    } else if (url.pathname === "/api/v1/staff/challenges/rules-draft") await route.fulfill({ json: detail });
    else return false;
    return true;
  });
  await page.goto("/?view=authoring");
  await page.getByRole("button", { name: "Rules challenge", exact: true }).click();
  await expect.poll(() => created).toBe(true);
  await expect(page.getByRole("button", { name: "New challenge", exact: true })).toBeDisabled();
  releaseCreation();
  await expect(page.getByRole("heading", { name: "Read the fine print", exact: true })).toBeVisible();
  await expect(page.getByText("briefing.txt", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send for review", exact: true })).toBeEnabled();
  expect(created).toBe(true);
});

async function recordViewMotion(page: Page) {
  await page.addInitScript(() => {
    const records: { target: string; from: string | undefined }[] = [];
    (window as unknown as { viewMotions: typeof records }).viewMotions = records;
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      if (this.tagName === "MAIN" || this.tagName === "BODY") records.push({ target: this.tagName, from: (keyframes as Keyframe[])[0].transform as string | undefined });
      return animate.call(this, keyframes, options);
    };
  });
  return () => page.evaluate(() => (window as unknown as { viewMotions: { target: string; from?: string }[] }).viewMotions.splice(0));
}

test("view changes slide in navigation order, fade to the landing page and survive history and rapid clicks",async({page})=>{
  const motions=await recordViewMotion(page);
  await mockWorkspace(page,async(route,url)=>{
    if(url.pathname!=="/api/v1/community")return false;
    await route.fulfill({json:{weekly:null,recent:[],top:[],topAll:[],activity:{start:new Date().toISOString(),days:[]},totals:{challenges:0,categories:[]}}});return true;
  });await page.goto("/?view=practice");
  const tabs=page.getByRole("navigation",{name:"Main",exact:true});
  await expect(tabs.getByRole("link",{name:"Challenges",exact:true})).toHaveAttribute("aria-current","page");
  expect(await motions()).toEqual([]);

  await tabs.getByRole("link",{name:"Leaderboard",exact:true}).click();
  await expect(tabs.getByRole("link",{name:"Leaderboard",exact:true})).toHaveAttribute("aria-current","page");
  expect(await motions()).toEqual([{target:"MAIN",from:"translateX(20px)"}]);

  await page.goBack();
  await expect(tabs.getByRole("link",{name:"Challenges",exact:true})).toHaveAttribute("aria-current","page");
  expect(await motions()).toEqual([{target:"MAIN",from:"translateX(-20px)"}]);
  await expect(page.locator("#main-content")).toBeFocused();

  await page.evaluate(()=>{for(const name of ["Leaderboard","Challenges","Leaderboard"])[...document.querySelectorAll<HTMLAnchorElement>("nav.tabs a")].find(link=>link.textContent===name)?.click();});
  await expect(tabs.getByRole("link",{name:"Leaderboard",exact:true})).toHaveAttribute("aria-current","page");
  await expect.poll(()=>page.evaluate(()=>document.querySelector("main")!.getAnimations().filter(animation=>animation.playState==="running").length)).toBe(0);
  expect(await page.evaluate(()=>getComputedStyle(document.querySelector("main")!).transform)).toBe("none");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  await motions();

  await page.getByRole("link",{name:"dfCTF home",exact:true}).click();
  await expect(page).toHaveURL(/view=home/);await expect(page.locator("#main-content")).toHaveCount(0);
  expect(await motions()).toEqual([{target:"BODY"}]);
  await page.goBack();
  await expect(page.locator("#main-content")).toBeFocused();
  expect(await motions()).toEqual([{target:"BODY"}]);
});

test("reduced motion keeps the view change as a fade with no sliding",async({page})=>{
  const motions=await recordViewMotion(page);
  await page.emulateMedia({reducedMotion:"reduce"});
  await mockWorkspace(page);await page.goto("/?view=practice");
  const leaderboard=page.getByRole("navigation",{name:"Main",exact:true}).getByRole("link",{name:"Leaderboard",exact:true});
  await leaderboard.click();await expect(leaderboard).toHaveAttribute("aria-current","page");
  expect(await motions()).toEqual([{target:"MAIN"}]);
});
