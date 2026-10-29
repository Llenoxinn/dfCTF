import { describe,it,expect,vi,afterEach } from "vitest";
import { checkOrigin,readBody,readJson,route } from "@/server/http";
import { api } from "@/components/ui";
import { validateRuntimeConfig } from "@/server/config";
import { z } from "zod";
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.restoreAllMocks();});
describe("request and deployment boundaries",()=>{
  it("sends bodyless application mutations through the origin guard without weakening it",async()=>{
    vi.stubEnv("APP_URL","http://localhost:3000");
    vi.stubGlobal("fetch",vi.fn(async(input:string,options:RequestInit)=>{
      const headers=new Headers(options.headers);headers.set("origin","http://localhost:3000");
      const request=new Request(new URL(input,"http://localhost:3000"),{...options,headers});
      expect(request.headers.get("content-type")).toBeNull();
      checkOrigin(request);
      return Response.json({revoked:true});
    }));
    expect(await api("/api/v1/staff/allowlist/example",{method:"DELETE"})).toEqual({revoked:true});
    expect(()=>checkOrigin(new Request("http://localhost:3000/api/v1/me",{method:"DELETE",headers:{origin:"https://foreign.example","x-dfctf-request":"1"}}))).toThrow();
  });
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
  it("logs why a server error happened without the failed query's parameters",async()=>{
    const log=vi.spyOn(console,"error").mockImplementation(()=>{});
    const failing=route(()=>{throw new Error("Failed query: select\nparams: player@example.test",{cause:new Error("connect ECONNREFUSED 127.0.0.1:5432")});});
    const response=await failing(new Request("http://localhost/api/v1/progress"),{});
    expect(response.status).toBe(500);expect(JSON.stringify(await response.json())).not.toContain("ECONNREFUSED");
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({status:500,reason:"connect ECONNREFUSED 127.0.0.1:5432"});expect(log.mock.calls[0][0]).not.toContain("player@example.test");
  });
  it("fails closed on incomplete or insecure production configuration",()=>{
    vi.stubEnv("NODE_ENV","production");for(const name of ["DATABASE_URL","APP_URL","AUTH_SECRET","FLAG_SECRET","SMTP_URL","MAIL_FROM"])vi.stubEnv(name,"");
    expect(()=>validateRuntimeConfig()).toThrow("DATABASE_URL");
    vi.stubEnv("DATABASE_URL","postgresql://app:example@db/dfctf");vi.stubEnv("APP_URL","http://dfctf.example");vi.stubEnv("AUTH_SECRET","a".repeat(48));vi.stubEnv("FLAG_SECRET","b".repeat(48));vi.stubEnv("SMTP_URL","smtp://mail:1025");vi.stubEnv("MAIL_FROM","dfctf@example.test");vi.stubEnv("LOCAL_MAIL","0");
    expect(()=>validateRuntimeConfig()).toThrow("HTTPS");vi.stubEnv("APP_URL","https://dfctf.example");expect(()=>validateRuntimeConfig()).not.toThrow();
    vi.stubEnv("LOCAL_MAIL","1");expect(()=>validateRuntimeConfig()).toThrow("local development mailbox");
  });
});
