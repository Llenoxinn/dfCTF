import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { CATEGORIES } from "../../src/lib/types";
import { profileMilestones, type PlayerProfile, type ProfileScope } from "../../src/lib/player-profile";

test.use({deviceScaleFactor:2});
function fixture(scope:ProfileScope,empty=false,long=false):PlayerProfile {
  const stats=empty?{rank:null,points:0,solved:0,firstBloods:0}:scope==="week"?{rank:5,points:25,solved:1,firstBloods:0}:{rank:2,points:160,solved:5,firstBloods:2};
  const identity={codename:"profile_browser",displayName:empty?"":long?"学ぶ人🌐の長い名前とセキュリティ研究の旅を続ける人たち":"Fixture Learner",bio:empty?"":"Fictional player details used only in automated tests.",websiteUrl:"",githubUrl:"",shareProfile:false};
  const scopeInfo={id:scope,label:scope==="week"?"Practice · this week":"Practice · all time",period:scope==="week"?"2 Nov – 8 Nov 2026 · PHT":"All-time practice"};
  const milestones=profileMilestones(stats),asOf="2026-11-03T10:00:00Z";
  const items=empty?[]:[{challengeId:`fixture-${scope}`,title:`${scope==="week"?"Weekly":"All-time"} fixture capture`,category:"Forensics" as const,at:asOf,points:stats.points,firstBlood:scope!=="week"}];
  return {identity,scope:scopeInfo,asOf,stats,milestones,activity:{items,nextCursor:empty?null:"test-cursor"},categories:CATEGORIES.map(category=>({category,total:category==="Forensics"?4:0,solved:!empty&&category==="Forensics"?stats.solved===5?2:1:0,points:!empty&&category==="Forensics"?stats.points:0})),card:{codename:identity.codename,displayName:identity.displayName,bio:identity.bio,scope:scopeInfo.label,period:scopeInfo.period,asOf,...stats,milestones}};
}
async function mockProfile(page:Page,{empty=false,long=false}={}){
  let ownerId="profile-browser-owner",fail=false,expired=false;
  let saved:PlayerProfile["identity"]|null=null;
  await page.route("**/api/**",async route=>{
    const url=new URL(route.request().url()),scope=url.searchParams.get("scope")==="week"?"week":"all";
    let response:unknown;
    if(url.pathname==="/api/v1/auth/bootstrap")response={user:{id:ownerId,email:"PRIVATE_EMAIL@example.test",codename:"profile_browser",emailVerified:true,role:"participant",twoFactorEnabled:false},hasAccess:true,staffVerified:false,providers:{google:false,github:false},localMail:false};
    else if(url.pathname==="/api/v1/profile"){
      if(expired){await route.fulfill({status:401,json:{error:{message:"Sign in to continue."}}});return;}
      if(fail){await route.fulfill({status:503,json:{error:{message:"Profile temporarily unavailable."}}});return;}
      if(route.request().method()==="PATCH"){
        const fields=route.request().postDataJSON();
        if(fields.websiteUrl.startsWith("http:")){await route.fulfill({status:422,json:{error:{message:"Check the highlighted fields.",details:{fieldErrors:{websiteUrl:["Use a complete HTTPS URL."]}}}}});return;}
        saved={codename:"profile_browser",...fields};response=saved;
      }else{
        const data=fixture(scope,empty,long);
        if(saved){data.identity=saved;data.card={...data.card,displayName:saved.displayName,bio:saved.bio};}
        response=data;
      }
    }else if(url.pathname==="/api/v1/profile/activity")response={items:[{challengeId:"fixture-next",title:"Next fixture capture",category:"OSINT",at:"2026-11-02T10:00:00Z",points:0,firstBlood:false}],nextCursor:null};
    else if(url.pathname==="/api/v1/challenges")response=[];
    else if(url.pathname==="/api/v1/progress")response={totalXp:empty?0:160,solvedCount:empty?0:5,attemptedCount:0,categories:[],recentSolves:[]};
    else if(url.pathname==="/api/v1/leaderboard")response={range:"week",weekEndsAt:"2026-11-08T15:59:59.999Z",players:0,standings:[],viewer:null,race:{players:[],snapshots:[]},hourly:{start:"2026-11-02T00:00:00Z",counts:[],firstBlood:[]},challenges:[],mine:{start:"2026-11-02T00:00:00Z",days:[]}};
    else if(url.pathname==="/api/v1/community")response={weekly:null};
    else if(["/api/auth/list-accounts","/api/auth/list-sessions"].includes(url.pathname))response=[];
    else if(url.pathname==="/api/auth/get-session")response={session:{id:"test"}};
    else throw new Error(`Unexpected profile fixture request: ${url.pathname}`);
    await route.fulfill({json:response});
  });
  return {fail:(value:boolean)=>{fail=value;},expire:()=>{expired=true;},owner:(id:string)=>{ownerId=id;}};
}
const preview=(page:Page)=>page.getByRole("img",{name:/^Player card for/});
async function openCard(page:Page){await page.getByRole("button",{name:"Share card",exact:true}).click();await expect(preview(page)).toBeVisible();}
async function svg(page:Page){return decodeURIComponent((await preview(page).getAttribute("src"))!.split(",").slice(1).join(","));}
async function png(page:Page,path:string){
  const downloadEvent=page.waitForEvent("download");
  await page.getByRole("button",{name:"Download PNG",exact:true}).click();
  const download=await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/^dfctf-profile_browser-(all-time|week)\.png$/);
  await download.saveAs(path);
  const bytes=await readFile(path);
  expect(bytes.subarray(0,8).toString("hex")).toBe("89504e470d0a1a0a");
  expect([bytes.readUInt32BE(16),bytes.readUInt32BE(20)]).toEqual([2400,1350]);
}

