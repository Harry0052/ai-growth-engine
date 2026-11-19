import Link from "next/link";
import { integrationFlags } from "@/lib/integrations";
import { money, pct } from "@/lib/format";
import { getSetting, listAudit } from "@/lib/repo";
import { experimentSnapshot, productSnapshot } from "@/lib/read";
import { campaignBoard } from "@/lib/services/ads";
import { publicState } from "@/lib/services/discover";
import { Badge, Card, Empty, PageTitle, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const demo = (await getSetting("demo_mode")) === "1";
  const [product, board, experiments, pulse, audit] = await Promise.all([
    productSnapshot(),
    campaignBoard(demo),
    experimentSnapshot(),
    publicState(),
    listAudit(6),
  ]);
  const flags = integrationFlags();
  const spend = board.reduce((sum, row) => sum + row.totals.spendCents, 0);
  const conversions = board.reduce((sum, row) => sum + row.totals.conversions, 0);
  const revenue = board.reduce((sum, row) => sum + row.totals.revenueCents, 0);
  const cac = conversions > 0 ? spend / conversions : null;
  const roas = spend > 0 ? revenue / spend : null;
  const liveSources = pulse.filter((entry) => entry.ok);
  const chips = [
    ["Meta", flags.meta],
    ["Google", flags.google],
    ["TikTok", flags.tiktok],
    ["Email", flags.resend || flags.sendgrid],
    ["SMS", flags.twilio],
    ["Stripe", flags.stripe],
    ["Model key", flags.openai || flags.anthropic],
  ] as const;

  return (
    <div>
      <PageTitle
        kicker="Today"
        title="What you can act on."
        body="Product numbers stay empty until real traffic arrives. Public sources and the labeled live test are kept separate so nothing is presented as customers."
      />
      {demo ? <p className="mb-4 rounded-xl bg-amber/10 px-3 py-2 text-sm text-amber">Demo mode is on. Sample rows are badged and are not real results.</p> : null}
      <div className="mb-6 flex flex-wrap gap-2">
        {chips.map(([label, on]) => (
          <Badge key={label} tone={on ? "live" : "stone"}>
            {label} {on ? "connected" : "not connected"}
          </Badge>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Product visitors" value={product.funnel ? String(product.funnel[0]?.count ?? 0) : "—"} hint={product.funnel ? "First-party, test traffic excluded." : "No product events yet."} />
        <Stat label="CAC" value={board.length ? money(cac) : "—"} hint={board.length ? `${board.length} campaigns in the math${demo ? " · includes demo" : ""}` : "Needs ad spend."} tone={demo ? "Includes demo rows" : undefined} />
        <Stat label="ROAS" value={board.length && roas != null ? roas.toFixed(2) : "—"} hint={board.length ? "Revenue ÷ spend from stored rows." : "No ad rows."} />
        <Stat label="LTV" value={product.ltvCents != null ? money(product.ltvCents) : "—"} hint={product.buyers ? `${product.buyers} paying people` : "Needs product purchase events."} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="serif text-2xl">First-party funnel</h2>
          {product.funnel ? (
            <ul className="mt-4 space-y-3">
              {product.funnel.map((step) => (
                <li key={step.step}>
                  <div className="flex justify-between text-sm">
                    <span>{step.step}</span>
                    <span>{step.count}{step.rateFromStart != null ? ` · ${pct(step.rateFromStart)}` : ""}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-ink/5">
                    <div className="h-2 rounded-full bg-violet" style={{ width: `${Math.max(4, (step.rateFromStart ?? 1) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="No product traffic yet" body="The live test does not fill this funnel. Install the snippet, or run the labeled test and read those numbers on their own page.">
              <Link className="rounded-full bg-ink px-4 py-2 text-sm text-paper" href="/live">Run a live test</Link>
            </Empty>
          )}
        </Card>
        <Card>
          <h2 className="serif text-2xl">Labeled test</h2>
          {experiments.test.visitsA + experiments.test.visitsB > 0 ? (
            <div className="mt-3 text-sm leading-6">
              <Badge tone="wait">Not customers</Badge>
              <p className="mt-3">A {experiments.test.visitsA} visits · {experiments.test.conversionsA} signups. B {experiments.test.visitsB} visits · {experiments.test.conversionsB} signups.</p>
              <p className="text-muted">{experiments.test.result.reason} p {experiments.test.result.pValue.toFixed(3)}.</p>
              <Link className="mt-3 inline-block underline" href="/experiments">Open the experiment</Link>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">No labeled test visits yet.</p>
          )}
          <h3 className="mt-6 text-sm font-medium">Public sources on file</h3>
          {liveSources.length ? (
            <ul className="mt-2 space-y-1 text-sm">
              {liveSources.map((entry) => (
                <li key={entry.source} className="flex justify-between gap-3">
                  <span>{entry.source}</span>
                  <span className="text-muted">{entry.ok ? new Date(entry.ok.fetched_at).toLocaleString() : ""}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">Nothing pulled yet.</p>
          )}
          <Link className="mt-4 inline-block text-sm underline" href="/discover">Pull live public data</Link>
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="serif text-2xl">Recent audit</h2>
        {audit.length ? (
          <ul className="mt-3 divide-y divide-line text-sm">
            {audit.map((row) => (
              <li key={row.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{row.action}</span>
                <span className="text-muted">{row.actor}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">External actions will land here.</p>
        )}
      </Card>
    </div>
  );
}
