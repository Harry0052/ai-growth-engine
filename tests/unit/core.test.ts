import { beforeEach, describe, expect, it } from "vitest";
import { clusterTexts } from "@/lib/cluster";
import { commissionCents } from "@/lib/commission";
import { retentionCohorts } from "@/lib/cohorts";
import { parseAdsCsv, parseFeedbackCsv } from "@/lib/csv";
import { clearAllForTests } from "@/lib/db";
import { orderedFunnel } from "@/lib/funnel";
import { sourceBackedHooks } from "@/lib/hooks";
import { pullMeta, sendEmail } from "@/lib/integrations";
import { mulberry32, planVisit } from "@/lib/live-plan";
import { experimentMath } from "@/lib/metrics";
import { buildMemo } from "@/lib/memo";
import { isQuiet } from "@/lib/quiet";
import { judgeCampaign } from "@/lib/recommendations";
import { createAffiliate, ensureTier, getAffiliateByCode, getConversion } from "@/lib/repo";
import { scrub } from "@/lib/scrub";
import { readSession, signSession } from "@/lib/session-token";
import { isStopKeyword, signSvix, verifySvix, signTwilio, verifyTwilio } from "@/lib/signatures";
import { normalCdf, twoProportion } from "@/lib/stats";
import { ingestTrackedEvent } from "@/lib/services/tracking";
import { approveCampaign } from "@/lib/services/ads";
import { upsertCampaign } from "@/lib/repo";
import { DEFAULT_THRESHOLDS } from "@/lib/constants";

beforeEach(async () => {
  await clearAllForTests();
});

describe("stats and recommendations", () => {
  it("reads a familiar z score", () => {
    expect(normalCdf(1.96)).toBeGreaterThan(0.97);
    expect(normalCdf(1.96)).toBeLessThan(0.976);
  });

  it("calls significance only with enough data", () => {
    const small = twoProportion(10, 1, 10, 5);
    expect(small.significant).toBe(false);
    const large = twoProportion(200, 20, 200, 50);
    expect(large.significant).toBe(true);
    expect(large.p2).toBeGreaterThan(large.p1);
  });

  it("kills a spent campaign with no return and scales a healthy one", () => {
    const kill = judgeCampaign({ impressions: 10000, clicks: 100, spendCents: 40000, conversions: 4, revenueCents: 5000 }, DEFAULT_THRESHOLDS);
    expect(kill.verdict).toBe("kill");
    const scale = judgeCampaign({ impressions: 80000, clicks: 2400, spendCents: 50000, conversions: 40, revenueCents: 180000 }, DEFAULT_THRESHOLDS);
    expect(scale.verdict).toBe("scale");
    const thin = judgeCampaign({ impressions: 10, clicks: 1, spendCents: 100, conversions: 0, revenueCents: 0 }, DEFAULT_THRESHOLDS);
    expect(thin.verdict).toBe("insufficient");
  });
});

