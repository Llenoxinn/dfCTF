import { expect, test, type Page } from "@playwright/test";
import { CATEGORIES } from "../../src/lib/types";
import { profileMilestones } from "../../src/lib/player-profile";
import type { FriendshipState, ViewedPlayer } from "../../src/lib/socials";

async function fixture(page:Page){
  const connections=new Map<string,FriendshipState>([["pending_peer","incoming"]]);
  const names=["echo_fox","new_peer","pending_peer"];
  let fail=false,expired=false;
  await page.route("**/api/**",async route=>{
    const url=new URL(route.request().url()),method=route.request().method();let result:unknown;
    if(url.pathname==="/api/v1/auth/bootstrap")result={user:{id:"synthetic-social-owner",email:"PRIVATE_OWNER@example.test",codename:"me_social",emailVerified:true,role:"participant",twoFactorEnabled:false},hasAccess:true,staffVerified:false,providers:{google:false,github:false},localMail:false};
    else if(url.pathname==="/api/v1/challenges")result=[];
    else if(url.pathname==="/api/v1/progress")result={totalXp:0,solvedCount:0,attemptedCount:0,categories:[],recentSolves:[]};
    else if(url.pathname==="/api/v1/leaderboard")result={range:"week",weekEndsAt:"2026-11-08T15:59:59.999Z",players:1,standings:[{codename:"echo_fox",rank:1,points:100,solves:3}],viewer:null,race:{players:[],snapshots:[]},hourly:{start:"2026-11-02T00:00:00Z",counts:[],firstBlood:[]},challenges:[],mine:{start:"2026-11-02T00:00:00Z",days:[]}};
    else if(url.pathname==="/api/v1/community")result={weekly:null};
    else if(url.pathname==="/api/v1/competitions/synthetic-event")result={id:"synthetic-event",title:"Synthetic social event",description:"A fictional event used only by the browser test.",rules:"",platform:"dfctf",externalUrl:null,status:"published",startsAt:"2026-11-03T09:00:00Z",endsAt:"2099-11-03T10:00:00Z",phase:"live",registered:true,participants:1,challenges:[],standings:[{codename:"echo_fox",rank:1,points:250,solves:1}]};
    else if(url.pathname.startsWith("/api/v1/players")||url.pathname==="/api/v1/socials"){
      if(expired){await route.fulfill({status:401,json:{error:{message:"Sign in to continue."}}});return;}
      if(method==="POST"){
        if(fail){await route.fulfill({status:503,json:{error:{message:"Synthetic service failure. Try again."}}});return;}
        const {codename,action}=route.request().postDataJSON();const state:FriendshipState=action==="request"?"outgoing":action==="accept"?"friends":"none";connections.set(codename,state);result={relationship:state};
      }else if(url.pathname.startsWith("/api/v1/players/")){
        const codename=decodeURIComponent(url.pathname.split("/").at(-1)!);
        const week=url.searchParams.get("scope")==="week",stats=week?{rank:4,points:25,solved:1,firstBloods:0}:{rank:1,points:100,solved:3,firstBloods:1};
        result={identity:{codename,displayName:"",bio:"",websiteUrl:"",githubUrl:""},detailsShared:false,relationship:connections.get(codename)??"none",scope:{id:week?"week":"all",label:week?"Practice · this week":"Practice · all time",period:week?"2–8 Nov 2026 · PHT":"All-time practice"},asOf:"2026-11-03T10:00:00Z",stats,categories:CATEGORIES.map(category=>({category,total:category==="Forensics"?4:0,solved:category==="Forensics"?stats.solved:0,points:category==="Forensics"?stats.points:0})),milestones:profileMilestones(stats),activity:[{challengeId:"synthetic-visible-capture",title:week?"Weekly fixture capture":"All-time fixture capture",category:"Forensics",at:"2026-11-03T10:00:00Z",points:25,firstBlood:!week}]} satisfies ViewedPlayer;
      }else{
        const kind=url.searchParams.get("kind"),q=url.searchParams.get("q")?.toLowerCase()??"";
        result={items:names.filter(name=>name.startsWith(q)&&(!kind||connections.get(name)===kind)).map(codename=>({codename,displayName:"",relationship:connections.get(codename)??"none"})),nextCursor:null};
      }
    }else throw new Error(`Unexpected Socials fixture request: ${url.pathname}`);
    await route.fulfill({json:result});
  });
  return {fail:(value:boolean)=>{fail=value;},expire:()=>{expired=true;}};
}

