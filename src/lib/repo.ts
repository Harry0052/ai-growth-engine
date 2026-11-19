import { randomUUID } from "crypto";
import { getDb } from "./db";

export function nid() {
  return randomUUID();
}

async function all<T>(sql: string, params: unknown[] = []) {
  return (await getDb()).all<T>(sql, params);
}
async function one<T>(sql: string, params: unknown[] = []) {
  return (await getDb()).get<T>(sql, params);
}
async function run(sql: string, params: unknown[] = []) {
  await (await getDb()).run(sql, params);
}

function json<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function getSetting(key: string) {
  const row = await one<{ value: string }>("SELECT value FROM settings WHERE key = ?", [key]);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  await run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
    [key, value],
  );
}

export async function addAudit(actor: string, action: string, target: string | null, detail: unknown) {
  await run("INSERT INTO audit_log (id, actor, action, target, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)", [
    nid(),
    actor,
    action,
    target,
    JSON.stringify(detail ?? {}),
    Date.now(),
  ]);
}

export async function listAudit(limit = 100) {
  const rows = await all<{ id: string; actor: string; action: string; target: string | null; detail: string; created_at: number }>(
    "SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?",
    [limit],
  );
  return rows.map((row) => ({ ...row, detail: json(row.detail, {}) }));
}

export type User = { id: string; email: string; password_hash: string; created_at: number };

