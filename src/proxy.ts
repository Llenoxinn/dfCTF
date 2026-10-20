import { NextResponse, type NextRequest } from "next/server";

export function proxy(request:NextRequest) {
  const nonce=Buffer.from(crypto.randomUUID()).toString("base64");
  const dev=process.env.NODE_ENV!=="production";
  const policy=[
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev?" 'unsafe-eval'":""}`,
    "style-src 'self' 'unsafe-inline'",
    `connect-src 'self'${dev?" ws: wss:":""}`,
    "img-src 'self' data: blob:","font-src 'self'","object-src 'none'","base-uri 'self'","form-action 'self'","frame-ancestors 'none'",
    ...(dev?[]:["upgrade-insecure-requests"])
  ].join("; ");
  const headers=new Headers(request.headers);headers.set("x-nonce",nonce);headers.set("Content-Security-Policy",policy);
  const response=NextResponse.next({request:{headers}});response.headers.set("Content-Security-Policy",policy);
  if(!dev)response.headers.set("Strict-Transport-Security","max-age=31536000");
  return response;
}
export const config={matcher:["/((?!api|_next/static|_next/image|favicon.ico).*)"]};