test("leaderboard names open read-only scoped player profiles and preserve history",async({page})=>{
  await fixture(page);await page.goto("/?view=leaderboard");
  const link=page.getByRole("link",{name:"View echo_fox's profile",exact:true});await expect(link).toHaveAttribute("href","/?view=socials&player=echo_fox");await link.click();
  await expect(page).toHaveURL(/view=socials&player=echo_fox/);await expect(page.getByRole("heading",{name:"echo_fox",exact:true})).toBeVisible();
  await expect(page.getByText("This player keeps their optional profile details private.")).toBeVisible();
  await expect(page.getByRole("region",{name:"Practice · all time statistics"})).toContainText("100");
  await expect(page.getByRole("button",{name:"Edit profile",exact:true})).toHaveCount(0);await expect(page.getByRole("button",{name:"Download PNG",exact:true})).toHaveCount(0);
  await page.getByLabel("Practice scope",{exact:true}).selectOption("week");
  await expect(page.getByRole("region",{name:"Practice · this week statistics"})).toContainText("25");await expect(page.getByRole("link",{name:"Weekly fixture capture"})).toBeVisible();await expect(page.getByRole("link",{name:"All-time fixture capture"})).toHaveCount(0);
  await page.getByRole("button",{name:"Add friend: echo_fox",exact:true}).click();await expect(page.getByRole("status").filter({hasText:"Friend request sent to echo_fox."})).toBeVisible();
  await page.reload();await expect(page.getByRole("button",{name:"Cancel request: echo_fox",exact:true})).toBeVisible();
  await page.goBack();await expect(page.getByRole("heading",{name:"Leaderboard",exact:true})).toBeVisible();await page.goForward();await expect(page.getByRole("heading",{name:"Player profile",exact:true})).toBeVisible();
});

