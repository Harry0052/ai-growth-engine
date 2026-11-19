import { pct } from "@/lib/format";
import { listTickets } from "@/lib/repo";
import { productSnapshot } from "@/lib/read";
import { Card, Empty, PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CommunityPage() {
  const [product, tickets] = await Promise.all([productSnapshot(), listTickets()]);
  const open = tickets.filter((ticket) => ticket.status === "open" || ticket.status === "escalated").length;
  return (
    <div>
      <PageTitle kicker="Community" title="Health from people who actually showed up." body="Labeled test traffic is excluded. A single day of visits cannot invent a week-4 retention rate." />
      {!product.product.length ? <Empty title="No product audience yet" body="When the snippet is on a real surface, active people, the funnel, and weekly cohorts will show up here." /> : null}
      {product.product.length ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card><p className="text-xs uppercase tracking-[0.14em] text-muted">People</p><p className="serif mt-2 text-4xl">{new Set(product.product.map((event) => event.anonymousId).filter(Boolean)).size}</p></Card>
          <Card><p className="text-xs uppercase tracking-[0.14em] text-muted">Open tickets</p><p className="serif mt-2 text-4xl">{open}</p></Card>
          <Card><p className="text-xs uppercase tracking-[0.14em] text-muted">Buyers</p><p className="serif mt-2 text-4xl">{product.buyers}</p></Card>
        </div>
      ) : null}
      {product.cohorts?.rows.length ? (
        <Card className="mt-4 overflow-x-auto">
          <h2 className="serif text-2xl">Retention cohorts</h2>
          <table className="mt-3 w-full text-left text-sm">
            <thead><tr><th className="py-2">Cohort</th><th>Size</th>{product.cohorts.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
            <tbody>
              {product.cohorts.rows.map((row) => (
                <tr key={row.cohort} className="border-t border-line">
                  <td className="py-2">{row.cohort}</td>
                  <td>{row.size}</td>
                  {row.rates.map((rate, index) => <td key={index}>{pct(rate, 0)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}
    </div>
  );
}
