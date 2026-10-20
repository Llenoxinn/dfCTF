import { describe,it,expect,vi,afterEach } from "vitest";
import { readBody,readJson } from "@/server/http";
import { validateRuntimeConfig } from "@/server/config";
import { z } from "zod";
afterEach(()=>vi.unstubAllEnvs());
describe("request and deployment boundaries",()=>{
  it("caps chunked bodies before the complete payload is buffered",async()=>{
    let chunksRead=0;
    const stream=new ReadableStream({pull(controller){chunksRead++;controller.enqueue(new Uint8Array(60_000));if(chunksRead>4)controller.close();}});
    const request=new Request("http://localhost/upload",{method:"POST",body:stream,duplex:"half"} as RequestInit);
    await expect(readBody(request,100_000)).rejects.toMatchObject({status:413});expect(chunksRead).toBeLessThan(5);
  });
  it("rejects oversized JSON even without Content-Length",async()=>{
    const request=new Request("http://localhost/submit",{method:"POST",body:JSON.stringify({flag:"x".repeat(110_000)})});
    await expect(readJson(request,z.object({flag:z.string()}))).rejects.toMatchObject({status:413});
  });
  it("fails closed on incomplete or insecure production configuration",()=>{
    vi.stubEnv("NODE_ENV","production");for(const name of ["DATABASE_URL","APP_URL","AUTH_SECRET","FLAG_SECRET","SMTP_URL","MAIL_FROM"])vi.stubEnv(name,"");
    expect(()=>validateRuntimeConfig()).toThrow("DATABASE_URL");
    vi.stubEnv("DATABASE_URL","postgresql://app:example@db/dfctf");vi.stubEnv("APP_URL","http://dfctf.example");vi.stubEnv("AUTH_SECRET","a".repeat(48));vi.stubEnv("FLAG_SECRET","b".repeat(48));vi.stubEnv("SMTP_URL","smtp://mail:1025");vi.stubEnv("MAIL_FROM","dfctf@example.test");vi.stubEnv("LOCAL_MAIL","0");
    expect(()=>validateRuntimeConfig()).toThrow("HTTPS");vi.stubEnv("APP_URL","https://dfctf.example");expect(()=>validateRuntimeConfig()).not.toThrow();
    vi.stubEnv("LOCAL_MAIL","1");expect(()=>validateRuntimeConfig()).toThrow("local development mailbox");
  });
});
