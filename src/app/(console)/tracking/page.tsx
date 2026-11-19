import { headers } from "next/headers";
import { originFrom, when } from "@/lib/format";
import { listLeads, listPlans, recentEvents } from "@/lib/repo";
import { addLandingEventsAction, funnelAction, importGa4Action, importMixpanelAction, savePlanAction } from "@/server/actions";
import { Card, PageTitle } from "@/components/ui";
import { Runner } from "@/components/runner";

export const dynamic = "force-dynamic";

export default async function TrackingPage() {
  const [plans, events, leads] = await Promise.all([listPlans(), recentEvents(30), listLeads()]);
  const headerStore = await headers();
  const origin = originFrom(headerStore.get("host"), headerStore.get("x-forwarded-proto"));
  const plan = plans[0];
  const snippet = `<script>\nwindow.__GE__ = { endpoint: "${origin}/api/track" };\n</script>\n<script src="${origin}/snippet.js"></script>`;
  return (
    <div>
      <PageTitle kicker="First party" title="Events you can count." body="The snippet and POST /api/track write the same table. GA4 and Mixpanel imports are tagged import and stay out of the product funnel." />
      <Card>
        <h2 className="serif text-2xl">Snippet</h2>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-ink px-3 py-3 text-xs text-paper">{snippet}</pre>
        <p className="mt-2 text-xs text-muted">PostHog-style batches can POST to {origin}/api/capture. Set TRACK_PUBLIC_KEY before this is public.</p>
      </Card>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="serif text-2xl">Recent events</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {events.map((event) => (
              <li key={event.id} className="flex justify-between gap-3"><span>{event.event_name} · {event.traffic}</span><span className="text-muted">{when(Number(event.ts))}</span></li>
            ))}
          </ul>
          {!events.length ? <p className="mt-2 text-sm text-muted">No events yet.</p> : null}
          <p data-testid="event-count" className="mt-3 text-xs text-muted">{events.length} shown</p>
        </Card>
        <Card>
          <h2 className="serif text-2xl">Test signups</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {leads.slice(0, 8).map((lead) => (
              <li key={lead.id}>{lead.email} · {lead.traffic} · variant {lead.variant || "—"}</li>
            ))}
          </ul>
          {!leads.length ? <p className="text-sm text-muted">No signups stored.</p> : null}
        </Card>
      </div>
      <Card className="mt-4">
        <h2 className="serif text-2xl">Tracking plan</h2>
        <p className="mt-2 text-sm text-muted">This exports a schema. It does not create properties inside GA4 or Mixpanel.</p>
        <form action={savePlanAction} className="mt-3 grid gap-2 md:grid-cols-3">
          <input name="name" defaultValue={plan?.name || "Test landing"} className="rounded-xl border border-line px-3 py-2 text-sm" />
          <input name="event" placeholder="event name" className="rounded-xl border border-line px-3 py-2 text-sm" />
          <input name="description" placeholder="what it means" className="rounded-xl border border-line px-3 py-2 text-sm" />
          <button className="rounded-full bg-ink px-4 py-2 text-sm text-paper" type="submit">Save event</button>
        </form>
        <div className="mt-3"><Runner label="Add the events this landing already emits" action={addLandingEventsAction} tone="ghost" /></div>
        {plan ? <pre className="mt-4 overflow-x-auto rounded-xl bg-paper p-3 text-xs">{JSON.stringify({ ga4: plan.events, mixpanel: plan.events, utm: plan.utm }, null, 2)}</pre> : null}
        <form action={funnelAction} className="mt-4 flex flex-wrap gap-2">
          <input name="steps" placeholder="page_view, cta_click, signup, purchase" className="min-w-64 flex-1 rounded-xl border border-line px-3 py-2 text-sm" />
          <button className="rounded-full border border-line px-4 py-2 text-sm" type="submit">Save funnel</button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          <Runner label="Import GA4 event counts" action={importGa4Action} tone="ghost" />
          <Runner label="Import Mixpanel export" action={importMixpanelAction} tone="ghost" />
        </div>
      </Card>
    </div>
  );
}
