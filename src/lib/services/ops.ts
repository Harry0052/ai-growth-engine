import { clusterTexts } from "../cluster";
import { featureGapMarkdown } from "../feature-gap";
import { sourceBackedHooks } from "../hooks";
import { buildMemo } from "../memo";
import { env } from "../env";
import { generateText, integrationFlags, probeOllama, pullGa4, pullGoogleAds, pullMeta, pullMixpanel, pullTikTok, stripeTransfer, type FetchLike } from "../integrations";
import { experimentMath } from "../metrics";
import { csvCell } from "../format";
import { mentionCounts } from "../cluster";
import {
  addAudit,
  addFeedback,
  addReport,
  createPayout,
  getAffiliate,
  latestSnapshot,
  listAffiliates,
  listClicks,
  listConversions,
  listFeedback,
  listPayouts,
  listTiers,
  markPayout,
  setFeedbackTheme,
  updatePassword,
} from "../repo";
import { hashPassword, verifyPassword } from "../password";
import { productSnapshot } from "../read";
import { mapEvents } from "../read";
import { listEvents } from "../repo";

export async function payableConversions(affiliateId: string) {
  return (await listConversions()).filter((row) => row.affiliate_id === affiliateId && row.status === "pending");
}

export async function approvePayout(affiliateId: string, method: "stripe" | "manual", actor: string, fetchImpl?: FetchLike) {
  const affiliate = await getAffiliate(affiliateId);
  if (!affiliate) return { ok: false as const, error: "Affiliate not found." };
  const rows = await payableConversions(affiliateId);
  const amount = rows.reduce((sum, row) => sum + Number(row.commission_cents), 0);
  if (!rows.length || amount <= 0) return { ok: false as const, error: "No payable commission. Labeled test conversions are excluded." };
  if (method === "stripe") {
    if (!env("STRIPE_SECRET_KEY")) return { ok: false as const, error: "Stripe is not connected." };
    if (!affiliate.stripe_account_id) return { ok: false as const, error: "This affiliate has no Stripe account id." };
    const transfer = await stripeTransfer({ amountCents: amount, destination: affiliate.stripe_account_id, fetchImpl });
    if (!transfer.ok) {
      await addAudit(actor, "stripe.payout_failed", affiliate.code, { error: transfer.error });
      return transfer;
    }
    await createPayout({ affiliateId, amountCents: amount, status: "paid", method: "stripe", note: "Approved Stripe transfer", conversionIds: rows.map((row) => row.id), externalId: transfer.id });
    await addAudit(actor, "stripe.payout", affiliate.code, { amountCents: amount, transfer: transfer.id });
    return { ok: true as const, message: "Stripe transfer sent." };
  }
  await createPayout({ affiliateId, amountCents: amount, status: "approved_manual", method: "manual", note: "Approved for manual payment. No money was moved.", conversionIds: rows.map((row) => row.id) });
  await addAudit(actor, "payout.manual_approved", affiliate.code, { amountCents: amount });
  return { ok: true as const, message: "Marked approved for manual payment. Download the CSV. Nothing was sent to a bank." };
}

export async function markPaid(payoutId: string, actor: string) {
  await markPayout(payoutId, "paid");
  await addAudit(actor, "payout.marked_paid", payoutId, { note: "Manual mark. Growth Engine did not move money." });
}

export function payoutCsv(rows: Array<{ affiliate: string; email: string; amountCents: number; status: string; conversions: number }>) {
  const header = ["affiliate", "email", "amount_cents", "status", "conversions"];
  const lines = rows.map((row) => [row.affiliate, row.email, String(row.amountCents), row.status, String(row.conversions)].map(csvCell).join(","));
  return [header.join(","), ...lines].join("\n");
}

export async function clusterFeedback(actor: string) {
  const items = (await listFeedback()).filter((item) => item.source !== "demo");
  const clusters = clusterTexts(items.map((item) => ({ id: item.id, text: item.body })));
  const themeOf = new Map<string, string>();
  for (const cluster of clusters) for (const id of cluster.ids) themeOf.set(id, cluster.name);
  for (const item of items) await setFeedbackTheme(item.id, themeOf.get(item.id) ?? "");
  await addAudit(actor, "feedback.cluster", null, { method: "keyword", themes: clusters.length, items: items.length });
  return clusters;
}

