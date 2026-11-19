import { latestReport } from "@/lib/repo";
import { draftsFromSnapshots } from "@/lib/services/ops";
import { rewriteAction } from "@/server/actions";
import { Badge, Card, Empty, PageTitle } from "@/components/ui";
import { Runner } from "@/components/runner";

export const dynamic = "force-dynamic";

export default async function CreativePage() {
  const [drafts, rewrite] = await Promise.all([draftsFromSnapshots(), latestReport("hooks")]);
  return (
    <div>
      <PageTitle kicker="Source-backed" title="Hooks from what people already said." body="These drafts wrap a real quote or headline. They are templates, not a language model. Connect a model if you want a rewrite, and read that rewrite as model text." />
      {!drafts.length ? <Empty title="No sources yet" body="Pull live reviews and Hacker News first. This page will not invent a hook." /> : null}
      <div className="grid gap-3">
        {drafts.map((draft) => (
          <Card key={draft.hook}>
            <Badge tone="stone">Template · {draft.basis}</Badge>
            <p className="serif mt-3 text-2xl leading-snug">{draft.hook}</p>
            <p className="mt-2 text-xs text-muted">{draft.citation}</p>
          </Card>
        ))}
      </div>
      <Card className="mt-4">
        <h2 className="serif text-2xl">Model rewrite</h2>
        <p className="mt-2 text-sm text-muted">Uses OpenAI, Anthropic, or a local Ollama model. If none is reachable, you get the error instead of a fake paragraph.</p>
        <div className="mt-4"><Runner label="Rewrite with a connected model" action={rewriteAction} /></div>
        {rewrite ? (
          <div className="mt-4">
            <Badge tone="violet">{rewrite.model || "model"}</Badge>
            <pre className="mt-3 whitespace-pre-wrap text-sm">{rewrite.body}</pre>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