export async function getUserByEmail(email: string) {
  return one<User>("SELECT * FROM users WHERE email = ?", [email.toLowerCase()]);
}
export async function getUserById(id: string) {
  return one<User>("SELECT * FROM users WHERE id = ?", [id]);
}
export async function createUser(email: string, passwordHash: string) {
  const user = { id: nid(), email: email.toLowerCase(), password_hash: passwordHash, created_at: Date.now() };
  await run("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)", [
    user.id,
    user.email,
    user.password_hash,
    user.created_at,
  ]);
  return user;
}
export async function updatePassword(id: string, passwordHash: string) {
  await run("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, id]);
}

export type Campaign = {
  id: string;
  platform: string;
  external_id: string;
  name: string;
  status: string;
  objective: string;
  daily_budget_cents: number | null;
  currency: string;
  source: string;
  raw_json: string;
  updated_at: number;
};

export async function upsertCampaign(input: Omit<Campaign, "id" | "updated_at"> & { id?: string }) {
  const existing = await one<{ id: string }>(
    "SELECT id FROM campaigns WHERE platform = ? AND external_id = ? AND source = ?",
    [input.platform, input.external_id, input.source],
  );
  const id = existing?.id ?? input.id ?? nid();
  const now = Date.now();
  if (existing) {
    await run(
      `UPDATE campaigns SET name = ?, status = ?, objective = ?, daily_budget_cents = ?, currency = ?, raw_json = ?, updated_at = ? WHERE id = ?`,
      [input.name, input.status, input.objective, input.daily_budget_cents, input.currency, input.raw_json, now, id],
    );
  } else {
    await run(
      `INSERT INTO campaigns (id, platform, external_id, name, status, objective, daily_budget_cents, currency, source, raw_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.platform, input.external_id, input.name, input.status, input.objective, input.daily_budget_cents, input.currency, input.source, input.raw_json, now],
    );
  }
  return id;
}

export async function listCampaigns(includeDemo: boolean) {
  const rows = await all<Campaign>(
    includeDemo ? "SELECT * FROM campaigns ORDER BY updated_at DESC" : "SELECT * FROM campaigns WHERE source <> 'demo' ORDER BY updated_at DESC",
  );
  return rows;
}

export async function getCampaign(id: string) {
  return one<Campaign>("SELECT * FROM campaigns WHERE id = ?", [id]);
}

export async function setCampaignStatus(id: string, status: string, dailyBudgetCents?: number | null) {
  if (dailyBudgetCents === undefined) {
    await run("UPDATE campaigns SET status = ?, updated_at = ? WHERE id = ?", [status, Date.now(), id]);
  } else {
    await run("UPDATE campaigns SET status = ?, daily_budget_cents = ?, updated_at = ? WHERE id = ?", [
      status,
      dailyBudgetCents,
      Date.now(),
      id,
    ]);
  }
}

export async function upsertAdSet(input: { campaignId: string; externalId: string; name: string; status: string; targeting: string; source: string }) {
  const existing = await one<{ id: string }>("SELECT id FROM ad_sets WHERE campaign_id = ? AND external_id = ? AND source = ?", [
    input.campaignId,
    input.externalId,
    input.source,
  ]);
  const id = existing?.id ?? nid();
  if (existing) {
    await run("UPDATE ad_sets SET name = ?, status = ?, targeting = ? WHERE id = ?", [input.name, input.status, input.targeting, id]);
  } else {
    await run(
      "INSERT INTO ad_sets (id, campaign_id, external_id, name, status, targeting, source) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, input.campaignId, input.externalId, input.name, input.status, input.targeting, input.source],
    );
  }
  return id;
}

export async function upsertAd(input: { campaignId: string; adSetId: string; externalId: string; name: string; status: string; source: string }) {
  const existing = await one<{ id: string }>("SELECT id FROM ads WHERE campaign_id = ? AND external_id = ? AND source = ?", [
    input.campaignId,
    input.externalId,
    input.source,
  ]);
  const id = existing?.id ?? nid();
  if (existing) await run("UPDATE ads SET name = ?, status = ?, ad_set_id = ? WHERE id = ?", [input.name, input.status, input.adSetId, id]);
  else {
    await run("INSERT INTO ads (id, campaign_id, ad_set_id, external_id, name, status, source) VALUES (?, ?, ?, ?, ?, ?, ?)", [
      id,
      input.campaignId,
      input.adSetId,
      input.externalId,
      input.name,
      input.status,
      input.source,
    ]);
  }
  return id;
}

export async function countChildren() {
  const sets = await all<{ campaign_id: string; n: number }>("SELECT campaign_id, COUNT(*) AS n FROM ad_sets GROUP BY campaign_id");
  const ads = await all<{ campaign_id: string; n: number }>("SELECT campaign_id, COUNT(*) AS n FROM ads GROUP BY campaign_id");
  return {
    sets: new Map(sets.map((row) => [row.campaign_id, Number(row.n)])),
    ads: new Map(ads.map((row) => [row.campaign_id, Number(row.n)])),
  };
}

export type MetricRow = {
  id: string;
  campaign_id: string;
  metric_date: string;
  impressions: number;
  clicks: number;
  spend_cents: number;
  conversions: number;
  revenue_cents: number;
  source: string;
  ad_set_name: string;
  ad_name: string;
};

export async function upsertMetric(input: Omit<MetricRow, "id">) {
  const existing = await one<{ id: string }>(
    "SELECT id FROM ad_metrics WHERE campaign_id = ? AND metric_date = ? AND source = ? AND ad_set_name = ? AND ad_name = ?",
    [input.campaign_id, input.metric_date, input.source, input.ad_set_name, input.ad_name],
  );
  if (existing) {
    await run(
      "UPDATE ad_metrics SET impressions = ?, clicks = ?, spend_cents = ?, conversions = ?, revenue_cents = ? WHERE id = ?",
      [input.impressions, input.clicks, input.spend_cents, input.conversions, input.revenue_cents, existing.id],
    );
    return existing.id;
  }
  const id = nid();
  await run(
    `INSERT INTO ad_metrics (id, campaign_id, metric_date, impressions, clicks, spend_cents, conversions, revenue_cents, source, ad_set_name, ad_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.campaign_id, input.metric_date, input.impressions, input.clicks, input.spend_cents, input.conversions, input.revenue_cents, input.source, input.ad_set_name, input.ad_name],
  );
  return id;
}

export async function listMetrics(includeDemo: boolean) {
  return all<MetricRow>(includeDemo ? "SELECT * FROM ad_metrics" : "SELECT * FROM ad_metrics WHERE source <> 'demo'");
}

export async function insertEvent(input: {
  eventName: string;
  anonymousId: string | null;
  userId: string | null;
  properties: unknown;
  context: unknown;
  source: string;
  traffic: string;
  ts?: number;
}) {
  const ts = input.ts ?? Date.now();
  if (input.anonymousId) {
    const recent = await one<{ id: string }>(
      "SELECT id FROM events WHERE anonymous_id = ? AND event_name = ? AND traffic = ? AND ts > ? ORDER BY ts DESC LIMIT 1",
      [input.anonymousId, input.eventName, input.traffic, ts - 2000],
    );
    if (recent) return { id: recent.id, duplicate: true };
  }
  const id = nid();
  await run(
    "INSERT INTO events (id, event_name, anonymous_id, user_id, properties, context, source, traffic, ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [id, input.eventName, input.anonymousId, input.userId, JSON.stringify(input.properties ?? {}), JSON.stringify(input.context ?? {}), input.source, input.traffic, ts],
  );
  return { id, duplicate: false };
}

export type StoredEvent = {
  id: string;
  event_name: string;
  anonymous_id: string | null;
  user_id: string | null;
  properties: string;
  context: string;
  source: string;
  traffic: string;
  ts: number;
};

export async function listEvents(where = "1 = 1", params: unknown[] = [], limit = 5000) {
  return all<StoredEvent>(`SELECT * FROM events WHERE ${where} ORDER BY ts ASC LIMIT ?`, [...params, limit]);
}

export async function deleteEventsBySource(source: string) {
  await run("DELETE FROM events WHERE source = ?", [source]);
}

export async function recentEvents(limit = 40) {
  const rows = await all<StoredEvent>("SELECT * FROM events ORDER BY ts DESC LIMIT ?", [limit]);
  return rows.map((row) => ({ ...row, properties: json(row.properties, {}), context: json(row.context, {}) }));
}

export type Experiment = { id: string; key: string; name: string; status: string; variants: string; metric: string; created_at: number };

export async function upsertExperiment(input: { key: string; name: string; status: string; variants: string[]; metric: string }) {
  const existing = await one<Experiment>("SELECT * FROM experiments WHERE key = ?", [input.key]);
  if (existing) {
    await run("UPDATE experiments SET name = ?, status = ?, variants = ?, metric = ? WHERE key = ?", [
      input.name,
      input.status,
      JSON.stringify(input.variants),
      input.metric,
      input.key,
    ]);
    return existing.id;
  }
  const id = nid();
  await run("INSERT INTO experiments (id, key, name, status, variants, metric, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [
    id,
    input.key,
    input.name,
    input.status,
    JSON.stringify(input.variants),
    input.metric,
    Date.now(),
  ]);
  return id;
}

export async function listExperiments() {
  const rows = await all<Experiment>("SELECT * FROM experiments ORDER BY created_at DESC");
  return rows.map((row) => ({ ...row, variants: json<string[]>(row.variants, ["A", "B"]) }));
}

export async function getExperiment(key: string) {
  const row = await one<Experiment>("SELECT * FROM experiments WHERE key = ?", [key]);
  return row ? { ...row, variants: json<string[]>(row.variants, ["A", "B"]) } : null;
}

export async function saveAssignment(experimentKey: string, anonymousId: string, variant: string) {
  const existing = await one<{ variant: string }>(
    "SELECT variant FROM assignments WHERE experiment_key = ? AND anonymous_id = ?",
    [experimentKey, anonymousId],
  );
  if (existing) return existing.variant;
  await run("INSERT INTO assignments (id, experiment_key, anonymous_id, variant, assigned_at) VALUES (?, ?, ?, ?, ?)", [
    nid(),
    experimentKey,
    anonymousId,
    variant,
    Date.now(),
  ]);
  return variant;
}

export type Tier = { id: string; name: string; rate_bps: number; bounty_cents: number };
export async function listTiers() {
  return all<Tier>("SELECT * FROM tiers ORDER BY name");
}
export async function ensureTier(name: string, rateBps: number, bountyCents: number) {
  const existing = await one<Tier>("SELECT * FROM tiers WHERE name = ?", [name]);
  if (existing) return existing;
  const tier = { id: nid(), name, rate_bps: rateBps, bounty_cents: bountyCents };
  await run("INSERT INTO tiers (id, name, rate_bps, bounty_cents) VALUES (?, ?, ?, ?)", [tier.id, name, rateBps, bountyCents]);
  return tier;
}

export type Affiliate = {
  id: string;
  name: string;
  email: string;
  code: string;
  tier_id: string;
  status: string;
  stripe_account_id: string;
  created_at: number;
};

export async function createAffiliate(input: { name: string; email?: string; code: string; tierId: string; stripeAccountId?: string }) {
  const row: Affiliate = {
    id: nid(),
    name: input.name,
    email: input.email ?? "",
    code: input.code.toUpperCase(),
    tier_id: input.tierId,
    status: "active",
    stripe_account_id: input.stripeAccountId ?? "",
    created_at: Date.now(),
  };
  await run(
    "INSERT INTO affiliates (id, name, email, code, tier_id, status, stripe_account_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [row.id, row.name, row.email, row.code, row.tier_id, row.status, row.stripe_account_id, row.created_at],
  );
  return row;
}
export async function getAffiliateByCode(code: string) {
  return one<Affiliate>("SELECT * FROM affiliates WHERE code = ?", [code.toUpperCase()]);
}
export async function listAffiliates() {
  return all<Affiliate>("SELECT * FROM affiliates ORDER BY created_at DESC");
}
export async function getAffiliate(id: string) {
  return one<Affiliate>("SELECT * FROM affiliates WHERE id = ?", [id]);
}

export async function addClick(input: { affiliateId: string; anonymousId: string | null; path: string; referrer: string; userAgent: string; traffic: string }) {
  const id = nid();
  await run(
    "INSERT INTO referral_clicks (id, affiliate_id, anonymous_id, path, referrer, user_agent, traffic, ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [id, input.affiliateId, input.anonymousId, input.path, input.referrer, input.userAgent, input.traffic, Date.now()],
  );
  return id;
}

export type Conversion = {
  id: string;
  affiliate_id: string;
  anonymous_id: string;
  event_name: string;
  revenue_cents: number;
  commission_cents: number;
  status: string;
  traffic: string;
  ts: number;
};

export async function getConversion(affiliateId: string, anonymousId: string) {
  return one<Conversion>("SELECT * FROM conversions WHERE affiliate_id = ? AND anonymous_id = ?", [affiliateId, anonymousId]);
}
export async function insertConversion(input: Omit<Conversion, "id" | "ts"> & { ts?: number }) {
  const row = { ...input, id: nid(), ts: input.ts ?? Date.now() };
  await run(
    `INSERT INTO conversions (id, affiliate_id, anonymous_id, event_name, revenue_cents, commission_cents, status, traffic, ts)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [row.id, row.affiliate_id, row.anonymous_id, row.event_name, row.revenue_cents, row.commission_cents, row.status, row.traffic, row.ts],
  );
  return row;
}
export async function updateConversion(id: string, input: Partial<Pick<Conversion, "event_name" | "revenue_cents" | "commission_cents" | "status">>) {
  const current = await one<Conversion>("SELECT * FROM conversions WHERE id = ?", [id]);
  if (!current) return;
  await run("UPDATE conversions SET event_name = ?, revenue_cents = ?, commission_cents = ?, status = ? WHERE id = ?", [
    input.event_name ?? current.event_name,
    input.revenue_cents ?? current.revenue_cents,
    input.commission_cents ?? current.commission_cents,
    input.status ?? current.status,
    id,
  ]);
}
export async function listConversions() {
  return all<Conversion>("SELECT * FROM conversions ORDER BY ts DESC");
}
export async function listClicks() {
  return all<{ id: string; affiliate_id: string; traffic: string; ts: number }>("SELECT id, affiliate_id, traffic, ts FROM referral_clicks ORDER BY ts DESC");
}

export async function createPayout(input: { affiliateId: string; amountCents: number; status: string; method: string; note: string; conversionIds: string[]; externalId?: string }) {
  const id = nid();
  const now = Date.now();
  await run(
    "INSERT INTO payouts (id, affiliate_id, amount_cents, status, method, external_id, note, created_at, decided_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [id, input.affiliateId, input.amountCents, input.status, input.method, input.externalId ?? "", input.note, now, now],
  );
  for (const conversionId of input.conversionIds) {
    await run("INSERT INTO payout_items (payout_id, conversion_id) VALUES (?, ?)", [id, conversionId]);
    await run("UPDATE conversions SET status = ? WHERE id = ?", [input.status === "paid" ? "paid" : "in_payout", conversionId]);
  }
  return id;
}
export async function listPayouts() {
  return all<{
    id: string;
    affiliate_id: string;
    amount_cents: number;
    status: string;
    method: string;
    external_id: string;
    note: string;
    created_at: number;
  }>("SELECT * FROM payouts ORDER BY created_at DESC");
}
export async function markPayout(id: string, status: string, externalId = "") {
  await run("UPDATE payouts SET status = ?, external_id = ?, decided_at = ? WHERE id = ?", [status, externalId, Date.now(), id]);
  const items = await all<{ conversion_id: string }>("SELECT conversion_id FROM payout_items WHERE payout_id = ?", [id]);
  for (const item of items) {
    await run("UPDATE conversions SET status = ? WHERE id = ?", [status === "paid" ? "paid" : status === "failed" ? "pending" : "in_payout", item.conversion_id]);
  }
}

export async function createTicket(input: { channel: string; fromName: string; fromAddress: string; subject: string; body: string; priority: string; category: string; triage: string }) {
  const now = Date.now();
  const id = nid();
  await run(
    `INSERT INTO tickets (id, channel, from_name, from_address, subject, status, priority, category, triage, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)`,
    [id, input.channel, input.fromName, input.fromAddress, input.subject, input.priority, input.category, input.triage, now, now],
  );
  await run(
    "INSERT INTO ticket_messages (id, ticket_id, direction, body, author, model, status, created_at) VALUES (?, ?, 'in', ?, ?, '', 'received', ?)",
    [nid(), id, input.body, input.fromAddress || input.fromName || "visitor", now],
  );
  return id;
}

export async function listTickets() {
  return all<{
    id: string;
    channel: string;
    from_name: string;
    from_address: string;
    subject: string;
    status: string;
    priority: string;
    category: string;
    triage: string;
    created_at: number;
    updated_at: number;
  }>("SELECT * FROM tickets ORDER BY updated_at DESC");
}
export async function getTicket(id: string) {
  return one<{
    id: string;
    channel: string;
    from_name: string;
    from_address: string;
    subject: string;
    status: string;
    priority: string;
    category: string;
    triage: string;
    created_at: number;
  }>("SELECT * FROM tickets WHERE id = ?", [id]);
}
export async function ticketMessages(ticketId: string) {
  return all<{ id: string; direction: string; body: string; author: string; model: string; status: string; created_at: number }>(
    "SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC",
    [ticketId],
  );
}
export async function addTicketMessage(input: { ticketId: string; direction: string; body: string; author: string; model?: string; status: string }) {
  const id = nid();
  await run(
    "INSERT INTO ticket_messages (id, ticket_id, direction, body, author, model, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [id, input.ticketId, input.direction, input.body, input.author, input.model ?? "", input.status, Date.now()],
  );
  await run("UPDATE tickets SET updated_at = ? WHERE id = ?", [Date.now(), input.ticketId]);
  return id;
}
export async function updateTicket(id: string, patch: { status?: string; priority?: string }) {
  const current = await getTicket(id);
  if (!current) return;
  await run("UPDATE tickets SET status = ?, priority = ?, updated_at = ? WHERE id = ?", [
    patch.status ?? current.status,
    patch.priority ?? current.priority,
    Date.now(),
    id,
  ]);
}

export type Flow = {
  id: string;
  name: string;
  channel: string;
  trigger_event: string;
  auto_send: number;
  respect_quiet_hours: number;
  definition: string;
  status: string;
  created_at: number;
};
export async function saveFlow(input: {
  id?: string;
  name: string;
  channel: string;
  triggerEvent: string;
  autoSend: boolean;
  respectQuietHours: boolean;
  definition: unknown;
  status: string;
}) {
  if (input.id) {
    await run(
      "UPDATE flows SET name = ?, channel = ?, trigger_event = ?, auto_send = ?, respect_quiet_hours = ?, definition = ?, status = ? WHERE id = ?",
      [input.name, input.channel, input.triggerEvent, input.autoSend ? 1 : 0, input.respectQuietHours ? 1 : 0, JSON.stringify(input.definition), input.status, input.id],
    );
    return input.id;
  }
  const id = nid();
  await run(
    `INSERT INTO flows (id, name, channel, trigger_event, auto_send, respect_quiet_hours, definition, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.name, input.channel, input.triggerEvent, input.autoSend ? 1 : 0, input.respectQuietHours ? 1 : 0, JSON.stringify(input.definition), input.status, Date.now()],
  );
  return id;
}
export async function listFlows() {
  const rows = await all<Flow>("SELECT * FROM flows ORDER BY created_at DESC");
  return rows.map((row) => ({ ...row, definition: json(row.definition, []) }));
}
export async function getFlow(id: string) {
  const row = await one<Flow>("SELECT * FROM flows WHERE id = ?", [id]);
  return row ? { ...row, definition: json<Array<{ type: string; hours?: number; subject?: string; body?: string }>>(row.definition, []) } : null;
}

export async function enroll(input: { flowId: string; subjectKey: string; recipient: string }) {
  const existing = await one<{ id: string }>("SELECT id FROM enrollments WHERE flow_id = ? AND subject_key = ?", [input.flowId, input.subjectKey]);
  if (existing) return existing.id;
  const id = nid();
  await run(
    "INSERT INTO enrollments (id, flow_id, subject_key, recipient, step_index, status, next_run_at, created_at) VALUES (?, ?, ?, ?, 0, 'active', ?, ?)",
    [id, input.flowId, input.subjectKey, input.recipient, Date.now(), Date.now()],
  );
  return id;
}
export async function dueEnrollments(now = Date.now()) {
  return all<{ id: string; flow_id: string; subject_key: string; recipient: string; step_index: number; status: string; next_run_at: number | null }>(
    "SELECT * FROM enrollments WHERE status = 'active' AND (next_run_at IS NULL OR next_run_at <= ?)",
    [now],
  );
}
export async function updateEnrollment(id: string, patch: { stepIndex?: number; status?: string; nextRunAt?: number | null }) {
  const current = await one<{ step_index: number; status: string; next_run_at: number | null }>("SELECT step_index, status, next_run_at FROM enrollments WHERE id = ?", [id]);
  if (!current) return;
  await run("UPDATE enrollments SET step_index = ?, status = ?, next_run_at = ? WHERE id = ?", [
    patch.stepIndex ?? current.step_index,
    patch.status ?? current.status,
    patch.nextRunAt === undefined ? current.next_run_at : patch.nextRunAt,
    id,
  ]);
}
export async function listEnrollments() {
  return all<{ id: string; flow_id: string; subject_key: string; recipient: string; step_index: number; status: string; next_run_at: number | null }>(
    "SELECT * FROM enrollments ORDER BY created_at DESC",
  );
}

export async function addOutbox(input: { channel: string; recipient: string; subject?: string; body: string; status: string; flowId?: string; ticketId?: string; provider?: string; providerId?: string; error?: string }) {
  const id = nid();
  const sent = input.status === "sent" ? Date.now() : null;
  await run(
    `INSERT INTO outbox (id, channel, recipient, subject, body, status, flow_id, ticket_id, provider, provider_id, error, created_at, sent_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.channel, input.recipient, input.subject ?? "", input.body, input.status, input.flowId ?? "", input.ticketId ?? "", input.provider ?? "", input.providerId ?? "", input.error ?? "", Date.now(), sent],
  );
  return id;
}
export async function listOutbox() {
  return all<{
    id: string;
    channel: string;
    recipient: string;
    subject: string;
    body: string;
    status: string;
    flow_id: string;
    error: string;
    provider: string;
    created_at: number;
    sent_at: number | null;
  }>("SELECT * FROM outbox ORDER BY created_at DESC LIMIT 200");
}
export async function getOutbox(id: string) {
  return one<{ id: string; channel: string; recipient: string; subject: string; body: string; status: string; flow_id: string; ticket_id: string }>(
    "SELECT * FROM outbox WHERE id = ?",
    [id],
  );
}
export async function markOutbox(id: string, status: string, extra: { provider?: string; providerId?: string; error?: string } = {}) {
  await run("UPDATE outbox SET status = ?, provider = ?, provider_id = ?, error = ?, sent_at = ? WHERE id = ?", [
    status,
    extra.provider ?? "",
    extra.providerId ?? "",
    extra.error ?? "",
    status === "sent" ? Date.now() : null,
    id,
  ]);
}

export async function unsubscribe(channel: string, address: string) {
  const normalized = address.trim().toLowerCase();
  await run(
    "INSERT INTO unsubscribes (id, channel, address, ts) VALUES (?, ?, ?, ?) ON CONFLICT (channel, address) DO NOTHING",
    [nid(), channel, normalized, Date.now()],
  );
}
export async function isUnsubscribed(channel: string, address: string) {
  const row = await one<{ id: string }>("SELECT id FROM unsubscribes WHERE channel = ? AND address = ?", [channel, address.trim().toLowerCase()]);
  return Boolean(row);
}

export async function addFeedback(input: { source: string; body: string; rating?: number | null; author?: string; theme?: string; createdAt?: number }) {
  const existing = await one<{ id: string }>("SELECT id FROM feedback WHERE source = ? AND body = ?", [input.source, input.body]);
  if (existing) return existing.id;
  const id = nid();
  await run("INSERT INTO feedback (id, source, body, rating, author, theme, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [
    id,
    input.source,
    input.body,
    input.rating ?? null,
    input.author ?? "",
    input.theme ?? "",
    input.createdAt ?? Date.now(),
  ]);
  return id;
}
export async function listFeedback() {
  return all<{ id: string; source: string; body: string; rating: number | null; author: string; theme: string; created_at: number }>(
    "SELECT * FROM feedback ORDER BY created_at DESC",
  );
}
export async function setFeedbackTheme(id: string, theme: string) {
  await run("UPDATE feedback SET theme = ? WHERE id = ?", [theme, id]);
}

export async function addReport(input: { kind: string; title: string; body: string; model?: string }) {
  const id = nid();
  await run("INSERT INTO reports (id, kind, title, body, model, created_at) VALUES (?, ?, ?, ?, ?, ?)", [
    id,
    input.kind,
    input.title,
    input.body,
    input.model ?? "",
    Date.now(),
  ]);
  return id;
}
export async function listReports(kind?: string) {
  if (kind) return all<{ id: string; kind: string; title: string; body: string; model: string; created_at: number }>("SELECT * FROM reports WHERE kind = ? ORDER BY created_at DESC", [kind]);
  return all<{ id: string; kind: string; title: string; body: string; model: string; created_at: number }>("SELECT * FROM reports ORDER BY created_at DESC");
}
export async function latestReport(kind: string) {
  return one<{ id: string; kind: string; title: string; body: string; model: string; created_at: number }>(
    "SELECT * FROM reports WHERE kind = ? ORDER BY created_at DESC LIMIT 1",
    [kind],
  );
}

export async function addSnapshot(input: { source: string; query: string; payload: unknown; ok: boolean; error?: string }) {
  const id = nid();
  await run("INSERT INTO snapshots (id, source, query, payload, ok, error, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [
    id,
    input.source,
    input.query,
    JSON.stringify(input.payload ?? {}),
    input.ok ? 1 : 0,
    input.error ?? "",
    Date.now(),
  ]);
  return id;
}
export async function latestSnapshot(source: string, okOnly = false) {
  const row = await one<{ id: string; source: string; query: string; payload: string; ok: number; error: string; fetched_at: number }>(
    `SELECT * FROM snapshots WHERE source = ? ${okOnly ? "AND ok = 1" : ""} ORDER BY fetched_at DESC LIMIT 1`,
    [source],
  );
  return row ? { ...row, payload: json(row.payload, {}) } : null;
}

export async function addLead(input: { email: string; name?: string; anonymousId?: string; variant?: string; ref?: string; traffic: string }) {
  const id = nid();
  await run(
    "INSERT INTO leads (id, email, name, anonymous_id, variant, ref_code, traffic, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [id, input.email, input.name ?? "", input.anonymousId ?? "", input.variant ?? "", input.ref ?? "", input.traffic, Date.now()],
  );
  return id;
}
export async function listLeads() {
  return all<{ id: string; email: string; name: string; variant: string; ref_code: string; traffic: string; created_at: number }>(
    "SELECT * FROM leads ORDER BY created_at DESC LIMIT 100",
  );
}

export async function saveJob(kind: string, status: string, progress: unknown) {
  await run(
    "INSERT INTO jobs (id, kind, status, progress, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET status = excluded.status, progress = excluded.progress, updated_at = excluded.updated_at",
    [kind, kind, status, JSON.stringify(progress ?? {}), Date.now()],
  );
}
export async function getJob(kind: string) {
  const row = await one<{ id: string; status: string; progress: string; updated_at: number }>("SELECT * FROM jobs WHERE id = ?", [kind]);
  return row ? { ...row, progress: json(row.progress, {}) } : null;
}

export async function savePlan(input: { id?: string; name: string; events: unknown; utm: unknown }) {
  const now = Date.now();
  if (input.id) {
    await run("UPDATE tracking_plans SET name = ?, events_json = ?, utm_json = ?, updated_at = ? WHERE id = ?", [
      input.name,
      JSON.stringify(input.events),
      JSON.stringify(input.utm),
      now,
      input.id,
    ]);
    return input.id;
  }
  const id = nid();
  await run("INSERT INTO tracking_plans (id, name, events_json, utm_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", [
    id,
    input.name,
    JSON.stringify(input.events),
    JSON.stringify(input.utm),
    now,
    now,
  ]);
  return id;
}
export async function listPlans() {
  const rows = await all<{ id: string; name: string; events_json: string; utm_json: string; updated_at: number }>(
    "SELECT * FROM tracking_plans ORDER BY updated_at DESC",
  );
  return rows.map((row) => ({ ...row, events: json(row.events_json, []), utm: json(row.utm_json, {}) }));
}

export async function deleteDemo() {
  await run("DELETE FROM ad_metrics WHERE source = 'demo'");
  await run("DELETE FROM ads WHERE source = 'demo'");
  await run("DELETE FROM ad_sets WHERE source = 'demo'");
  await run("DELETE FROM campaigns WHERE source = 'demo'");
  await run("DELETE FROM feedback WHERE source = 'demo'");
}
