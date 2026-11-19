import Link from "next/link";
import { LIVE_TEST_BIAS } from "@/lib/constants";
import { pct } from "@/lib/format";
import { experimentSnapshot } from "@/lib/read";
import { getAffiliateByCode, listClicks, listConversions } from "@/lib/repo";
import { LIVE_AFFILIATE_CODE } from "@/lib/constants";
import { LiveRunner } from "@/components/live-runner";
import { Card, PageTitle } from "@/components/ui";
import { pullPublicAction, memoAction } from "@/server/actions";
import { Runner } from "@/components/runner";

export const dynamic = "force-dynamic";

const STEPS = [
  "Pull live public data: Apple reviews, Hacker News, Wikipedia, Product Hunt, YouTube.",
  "Draft source-backed hooks on Creative. A model rewrites them only if one is connected.",
  "Open the test landing. The snippet sends events to /api/track.",
  "Send labeled test visits. Variant B is scripted to click more often.",
  "Read significance, the affiliate attribution, and the weekly memo.",
];

export default async function LivePage() {
  const snapshot = await experimentSnapshot();
  const affiliate = await getAffiliateByCode(LIVE_AFFILIATE_CODE);
  const clicks = affiliate ? (await listClicks()).filter((click) => click.affiliate_id === affiliate.id).length : 0;
  const conversions = affiliate ? (await listConversions()).filter((row) => row.affiliate_id === affiliate.id) : [];
  const test = snapshot.test;
  return (
    <div>
      <PageTitle kicker="Record from here" title="Run a live test." body="Every number on this page comes from a real HTTP visit or a public source. The load script is labeled test traffic and is never called a customer." />
      <ol className="mb-6 grid gap-2 text-sm md:grid-cols-5">
        {STEPS.map((step, index) => (
          <li key={step} className="rounded-2xl border border-line bg-card p-3">
            <span className="text-xs text-violet">0{index + 1}</span>
            <p className="mt-1 leading-5">{step}</p>
          </li>
        ))}
      </ol>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="serif text-2xl">1 · Public sources</h2>
          <p className="mt-2 text-sm text-muted">No key required. Reddit is attempted and left empty if it refuses.</p>
          <div className="mt-4"><Runner label="Pull live public data" action={pullPublicAction} /></div>
        </Card>
        <Card>
          <h2 className="serif text-2xl">2 · Hooks</h2>
          <p className="mt-2 text-sm text-muted">Drafts quote the sources. They are not model output.</p>
          <Link className="mt-4 inline-block rounded-full border border-line px-4 py-2 text-sm" href="/creative">Open creative</Link>
        </Card>
        <Card>
          <h2 className="serif text-2xl">3 · Landing</h2>
          <p className="mt-2 text-sm text-muted">Two headlines, a sticky assignment, and the tracking snippet.</p>
          <Link className="mt-4 inline-block rounded-full border border-line px-4 py-2 text-sm" href="/try">Open /try</Link>
        </Card>
        <Card>
          <h2 className="serif text-2xl">4 · Traffic and attribution</h2>
          <LiveRunner />
        </Card>
      </div>
      <Card className="mt-4">
        <h2 className="serif text-2xl">5 · What the visits did</h2>
        <p className="mt-2 text-sm text-muted">{LIVE_TEST_BIAS}</p>
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
          <p>Visits A/B: {test.visitsA} / {test.visitsB}</p>
          <p>Signups A/B: {test.conversionsA} / {test.conversionsB}</p>
          <p>Signup rate A/B: {pct(test.visitsA ? test.conversionsA / test.visitsA : null)} / {pct(test.visitsB ? test.conversionsB / test.visitsB : null)}</p>
        </div>
        <p className="mt-3 text-sm">{test.visitsA + test.visitsB ? `${test.result.reason} z ${test.result.z.toFixed(2)}, p ${test.result.pValue.toFixed(3)}.` : "No labeled visits yet."}</p>
        <p className="mt-2 text-sm">Affiliate {LIVE_AFFILIATE_CODE}: {clicks} clicks, {conversions.length} conversions, test commission ${(conversions.reduce((sum, row) => sum + Number(row.commission_cents), 0) / 100).toFixed(2)}. Test commission is not payable.</p>
        <div className="mt-4"><Runner label="Write the weekly memo" action={memoAction} /></div>
      </Card>
    </div>
  );
}
