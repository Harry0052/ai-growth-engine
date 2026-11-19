"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUser, setSessionCookie } from "@/lib/auth";
import { LANDING_EVENTS } from "@/lib/constants";
import { parseFeedbackCsv } from "@/lib/csv";
import { applyDemoMode } from "@/lib/demo";
import { loginWithPassword } from "@/lib/login";
import { slug } from "@/lib/format";
import {
  addAudit,
  addFeedback,
  createAffiliate,
  ensureTier,
  listPlans,
  listTiers,
  saveFlow,
  savePlan,
  setSetting,
  updateTicket,
} from "@/lib/repo";
import { importAdsCsv, importGa4, importMixpanel, syncAds, approveCampaign } from "@/lib/services/ads";
import { pullPublic } from "@/lib/services/discover";
import { approveOutbox } from "@/lib/services/messages";
import { addTicketMessage } from "@/lib/repo";
import {
  approvePayout,
  changePassword,
  clusterFeedback,
  markPaid,
  rewriteHooks,
  saveReviewFeedback,
  testConnection,
  writeFeatureGap,
  writeMemo,
} from "@/lib/services/ops";
import { deliver } from "@/lib/services/messages";
import { generateText } from "@/lib/integrations";

async function actor() {
  const user = await currentUser();
  if (!user) throw new Error("Sign in required.");
  return user;
}

function safeNext(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const next = safeNext(String(formData.get("next") || "/"));
  let user = null;
  try {
    user = await loginWithPassword(email, password);
  } catch (error) {
    const message = error instanceof Error ? error.message : "setup";
    redirect(`/login?error=${encodeURIComponent(message)}`);
  }
  if (!user) redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  await setSessionCookie(user.id);
  redirect(next);
}

export async function pullPublicAction() {
  const user = await actor();
  await pullPublic(user.email);
  revalidatePath("/discover");
  revalidatePath("/");
}

export async function saveDiscoverAction(formData: FormData) {
  await actor();
  await setSetting("discover_app", String(formData.get("app") || "ChatGPT"));
  await setSetting("discover_topic", String(formData.get("topic") || "consumer AI"));
  await setSetting("discover_wiki", String(formData.get("wiki") || "ChatGPT"));
  await setSetting("youtube_channels", String(formData.get("channels") || ""));
  revalidatePath("/discover");
}

export async function importAdsAction(text: string) {
  const user = await actor();
  const result = await importAdsCsv(text, user.email);
  revalidatePath("/ads");
  return result;
}

export async function syncAdsAction(platform: "meta" | "google" | "tiktok") {
  const user = await actor();
  const result = await syncAds(platform, user.email);
  revalidatePath("/ads");
  return result;
}

export async function approveCampaignAction(id: string, action: "pause" | "scale") {
  const user = await actor();
  const result = await approveCampaign(id, action, user.email);
  revalidatePath("/ads");
  return result;
}

export async function saveThresholdsAction(formData: FormData) {
  const user = await actor();
  const thresholds = {
    minSpendCents: Math.round(Number(formData.get("minSpend")) * 100),
    minImpressions: Number(formData.get("minImpressions")),
    killRoas: Number(formData.get("killRoas")),
    scaleRoas: Number(formData.get("scaleRoas")),
    minCtr: Number(formData.get("minCtr")) / 100,
    targetCacCents: Math.round(Number(formData.get("targetCac")) * 100),
  };
  await setSetting("thresholds", JSON.stringify(thresholds));
  await addAudit(user.email, "ads.thresholds", null, thresholds);
  revalidatePath("/ads");
}

export async function setDemoAction(on: boolean) {
  const user = await actor();
  await applyDemoMode(on, user.email);
  revalidatePath("/");
  revalidatePath("/ads");
  revalidatePath("/feedback");
}

export async function createAffiliateAction(formData: FormData) {
  const user = await actor();
  const tiers = await listTiers();
  const tier = tiers[0] ?? (await ensureTier("Standard", 2000, 0));
  const code = String(formData.get("code") || "").trim();
  if (!/^[a-z0-9_-]{3,24}$/i.test(code)) throw new Error("Use 3–24 letters, numbers, dashes, or underscores.");
  try {
    await createAffiliate({
      name: String(formData.get("name") || code),
      email: String(formData.get("email") || ""),
      code,
      tierId: tier.id,
      stripeAccountId: String(formData.get("stripe") || ""),
    });
  } catch {
    throw new Error("That code already exists.");
  }
  await addAudit(user.email, "affiliate.created", code.toUpperCase(), {});
  revalidatePath("/affiliates");
}