export async function saveReviewFeedback(actor: string) {
  const snap = await latestSnapshot("itunes", true);
  const payload = (snap?.payload ?? {}) as { apps?: Array<{ name?: string }>; reviews?: Array<{ title?: string; body?: string; rating?: number | null; author?: string }> };
  const reviews = payload.reviews ?? [];
  let saved = 0;
  for (const review of reviews) {
    const body = [review.title, review.body].filter(Boolean).join(" — ");
    if (!body) continue;
    const id = await addFeedback({ source: "app-store", body, rating: review.rating, author: review.author });
    if (id) saved += 1;
  }
  await addAudit(actor, "feedback.reviews_saved", payload.apps?.[0]?.name ?? "", { reviews: reviews.length });
  return { saved, app: payload.apps?.[0]?.name ?? "" };
}

export async function writeFeatureGap(actor: string) {
  const snap = await latestSnapshot("itunes", true);
  if (!snap) return { ok: false as const, error: "Pull Apple reviews first." };
  const payload = snap.payload as { apps?: Array<{ name?: string }>; reviews?: Array<{ id?: string; title?: string; body?: string; rating?: number | null }> };
  const reviews = payload.reviews ?? [];
  const low = reviews.filter((review) => (review.rating ?? 5) <= 3);
  const used = low.length ? low : reviews;
  const clusters = clusterTexts(used.map((review, index) => ({ id: review.id || String(index), text: [review.title, review.body].filter(Boolean).join(" — ") })));
  const app = payload.apps?.[0]?.name || snap.query;
  const body = featureGapMarkdown(app, used.length, clusters);
  const id = await addReport({ kind: "feature-gap", title: `Feature gap · ${app}`, body, model: "" });
  await addAudit(actor, "report.feature_gap", app, { id, clusters: clusters.length });
  return { ok: true as const, id, body };
}

export async function draftsFromSnapshots() {
  const itunes = await latestSnapshot("itunes", true);
  const hn = await latestSnapshot("hn", true);
  const reviews = ((itunes?.payload as { reviews?: Array<{ title?: string; body?: string; rating?: number | null; author?: string }>; apps?: Array<{ name?: string }> })?.reviews ?? []).map((review) => ({
    text: [review.title, review.body].filter(Boolean).join(" — "),
    rating: review.rating,
    author: review.author,
    app: (itunes?.payload as { apps?: Array<{ name?: string }> }).apps?.[0]?.name,
  }));
  const stories = ((hn?.payload as { stories?: Array<{ title?: string; points?: number | null }> })?.stories ?? []).flatMap((story) =>
    story.title ? [{ title: story.title, points: story.points ?? null }] : [],
  );
  const terms = mentionCounts([...reviews.map((review) => review.text), ...stories.map((story) => story.title)]).map((item) => item.term);
  return sourceBackedHooks({ reviews, stories, terms });
}

export async function rewriteHooks(actor: string, fetchImpl?: FetchLike) {
  const drafts = await draftsFromSnapshots();
  if (!drafts.length) return { ok: false as const, error: "Pull live sources before asking a model to rewrite." };
  const prompt = `Rewrite these sourced lines into 5 ad hooks. Use only the quotes given. Do not invent statistics, star ratings, or quotes.\n\n${drafts.map((draft, index) => `${index + 1}. ${draft.quote}\nSource: ${draft.citation}`).join("\n")}`;
  const result = await generateText(prompt, fetchImpl);
  if (!result.ok) return result;
  await addReport({ kind: "hooks", title: "Model rewrite", body: result.text, model: `${result.provider}:${result.model}` });
  await addAudit(actor, "creative.rewrite", result.model, { provider: result.provider });
  return { ok: true as const, text: result.text, provider: result.provider, model: result.model, message: `Written by ${result.provider} / ${result.model}.` };
}

