import { addAudit, addFeedback, deleteDemo, setSetting, upsertCampaign, upsertMetric } from "./repo";

export async function applyDemoMode(on: boolean, actor: string) {
  await deleteDemo();
  if (!on) {
    await setSetting("demo_mode", "0");
    await addAudit(actor, "demo.disabled", null, {});
    return;
  }
  const prospecting = await upsertCampaign({
    platform: "meta",
    external_id: "example-prospecting",
    name: "EXAMPLE — Prospecting",
    status: "ACTIVE",
    objective: "OUTCOME_SALES",
    daily_budget_cents: 5000,
    currency: "USD",
    source: "demo",
    raw_json: JSON.stringify({ note: "Sample row. Not an ad account." }),
  });
  const broad = await upsertCampaign({
    platform: "meta",
    external_id: "example-broad",
    name: "EXAMPLE — Broad",
    status: "ACTIVE",
    objective: "OUTCOME_SALES",
    daily_budget_cents: 4000,
    currency: "USD",
    source: "demo",
    raw_json: "{}",
  });
  const spark = await upsertCampaign({
    platform: "tiktok",
    external_id: "example-spark",
    name: "EXAMPLE — Spark",
    status: "ENABLE",
    objective: "",
    daily_budget_cents: 2000,
    currency: "USD",
    source: "demo",
    raw_json: "{}",
  });
  const brand = await upsertCampaign({
    platform: "google",
    external_id: "example-brand",
    name: "EXAMPLE — Brand",
    status: "ENABLED",
    objective: "SEARCH",
    daily_budget_cents: 3000,
    currency: "USD",
    source: "demo",
    raw_json: "{}",
  });
  const rows = [
    [prospecting, 80_000, 2400, 50_000, 40, 180_000],
    [broad, 60_000, 300, 40_000, 4, 5_000],
    [spark, 400, 12, 1_500, 0, 0],
    [brand, 5_000, 200, 8_000, 10, 9_000],
  ] as const;
  for (const [campaignId, impressions, clicks, spend, conversions, revenue] of rows) {
    await upsertMetric({
      campaign_id: campaignId,
      metric_date: "2026-11-01",
      impressions,
      clicks,
      spend_cents: spend,
      conversions,
      revenue_cents: revenue,
      source: "demo",
      ad_set_name: "",
      ad_name: "",
    });
  }
  await addFeedback({
    source: "demo",
    body: "EXAMPLE — the sample import is not a real review. Turn demo mode off to hide it.",
    rating: 2,
    author: "sample",
  });
  await setSetting("demo_mode", "1");
  await addAudit(actor, "demo.enabled", null, { note: "Sample rows only. Not real results." });
}
