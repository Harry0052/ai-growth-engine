import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { LIVE_AFFILIATE_CODE } from "@/lib/constants";
import { ensureReady } from "@/lib/ready";
import { getAffiliateByCode, listClicks, listConversions, latestReport } from "@/lib/repo";
import { experimentSnapshot } from "@/lib/read";

export const runtime = "nodejs";

export async function GET() {
  await ensureReady();
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [snapshot, affiliate, clicks, conversions, memo] = await Promise.all([
    experimentSnapshot(),
    getAffiliateByCode(LIVE_AFFILIATE_CODE),
    listClicks(),
    listConversions(),
    latestReport("memo"),
  ]);
  const mine = affiliate ? clicks.filter((click) => click.affiliate_id === affiliate.id) : [];
  const conv = affiliate ? conversions.filter((row) => row.affiliate_id === affiliate.id) : [];
  return NextResponse.json({
    test: snapshot.test,
    clicks: mine.length,
    conversions: conv.length,
    commissionCents: conv.reduce((sum, row) => sum + Number(row.commission_cents), 0),
    memo: memo ? { id: memo.id, model: memo.model } : null,
  });
}
