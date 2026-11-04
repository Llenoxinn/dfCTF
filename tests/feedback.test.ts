import { randomUUID } from "node:crypto";
import { mkdtemp,readdir,readFile,rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeAll,afterAll,beforeEach,afterEach,describe,it,expect,vi } from "vitest";
import { eq } from "drizzle-orm";
import { createStore } from "@/server/db";
import * as database from "@/server/db";
import { submitFeedback,feedbackMail,deliverFeedback } from "@/server/feedback";
import { feedbackReceipts } from "@/server/schema";
import { feedbackInput,legacyFeedbackInput,type FeedbackInput } from "@/lib/feedback";
import { sendAuthEmail } from "@/server/mail";
import { HttpError } from "@/server/http";
import { POST } from "@/app/api/v1/feedback/route";

const smtp=vi.hoisted(()=>({send:vi.fn()}));
vi.mock("nodemailer",()=>({default:{createTransport:()=>({sendMail:smtp.send})}}));
let store:Awaited<ReturnType<typeof createStore>>;
const report=():FeedbackInput=>({id:randomUUID(),kind:"bug",title:"Fictional broken control",steps:"Open the fictional page and select the control.",expected:"The fictional control should open.",actual:"The fictional control stays closed.",contactEmail:"reply@example.test"});
const headers=()=>new Headers({"x-forwarded-for":randomUUID()});
beforeAll(async()=>{store=await createStore(undefined,true);await store.migrate();});
afterAll(async()=>{await store.close();});
beforeEach(()=>{vi.stubEnv("LOCAL_MAIL","0");vi.stubEnv("AUTH_SECRET","test-feedback-secret-that-is-long-enough");vi.stubEnv("SMTP_URL","smtp://fixture.invalid");vi.stubEnv("MAIL_FROM","sender@example.test");vi.stubEnv("FEEDBACK_TO","developers@example.test");smtp.send.mockReset();smtp.send.mockResolvedValue({accepted:["developers@example.test"]});});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();});

describe("private reporting intake",()=>{
  it("accepts the original feedback contract and enforces its field limits without header injection",async()=>{
    const input={subject:"s".repeat(120),message:"m".repeat(5000),email:"reply@example.test"};
    expect(legacyFeedbackInput.safeParse(input).success).toBe(true);
    expect((await submitFeedback(store.db,input,headers())).accepted).toBe(true);
    expect(smtp.send).toHaveBeenLastCalledWith(expect.objectContaining({to:"developers@example.test",replyTo:input.email,text:expect.stringContaining(input.message)}));
    expect(legacyFeedbackInput.safeParse({subject:"x",message:"x",email:""}).success).toBe(true);
    for(const patch of [{subject:"s".repeat(121)},{message:"m".repeat(5001)},{email:"x".repeat(255)},{subject:" "},{message:" "},{email:"not an email"},{subject:"Report\r\nBcc: other@example.test"},{email:"x@example.test\r\nBcc: other@example.test"},{userId:"forged"}])expect(legacyFeedbackInput.safeParse({...input,...patch}).success).toBe(false);
    expect(feedbackInput.safeParse({id:randomUUID(),kind:"feedback",title:input.subject,message:input.message}).success).toBe(true);
    expect(feedbackInput.safeParse({id:randomUUID(),kind:"feedback",title:input.subject+"x",message:input.message}).success).toBe(false);
  });
  it("stores feedback locally without SMTP in development using the same mail system as login emails",async()=>{
    const directory=await mkdtemp(path.join(os.tmpdir(),"dfctf-feedback-mail-"));
    vi.spyOn(process,"cwd").mockReturnValue(directory);vi.stubEnv("NODE_ENV","development");vi.stubEnv("LOCAL_MAIL","1");vi.stubEnv("SMTP_URL","");vi.stubEnv("MAIL_FROM","");
    try {
      const input=report();await deliverFeedback(input);await sendAuthEmail("auth@example.test","Verify email","https://example.test/verify");
      vi.stubEnv("APP_URL","http://localhost:3000");vi.spyOn(database,"getDb").mockResolvedValue(store.db);
      const response=await POST(new Request("http://localhost:3000/api/v1/feedback",{method:"POST",headers:{origin:"http://localhost:3000","content-type":"application/json","x-forwarded-for":randomUUID()},body:JSON.stringify({subject:"Local endpoint test",message:"A local report saved without SMTP.",email:""})}),{});
      expect(response.status).toBe(200);expect(await response.json()).toMatchObject({accepted:true,delivery:"local"});
      const files=await readdir(path.join(directory,".data","mail"));expect(files).toHaveLength(3);
      const mails=await Promise.all(files.map(async file=>JSON.parse(await readFile(path.join(directory,".data","mail",file),"utf8"))));
      expect(mails).toContainEqual(expect.objectContaining({to:"developers@example.test",replyTo:input.contactEmail,...feedbackMail(input)}));
      expect(mails).toContainEqual(expect.objectContaining({to:"auth@example.test",url:"https://example.test/verify"}));
      expect(smtp.send).not.toHaveBeenCalled();
      vi.stubEnv("NODE_ENV","production");await expect(deliverFeedback(input)).rejects.toMatchObject({code:"FEEDBACK_UNAVAILABLE"});
    }finally{await rm(directory,{recursive:true,force:true});}
  });
  it("fails when the developer inbox is unset, even if SMTP or local mail is configured",async()=>{
    vi.stubEnv("FEEDBACK_TO","");await expect(deliverFeedback(report())).rejects.toMatchObject({status:503,code:"FEEDBACK_UNAVAILABLE"});
    vi.stubEnv("LOCAL_MAIL","1");await expect(deliverFeedback(report())).rejects.toMatchObject({status:503});expect(smtp.send).not.toHaveBeenCalled();
  });
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
  it("rejects malformed, oversized, and header-injection fields",()=>{
    for(const patch of [{title:"Report\r\nBcc: secret@example.test"},{steps:" "},{actual:"x".repeat(6001)},{contactEmail:"a@example.test\r\nBcc: x@example.test"},{userId:"forged"}])expect(feedbackInput.safeParse({...report(),...patch}).success).toBe(false);
  });
  it("rate limits new submissions, while a successful retry does not send again",async()=>{
    const address=headers(),deliver=vi.fn(async()=>{}),first=report();await submitFeedback(store.db,first,address,deliver);
    for(let i=0;i<4;i++)await submitFeedback(store.db,report(),address,deliver);
    await expect(submitFeedback(store.db,report(),address,deliver)).rejects.toMatchObject({status:429,code:"FEEDBACK_RATE_LIMITED",message:"Too many feedback submissions. Please wait before trying again."});
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
    const legacyResponse=await post({subject:"Legacy feedback",message:"A legacy feedback message.",email:""});expect(legacyResponse.status).toBe(200);
    const invalid=await post({subject:" ",message:" ",email:"invalid"});expect(invalid.status).toBe(422);expect((await invalid.json()).error.details.fieldErrors).toMatchObject({subject:expect.any(Array),message:expect.any(Array),email:expect.any(Array)});
    vi.stubEnv("SMTP_URL","");await expect(deliverFeedback(report())).rejects.toBeInstanceOf(HttpError);
  });
});