test("Socials supports search, sent cancellation, incoming acceptance, decline and friend removal",async({page})=>{
  await fixture(page);await page.goto("/?view=socials");
  const connections=page.getByRole("region",{name:"Your connections",exact:true}),directory=page.getByRole("region",{name:"Find players",exact:true});
  await expect(connections.getByText("Your circle starts here",{exact:true})).toBeVisible();
  await page.getByLabel("Search players by codename").fill("new_");await page.getByRole("button",{name:"Search",exact:true}).click();
  await expect(directory.getByRole("link",{name:/new_peer/})).toBeVisible();await expect(directory.getByRole("link",{name:/echo_fox/})).toHaveCount(0);
  await directory.getByRole("button",{name:"Add friend: new_peer",exact:true}).click();
  await page.getByRole("button",{name:"Sent",exact:true}).click();await expect(connections.getByRole("link",{name:/new_peer/})).toBeVisible();
  await connections.getByRole("button",{name:"Cancel request: new_peer",exact:true}).click();await expect(connections.getByText("No pending requests",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Received",exact:true}).click();await connections.getByRole("button",{name:"Accept request: pending_peer",exact:true}).click();
  await page.getByRole("button",{name:"Friends",exact:true}).click();await expect(connections.getByRole("link",{name:/pending_peer/})).toBeVisible();
  await connections.getByRole("button",{name:"Remove friend: pending_peer",exact:true}).click();await expect(connections.getByText("Your circle starts here",{exact:true})).toBeVisible();
});

test("competition standings open the same player view with clearly separate practice scores",async({page})=>{
  await fixture(page);await page.goto("/?view=competitions&competition=synthetic-event");
  const scoreboard=page.getByRole("region",{name:"Competition scoreboard",exact:true});await expect(scoreboard).toContainText("250");
  await scoreboard.getByRole("link",{name:"View echo_fox's profile",exact:true}).click();
  await expect(page.getByRole("heading",{name:"echo_fox",exact:true})).toBeVisible();await expect(page.getByRole("region",{name:"Practice · all time statistics"})).toContainText("100");
  await page.goBack();await expect(page.getByRole("heading",{name:"Synthetic social event",exact:true})).toBeVisible();
});

test("network failures allow retry and expired sessions clear private connection lists",async({page})=>{
  const mock=await fixture(page);await page.goto("/?view=socials&player=echo_fox");mock.fail(true);
  await page.getByRole("button",{name:"Add friend: echo_fox",exact:true}).click();await expect(page.getByRole("main").getByRole("alert")).toContainText("Synthetic service failure");
  mock.fail(false);await page.getByRole("button",{name:"Add friend: echo_fox",exact:true}).click();await expect(page.getByRole("button",{name:"Cancel request: echo_fox",exact:true})).toBeVisible();
  mock.expire();await page.getByRole("button",{name:"Cancel request: echo_fox",exact:true}).click();await expect(page.getByRole("main").getByRole("alert")).toContainText("Sign in again");await expect(page.getByRole("heading",{name:"echo_fox",exact:true})).toHaveCount(0);
});

test("the connections loader stays inset on every tab at desktop and mobile widths",async({page})=>{
  await fixture(page);
  let release=()=>{};const held=new Promise<void>(resolve=>{release=resolve;});
  await page.route(url=>url.pathname==="/api/v1/socials"&&url.searchParams.has("kind"),async route=>{await held;await route.fallback().catch(()=>{});});
  await page.goto("/?view=socials");
  const connections=page.getByRole("region",{name:"Your connections",exact:true}),loader=connections.locator(".loading");
  for(const [width,inset] of [[1280,24],[390,20]] as const){
    await page.setViewportSize({width,height:844});
    for(const tab of ["Friends","Received","Sent"]){
      await connections.getByRole("button",{name:tab,exact:true}).click();await expect(loader).toContainText("Loading players");
      const panel=(await connections.boundingBox())!,meter=(await loader.locator(".pixel-scan").boundingBox())!,label=(await loader.locator(".mono").boundingBox())!;
      expect(meter.x-panel.x-1).toBeCloseTo(inset,0);expect(label.x+label.width).toBeLessThanOrEqual(panel.x+panel.width-inset);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    }
    await page.screenshot({path:`test-results/socials-connections-loading-${width}.png`});
  }
  await connections.getByRole("button",{name:"Received",exact:true}).click();release();
  await expect(connections.getByRole("link",{name:/pending_peer/})).toBeVisible();await expect(loader).toHaveCount(0);
});

test("directory and player profiles fit narrow screens in both site themes",async({page})=>{
  await fixture(page);await page.setViewportSize({width:390,height:844});await page.goto("/?view=socials");
  await expect(page.getByRole("heading",{name:"Socials",exact:true})).toBeVisible();await expect(page.getByRole("region",{name:"Find players",exact:true}).getByRole("link",{name:/echo_fox/})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:"test-results/socials-mobile.png",fullPage:true});
  await page.getByRole("region",{name:"Find players",exact:true}).getByRole("link",{name:/echo_fox/}).click();await expect(page.getByRole("heading",{name:"echo_fox",exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:"test-results/social-player-mobile-dark.png",fullPage:true});
  await page.context().addCookies([{name:"dfctf-theme",value:"light",domain:"127.0.0.1",path:"/"}]);await page.reload();await expect(page.getByRole("heading",{name:"echo_fox",exact:true})).toBeVisible();await expect(page.locator("html")).toHaveAttribute("data-theme","light");expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:"test-results/social-player-mobile-light.png",fullPage:true});
});
