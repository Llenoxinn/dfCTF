import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

test("real owner profile edits persist, reflect canonical scores, and remain isolated from another account",async({page})=>{
  const fixture=JSON.parse(await readFile(path.join(process.env.DFCTF_INTEGRATION_DIR!,"fixture.json"),"utf8")) as {challengeId:string;flag:string;learners:{learner:string;otherLearner:string;password:string}};
  // Keep this synthetic client out of preceding suites' rolling sign-in budget.
  // Development trusts this header; production still requires its proxy-stamped X-Real-IP.
  await page.setExtraHTTPHeaders({Origin:"http://127.0.0.1:3200","X-dfCTF-Request":"1","X-Forwarded-For":"192.0.2.31"});
  expect((await page.request.get("/api/v1/profile")).status()).toBe(401);
  async function signIn(email:string){
    await page.goto("/?auth=signin");await page.getByLabel("Email",{exact:true}).fill(email);await page.getByLabel("Password",{exact:true}).fill(fixture.learners.password);
    const [response]=await Promise.all([
      page.waitForResponse(response=>new URL(response.url()).pathname==="/api/auth/sign-in/email"&&response.request().method()==="POST"),
      page.locator("form").getByRole("button",{name:"Sign in",exact:true}).click(),
    ]);
    expect(response.status(),"The profile fixture must sign in before opening the dashboard.").toBe(200);
    await page.getByRole("button",{name:/^Account menu for/}).click();
    await page.getByRole("navigation",{name:"Account",exact:true}).getByRole("link",{name:"Profile",exact:true}).click();
    await expect(page.getByRole("heading",{name:"Profile",exact:true})).toBeVisible();
  }
  await signIn(fixture.learners.learner);
  await page.getByRole("button",{name:"Edit profile",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"Edit profile",exact:true});
  await dialog.getByLabel(/^Display name/).fill("Fixture learner 学ぶ人");await dialog.getByLabel(/^Bio/).fill("Synthetic account for profile integration verification.");
  await dialog.getByRole("button",{name:"Save profile",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Fixture learner 学ぶ人",exact:true})).toBeVisible();
  const submission=await page.request.post(`/api/v1/challenges/${fixture.challengeId}/submissions`,{data:{flag:fixture.flag}});
  expect(submission.ok()).toBe(true);
  await page.getByRole("button",{name:"Refresh profile",exact:true}).click();
  const result=await(await page.request.get("/api/v1/profile?scope=all")).json();
  const board=await(await page.request.get("/api/v1/leaderboard?range=all")).json();
  expect(result.stats).toMatchObject({points:board.viewer.points,rank:board.viewer.rank,solved:board.viewer.solves});
  expect(result.identity.displayName).toBe("Fixture learner 学ぶ人");expect(JSON.stringify(result.card)).not.toContain(fixture.learners.learner);expect(JSON.stringify(result)).not.toContain(fixture.flag);
  await page.reload();await expect(page.getByRole("heading",{name:"Fixture learner 学ぶ人",exact:true})).toBeVisible();
  expect((await page.request.post("/api/auth/sign-out",{data:{}})).ok()).toBe(true);
  expect((await page.request.get("/api/v1/profile")).status()).toBe(401);
  await signIn(fixture.learners.otherLearner);
  const other=await(await page.request.get("/api/v1/profile?scope=all")).json();
  expect(other.identity.displayName).toBe("");expect(other.stats).toMatchObject({points:0,solved:0,rank:null});
  const injection=await page.request.patch("/api/v1/profile",{data:{displayName:"Injected",bio:"",websiteUrl:"",githubUrl:"",role:"admin",points:999}});
  expect(injection.status()).toBe(422);
});