test("scope changes update statistics, activity, milestones and card together",async({page})=>{
  await mockProfile(page);await page.goto("/?view=profile");
  const all=page.getByRole("region",{name:"Practice · all time statistics"});
  await expect(all).toContainText("160");await expect(all).toContainText("#2");
  await expect(page.getByRole("link",{name:"All-time fixture capture"})).toBeVisible();
  await page.getByRole("button",{name:"Load more solves"}).click();
  await expect(page.getByRole("link",{name:"Next fixture capture"})).toBeVisible();
  await page.getByLabel("Practice scope",{exact:true}).selectOption("week");
  const weekly=page.getByRole("region",{name:"Practice · this week statistics"});
  await expect(weekly).toContainText("25");await expect(weekly).toContainText("#5");
  await expect(page.getByRole("link",{name:"All-time fixture capture"})).toHaveCount(0);
  await expect(page.getByRole("link",{name:"Weekly fixture capture"})).toBeVisible();
  await expect(page.getByRole("region",{name:"Milestones",exact:true})).not.toContainText("At least one earliest solve");
  await openCard(page);
  expect(await svg(page)).toContain("Practice · this week");expect(await svg(page)).toContain("#5");
});

test("the hero pattern is stable and the map and goals reflect proven results",async({page})=>{
  await mockProfile(page);await page.goto("/?view=profile");
  const band=page.locator(".pf-band path");await expect(band).toHaveAttribute("d",/^M/);
  const pattern=await band.getAttribute("d");
  await page.reload();await expect(band).toHaveAttribute("d",pattern!);
  const categories=page.getByRole("region",{name:"Categories",exact:true});
  await expect(categories).toContainText("2 of 4 solved");
  const forensics=categories.getByRole("listitem").filter({hasText:"Forensics"});
  await expect(forensics).toContainText("2/4");await expect(forensics).toContainText("160 pts");
  await expect(forensics.locator(".meter i")).toHaveCount(12);await expect(forensics.locator(".meter i.on")).toHaveCount(6);
  await expect(categories.getByRole("img",{name:/Forensics 2 of 4/})).toBeVisible();
  await expect(categories.getByRole("listitem").filter({hasText:"OSINT"})).toContainText("None");
  const goals=page.getByRole("region",{name:"Milestones",exact:true});
  await expect(goals).toContainText("2 of 3 earned");await expect(goals.locator("svg.milestone-icon[aria-hidden='true']")).toHaveCount(3);
  await expect(goals.getByRole("listitem").filter({hasText:"First solve"})).toContainText("Earned");
  await expect(goals.getByRole("listitem").filter({hasText:"Ten solves"})).toContainText("5/10");
  await expect(goals.getByRole("listitem").filter({hasText:"First Blood"})).toContainText("Earned");
  await expect(page.getByRole("button",{name:"Share card",exact:true})).toHaveClass(/button-primary/);
});

