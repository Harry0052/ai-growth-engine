import { pct } from "@/lib/format";
import { experimentSnapshot } from "@/lib/read";
import { listExperiments } from "@/lib/repo";
import { Card, PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

const COPY = {
  A: "Remember everyone who matters.",
  B: "Never lose the thread.",
};

function Block({ title, math }: { title: string; math: Awaited<ReturnType<typeof experimentSnapshot>>["test"] }) {
  return (
    <Card>
      <h2 className="serif text-2xl">{title}</h2>
      <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
        <p>A · {math.visitsA} visits · {math.conversionsA} signups · {pct(math.visitsA ? math.conversionsA / math.visitsA : null)}</p>
        <p>B · {math.visitsB} visits · {math.conversionsB} signups · {pct(math.visitsB ? math.conversionsB / math.visitsB : null)}</p>
      </div>
      <p className="mt-3 text-sm">{math.visitsA + math.visitsB ? `${math.result.reason} z=${math.result.z.toFixed(2)}, two-tailed p=${math.result.pValue.toFixed(4)}.` : "No visits in this traffic class."}</p>
      <p className="mt-1 text-xs text-muted">Primary metric is signup. Purchases are secondary: A {math.purchasesA}, B {math.purchasesB}. Secondary p={math.purchaseResult.pValue.toFixed(3)}.</p>
    </Card>
  );
}

export default async function ExperimentsPage() {
  const [experiments, snapshot] = await Promise.all([listExperiments(), experimentSnapshot()]);
  return (
    <div>
      <PageTitle kicker="A/B" title="Two headlines, one real test." body="Assignment is a stable hash of the anonymous id. Significance is a two-proportion z-test. Thirty visits per variant are required before a result is called." />
      <Card className="mb-4">
        <h2 className="text-sm font-medium">Creative definitions</h2>
        <p className="mt-2 text-sm">A · {COPY.A}</p>
        <p className="text-sm">B · {COPY.B}</p>
        <p className="mt-2 text-xs text-muted">{experiments.map((experiment) => `${experiment.name} · ${experiment.status} · metric ${experiment.metric}`).join(" · ") || "The landing experiment is created on setup."}</p>
      </Card>
      <div className="grid gap-4">
        <Block title="Labeled test traffic" math={snapshot.test} />
        <Block title="Product traffic" math={snapshot.product} />
      </div>
    </div>
  );
}
