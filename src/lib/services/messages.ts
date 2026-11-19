import { env } from "../env";
import { sendEmail, sendSms } from "../integrations";
import { isQuiet, quietEndsAt } from "../quiet";
import {
  addAudit,
  addOutbox,
  dueEnrollments,
  getFlow,
  getOutbox,
  getSetting,
  isUnsubscribed,
  markOutbox,
  updateEnrollment,
} from "../repo";
import { makeUnsubToken } from "../signatures";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export async function processDueFlows(fetchImpl?: FetchLike) {
  const quietStart = (await getSetting("quiet_start")) || "21:00";
  const quietEnd = (await getSetting("quiet_end")) || "08:00";
  const zone = (await getSetting("quiet_timezone")) || "America/Los_Angeles";
  const due = await dueEnrollments();
  for (const enrollment of due) {
    let stepIndex = enrollment.step_index;
    for (let guard = 0; guard < 8; guard += 1) {
      const flow = await getFlow(enrollment.flow_id);
      if (!flow || flow.status !== "active") {
        await updateEnrollment(enrollment.id, { status: "stopped" });
        break;
      }
      const step = flow.definition[stepIndex];
      if (!step) {
        await updateEnrollment(enrollment.id, { status: "completed", stepIndex, nextRunAt: null });
        break;
      }
      if (step.type === "wait") {
        const hours = Number(step.hours) || 1;
        stepIndex += 1;
        await updateEnrollment(enrollment.id, { stepIndex, nextRunAt: Date.now() + hours * 3600 * 1000 });
        break;
      }
      if (!enrollment.recipient) {
        await addOutbox({
          channel: flow.channel,
          recipient: "",
          body: step.body || "",
          status: "blocked",
          flowId: flow.id,
          error: "No recipient on the triggering event.",
        });
        await updateEnrollment(enrollment.id, { status: "blocked", stepIndex });
        break;
      }
      if (await isUnsubscribed(flow.channel, enrollment.recipient)) {
        await addOutbox({
          channel: flow.channel,
          recipient: enrollment.recipient,
          body: step.body || "",
          status: "skipped",
          flowId: flow.id,
          error: "Unsubscribed",
        });
        stepIndex += 1;
        await updateEnrollment(enrollment.id, { stepIndex, nextRunAt: Date.now() });
        continue;
      }
      if (flow.respect_quiet_hours && isQuiet(new Date(), quietStart, quietEnd, zone)) {
        await updateEnrollment(enrollment.id, { stepIndex, nextRunAt: quietEndsAt(new Date(), quietStart, quietEnd, zone) });
        break;
      }
      const body = appendCompliance(flow.channel, enrollment.recipient, step.body || "");
      if (flow.auto_send) {
        const sent = await deliver(flow.channel, enrollment.recipient, step.subject || flow.name, body, fetchImpl);
        await addOutbox({
          channel: flow.channel,
          recipient: enrollment.recipient,
          subject: step.subject || flow.name,
          body,
          status: sent.ok ? "sent" : "needs_approval",
          flowId: flow.id,
          provider: sent.ok ? sent.provider : "",
          providerId: sent.ok ? sent.id : "",
          error: sent.ok ? "" : sent.error,
        });
        if (sent.ok) await addAudit("system", `${flow.channel}.sent`, enrollment.recipient, { provider: sent.provider, flow: flow.name });
      } else {
        await addOutbox({
          channel: flow.channel,
          recipient: enrollment.recipient,
          subject: step.subject || flow.name,
          body,
          status: "needs_approval",
          flowId: flow.id,
        });
      }
      stepIndex += 1;
      await updateEnrollment(enrollment.id, { stepIndex, nextRunAt: Date.now() });
    }
  }
}

function appendCompliance(channel: string, address: string, body: string) {
  if (channel === "sms") return `${body}\n\nReply STOP to opt out.`.trim();
  const token = makeUnsubToken("email", address, env("AUTH_SECRET") || "missing");
  const origin = env("APP_ORIGIN") || "http://127.0.0.1:3847";
  return `${body}\n\nUnsubscribe: ${origin}/unsubscribe?token=${token}`.trim();
}

export async function deliver(channel: string, to: string, subject: string, body: string, fetchImpl?: FetchLike) {
  if (await isUnsubscribed(channel, to)) return { ok: false as const, error: "This address is unsubscribed." };
  if (channel === "sms") return sendSms({ to, body, fetchImpl });
  return sendEmail({ to, subject, text: body, fetchImpl });
}

export async function approveOutbox(id: string, actor: string, fetchImpl?: FetchLike) {
  const item = await getOutbox(id);
  if (!item) return { ok: false as const, error: "Message not found." };
  if (item.status === "sent") return { ok: false as const, error: "That message was already sent." };
  const sent = await deliver(item.channel, item.recipient, item.subject || "Message", item.body, fetchImpl);
  if (!sent.ok) {
    await markOutbox(id, "failed", { error: sent.error });
    await addAudit(actor, `${item.channel}.failed`, item.recipient, { error: sent.error });
    return sent;
  }
  await markOutbox(id, "sent", { provider: sent.provider, providerId: sent.id });
  await addAudit(actor, `${item.channel}.approved_send`, item.recipient, { provider: sent.provider });
  return { ok: true as const };
}
