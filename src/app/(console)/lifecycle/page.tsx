import { listEnrollments, listFlows, listOutbox } from "@/lib/repo";
import { Card, PageTitle } from "@/components/ui";
import { FlowEditor } from "@/components/flow-editor";
import { ApproveSendButton } from "@/components/bound";

export const dynamic = "force-dynamic";

export default async function LifecyclePage() {
  const [flows, enrollments, outbox] = await Promise.all([listFlows(), listEnrollments(), listOutbox()]);
  return (
    <div>
      <PageTitle kicker="Email and SMS" title="Flows wait for a yes." body="Product events enroll people. Labeled test traffic does not. Auto-send is off unless you turn it on. Quiet hours default to 9pm–8am America/Los_Angeles, and STOP is honored." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="serif text-2xl">New flow</h2>
          <div className="mt-3"><FlowEditor /></div>
        </Card>
        <Card>
          <h2 className="serif text-2xl">Outbox</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {outbox.map((item) => (
              <li key={item.id} className="rounded-xl border border-line p-3">
                <p>{item.status} · {item.channel} · {item.recipient || "no recipient"}</p>
                <p className="text-muted">{item.subject}</p>
                {item.error ? <p className="text-danger">{item.error}</p> : null}
                {item.status === "needs_approval" || item.status === "failed" ? (
                  <div className="mt-2"><ApproveSendButton id={item.id} /></div>
                ) : null}
              </li>
            ))}
          </ul>
          {!outbox.length ? <p className="mt-2 text-sm text-muted">Nothing is waiting to send.</p> : null}
          <h3 className="mt-6 text-sm font-medium">Enrollments</h3>
          <ul className="mt-2 text-sm text-muted">
            {enrollments.map((row) => <li key={row.id}>{row.status} · step {row.step_index} · {row.recipient || row.subject_key}</li>)}
          </ul>
        </Card>
      </div>
      {flows[0] ? (
        <Card className="mt-4">
          <h2 className="serif text-2xl">Edit {flows[0].name}</h2>
          <FlowEditor initial={{ ...flows[0], channel: flows[0].channel === "sms" ? "sms" : "email", definition: flows[0].definition as Array<{ type: "wait" | "send"; hours?: number; subject?: string; body?: string }> }} />
        </Card>
      ) : null}
    </div>
  );
}
