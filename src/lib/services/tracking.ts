import { commissionCents } from "../commission";
import {
  addClick,
  addLead,
  enroll,
  getAffiliateByCode,
  getConversion,
  getSetting,
  insertConversion,
  insertEvent,
  listFlows,
  listTiers,
  updateConversion,
} from "../repo";
import { processDueFlows } from "./messages";

function revenueCents(properties: Record<string, unknown>) {
  if (typeof properties.revenue_cents === "number") return Math.round(properties.revenue_cents);
  if (typeof properties.revenue === "number") return Math.round(properties.revenue * 100);
  return 0;
}

export async function ingestTrackedEvent(input: {
  event: string;
  anonymousId: string | null;
  userId: string | null;
  properties: Record<string, unknown>;
  context: Record<string, unknown>;
  source: string;
  traffic: string;
}) {
  const saved = await insertEvent({
    eventName: input.event,
    anonymousId: input.anonymousId,
    userId: input.userId,
    properties: input.properties,
    context: input.context,
    source: input.source,
    traffic: input.traffic,
  });
  if (saved.duplicate) return saved;
  const ref = String(input.context.ref || input.properties.ref || "");
  if ((input.event === "signup" || input.event === "purchase") && ref && input.anonymousId) {
    await attribute(ref, input.anonymousId, input.event, input.properties, input.traffic);
  }
  if (input.event === "signup") {
    const email = String(input.properties.email || "");
    if (email.includes("@")) {
      await addLead({
        email,
        name: String(input.properties.name || ""),
        anonymousId: input.anonymousId ?? "",
        variant: String(input.properties.variant || ""),
        ref,
        traffic: input.traffic,
      });
    }
  }
  if (input.traffic === "product") {
    await enrollFlows(input.event, input.anonymousId, input.properties);
    await processDueFlows();
  }
  return saved;
}

async function attribute(code: string, anonymousId: string, event: string, properties: Record<string, unknown>, traffic: string) {
  const affiliate = await getAffiliateByCode(code);
  if (!affiliate || affiliate.status !== "active") return;
  const tier = (await listTiers()).find((item) => item.id === affiliate.tier_id);
  const revenue = revenueCents(properties);
  const commission = commissionCents(revenue, tier?.rate_bps ?? 0, tier?.bounty_cents ?? 0);
  const status = traffic === "product" ? "pending" : "test";
  const existing = await getConversion(affiliate.id, anonymousId);
  if (!existing) {
    await insertConversion({
      affiliate_id: affiliate.id,
      anonymous_id: anonymousId,
      event_name: event,
      revenue_cents: revenue,
      commission_cents: commission,
      status,
      traffic,
    });
    return;
  }
  if (existing.status === "paid" || existing.status === "in_payout") return;
  if (revenue >= existing.revenue_cents) {
    await updateConversion(existing.id, { event_name: event, revenue_cents: revenue, commission_cents: commission });
  }
}

async function enrollFlows(event: string, anonymousId: string | null, properties: Record<string, unknown>) {
  const flows = await listFlows();
  for (const flow of flows) {
    if (flow.status !== "active" || flow.trigger_event !== event) continue;
    const recipient = flow.channel === "sms" ? String(properties.phone || "") : String(properties.email || "");
    if (!recipient) continue;
    await enroll({ flowId: flow.id, subjectKey: anonymousId || recipient, recipient });
  }
}

export async function funnelSteps() {
  const raw = await getSetting("funnel_steps");
  if (!raw) return ["page_view", "cta_click", "signup", "purchase"];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) return parsed;
  } catch {
    /* use the default */
  }
  return ["page_view", "cta_click", "signup", "purchase"];
}

export function classifyTraffic(userAgent: string, properties: Record<string, unknown>) {
  if (userAgent.includes("GrowthEngineLiveTest")) return "live-test";
  if (properties.traffic === "live-test") return "live-test";
  if (properties.traffic === "import") return "import";
  return "product";
}

export async function recordReferralClick(input: {
  code: string;
  anonymousId: string | null;
  referrer: string;
  userAgent: string;
}) {
  const affiliate = await getAffiliateByCode(input.code);
  if (!affiliate || affiliate.status !== "active") return null;
  const traffic = input.userAgent.includes("GrowthEngineLiveTest") ? "live-test" : "product";
  await addClick({
    affiliateId: affiliate.id,
    anonymousId: input.anonymousId,
    path: `/r/${affiliate.code}`,
    referrer: input.referrer,
    userAgent: input.userAgent,
    traffic,
  });
  return affiliate;
}
