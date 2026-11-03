import { test,expect,type Page } from "@playwright/test";
import type { CompetitionDetail,ChallengeDetail } from "../../src/lib/types";

const identity={id:"host",email:"host@example.test",codename:"event_player",emailVerified:true,role:"admin",twoFactorEnabled:true};
const event=():CompetitionDetail=>({id:"event-one",title:"Autumn CTF",description:"An individual competition with original fictional challenges.",rules:"No LLM-assisted solving. Follow the published scope.",platform:"dfctf",externalUrl:null,status:"published",startsAt:new Date(Date.now()-3_600_000).toISOString(),endsAt:new Date(Date.now()+3_600_000).toISOString(),phase:"live",registered:false,participants:0,challenges:[],standings:[]});
const problem=():ChallengeDetail=>({id:"event-problem",slug:"event-problem",title:"Private competition evidence",summary:"Find a flag in the original training evidence.",description:"Inspect the supplied event file to recover the complete flag.",category:"Forensics",difficulty:"Easy",tags:[],xp:250,estimatedMinutes:10,solved:false,attempted:false,solveCount:0,status:"published",visibility:"competition",author:"event_author",flagFormat:"dfCTF{...}",version:1,files:[],solvers:[],submissionsOpen:true});
async function mock(page:Page,handle:(route:any,url:URL)=>Promise<boolean>){
  await page.route("**/api/**",async route=>{
    const url=new URL(route.request().url());if(await handle(route,url))return;let data:unknown;
    if(url.pathname==="/api/v1/auth/bootstrap")data={user:identity,hasAccess:true,staffVerified:true,providers:{google:false,github:false},localMail:false};
    else if(url.pathname==="/api/v1/challenges")data=[];
    else if(url.pathname==="/api/v1/competitions")data=[];
    else if(url.pathname==="/api/v1/progress")data={totalXp:0,solvedCount:0,attemptedCount:0,categories:[],recentSolves:[]};
    else if(url.pathname==="/api/v1/leaderboard")data={range:"week",weekEndsAt:new Date(Date.now()+86_400_000).toISOString(),players:0,standings:[],viewer:null,challenges:[],race:{players:[],snapshots:[]},hourly:{start:new Date().toISOString(),counts:[],firstBlood:[]},mine:{days:[]}};
    else throw new Error(`Unexpected competition request ${route.request().method()} ${url.pathname}`);
    await route.fulfill({json:data});
  });
}
test("players join, solve through the event API, and see event points without changing practice XP",async({page})=>{
  const current=event(),challenge=problem();let submissions=0;
  await mock(page,async(route,url)=>{
    if(url.pathname==="/api/v1/competitions")await route.fulfill({json:[current]});
    else if(url.pathname==="/api/v1/competitions/event-one/join"){expect(route.request().headers()["x-dfctf-request"]).toBe("1");current.registered=true;current.participants=1;current.challenges=[challenge];await route.fulfill({json:{registered:true}});}
    else if(url.pathname==="/api/v1/competitions/event-one/challenges/event-problem/submissions"){
      expect(route.request().postDataJSON()).toEqual({flag:"dfCTF{event_evidence}"});submissions++;challenge.solved=true;challenge.solveCount=1;challenge.solution="Read the fictional evidence file.";challenge.solvers=[{codename:identity.codename,solvedAt:new Date().toISOString(),firstBlood:true}];current.standings=[{rank:1,codename:identity.codename,points:250,solves:1}];await route.fulfill({json:{status:"correct",xp:250,totalXp:250,solution:challenge.solution}});
    }else if(url.pathname==="/api/v1/competitions/event-one/challenges/event-problem")await route.fulfill({json:challenge});
    else if(url.pathname==="/api/v1/competitions/event-one")await route.fulfill({json:current});
    else return false;return true;
  });
  await page.goto("/?view=competitions&competition=event-one");
  await page.getByRole("button",{name:"Join competition",exact:true}).click();
  await page.getByRole("link",{name:/Private competition evidence/}).click();
  await page.getByLabel("Flag",{exact:true}).fill("dfCTF{event_evidence}");await page.getByRole("button",{name:"Submit flag",exact:true}).click();
  await expect(page.getByText("Your competition score is now",{exact:false})).toContainText("250");expect(submissions).toBe(1);
  await expect(page.locator(".capture-heading")).toContainText("Flag captured!");
  await expect(page.locator(".capture-points")).toHaveText("+250 points earned");
  await expect(page.locator(".capture-announcement")).toHaveText("Flag captured! 250 points earned.");
  await expect(page.locator(".standing-pill")).toContainText("0 pts");
  await page.getByRole("button",{name:"Back to competition",exact:true}).click();
  await expect(page.getByRole("table")).toContainText("250");
  await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:"test-results/competition-desktop.png",fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:"test-results/competition-mobile.png",fullPage:true});
  const tab=page.getByRole("navigation",{name:"Main"}).getByRole("link",{name:"Competitions",exact:true});
  await tab.click();await expect(page.getByRole("button",{name:"View event",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"View event",exact:true}).click();await page.getByRole("link",{name:/Private competition evidence/}).click();
  await expect(page.getByRole("heading",{name:"Private competition evidence",exact:true})).toBeVisible();
  // The challenge is a modal; the header behind it is inert until Escape closes it.
  await page.keyboard.press("Escape");await expect(page.getByRole("dialog")).toHaveCount(0);
  await tab.click();await expect(page.getByRole("button",{name:"View event",exact:true})).toBeVisible();
});
test("host settings switch between built-in challenges and a CTFd link and publish a configured event",async({page})=>{
  let saved:any,published=false;
  await mock(page,async(route,url)=>{
    if(url.pathname==="/api/v1/competitions"||url.pathname==="/api/v1/staff/competitions"&&route.request().method()==="GET")await route.fulfill({json:[]});
    else if(url.pathname==="/api/v1/staff/challenges")await route.fulfill({json:[problem()]});
    else if(url.pathname==="/api/v1/staff/competitions"&&route.request().method()==="POST"){saved=route.request().postDataJSON();await route.fulfill({json:{id:"new-event"}});}
    else if(url.pathname==="/api/v1/staff/competitions/new-event"){published=route.request().postDataJSON().status==="published";await route.fulfill({json:{id:"new-event",status:"published"}});}
    else return false;return true;
  });
  await page.goto("/?view=competitions");await page.getByRole("button",{name:"Manage events",exact:true}).click();await page.getByRole("button",{name:"Create competition",exact:true}).click();
  await page.getByLabel("Competition title",{exact:true}).fill("Custom CTFd event");await page.getByLabel("Description",{exact:true}).fill("An independently hosted competition with original challenges.");
  await expect(page.getByRole("heading",{name:"Challenges and points",exact:true})).toBeVisible();
  await page.getByRole("checkbox",{name:"Private competition evidence",exact:true}).check();
  await page.getByLabel("Points for Private competition evidence",{exact:true}).fill("500");
  await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>window.scrollTo({top:0,behavior:"instant"}));await page.screenshot({path:"test-results/competition-host-native.png",fullPage:true});
  await page.getByLabel(/^Hosting platform/).selectOption("ctfd");await expect(page.getByRole("heading",{name:"Challenges and points",exact:true})).toHaveCount(0);
  await page.getByLabel("CTFd event URL",{exact:true}).fill("https://ctf.example.org/autumn");
  await page.getByLabel("Starts (Philippine time)",{exact:true}).fill("2026-12-01T08:00");await page.getByLabel("Ends (Philippine time)",{exact:true}).fill("2026-12-01T18:00");
  await page.getByRole("button",{name:"Save event draft",exact:true}).click();await expect(page.getByText("Draft saved.",{exact:false})).toBeVisible();
  expect(saved).toMatchObject({platform:"ctfd",externalUrl:"https://ctf.example.org/autumn",selections:[],startsAt:"2026-12-01T00:00:00.000Z",endsAt:"2026-12-01T10:00:00.000Z"});
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.scrollTo({top:0,behavior:"instant"}));expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:"test-results/competition-host-ctfd-mobile.png",fullPage:true});
  await page.getByRole("button",{name:"Publish competition",exact:true}).click();await expect(page.getByText("Competition published.",{exact:false})).toBeVisible();expect(published).toBe(true);
});
test("upcoming event content stays hidden and CTFd links use their independent host",async({page})=>{
  const upcoming={...event(),phase:"upcoming",startsAt:new Date(Date.now()+86_400_000).toISOString()};
  await mock(page,async(route,url)=>{
    if(url.pathname==="/api/v1/competitions/event-one")await route.fulfill({json:upcoming});
    else if(url.pathname==="/api/v1/competitions/external")await route.fulfill({json:{...event(),id:"external",platform:"ctfd",externalUrl:"https://ctf.example.org/autumn"}});
    else return false;return true;
  });
  await page.goto("/?view=competitions&competition=event-one");await expect(page.getByText("Challenges open at the scheduled start.",{exact:false})).toBeVisible();await expect(page.getByRole("link",{name:/Private competition evidence/})).toHaveCount(0);
  await page.goto("/?view=competitions&competition=external");const link=page.getByRole("link",{name:"Open CTFd event",exact:true});await expect(link).toHaveAttribute("href","https://ctf.example.org/autumn");await expect(link).toHaveAttribute("rel","noopener noreferrer");await expect(page.getByRole("button",{name:"Join competition",exact:true})).toHaveCount(0);
});
