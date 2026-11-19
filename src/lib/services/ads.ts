import { DEFAULT_THRESHOLDS, type Thresholds } from "../constants";
import { parseAdsCsv } from "../csv";
import { env } from "../env";
import {
  mutateGoogle,
  mutateMeta,
  mutateTikTok,
  pullGa4,
  pullGoogleAds,
  pullMeta,
  pullMixpanel,
  pullTikTok,
  type FetchLike,
} from "../integrations";
import { judgeCampaign, type CampaignMath } from "../recommendations";
import {
  addAudit,
  getCampaign,
  deleteEventsBySource,
  getSetting,
  listCampaigns,
  listMetrics,
  setCampaignStatus,
  upsertAd,
  upsertAdSet,
  upsertCampaign,
  upsertMetric,
  insertEvent,
} from "../repo";

export async function thresholds(): Promise<Thresholds> {
  const raw = await getSetting("thresholds");
  if (!raw) return DEFAULT_THRESHOLDS;
  try {
    return { ...DEFAULT_THRESHOLDS, ...(JSON.parse(raw) as Partial<Thresholds>) };
  } catch {
    return DEFAULT_THRESHOLDS;
  }
}

export async function campaignBoard(includeDemo: boolean) {
  const [campaigns, metrics, rules] = await Promise.all([listCampaigns(includeDemo), listMetrics(includeDemo), thresholds()]);
  return campaigns.map((campaign) => {
    const rows = metrics.filter((metric) => metric.campaign_id === campaign.id);
    const totals = rows.reduce<CampaignMath>(
      (sum, row) => ({
        impressions: sum.impressions + Number(row.impressions),
        clicks: sum.clicks + Number(row.clicks),
        spendCents: sum.spendCents + Number(row.spend_cents),
        conversions: sum.conversions + Number(row.conversions),
        revenueCents: sum.revenueCents + Number(row.revenue_cents),
      }),
      { impressions: 0, clicks: 0, spendCents: 0, conversions: 0, revenueCents: 0 },
    );
    return {
      campaign,
      totals,
      judgement: rows.length ? judgeCampaign(totals, rules) : null,
      dates: rows.map((row) => row.metric_date).sort(),
      rowCount: rows.length,
    };
  });
}

export async function importAdsCsv(text: string, actor: string) {
  const parsed = parseAdsCsv(text);
  if (!parsed.rows.length) return { ok: false as const, error: "No campaign rows were found. Check that the export has a header row." };
  const ids = new Map<string, string>();
  for (const row of parsed.rows) {
    const platform = parsed.platform === "unknown" ? "csv" : parsed.platform;
    const external = row.campaign.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80) || "row";
    const key = `${platform}:${external}`;
    if (!ids.has(key)) {
      const id = await upsertCampaign({
        platform,
        external_id: external,
        name: row.campaign,
        status: "imported",
        objective: "",
        daily_budget_cents: null,
        currency: "USD",
        source: "csv",
        raw_json: "{}",
      });
      ids.set(key, id);
    }
    await upsertMetric({
      campaign_id: ids.get(key)!,
      metric_date: row.date,
      impressions: row.impressions,
      clicks: row.clicks,
      spend_cents: row.spendCents,
      conversions: row.conversions,
      revenue_cents: row.revenueCents,
      source: "csv",
      ad_set_name: row.adSet,
      ad_name: row.ad,
    });
  }
  await addAudit(actor, "ads.csv_import", parsed.platform, { rows: parsed.rows.length, campaigns: ids.size });
  return { ok: true as const, platform: parsed.platform, rows: parsed.rows.length, campaigns: ids.size };
}

