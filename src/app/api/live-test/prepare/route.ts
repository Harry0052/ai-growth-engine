import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { LIVE_AFFILIATE_CODE } from "@/lib/constants";
import { originFrom } from "@/lib/format";
import { ensureReady } from "@/lib/ready";
import { createAffiliate, ensureTier, getAffiliateByCode, listTiers } from "@/lib/repo";

export const runtime = "nodejs";

export async function POST(request: Request) {
  await ensureReady();
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tiers = await listTiers();
  const tier = tiers[0] ?? (await ensureTier("Standard", 2000, 0));
  let affiliate = await getAffiliateByCode(LIVE_AFFILIATE_CODE);
  if (!affiliate) {
    affiliate = await createAffiliate({ name: "Live test partner", email: "", code: LIVE_AFFILIATE_CODE, tierId: tier.id });
  }
  const url = new URL(request.url);
  const origin = originFrom(request.headers.get("host"), request.headers.get("x-forwarded-proto"));
  return NextResponse.json({ code: affiliate.code, url: `${origin}/r/${affiliate.code}`, landing: `${origin}/try`, host: url.host });
}
