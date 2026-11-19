import { when } from "@/lib/format";
import { listAudit } from "@/lib/repo";
import { PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const rows = await listAudit(200);
  return (
    <div>
      <PageTitle kicker="Audit" title="What left the building." body="Logins, syncs, approvals, sends, payouts, and public pulls. Secrets are redacted." />
      <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
        {rows.map((row) => (
          <li key={row.id} className="grid gap-1 px-4 py-3 text-sm md:grid-cols-[180px_1fr_160px]">
            <span className="font-medium">{row.action}</span>
            <span className="text-muted">{row.target || JSON.stringify(row.detail).slice(0, 180)}</span>
            <span className="text-muted md:text-right">{row.actor} · {when(Number(row.created_at))}</span>
          </li>
        ))}
      </ul>
      {!rows.length ? <p className="mt-4 text-sm text-muted">No actions yet.</p> : null}
    </div>
  );
}
