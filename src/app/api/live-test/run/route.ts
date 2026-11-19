import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { LIVE_AFFILIATE_CODE } from "@/lib/constants";
import { driveVisits } from "@/lib/driver";
import { originFrom } from "@/lib/format";
import { ensureReady } from "@/lib/ready";
import { addAudit, saveJob } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  await ensureReady();
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { count?: number };
  const count = Math.max(1, Math.min(40, Number(body.count) || 20));
  const origin = originFrom(request.headers.get("host"), request.headers.get("x-forwarded-proto"));
  const result = await driveVisits({ baseUrl: origin, count, concurrency: 4, affiliateCode: LIVE_AFFILIATE_CODE });
  await saveJob("live-test", "ran", result);
  await addAudit(user.email, "live_test.batch", origin, result);
  return NextResponse.json(result);
}
