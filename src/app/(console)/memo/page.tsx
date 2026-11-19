import { latestReport } from "@/lib/repo";
import { memoAction } from "@/server/actions";
import { Card, Empty, PageTitle } from "@/components/ui";
import { Runner } from "@/components/runner";

export const dynamic = "force-dynamic";

export default async function MemoPage() {
  const memo = await latestReport("memo");
  return (
    <div>
      <PageTitle kicker="Weekly" title="A memo from the rows you have." body="The structured sections are counted. A narrative is appended only when a model answers. If it doesn't, the page says so." />
      <Runner label="Write this week's memo" action={memoAction} />
      {memo ? (
        <Card className="mt-4">
          <p className="text-xs text-muted">{new Date(memo.created_at).toLocaleString()} · {memo.model || "no model narrative"}</p>
          <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-6">{memo.body}</pre>
        </Card>
      ) : (
        <div className="mt-4"><Empty title="No memo yet" body="Pull public data or run the live test, then write the memo. Empty sections stay empty." /></div>
      )}
    </div>
  );
}