export async function syncAds(platform: "meta" | "google" | "tiktok", actor: string, fetchImpl?: FetchLike) {
  if (platform === "meta") {
    if (!env("META_ACCESS_TOKEN") || !env("META_AD_ACCOUNT_ID")) return { ok: false as const, error: "Meta is not connected." };
    const pulled = await pullMeta({ token: env("META_ACCESS_TOKEN"), accountId: env("META_AD_ACCOUNT_ID"), fetchImpl });
    if (!pulled.ok) {
      await addAudit(actor, "meta.sync_failed", null, { error: pulled.error });
      return pulled;
    }
    const ids = new Map<string, string>();
    for (const campaign of pulled.campaigns) {
      const id = await upsertCampaign({
        platform: "meta",
        external_id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        objective: campaign.objective,
        daily_budget_cents: campaign.dailyBudgetCents,
        currency: "USD",
        source: "meta",
        raw_json: "{}",
      });
      ids.set(campaign.id, id);
    }
    for (const adset of pulled.adsets) {
      const campaignId = ids.get(adset.campaignId);
      if (!campaignId) continue;
      await upsertAdSet({ campaignId, externalId: adset.id, name: adset.name, status: adset.status, targeting: JSON.stringify(adset.targeting), source: "meta" });
    }
    for (const ad of pulled.ads) {
      const campaignId = ids.get(ad.campaignId);
      if (!campaignId) continue;
      await upsertAd({ campaignId, adSetId: ad.adsetId, externalId: ad.id, name: ad.name, status: ad.status, source: "meta" });
    }
    for (const metric of pulled.metrics) {
      const campaignId = ids.get(metric.campaignId);
      if (!campaignId) continue;
      await upsertMetric({
        campaign_id: campaignId,
        metric_date: metric.date || "undated",
        impressions: metric.impressions,
        clicks: metric.clicks,
        spend_cents: metric.spendCents,
        conversions: metric.conversions,
        revenue_cents: metric.revenueCents,
        source: "meta",
        ad_set_name: "",
        ad_name: "",
      });
    }
    await addAudit(actor, "meta.sync", null, { campaigns: pulled.campaigns.length, metrics: pulled.metrics.length });
    return { ok: true as const, campaigns: pulled.campaigns.length };
  }
  if (platform === "google") {
    const pulled = await pullGoogleAds({ fetchImpl });
    if (!pulled.ok) {
      await addAudit(actor, "google.sync_failed", null, { error: pulled.error });
      return pulled;
    }
    const ids = new Map<string, string>();
    for (const campaign of pulled.campaigns) {
      const id = await upsertCampaign({
        platform: "google",
        external_id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        objective: "",
        daily_budget_cents: campaign.dailyBudgetCents,
        currency: "USD",
        source: "google",
        raw_json: JSON.stringify({ budgetResource: campaign.budgetResource }),
      });
      ids.set(campaign.id, id);
    }
    for (const metric of pulled.metrics) {
      const campaignId = ids.get(metric.campaignId);
      if (!campaignId) continue;
      await upsertMetric({
        campaign_id: campaignId,
        metric_date: metric.date || "undated",
        impressions: metric.impressions,
        clicks: metric.clicks,
        spend_cents: metric.spendCents,
        conversions: metric.conversions,
        revenue_cents: metric.revenueCents,
        source: "google",
        ad_set_name: "",
        ad_name: "",
      });
    }
    await addAudit(actor, "google.sync", null, { campaigns: pulled.campaigns.length });
    return { ok: true as const, campaigns: pulled.campaigns.length };
  }
  if (!env("TIKTOK_ACCESS_TOKEN") || !env("TIKTOK_ADVERTISER_ID")) return { ok: false as const, error: "TikTok is not connected." };
  const pulled = await pullTikTok({ token: env("TIKTOK_ACCESS_TOKEN"), advertiserId: env("TIKTOK_ADVERTISER_ID"), fetchImpl });
  if (!pulled.ok) {
    await addAudit(actor, "tiktok.sync_failed", null, { error: pulled.error });
    return pulled;
  }
  const ids = new Map<string, string>();
  for (const campaign of pulled.campaigns) {
    const id = await upsertCampaign({
      platform: "tiktok",
      external_id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      objective: "",
      daily_budget_cents: campaign.dailyBudgetCents,
      currency: "USD",
      source: "tiktok",
      raw_json: "{}",
    });
    ids.set(campaign.id, id);
  }
  for (const metric of pulled.metrics) {
    const campaignId = ids.get(metric.campaignId);
    if (!campaignId) continue;
    await upsertMetric({
      campaign_id: campaignId,
      metric_date: metric.date || "undated",
      impressions: metric.impressions,
      clicks: metric.clicks,
      spend_cents: metric.spendCents,
      conversions: metric.conversions,
      revenue_cents: metric.revenueCents,
      source: "tiktok",
      ad_set_name: "",
      ad_name: "",
    });
  }
  await addAudit(actor, "tiktok.sync", null, { campaigns: pulled.campaigns.length });
  return { ok: true as const, campaigns: pulled.campaigns.length };
}

