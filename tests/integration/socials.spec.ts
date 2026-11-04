import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

test("real players discover leaderboard profiles, opt into sharing and accept mutual friendships",async({page,browser})=>{
  const fixture=JSON.parse(await readFile(path.join(process.env.DFCTF_INTEGRATION_DIR!,"fixture.json"),"utf8")) as {challengeId:string;flag:string;learners:{learner:string;otherLearner:string;password:string}};
  // Separate synthetic clients so earlier suites' logins do not share this flow's rate-limit bucket.
  await page.setExtraHTTPHeaders({Origin:"http://127.0.0.1:3200","X-dfCTF-Request":"1","X-Forwarded-For":"192.0.2.41"});
  const otherContext=await browser.newContext({baseURL:"http://127.0.0.1:3200",extraHTTPHeaders:{Origin:"http://127.0.0.1:3200","X-dfCTF-Request":"1","X-Forwarded-For":"192.0.2.42"}});
  const other=await otherContext.newPage();
  async function login(target:Page,email:string){await target.goto("/?auth=signin");await target.getByLabel("Email",{exact:true}).fill(email);await target.getByLabel("Password",{exact:true}).fill(fixture.learners.password);await target.locator("form").getByRole("button",{name:"Sign in",exact:true}).click();await expect(target.getByRole("navigation",{name:"Main",exact:true})).toBeVisible();}
  try{
    expect((await page.request.get("/api/v1/socials")).status()).toBe(401);
    await login(page,fixture.learners.learner);await login(other,fixture.learners.otherLearner);
    const a=(await(await page.request.get("/api/v1/me")).json()).codename as string,b=(await(await other.request.get("/api/v1/me")).json()).codename as string;
    const privateDetails={displayName:"Synthetic social learner",bio:"Fixture details shared only with consent.",websiteUrl:"",githubUrl:"",shareProfile:false};
    expect((await page.request.patch("/api/v1/profile",{headers:{"X-dfCTF-Account":a},data:privateDetails})).status()).toBe(200);
    const concealed=await(await other.request.get(`/api/v1/players/${a}`)).json();expect(concealed.identity.displayName).toBe("");expect(concealed.identity.bio).toBe("");
    await page.getByRole("button",{name:/^Account menu for/}).click();await page.getByRole("navigation",{name:"Account",exact:true}).getByRole("link",{name:"Profile",exact:true}).click();await page.getByRole("button",{name:"Edit profile",exact:true}).click();
    await page.getByRole("dialog",{name:"Edit profile",exact:true}).getByLabel("Share my display name, bio, and links with signed-in players",{exact:true}).check();await page.getByRole("button",{name:"Save profile",exact:true}).click();await expect(page.getByRole("dialog")).toHaveCount(0);
    expect((await page.request.post(`/api/v1/challenges/${fixture.challengeId}/submissions`,{data:{flag:fixture.flag}})).ok()).toBe(true);
    await other.getByRole("navigation",{name:"Main",exact:true}).getByRole("link",{name:"Leaderboard",exact:true}).click();await other.getByRole("button",{name:"All time",exact:true}).click();
    await other.getByRole("link",{name:`View ${a}'s profile`,exact:true}).click();await expect(other.getByRole("heading",{name:privateDetails.displayName,exact:true})).toBeVisible();
    const publicProfile=await(await other.request.get(`/api/v1/players/${a}`)).json();expect(JSON.stringify(publicProfile)).not.toContain(fixture.learners.learner);expect(JSON.stringify(publicProfile)).not.toContain(fixture.flag);
    await other.getByRole("button",{name:`Add friend: ${a}`,exact:true}).click();await expect(other.getByRole("button",{name:`Cancel request: ${a}`,exact:true})).toBeVisible();
    await page.getByRole("button",{name:/^Account menu for/}).click();await page.getByRole("navigation",{name:"Account",exact:true}).getByRole("link",{name:"Socials",exact:true}).click();await page.getByRole("button",{name:"Received",exact:true}).click();
    const connections=page.getByRole("region",{name:"Your connections",exact:true});await connections.getByRole("button",{name:`Accept request: ${b}`,exact:true}).click();await page.getByRole("button",{name:"Friends",exact:true}).click();await expect(connections.getByRole("link",{name:new RegExp(b)})).toBeVisible();
    await other.reload();await expect(other.getByRole("button",{name:`Remove friend: ${a}`,exact:true})).toBeVisible();
    expect((await page.request.patch("/api/v1/profile",{headers:{"X-dfCTF-Account":a},data:privateDetails})).status()).toBe(200);await other.reload();await expect(other.getByRole("heading",{name:a,exact:true})).toBeVisible();await expect(other.getByText(privateDetails.bio,{exact:true})).toHaveCount(0);
    await connections.getByRole("button",{name:`Remove friend: ${b}`,exact:true}).click();await expect(connections.getByText("Your circle starts here",{exact:true})).toBeVisible();
    const theirs=await(await other.request.get("/api/v1/socials?kind=friends")).json();expect(theirs.items).toEqual([]);
  }finally{await otherContext.close();}
});
