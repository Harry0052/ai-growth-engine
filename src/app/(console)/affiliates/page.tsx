import { money } from "@/lib/format";
import { affiliateBoard } from "@/lib/services/ops";
import { createAffiliateAction } from "@/server/actions";
import { Badge, Card, PageTitle } from "@/components/ui";
import { MarkPaidButton, PayoutButton } from "@/components/bound";

export const dynamic = "force-dynamic";

export default async function AffiliatesPage() {
  const board = await affiliateBoard();
  return (
    <div>
      <PageTitle kicker="Affiliates" title="Links, attribution, then a ledger." body="Clicks hit /r/code. Signups and purchases with that code become conversions. Test traffic is calculated and excluded from payouts." />
      <Card>
        <form action={createAffiliateAction} className="grid gap-2 md:grid-cols-4">
          <input name="name" required placeholder="Name" className="rounded-xl border border-line px-3 py-2 text-sm" />
          <input name="email" placeholder="Email" className="rounded-xl border border-line px-3 py-2 text-sm" />
          <input name="code" required placeholder="Code" className="rounded-xl border border-line px-3 py-2 text-sm" />
          <input name="stripe" placeholder="Stripe account id" className="rounded-xl border border-line px-3 py-2 text-sm" />
          <button className="rounded-full bg-ink px-4 py-2 text-sm text-paper md:col-span-4" type="submit">Create affiliate</button>
        </form>
      </Card>
      <div className="mt-4 grid gap-3">
        {board.rows.map((row) => {
          const product = row.conversions.filter((conversion) => conversion.status === "pending");
          const test = row.conversions.filter((conversion) => conversion.status === "test");
          const payable = product.reduce((sum, conversion) => sum + Number(conversion.commission_cents), 0);
          return (
            <Card key={row.affiliate.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-medium">{row.affiliate.name} · {row.affiliate.code}</h2>
                <Badge>{row.tier ? `${row.tier.rate_bps / 100}%` : "no tier"}</Badge>
              </div>
              <p className="mt-2 text-sm">Clicks {row.clicks.length} · payable {money(payable)} · test conversions {test.length} (not payable)</p>
              <p className="text-xs text-muted">Link path /r/{row.affiliate.code}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <PayoutButton id={row.affiliate.id} method="stripe" />
                <PayoutButton id={row.affiliate.id} method="manual" />
              </div>
            </Card>
          );
        })}
      </div>
      <Card className="mt-4">
        <h2 className="serif text-2xl">Payout ledger</h2>
        <a className="mt-2 inline-block text-sm underline" href="/api/export/payouts">Download payable CSV</a>
        <ul className="mt-3 space-y-2 text-sm">
          {board.payouts.map((payout) => (
            <li key={payout.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>{money(payout.amount_cents)} · {payout.method} · {payout.status}</span>
              {payout.status === "approved_manual" ? <MarkPaidButton id={payout.id} /> : null}
            </li>
          ))}
        </ul>
        {!board.payouts.length ? <p className="mt-2 text-sm text-muted">No payouts yet.</p> : null}
      </Card>
    </div>
  );
}