test("a new player sees goals and one clear next step",async({page})=>{
  await mockProfile(page,{empty:true});await page.goto("/?view=profile");
  await expect(page.getByRole("region",{name:"Milestones",exact:true})).toContainText("0 of 3 earned");
  await expect(page.getByRole("region",{name:"Milestones",exact:true}).getByText("Not yet")).toHaveCount(2);
  await expect(page.getByRole("heading",{name:"Your first solve starts here",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Browse challenges",exact:true})).toHaveClass(/button-primary/);
  await expect(page.getByRole("button",{name:"Share card",exact:true})).toHaveClass(/button-secondary/);
  await expect(page.locator(".player-profile .empty")).toHaveCount(0);
});

for(const width of [320,390,768,1440]){
  test(`the profile has no horizontal scrolling at ${width} pixels`,async({page})=>{
    await mockProfile(page,{long:true});await page.setViewportSize({width,height:844});await page.goto("/?view=profile");
    await expect(page.getByRole("button",{name:"Share card",exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}

test("the accent picker accepts any color by keyboard and warns about low contrast",async({page})=>{
  await mockProfile(page);await page.goto("/?view=profile");await openCard(page);
  const hex=page.getByLabel("Hex value",{exact:true});await expect(hex).toHaveValue("#ffd23f");
  await hex.fill("#ff00aa");expect(await svg(page)).toContain("#ff00aa");
  await page.getByRole("slider",{name:"Hue",exact:true}).focus();await page.keyboard.press("ArrowRight");
  await expect(hex).not.toHaveValue("#ff00aa");
  const warning=page.getByText("This color is hard to read on the dark card.",{exact:false});await expect(warning).toHaveCount(0);
  await hex.fill("#101113");await expect(warning).toBeVisible();
  await page.getByRole("button",{name:"Reset card",exact:true}).click();await expect(hex).toHaveValue("#ffd23f");await expect(warning).toHaveCount(0);
});

test("the player card opens on demand and returns focus when closed",async({page})=>{
  await mockProfile(page);await page.goto("/?view=profile");
  const share=page.getByRole("button",{name:"Share card",exact:true});
  await expect(share).toBeVisible();await expect(preview(page)).toHaveCount(0);
  await share.click();
  const dialog=page.getByRole("dialog",{name:"Player card",exact:true});
  await expect(dialog.getByRole("button",{name:"Download PNG",exact:true})).toBeVisible();
  await page.keyboard.press("Escape");await expect(dialog).toHaveCount(0);await expect(share).toBeFocused();
  await share.click();await dialog.getByRole("button",{name:"Close player card",exact:true}).click();
  await expect(dialog).toHaveCount(0);await expect(share).toBeFocused();
});

test("customization persists per owner, exports a real matching PNG and resets",async({page})=>{
  const mock=await mockProfile(page);await page.setViewportSize({width:1440,height:1000});await page.goto("/?view=profile");
  await openCard(page);
  await page.getByRole("button",{name:"Light",exact:true}).click();await page.getByLabel("Hex value",{exact:true}).fill("#086781");
  await page.getByLabel("First Blood count",{exact:true}).uncheck();
  expect(await svg(page)).toContain("#f5f3ec");expect(await svg(page)).toContain("#086781");expect(await svg(page)).not.toContain("FIRST BLOODS");
  expect(await svg(page)).not.toMatch(/PRIVATE_EMAIL|@example.test|userId|token|Download PNG/);
  await png(page,"test-results/profile-card-populated.png");
  await expect(page.getByRole("link",{name:"Save PNG again",exact:true})).toBeVisible();
  await page.reload();await page.screenshot({path:"test-results/profile-dashboard-desktop.png",fullPage:true});
  await openCard(page);await expect(page.getByRole("button",{name:"Light",exact:true})).toHaveAttribute("aria-pressed","true");await expect(page.getByLabel("Hex value",{exact:true})).toHaveValue("#086781");
  mock.owner("second-profile-owner");await page.reload();await openCard(page);
  await expect(page.getByRole("button",{name:"Dark",exact:true})).toHaveAttribute("aria-pressed","true");
  await page.getByRole("button",{name:"Light",exact:true}).click();await page.getByRole("button",{name:"Reset card",exact:true}).click();
  await expect(page.getByRole("button",{name:"Dark",exact:true})).toHaveAttribute("aria-pressed","true");
});

for(const variant of ["empty","unicode"] as const){
  test(`${variant} profile exports at fixed resolution on a narrow viewport with generated avatar`,async({page})=>{
    const unexpected:string[]=[];page.on("request",request=>{if(request.url().includes("unavailable-avatar"))unexpected.push(request.url());});
    await mockProfile(page,{empty:variant==="empty",long:variant==="unicode"});
    await page.setViewportSize({width:390,height:844});await page.goto("/?view=profile");
    if(variant==="empty"){await expect(page.getByRole("region",{name:"Practice · all time statistics"})).toContainText("Unranked");await expect(page.getByRole("heading",{name:"Your first solve starts here",exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"Browse challenges",exact:true})).toBeVisible();await expect(page.locator(".player-profile .empty")).toHaveCount(0);}
    await expect(page.getByRole("button",{name:"Share card",exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await openCard(page);
    expect(await svg(page)).not.toContain("<image");expect(unexpected).toEqual([]);
    if(variant==="unicode")await page.getByRole("button",{name:"Light",exact:true}).click();
    await png(page,`test-results/profile-card-${variant}.png`);
    await page.keyboard.press("Escape");
    await page.evaluate(()=>window.scrollTo({top:0,behavior:"instant"}));
    await page.screenshot({path:`test-results/profile-dashboard-${variant}-mobile.png`,fullPage:true});
  });
}

test("profile editing validates fields, preserves account separation and restores focus",async({page})=>{
  await mockProfile(page);await page.goto("/?view=profile");
  const edit=page.getByRole("button",{name:"Edit profile",exact:true});await edit.click();
  const dialog=page.getByRole("dialog",{name:"Edit profile",exact:true});
  await dialog.getByLabel(/^Display name/).fill("Updated fixture player");await dialog.getByLabel(/^Website URL/).fill("http://example.test");
  await dialog.getByRole("button",{name:"Save profile",exact:true}).click();
  await expect(dialog.getByLabel(/^Website URL/)).toHaveAttribute("aria-invalid","true");
  await expect(dialog.getByLabel(/^Website URL/)).toBeFocused();
  await dialog.getByLabel(/^Website URL/).fill("https://example.test");await dialog.getByRole("button",{name:"Save profile",exact:true}).click();
  await expect(dialog).toHaveCount(0);await expect(edit).toBeFocused();
  await expect(page.getByRole("heading",{name:"@profile_browser",exact:true})).toBeVisible();
  await expect(page.getByText("Updated fixture player",{exact:true})).toBeVisible();
  await openCard(page);expect(await svg(page)).toContain("Updated fixture");await page.keyboard.press("Escape");
  await edit.click();await page.getByRole("dialog").getByLabel(/^Display name/).fill("Unsaved fixture");await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);await expect(edit).toBeFocused();
  await page.getByRole("button",{name:"Account settings",exact:false}).click();await expect(page.getByRole("heading",{name:"Settings",exact:true})).toBeVisible();
});

test("failed and expired loads do not become zero statistics or expose a stale card",async({page})=>{
  const mock=await mockProfile(page);mock.fail(true);await page.goto("/?view=profile");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Profile temporarily unavailable");await expect(preview(page)).toHaveCount(0);
  mock.fail(false);await page.getByRole("button",{name:"Retry profile"}).click();await openCard(page);await page.keyboard.press("Escape");
  mock.expire();await page.getByLabel("Practice scope",{exact:true}).selectOption("week");
  await expect(page.getByRole("button",{name:"Check sign-in"})).toBeVisible();await expect(preview(page)).toHaveCount(0);await expect(page.getByRole("button",{name:"Download PNG",exact:true})).toHaveCount(0);
});

test("an image decode failure offers retry and concurrent download clicks produce one PNG",async({page})=>{
  await mockProfile(page);await page.goto("/?view=profile");await openCard(page);
  await page.evaluate(()=>{const original=HTMLImageElement.prototype.decode;let first=true;HTMLImageElement.prototype.decode=function(){if(first){first=false;return Promise.reject(new Error("Synthetic image decode failure. Retry the download."));}return original.call(this);};});
  await page.getByRole("button",{name:"Download PNG",exact:true}).click();
  await expect(page.getByRole("button",{name:"Retry export",exact:true})).toBeVisible();
  const downloads:string[]=[];page.on("download",download=>downloads.push(download.suggestedFilename()));
  const event=page.waitForEvent("download");await page.getByRole("button",{name:"Download PNG",exact:true}).evaluate(button=>{(button as HTMLButtonElement).click();(button as HTMLButtonElement).click();});
  await event;await expect(page.getByRole("button",{name:"Download PNG",exact:true})).toBeEnabled();expect(downloads).toHaveLength(1);
});

test("a pending export freezes scope and editing until the snapshot is ready",async({page})=>{
  await mockProfile(page);await page.goto("/?view=profile");await openCard(page);
  await page.evaluate(()=>{
    const original=HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode=function(){return new Promise<void>((resolve,reject)=>{(window as unknown as {releaseProfileImage:()=>void}).releaseProfileImage=()=>original.call(this).then(resolve,reject);});};
  });
  const event=page.waitForEvent("download");
  await page.getByRole("button",{name:"Download PNG",exact:true}).click();
  await expect(page.getByRole("button",{name:"Preparing PNG",exact:true})).toBeDisabled();
  await expect(page.getByLabel("Practice scope",{exact:true})).toBeDisabled();
  await expect(page.getByRole("button",{name:"Edit profile",exact:true})).toBeDisabled();
  await expect(page.getByRole("button",{name:"Light",exact:true})).toBeDisabled();
  await expect(page.getByRole("button",{name:"Close player card",exact:true})).toBeDisabled();
  await page.keyboard.press("Escape");await expect(preview(page)).toBeVisible();
  await page.waitForFunction(()=>typeof (window as unknown as {releaseProfileImage?:()=>void}).releaseProfileImage==="function");
  await page.evaluate(()=>(window as unknown as {releaseProfileImage:()=>void}).releaseProfileImage());
  await event;await expect(page.getByLabel("Practice scope",{exact:true})).toBeEnabled();
});