describe("imports and copy", () => {
  it("parses the three ads export shapes", () => {
    const meta = parseAdsCsv("Campaign name,Ad set name,Ad name,Day,Impressions,Link clicks,Amount spent (USD),Purchases,Purchase conversion value\nProspecting,US,Hook,2026-11-01,1000,50,\"$12.50\",2,40\n");
    expect(meta.platform).toBe("meta");
    expect(meta.rows[0].spendCents).toBe(1250);
    expect(meta.rows[0].revenueCents).toBe(4000);
    const google = parseAdsCsv("Campaign,Ad group,Ad,Day,Impressions,Clicks,Cost,Conversions,Conv. value\nBrand,Exact,RSA,2026-11-01,100,10,8.5,1,20\n");
    expect(google.platform).toBe("google");
    expect(google.rows[0].spendCents).toBe(850);
    const tiktok = parseAdsCsv("Campaign name,Ad group name,Ad name,Date,Impression,Click (destination),Cost,Conversion\nSpark,AG,Ad,2026-11-01,500,20,3.25,1\n");
    expect(tiktok.platform).toBe("tiktok");
  });

  it("parses feedback csv and clusters repeated words", () => {
    const rows = parseFeedbackCsv("body,rating,author\nThe app crashes on login,1,A\nLogin crash again,2,B\nLove the memory,5,C\n");
    expect(rows).toHaveLength(3);
    const clusters = clusterTexts(rows.map((row, index) => ({ id: String(index), text: row.body })));
    expect(clusters.some((cluster) => cluster.name === "login" || cluster.name === "crash")).toBe(true);
  });

  it("quotes a real review instead of inventing one", () => {
    const drafts = sourceBackedHooks({ reviews: [{ text: "It forgets my friends.", rating: 2, author: "Ada", app: "KIN" }] });
    expect(drafts[0].quote).toContain("forgets");
    expect(drafts[0].citation).toContain("Ada");
    expect(drafts[0].hook).toContain("forgets");
  });

  it("leaves empty memo sections empty", () => {
    const memo = buildMemo({ weekLabel: "Nov 19, 2026", gaps: ["Meta ads"] });
    expect(memo).toContain("No live public source");
    expect(memo).toContain("No product traffic");
    expect(memo).toContain("Meta ads");
    expect(memo).not.toMatch(/\$[1-9]/);
  });
});

describe("behavior", () => {
  it("wraps quiet hours around midnight", () => {
    expect(isQuiet(new Date("2026-11-19T06:00:00Z"), "21:00", "08:00", "UTC")).toBe(true);
    expect(isQuiet(new Date("2026-11-19T15:00:00Z"), "21:00", "08:00", "UTC")).toBe(false);
  });

  it("pays the bounty once on top of the rate", () => {
    expect(commissionCents(2000, 2000, 500)).toBe(900);
  });

  it("counts an ordered funnel and a cohort", () => {
    const funnel = orderedFunnel(
      [
        { anonymous_id: "a", event_name: "page_view", ts: 1 },
        { anonymous_id: "a", event_name: "signup", ts: 2 },
        { anonymous_id: "b", event_name: "signup", ts: 2 },
      ],
      ["page_view", "signup"],
    );
    expect(funnel[1].count).toBe(1);
    const cohorts = retentionCohorts([
      { anonymous_id: "a", ts: Date.parse("2026-11-02T00:00:00Z") },
      { anonymous_id: "a", ts: Date.parse("2026-11-10T00:00:00Z") },
    ]);
    expect(cohorts.rows[0].size).toBe(1);
    expect(cohorts.rows[0].rates[0]).toBe(1);
  });

  it("verifies webhook signatures and STOP", () => {
    expect(isStopKeyword(" STOP ")).toBe(true);
    const twilio = signTwilio("token", "https://example.com/sms", { Body: "Hi", From: "+1" });
    expect(verifyTwilio("token", "https://example.com/sms", { From: "+1", Body: "Hi" }, twilio)).toBe(true);
    const secret = `whsec_${Buffer.from("super-secret-key").toString("base64")}`;
    const sig = signSvix(secret, "id", "1700000000", "{}");
    expect(verifySvix(secret, "id", "1700000000", "{}", `v1,${sig}`, 1700000000 * 1000)).toBe(true);
    expect(verifySvix(secret, "id", "1700000000", "{}", "v1,nope", 1700000000 * 1000)).toBe(false);
  });

  it("redacts secrets and round-trips a session", async () => {
    expect(scrub({ token: "abc", name: "Ada" })).toEqual({ token: "[redacted]", name: "Ada" });
    const token = await signSession("user-1", "secret");
    expect((await readSession(token, "secret"))?.uid).toBe("user-1");
    expect(await readSession(token, "other")).toBeNull();
  });
});