export async function approvePayoutAction(affiliateId: string, method: "stripe" | "manual") {
  const user = await actor();
  const result = await approvePayout(affiliateId, method, user.email);
  revalidatePath("/affiliates");
  return result;
}

export async function markPaidAction(payoutId: string) {
  const user = await actor();
  await markPaid(payoutId, user.email);
  revalidatePath("/affiliates");
}

export async function saveFlowAction(input: {
  id?: string;
  name: string;
  channel: "email" | "sms";
  triggerEvent: string;
  autoSend: boolean;
  respectQuietHours: boolean;
  status: string;
  steps: Array<{ type: "wait" | "send"; hours?: number; subject?: string; body?: string }>;
}) {
  const user = await actor();
  const id = await saveFlow({ ...input, definition: input.steps });
  await addAudit(user.email, "flow.saved", input.name, { autoSend: input.autoSend });
  revalidatePath("/lifecycle");
  return id;
}

export async function approveOutboxAction(id: string) {
  const user = await actor();
  const result = await approveOutbox(id, user.email);
  revalidatePath("/lifecycle");
  revalidatePath("/support");
  return result;
}

export async function draftTicketAction(ticketId: string) {
  const user = await actor();
  const ticket = await import("@/lib/repo").then((repo) => repo.getTicket(ticketId));
  if (!ticket) return { ok: false as const, error: "Ticket not found." };
  const messages = await import("@/lib/repo").then((repo) => repo.ticketMessages(ticketId));
  const prompt = `Draft a short reply to this support ticket. Do not promise refunds, features, or timelines that are not in the ticket. If you do not know, say a human will confirm.\n\n${messages.map((message) => `${message.direction}: ${message.body}`).join("\n")}`;
  const result = await generateText(prompt);
  await addAudit(user.email, result.ok ? "support.draft" : "support.draft_unavailable", ticketId, {
    model: result.ok ? result.model : "",
    error: result.ok ? "" : result.error,
  });
  if (!result.ok) return result;
  return { ok: true as const, text: result.text, message: `Draft from ${result.provider} / ${result.model}. Nothing has been sent.` };
}

export async function replyTicketAction(ticketId: string, body: string, send: boolean) {
  const user = await actor();
  if (!body.trim()) return { ok: false as const, error: "Write a reply first." };
  const ticket = await import("@/lib/repo").then((repo) => repo.getTicket(ticketId));
  if (!ticket) return { ok: false as const, error: "Ticket not found." };
  if (!send || ticket.channel === "chat") {
    await addTicketMessage({ ticketId, direction: "out", body, author: user.email, status: "sent" });
    await updateTicket(ticketId, { status: "pending" });
    await addAudit(user.email, "support.reply", ticketId, { channel: ticket.channel, external: false });
    revalidatePath("/support");
    return { ok: true as const, message: ticket.channel === "chat" ? "In-app reply saved. No email or SMS was sent." : "Draft saved." };
  }
  if (!ticket.from_address) return { ok: false as const, error: "This ticket has no address to send to." };
  const result = await deliver(ticket.channel === "sms" ? "sms" : "email", ticket.from_address, ticket.subject || "Reply", body);
  await addTicketMessage({
    ticketId,
    direction: "out",
    body,
    author: user.email,
    status: result.ok ? "sent" : "failed",
  });
  if (!result.ok) return result;
  await updateTicket(ticketId, { status: "pending" });
  await addAudit(user.email, "support.sent", ticket.from_address, { provider: result.provider });
  revalidatePath("/support");
  return { ok: true as const, message: `Sent with ${result.provider}.` };
}

export async function escalateTicketAction(ticketId: string) {
  const user = await actor();
  await updateTicket(ticketId, { status: "escalated", priority: "urgent" });
  await addAudit(user.email, "support.escalated", ticketId, {});
  revalidatePath("/support");
}

