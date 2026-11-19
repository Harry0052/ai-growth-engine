import { currentUser } from "@/lib/auth";
import { payoutCsv } from "@/lib/services/ops";
import { listAffiliates, listConversions } from "@/lib/repo";

export const runtime = "nodejs";

export async function GET() {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const [affiliates, conversions] = await Promise.all([listAffiliates(), listConversions()]);
  const rows = affiliates.map((affiliate) => {
    const mine = conversions.filter((conversion) => conversion.affiliate_id === affiliate.id && conversion.status !== "test");
    return {
      affiliate: affiliate.name,
      email: affiliate.email,
      amountCents: mine.filter((conversion) => conversion.status === "pending" || conversion.status === "in_payout").reduce((sum, conversion) => sum + Number(conversion.commission_cents), 0),
      status: "payable",
      conversions: mine.length,
    };
  });
  return new Response(payoutCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=payouts.csv",
    },
  });
}