export async function approveCampaign(id: string, action: "pause" | "scale", actor: string, fetchImpl?: FetchLike) {
  const campaign = await getCampaign(id);
  if (!campaign) return { ok: false as const, error: "Campaign not found." };
  if (campaign.source === "demo") return { ok: false as const, error: "Demo rows are not sent to an ad platform." };
  const nextBudget =
    action === "scale" && campaign.daily_budget_cents != null ? Math.round(campaign.daily_budget_cents * 1.2) : campaign.daily_budget_cents;
  if (action === "scale" && campaign.daily_budget_cents == null) {
    return { ok: false as const, error: "This campaign has no daily budget stored, so nothing was scaled." };
  }
  const localNote = "Recorded locally. The ad platform was not called.";
  if (campaign.source === "csv" || campaign.source !== campaign.platform) {
    await setCampaignStatus(id, action === "pause" ? "paused" : campaign.status, action === "scale" ? nextBudget : undefined);
    await addAudit(actor, `ads.${action}.local`, campaign.name, { platform: campaign.platform, note: localNote });
    return { ok: true as const, mode: "local_only" as const, message: localNote };
  }
  const connected =
    (campaign.platform === "meta" && env("META_ACCESS_TOKEN")) ||
    (campaign.platform === "google" && env("GOOGLE_ADS_DEVELOPER_TOKEN") && env("GOOGLE_ADS_CUSTOMER_ID")) ||
    (campaign.platform === "tiktok" && env("TIKTOK_ACCESS_TOKEN") && env("TIKTOK_ADVERTISER_ID"));
  if (!connected) {
    await setCampaignStatus(id, action === "pause" ? "paused" : campaign.status, action === "scale" ? nextBudget : undefined);
    await addAudit(actor, `ads.${action}.local`, campaign.name, { platform: campaign.platform, note: localNote });
    return { ok: true as const, mode: "local_only" as const, message: `${campaign.platform} is not connected. ${localNote}` };
  }
  const result = await callPlatform(campaign.platform, campaign.external_id, action, nextBudget, campaign.raw_json, fetchImpl);
  if (!result.ok) {
    await addAudit(actor, `ads.${action}.failed`, campaign.name, { error: result.error });
    return result;
  }
  await setCampaignStatus(id, action === "pause" ? "paused" : campaign.status, action === "scale" ? nextBudget : undefined);
  await addAudit(actor, `ads.${action}.api`, campaign.name, { platform: campaign.platform });
  return { ok: true as const, mode: "api" as const, message: action === "pause" ? "Pause was sent to the ad platform." : "The new daily budget was sent to the ad platform." };
}