export async function importFeedbackAction(text: string) {
  const user = await actor();
  const rows = parseFeedbackCsv(text);
  for (const row of rows) await addFeedback(row);
  await addAudit(user.email, "feedback.import", null, { rows: rows.length });
  revalidatePath("/feedback");
  return { ok: true as const, rows: rows.length };
}

export async function clusterFeedbackAction() {
  const user = await actor();
  const clusters = await clusterFeedback(user.email);
  revalidatePath("/feedback");
  return clusters;
}

export async function saveReviewsAction() {
  const user = await actor();
  const result = await saveReviewFeedback(user.email);
  revalidatePath("/feedback");
  return result;
}

export async function featureGapAction() {
  const user = await actor();
  const result = await writeFeatureGap(user.email);
  revalidatePath("/discover");
  revalidatePath("/memo");
  return result;
}

export async function rewriteAction() {
  const user = await actor();
  return rewriteHooks(user.email);
}

export async function memoAction() {
  const user = await actor();
  const result = await writeMemo(user.email);
  revalidatePath("/memo");
  return result;
}

export async function quietAction(formData: FormData) {
  const user = await actor();
  await setSetting("quiet_start", String(formData.get("start") || "21:00"));
  await setSetting("quiet_end", String(formData.get("end") || "08:00"));
  await setSetting("quiet_timezone", String(formData.get("timezone") || "America/Los_Angeles"));
  await addAudit(user.email, "settings.quiet_hours", null, {});
  revalidatePath("/settings");
}

export async function passwordAction(formData: FormData) {
  const user = await actor();
  const result = await changePassword(user.id, String(formData.get("current") || ""), String(formData.get("next") || ""), user.email);
  if (!result.ok) throw new Error(result.error);
  revalidatePath("/settings");
}

export async function testConnectionAction(id: string) {
  const user = await actor();
  return testConnection(id, user.email);
}

export async function savePlanAction(formData: FormData) {
  const user = await actor();
  const name = String(formData.get("name") || "Acquisition plan");
  const eventName = String(formData.get("event") || "").trim();
  const description = String(formData.get("description") || "");
  const plans = await listPlans();
  const current = plans[0];
  const events = Array.isArray(current?.events) ? [...(current.events as Array<Record<string, unknown>>)] : [];
  if (eventName) events.push({ name: eventName, description, properties: [] });
  const campaign = slug(name) || "campaign";
  const utm = {
    source: "{meta|google|tiktok|affiliate|email|sms}",
    medium: "{paid|email|sms|referral}",
    campaign,
    content: "{creative or variant}",
    term: "{audience label}",
    example: `?utm_source=meta&utm_medium=paid&utm_campaign=${campaign}&utm_content=hook-a&utm_term=lookalike`,
  };
  await savePlan({ id: current?.id, name, events, utm });
  await addAudit(user.email, "tracking.plan", name, {});
  revalidatePath("/tracking");
}

export async function addLandingEventsAction() {
  const user = await actor();
  const plans = await listPlans();
  const current = plans[0];
  const name = current?.name || "Test landing";
  await savePlan({
    id: current?.id,
    name,
    events: LANDING_EVENTS,
    utm: {
      source: "{meta|google|tiktok|affiliate}",
      medium: "paid",
      campaign: "test-landing",
      content: "{variant}",
      term: "{audience}",
      example: "?utm_source=meta&utm_medium=paid&utm_campaign=test-landing&utm_content=B&utm_term=lookalike",
    },
  });
  await addAudit(user.email, "tracking.landing_events", null, {});
  revalidatePath("/tracking");
}

export async function importGa4Action() {
  const user = await actor();
  const result = await importGa4(user.email);
  revalidatePath("/tracking");
  return result;
}

export async function importMixpanelAction() {
  const user = await actor();
  const result = await importMixpanel(user.email);
  revalidatePath("/tracking");
  return result;
}

export async function funnelAction(formData: FormData) {
  await actor();
  const steps = String(formData.get("steps") || "")
    .split(",")
    .map((step) => step.trim())
    .filter(Boolean);
  if (steps.length < 2) return;
  await setSetting("funnel_steps", JSON.stringify(steps));
  revalidatePath("/");
  revalidatePath("/tracking");
}
