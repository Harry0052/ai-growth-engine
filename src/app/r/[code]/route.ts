import { NextResponse } from "next/server";
import { ensureReady } from "@/lib/ready";
import { recordReferralClick } from "@/lib/services/tracking";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  await ensureReady();
  const { code } = await context.params;
  const url = new URL(request.url);
  const aid = request.headers.get("x-ge-aid") || crypto.randomUUID();
  const affiliate = await recordReferralClick({
    code,
    anonymousId: aid,
    referrer: request.headers.get("referer") || "",
    userAgent: request.headers.get("user-agent") || "",
  });
  const response = NextResponse.redirect(new URL("/try", url.origin));
  response.cookies.set("ge_aid", aid, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  if (affiliate) response.cookies.set("ge_ref", affiliate.code, { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax" });
  return response;
}