export async function writeMemo(actor: string, fetchImpl?: FetchLike) {
  const itunes = await latestSnapshot("itunes", true);
  const wiki = await latestSnapshot("wiki", true);
  const hn = await latestSnapshot("hn", true);
  const reviews = (itunes?.payload as { reviews?: Array<{ title?: string; body?: string; rating?: number | null }>; apps?: Array<{ name?: string }> } | undefined)?.reviews ?? [];
  const low = reviews.filter((review) => (review.rating ?? 5) <= 3);
  const clusters = clusterTexts((low.length ? low : reviews).map((review, index) => ({ id: String(index), text: [review.title, review.body].filter(Boolean).join(" ") })));
  const points = (wiki?.payload as { points?: Array<{ views: number }> } | undefined)?.points ?? [];
  const last7 = points.slice(-7).reduce((sum, point) => sum + point.views, 0);
  const prior7 = points.slice(-14, -7).reduce((sum, point) => sum + point.views, 0);
  const stories = ((hn?.payload as { stories?: Array<{ title: string; points: number | null }> } | undefined)?.stories ?? []).slice(0, 5);
  const events = mapEvents(await listEvents("traffic = ?", ["live-test"], 20000));
  const math = experimentMath(events, "signup", "live-test");
  const clicks = await listClicks();
  const conversions = await listConversions();
  const testClicks = clicks.filter((click) => click.traffic === "live-test").length;
  const testConversions = conversions.filter((row) => row.traffic !== "product");
  const product = await productSnapshot();
  const flags = integrationFlags();
  const gaps = [
    !flags.meta && "Meta ads",
    !flags.google && "Google Ads",
    !flags.tiktok && "TikTok ads",
    !flags.ga4 && "GA4",
    !flags.mixpanel && "Mixpanel",
    !(flags.resend || flags.sendgrid) && "Email provider",
    !flags.twilio && "Twilio SMS",
    !flags.stripe && "Stripe",
    !(flags.openai || flags.anthropic) && "Hosted model key (Ollama still counts if it is running)",
  ].filter((gap): gap is string => Boolean(gap));
  const feedback = (await listFeedback()).filter((item) => item.source !== "demo");
  const themes = new Map<string, number>();
  for (const item of feedback) if (item.theme) themes.set(item.theme, (themes.get(item.theme) ?? 0) + 1);
  const memo = buildMemo({
    weekLabel: new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date()),
    reviews: reviews.length
      ? {
          app: (itunes?.payload as { apps?: Array<{ name?: string }> }).apps?.[0]?.name || itunes?.query || "App",
          count: reviews.length,
          themes: clusters.slice(0, 5).map((cluster) => ({ name: cluster.name, count: cluster.count, quote: cluster.examples[0]?.slice(0, 140) })),
        }
      : undefined,
    attention: points.length
      ? { article: wiki?.query || "Wikipedia", last7: points.length >= 7 ? last7 : null, prior7: points.length >= 14 ? prior7 : null, days: points.length }
      : undefined,
    stories,
    experiment: math.visitsA + math.visitsB > 0 ? { ...math, traffic: "Labeled test traffic", result: math.result } : null,
    affiliate: testClicks
      ? {
          code: "LIVETEST",
          clicks: testClicks,
          conversions: testConversions.length,
          commissionCents: testConversions.reduce((sum, row) => sum + Number(row.commission_cents), 0),
          traffic: "labeled test traffic, not payable",
        }
      : null,
    productFunnel: product.funnel,
    feedbackThemes: [...themes.entries()].map(([name, count]) => ({ name, count })),
    gaps,
  });
  const llm = await generateText(
    `Write a 160 word growth memo narrative using ONLY the figures and quotes in the source. If a number is not in the source, do not invent it. Do not call test traffic customers.\n\nSOURCE:\n${memo}`,
    fetchImpl,
  );
  const narrative = llm.ok
    ? `## Narrative · ${llm.provider} / ${llm.model}\n\n${llm.text}\n\nModel text can be wrong. The sections above are the source of truth.`
    : `## Narrative\n\nNo narrative was written. ${llm.error}`;
  const body = `${memo}\n\n${narrative}`;
  const id = await addReport({ kind: "memo", title: "Weekly growth memo", body, model: llm.ok ? `${llm.provider}:${llm.model}` : "" });
  await addAudit(actor, "report.memo", id, { model: llm.ok ? llm.model : "none" });
  return { ok: true as const, id, body, model: llm.ok ? `${llm.provider} / ${llm.model}` : "" };
}