describe("integrations and attribution", () => {
  it("shapes a Meta pull and does not call fetch without credentials", async () => {
    const calls: string[] = [];
    const fetchImpl = async (input: string) => {
      calls.push(String(input));
      if (String(input).includes("/campaigns")) return json({ data: [{ id: "1", name: "Prospecting", status: "ACTIVE", daily_budget: "5000" }] });
      if (String(input).includes("/adsets")) return json({ data: [] });
      if (String(input).includes("/ads?")) return json({ data: [] });
      return json({ data: [{ campaign_id: "1", campaign_name: "Prospecting", impressions: "100", clicks: "10", spend: "5.00", date_start: "2026-11-01", actions: [{ action_type: "purchase", value: "1" }], action_values: [{ action_type: "purchase", value: "20" }] }] });
    };
    const pulled = await pullMeta({ token: "secret-token", accountId: "123", fetchImpl: fetchImpl as typeof fetch });
    expect(pulled.ok).toBe(true);
    if (pulled.ok) expect(pulled.metrics[0].revenueCents).toBe(2000);
    expect(calls[0]).toContain("act_123");
    delete process.env.META_ACCESS_TOKEN;
    const id = await upsertCampaign({
      platform: "meta",
      external_id: "1",
      name: "Prospecting",
      status: "ACTIVE",
      objective: "",
      daily_budget_cents: 5000,
      currency: "USD",
      source: "meta",
      raw_json: "{}",
    });
    const local = await approveCampaign(id, "pause", "tester", fetchImpl as typeof fetch);
    expect(local.ok).toBe(true);
    if (local.ok) expect(local.mode).toBe("local_only");
    process.env.META_ACCESS_TOKEN = "secret-token";
    const remoteCalls: Array<{ url: string; body: string }> = [];
    const remote = async (input: string, init?: RequestInit) => {
      remoteCalls.push({ url: String(input), body: String(init?.body ?? "") });
      return json({ success: true });
    };
    const sent = await approveCampaign(id, "pause", "tester", remote as typeof fetch);
    expect(sent.ok && sent.mode).toBe("api");
    expect(remoteCalls[0].url).toContain("/1");
    expect(remoteCalls[0].body).toContain("PAUSED");
    delete process.env.META_ACCESS_TOKEN;
  });

  it("does not send email without a provider", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.SENDGRID_API_KEY;
    const result = await sendEmail({ to: "a@example.com", subject: "Hi", text: "Hi" });
    expect(result.ok).toBe(false);
  });

  it("attributes a product purchase and keeps test commission unpaid", async () => {
    const tier = await ensureTier("Standard", 2000, 0);
    await createAffiliate({ name: "Ada", code: "ada", tierId: tier.id });
    await ingestTrackedEvent({
      event: "purchase",
      anonymousId: "person-1",
      userId: null,
      properties: { revenue: 20, ref: "ada" },
      context: { ref: "ada" },
      source: "first-party",
      traffic: "product",
    });
    const affiliate = await getAffiliateByCode("ADA");
    const paid = await getConversion(affiliate!.id, "person-1");
    expect(paid?.commission_cents).toBe(400);
    expect(paid?.status).toBe("pending");
    await ingestTrackedEvent({
      event: "purchase",
      anonymousId: "person-2",
      userId: null,
      properties: { revenue: 20, ref: "ada" },
      context: { ref: "ada" },
      source: "first-party",
      traffic: "live-test",
    });
    const test = await getConversion(paid!.affiliate_id, "person-2");
    expect(test?.status).toBe("test");
  });

  it("gives the scripted test a real difference", () => {
    const random = mulberry32(20261119);
    const events = { A: [] as Array<{ anonymousId: string; name: string; variant: "A" | "B"; traffic: "live-test" }>, B: [] as Array<{ anonymousId: string; name: string; variant: "A" | "B"; traffic: "live-test" }> };
    for (let i = 0; i < 240; i += 1) {
      const variant = i % 2 === 0 ? "A" : "B";
      for (const name of planVisit(random, variant)) {
        events[variant].push({ anonymousId: `p${i}`, name, variant, traffic: "live-test" });
      }
    }
    const math = experimentMath([...events.A, ...events.B], "signup", "live-test");
    expect(math.visitsA).toBe(120);
    expect(math.visitsB).toBe(120);
    expect(math.conversionsB).toBeGreaterThan(math.conversionsA);
    expect(math.result.significant).toBe(true);
  });
});

function json(data: unknown) {
  return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
}
