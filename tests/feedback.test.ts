import { randomUUID } from "node:crypto";
import { beforeAll,afterAll,beforeEach,afterEach,describe,it,expect,vi } from "vitest";
import { eq } from "drizzle-orm";
import { createStore } from "@/server/db";
import * as database from "@/server/db";
import { submitFeedback,feedbackMail,deliverFeedback } from "@/server/feedback";
import { feedbackReceipts } from "@/server/schema";
import { feedbackInput,type FeedbackInput } from "@/lib/feedback";
import { HttpError } from "@/server/http";
import { POST } from "@/app/api/v1/feedback/route";

const smtp=vi.hoisted(()=>({send:vi.fn()}));
vi.mock("nodemailer",()=>({default:{createTransport:()=>({sendMail:smtp.send})}}));
let store:Awaited<ReturnType<typeof createStore>>;
const report=():FeedbackInput=>({id:randomUUID(),kind:"bug",title:"Fictional broken control",steps:"Open the fictional page and select the control.",expected:"The fictional control should open.",actual:"The fictional control stays closed.",contactEmail:"reply@example.test"});
const headers=()=>new Headers({"x-forwarded-for":randomUUID()});
beforeAll(async()=>{store=await createStore(process.env.TEST_DATABASE_URL,true);await store.migrate();});
afterAll(async()=>{await store.close();});
beforeEach(()=>{vi.stubEnv("AUTH_SECRET","test-feedback-secret-that-is-long-enough");vi.stubEnv("SMTP_URL","smtp://fixture.invalid");vi.stubEnv("MAIL_FROM","sender@example.test");vi.stubEnv("FEEDBACK_TO","developers@example.test");smtp.send.mockReset();smtp.send.mockResolvedValue({accepted:["developers@example.test"]});});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();});

