import { afterEach,beforeEach,expect,it,vi } from "vitest";
import type { Community } from "@/lib/types";

const {getCommunity,getDb}=vi.hoisted(()=>({getCommunity:vi.fn(),getDb:vi.fn()}));
vi.mock("@/server/community",()=>({getCommunity}));
vi.mock("@/server/db",()=>({getDb}));
let GET:typeof import("@/app/api/v1/community/route").GET;
const database={};
const publicData:Community={weekly:null,recent:[],top:[],topAll:[],activity:{start:"2026-11-05T00:00:00Z",days:[0]},totals:{challenges:0,categories:[]}};
const refreshed:Community={...publicData,totals:{...publicData.totals,challenges:1}};
const request=(headers?:HeadersInit)=>GET(new Request("http://localhost/api/v1/community",{headers}),{});

beforeEach(async()=>{
  vi.resetModules();vi.resetAllMocks();vi.useFakeTimers();vi.setSystemTime(new Date("2026-11-05T04:00:00Z"));
  getDb.mockResolvedValue(database);getCommunity.mockResolvedValue(publicData);
  ({GET}=await import("@/app/api/v1/community/route"));
});
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});

it("reuses successful public data until the exact 30-second expiry",async()=>{
  expect(await (await request()).json()).toEqual(publicData);
  vi.advanceTimersByTime(29_999);
  expect(await (await request()).json()).toEqual(publicData);
  expect(getCommunity).toHaveBeenCalledTimes(1);expect(getDb).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(1);getCommunity.mockResolvedValueOnce(refreshed);
  expect(await (await request()).json()).toEqual(refreshed);
  expect(getCommunity).toHaveBeenCalledTimes(2);expect(getDb).toHaveBeenCalledTimes(2);
});

it("shares a cold calculation and starts its cache lifetime after it succeeds",async()=>{
  const query=Promise.withResolvers<Community>();
  getCommunity.mockReturnValueOnce(query.promise);
  const first=request(),second=request();
  await Promise.resolve();await Promise.resolve();
  expect(getDb).toHaveBeenCalledTimes(1);expect(getCommunity).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(45_000);query.resolve(publicData);
  const responses=await Promise.all([first,second]);
  expect(await Promise.all(responses.map(response=>response.json()))).toEqual([publicData,publicData]);
  vi.advanceTimersByTime(29_999);await request();
  expect(getCommunity).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(1);await request();
  expect(getCommunity).toHaveBeenCalledTimes(2);
});

it("shares a refresh across concurrent requests after expiry",async()=>{
  await request();vi.advanceTimersByTime(30_000);
  const query=Promise.withResolvers<Community>();getCommunity.mockReturnValueOnce(query.promise);
  const requests=[request(),request(),request()];
  await Promise.resolve();await Promise.resolve();
  expect(getDb).toHaveBeenCalledTimes(2);expect(getCommunity).toHaveBeenCalledTimes(2);
  query.resolve(refreshed);
  const responses=await Promise.all(requests);
  expect(await Promise.all(responses.map(response=>response.json()))).toEqual([refreshed,refreshed,refreshed]);
});

it.each(["database","query"])("recovers from %s failures on cold loads and expired refreshes",async stage=>{
  vi.spyOn(console,"error").mockImplementation(()=>{});
  const failing=stage==="database"?getDb:getCommunity;
  failing.mockRejectedValueOnce(new Error("Temporary internal failure"));
  const failed=await request();
  expect(failed.status).toBe(500);expect(await failed.text()).not.toContain("Temporary internal failure");
  expect(await (await request()).json()).toEqual(publicData);
  vi.advanceTimersByTime(30_000);failing.mockRejectedValueOnce(new Error("Temporary refresh failure"));
  expect((await request()).status).toBe(500);
  getCommunity.mockResolvedValueOnce(refreshed);
  expect(await (await request()).json()).toEqual(refreshed);
  expect(getDb).toHaveBeenCalledTimes(4);
  expect(getCommunity).toHaveBeenCalledTimes(stage==="database"?2:4);
});

it("shares only public data while returning independent bodies and request IDs",async()=>{
  const first=await request({cookie:"session=first-player"});
  const second=await request({cookie:"session=another-player"});
  expect(await first.json()).toEqual(publicData);expect(await second.json()).toEqual(publicData);
  expect(first.headers.get("x-request-id")).toBeTruthy();
  expect(first.headers.get("x-request-id")).not.toBe(second.headers.get("x-request-id"));
  for(const response of [first,second]){
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.has("set-cookie")).toBe(false);
  }
  expect(getCommunity).toHaveBeenCalledExactlyOnceWith(database);
  expect(getDb).toHaveBeenCalledExactlyOnceWith();
});
