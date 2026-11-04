import { test,expect } from "@playwright/test";

for(const item of [
  {action:"Report a bug",submit:"Submit bug report",fields:["Steps to reproduce","Expected behavior","Actual behavior"],kind:"bug"},
  {action:"Suggest a feature",submit:"Submit feature suggestion",fields:["Problem or need","Proposed improvement"],kind:"feature"},
  {action:"Send feedback",submit:"Submit feedback",fields:["Feedback message"],kind:"feedback"},
]) {
  test(`${item.action} collects structured details inside the app and confirms only after acceptance`,async({page})=>{
    await page.setViewportSize({width:390,height:844});
    let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve;});
    const received:Record<string,string>[]=[];
    await page.route("**/api/v1/feedback",async route=>{const body=route.request().postDataJSON();received.push(body);await pending;await route.fulfill({json:{accepted:true,id:body.id}});});
    await page.goto("/support");
    const trigger=page.getByRole("navigation",{name:"Help and information"}).getByRole("button",{name:item.action,exact:true});
    await trigger.click();const dialog=page.getByRole("dialog",{name:item.action,exact:true});
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button",{name:item.submit,exact:true}).click();
    await expect(dialog.getByLabel(item.kind==="feedback"?"Subject":"Title",{exact:true})).toBeFocused();
    expect(received).toHaveLength(0);
    await dialog.getByLabel(item.kind==="feedback"?"Subject":"Title",{exact:true}).fill("Synthetic report title");
    for(const label of item.fields)await dialog.getByLabel(label,{exact:true}).fill(`Synthetic details for ${label}.`);
    await dialog.getByLabel(/^Contact email/).fill("private-reply@example.test");
    await dialog.getByRole("button",{name:item.submit,exact:true}).evaluate(button=>{(button as HTMLButtonElement).click();(button as HTMLButtonElement).click();});
    await expect.poll(()=>received.length).toBe(1);
    await expect(dialog.getByRole("button",{name:"Sending…",exact:true})).toBeDisabled();
    await expect(dialog.getByText("Your submission was accepted for delivery to the developers.",{exact:true})).toHaveCount(0);
    await page.keyboard.press("Escape");await expect(dialog).toBeVisible();
    expect(received[0]).toMatchObject({kind:item.kind,title:"Synthetic report title",contactEmail:"private-reply@example.test"});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    release();await expect(dialog.getByText("Your submission was accepted for delivery to the developers.",{exact:true})).toBeVisible();
    await dialog.getByRole("button",{name:"Done",exact:true}).click();await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();
    await expect(page).toHaveURL(/\/support$/);
  });
}

test("a failed report keeps all text, retries the same ID, and supports Escape with focus return",async({page})=>{
  const attempts:Record<string,string>[]=[];
  await page.route("**/api/v1/feedback",async route=>{const body=route.request().postDataJSON();attempts.push(body);await route.fulfill(attempts.length===1?{status:503,json:{error:{message:"Delivery unavailable. Retry your submission."}}}:{json:{accepted:true,id:body.id}});});
  await page.goto("/support");const trigger=page.getByRole("button",{name:"Report a bug",exact:true});await trigger.click();
  const dialog=page.getByRole("dialog",{name:"Report a bug",exact:true});
  for(const label of ["Title","Steps to reproduce","Expected behavior","Actual behavior"])await dialog.getByLabel(label,{exact:true}).fill(`Preserved synthetic ${label} details.`);
  await dialog.getByRole("button",{name:"Submit bug report",exact:true}).click();
  await expect(dialog.getByRole("alert")).toContainText("Delivery unavailable.");
  await expect(dialog.getByRole("textbox",{name:"Steps to reproduce",exact:true})).toHaveValue("Preserved synthetic Steps to reproduce details.");
  await dialog.getByRole("button",{name:"Submit bug report",exact:true}).click();
  await expect(dialog.getByText("Your submission was accepted for delivery to the developers.",{exact:true})).toBeVisible();
  expect(attempts).toHaveLength(2);expect(attempts[1]).toEqual(attempts[0]);
  await page.keyboard.press("Escape");await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();
});