describe("private reporting intake",()=>{
  it("delivers every complete report type to the same private inbox without a GitHub account",async()=>{
    const bug=report();
    const variants:FeedbackInput[]=[bug,{id:randomUUID(),kind:"feature",title:"Fictional improvement",problem:"A fictional need players encounter.",improvement:"A fictional proposal for improving it.",contactEmail:""},{id:randomUUID(),kind:"feedback",title:"Fictional feedback",message:"A fictional feedback message for developers.",contactEmail:""}];
    for(const item of variants){
      expect(await submitFeedback(store.db,item,headers())).toEqual({accepted:true,id:item.id});
      expect(smtp.send).toHaveBeenLastCalledWith(expect.objectContaining({to:"developers@example.test",...feedbackMail(item)}));
      for(const value of Object.values(item))if(value)expect(smtp.send.mock.lastCall![0].text).toContain(value);
    }
    expect(smtp.send.mock.calls[0][0]).toMatchObject({from:"sender@example.test",replyTo:bug.contactEmail});
    expect(smtp.send.mock.calls[0][0].text).toContain(bug.kind==="bug"?bug.actual:"");
    const [receipt]=await store.db.select().from(feedbackReceipts).where(eq(feedbackReceipts.id,bug.id));
    expect(JSON.stringify(receipt)).not.toMatch(/reply@example|fictional|control/i);
  });
  it("deduplicates simultaneous sends and retries, rejecting a reused ID with changed content",async()=>{
    const item=report(),address=headers(),deliver=vi.fn(async()=>{});
    await Promise.all([submitFeedback(store.db,item,address,deliver),submitFeedback(store.db,item,address,deliver)]);
    await submitFeedback(store.db,item,address,deliver);expect(deliver).toHaveBeenCalledTimes(1);
    await expect(submitFeedback(store.db,{...item,title:"A changed report"},address,deliver)).rejects.toMatchObject({status:409});
  });
  it("does not confirm failed delivery or persist a receipt and permits the same report to retry",async()=>{
    const item=report(),address=headers();smtp.send.mockRejectedValueOnce(new Error("SECRET SMTP details"));
    await expect(submitFeedback(store.db,item,address)).rejects.toMatchObject({status:503,code:"FEEDBACK_DELIVERY_FAILED"});
    expect(await store.db.select().from(feedbackReceipts).where(eq(feedbackReceipts.id,item.id))).toHaveLength(0);
    expect(await submitFeedback(store.db,item,address)).toEqual({accepted:true,id:item.id});
    smtp.send.mockResolvedValueOnce({accepted:[]});await expect(deliverFeedback(report())).rejects.toMatchObject({status:503});
  });
  it("bounds slow delivery, shares duplicate sends, and resumes without charging busy reports",async()=>{
    const item=report(),address=headers();let release!:()=>void;
    const deliver=vi.fn(()=>new Promise<void>(resolve=>{release=resolve;}));
    const first=submitFeedback(store.db,item,address,deliver);
    await vi.waitFor(()=>expect(deliver).toHaveBeenCalledTimes(1));
    try {
      for(let i=0;i<6;i++)await expect(submitFeedback(store.db,report(),address,deliver)).rejects.toMatchObject({status:503,code:"FEEDBACK_BUSY"});
      await expect(submitFeedback(store.db,{...item,title:"A changed report"},address,deliver)).rejects.toMatchObject({status:409});
      const duplicate=submitFeedback(store.db,item,address,deliver);release();
      await expect(Promise.all([first,duplicate])).resolves.toEqual([{accepted:true,id:item.id},{accepted:true,id:item.id}]);
      expect(deliver).toHaveBeenCalledTimes(1);
      await expect(submitFeedback(store.db,report(),address,async()=>{})).resolves.toMatchObject({accepted:true});
    } finally { release();await first; }
  });
  it("rejects malformed, oversized, and header-injection fields",()=>{
    for(const patch of [{title:"Report\r\nBcc: secret@example.test"},{steps:" "},{actual:"x".repeat(6001)},{contactEmail:"a@example.test\r\nBcc: x@example.test"},{userId:"forged"}])expect(feedbackInput.safeParse({...report(),...patch}).success).toBe(false);
  });
  it("rate limits new submissions, while a successful retry does not send again",async()=>{
    const address=headers(),deliver=vi.fn(async()=>{}),first=report();await submitFeedback(store.db,first,address,deliver);
    for(let i=0;i<4;i++)await submitFeedback(store.db,report(),address,deliver);
    await expect(submitFeedback(store.db,report(),address,deliver)).rejects.toMatchObject({status:429});
    await submitFeedback(store.db,first,address,deliver);expect(deliver).toHaveBeenCalledTimes(5);
  });
  it("enforces same-origin JSON and server validation, confirming acceptance only after SMTP success",async()=>{
    vi.stubEnv("APP_URL","http://localhost:3000");vi.spyOn(database,"getDb").mockResolvedValue(store.db);vi.spyOn(console,"error").mockImplementation(()=>{});
    const post=(body:unknown,origin="http://localhost:3000")=>POST(new Request("http://localhost:3000/api/v1/feedback",{method:"POST",headers:{origin,"content-type":"application/json","x-forwarded-for":randomUUID()},body:JSON.stringify(body)}),{});
    expect((await post(report(),"https://untrusted.test")).status).toBe(403);
    expect((await post({...report(),title:" "})).status).toBe(422);
    expect((await post({...report(),steps:"x".repeat(100_001)})).status).toBe(413);
    smtp.send.mockRejectedValueOnce(new Error("secret credentials"));const failed=await post(report());expect(failed.status).toBe(503);expect(JSON.stringify(await failed.json())).not.toContain("secret credentials");
    const item=report(),response=await post(item);expect(response.status).toBe(200);expect(await response.json()).toEqual({accepted:true,id:item.id});
    vi.stubEnv("SMTP_URL","");await expect(deliverFeedback(report())).rejects.toBeInstanceOf(HttpError);
  });
});
