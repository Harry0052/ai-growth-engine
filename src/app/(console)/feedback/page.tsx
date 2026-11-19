import { clip } from "@/lib/format";
import { listFeedback, latestReport } from "@/lib/repo";
import { importFeedbackAction } from "@/server/actions";
import { Badge, Card, Empty, PageTitle } from "@/components/ui";
import { CsvBox } from "@/components/csv-box";
import { ClusterButton } from "@/components/bound";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const [items, gap] = await Promise.all([listFeedback(), latestReport("feature-gap")]);
  const real = items.filter((item) => item.source !== "demo");
  const themes = new Map<string, number>();
  for (const item of real) if (item.theme) themes.set(item.theme, (themes.get(item.theme) ?? 0) + 1);
  return (
    <div>
      <PageTitle kicker="Feedback" title="Themes from words people used." body="Clustering is lexical unless a model is connected for the weekly narrative. Demo rows are hidden here." />
      <div className="grid gap-4 lg:grid-cols-2">
        <CsvBox label="Import a feedback or app-store review CSV" action={importFeedbackAction} />
        <Card>
          <h2 className="serif text-2xl">Cluster</h2>
          <p className="mt-2 text-sm text-muted">Groups items that share a word. It does not invent feature requests.</p>
          <div className="mt-3"><ClusterButton /></div>
          <ul className="mt-3 text-sm">{[...themes.entries()].map(([name, count]) => <li key={name}>{name} · {count}</li>)}</ul>
        </Card>
      </div>
      {!real.length ? <div className="mt-4"><Empty title="No feedback yet" body="Use the widget, import a CSV, or save the live App Store reviews from Discover." /></div> : null}
      <ul className="mt-4 space-y-2">
        {real.slice(0, 20).map((item) => (
          <li key={item.id} className="rounded-2xl border border-line bg-card p-4 text-sm">
            <Badge>{item.source}</Badge> {item.theme ? <Badge tone="violet">{item.theme}</Badge> : null}
            <p className="mt-2">{clip(item.body, 280)}</p>
          </li>
        ))}
      </ul>
      {gap ? <Card className="mt-4"><h2 className="serif text-2xl">{gap.title}</h2><pre className="mt-3 whitespace-pre-wrap text-sm">{gap.body}</pre></Card> : null}
    </div>
  );
}
