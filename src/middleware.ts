import { NextResponse, type NextRequest } from "next/server";
import { readSession, SESSION_COOKIE } from "@/lib/session-token";

const PUBLIC = [
  /^\/login$/,
  /^\/try$/,
  /^\/r\//,
  /^\/unsubscribe$/,
  /^\/api\/auth\/login$/,
  /^\/api\/auth\/logout$/,
  /^\/api\/track$/,
  /^\/api\/capture$/,
  /^\/api\/flags$/,
  /^\/api\/health$/,
  /^\/api\/webhooks\//,
  /^\/api\/support\/inbound$/,
  /^\/api\/support\/thread$/,
  /^\/api\/feedback$/,
  /^\/snippet\.js$/,
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const aid = request.cookies.get("ge_aid")?.value ?? crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-ge-aid", aid);
  const needsAuth = !PUBLIC.some((pattern) => pattern.test(pathname));
  if (needsAuth) {
    const session = await readSession(request.cookies.get(SESSION_COOKIE)?.value, process.env.AUTH_SECRET || "");
    if (!session) {
      if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      if (pathname !== "/") url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (!request.cookies.get("ge_aid")) {
    response.cookies.set("ge_aid", aid, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|svg|ico|webp)$).*)"],
};