export async function testConnection(id: string, actor: string, fetchImpl?: FetchLike) {
  try {
    if (id === "meta") {
      if (!env("META_ACCESS_TOKEN") || !env("META_AD_ACCOUNT_ID")) return { ok: false as const, error: "Meta env vars are missing." };
      const result = await pullMeta({ token: env("META_ACCESS_TOKEN"), accountId: env("META_AD_ACCOUNT_ID"), fetchImpl });
      await addAudit(actor, "meta.test", null, { ok: result.ok });
      return result.ok ? { ok: true as const, message: `Meta returned ${result.campaigns.length} campaigns.` } : result;
    }
    if (id === "google") {
      const result = await pullGoogleAds({ fetchImpl });
      await addAudit(actor, "google.test", null, { ok: result.ok });
      return result.ok ? { ok: true as const, message: `Google Ads returned ${result.campaigns.length} campaigns.` } : result;
    }
    if (id === "tiktok") {
      if (!env("TIKTOK_ACCESS_TOKEN")) return { ok: false as const, error: "TikTok env vars are missing." };
      const result = await pullTikTok({ token: env("TIKTOK_ACCESS_TOKEN"), advertiserId: env("TIKTOK_ADVERTISER_ID"), fetchImpl });
      await addAudit(actor, "tiktok.test", null, { ok: result.ok });
      return result.ok ? { ok: true as const, message: `TikTok returned ${result.campaigns.length} campaigns.` } : result;
    }
    if (id === "ga4") {
      const result = await pullGa4({ propertyId: env("GA4_PROPERTY_ID"), token: env("GA4_ACCESS_TOKEN") || env("GOOGLE_ADS_ACCESS_TOKEN"), fetchImpl });
      await addAudit(actor, "ga4.test", null, { ok: result.ok });
      return result.ok ? { ok: true as const, message: `GA4 returned ${result.rows.length} rows.` } : result;
    }
    if (id === "mixpanel") {
      const day = new Date().toISOString().slice(0, 10);
      const result = await pullMixpanel({ secret: env("MIXPANEL_API_SECRET"), from: day, to: day, fetchImpl });
      await addAudit(actor, "mixpanel.test", null, { ok: result.ok });
      return result.ok ? { ok: true as const, message: "Mixpanel export responded." } : result;
    }
    if (id === "ollama") {
      const result = await probeOllama(fetchImpl);
      await addAudit(actor, "ollama.test", null, { ok: result.ok });
      return result.ok ? { ok: true as const, message: `Ollama model ${result.model} is available.` } : result;
    }
    return { ok: false as const, error: "Unknown integration." };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Connection test failed." };
  }
}

export async function changePassword(userId: string, current: string, next: string, actor: string) {
  const { getUserById } = await import("../repo");
  const user = await getUserById(userId);
  if (!user || !verifyPassword(current, user.password_hash)) return { ok: false as const, error: "Current password does not match." };
  if (next.length < 8) return { ok: false as const, error: "Use at least 8 characters." };
  await updatePassword(userId, hashPassword(next));
  await addAudit(actor, "auth.password", actor, {});
  return { ok: true as const };
}

export async function affiliateBoard() {
  const [affiliates, tiers, clicks, conversions, payouts] = await Promise.all([
    listAffiliates(),
    listTiers(),
    listClicks(),
    listConversions(),
    listPayouts(),
  ]);
  const rows = affiliates.map((affiliate) => {
    const mineClicks = clicks.filter((click) => click.affiliate_id === affiliate.id);
    const mineConversions = conversions.filter((conversion) => conversion.affiliate_id === affiliate.id);
    const tier = tiers.find((item) => item.id === affiliate.tier_id);
    return { affiliate, tier, clicks: mineClicks, conversions: mineConversions };
  });
  return { rows, payouts, tiers };
}