async function callPlatform(platform: string, externalId: string, action: "pause" | "scale", budget: number | null, raw: string, fetchImpl?: FetchLike) {
  if (platform === "meta") {
    const body: Record<string, string> = action === "pause" ? { status: "PAUSED" } : { daily_budget: String(budget ?? 0) };
    return mutateMeta({ token: env("META_ACCESS_TOKEN"), id: externalId, body, fetchImpl });
  }
  if (platform === "tiktok") {
    if (action === "pause") {
      return mutateTikTok({
        token: env("TIKTOK_ACCESS_TOKEN"),
        path: "campaign/status/update/",
        body: { advertiser_id: env("TIKTOK_ADVERTISER_ID"), campaign_ids: [externalId], operation_status: "DISABLE" },
        fetchImpl,
      });
    }
    return mutateTikTok({
      token: env("TIKTOK_ACCESS_TOKEN"),
      path: "campaign/update/",
      body: { advertiser_id: env("TIKTOK_ADVERTISER_ID"), campaign_id: externalId, budget: (budget ?? 0) / 100 },
      fetchImpl,
    });
  }
  const customer = env("GOOGLE_ADS_CUSTOMER_ID").replace(/-/g, "");
  if (action === "pause") {
    return mutateGoogle({
      path: "campaigns:mutate",
      body: {
        operations: [{ update: { resourceName: `customers/${customer}/campaigns/${externalId}`, status: "PAUSED" }, updateMask: "status" }],
      },
      fetchImpl,
    });
  }
  let budgetResource = "";
  try {
    budgetResource = String((JSON.parse(raw) as { budgetResource?: string }).budgetResource ?? "");
  } catch {
    budgetResource = "";
  }
  if (!budgetResource) return { ok: false as const, error: "Google Ads did not return a campaign budget resource, so the budget was not changed." };
  return mutateGoogle({
    path: "campaignBudgets:mutate",
    body: { operations: [{ update: { resourceName: budgetResource, amountMicros: String((budget ?? 0) * 10_000) }, updateMask: "amount_micros" }] },
    fetchImpl,
  });
}

export async function importGa4(actor: string, fetchImpl?: FetchLike) {
  const token = env("GA4_ACCESS_TOKEN") || env("GOOGLE_ADS_ACCESS_TOKEN");
  if (!env("GA4_PROPERTY_ID") || !token) return { ok: false as const, error: "GA4 is not connected." };
  const pulled = await pullGa4({ propertyId: env("GA4_PROPERTY_ID"), token, fetchImpl });
  if (!pulled.ok) return pulled;
  await deleteEventsBySource("ga4");
  for (const row of pulled.rows) {
    const day = row.date.length === 8 ? Date.parse(`${row.date.slice(0, 4)}-${row.date.slice(4, 6)}-${row.date.slice(6, 8)}T00:00:00Z`) : Date.now();
    await insertEvent({
      eventName: row.event,
      anonymousId: null,
      userId: null,
      properties: { count: row.count },
      context: { note: "GA4 aggregate row, not a person." },
      source: "ga4",
      traffic: "import",
      ts: Number.isFinite(day) ? day : Date.now(),
    });
  }
  await addAudit(actor, "ga4.import", env("GA4_PROPERTY_ID"), { rows: pulled.rows.length });
  return { ok: true as const, rows: pulled.rows.length };
}

export async function importMixpanel(actor: string, fetchImpl?: FetchLike) {
  if (!env("MIXPANEL_API_SECRET")) return { ok: false as const, error: "Mixpanel is not connected." };
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 86400000);
  const fmt = (date: Date) => date.toISOString().slice(0, 10);
  const pulled = await pullMixpanel({ secret: env("MIXPANEL_API_SECRET"), from: fmt(start), to: fmt(end), fetchImpl });
  if (!pulled.ok) return pulled;
  await deleteEventsBySource("mixpanel");
  let stored = 0;
  for (const event of pulled.events.slice(0, 2000)) {
    const properties = event.properties ?? {};
    const distinct = properties.distinct_id == null ? null : String(properties.distinct_id);
    const time = typeof properties.time === "number" ? properties.time * 1000 : Date.now();
    await insertEvent({
      eventName: event.event || "event",
      anonymousId: distinct,
      userId: distinct,
      properties,
      context: {},
      source: "mixpanel",
      traffic: "import",
      ts: time,
    });
    stored += 1;
  }
  await addAudit(actor, "mixpanel.import", null, { stored });
  return { ok: true as const, stored };
}
