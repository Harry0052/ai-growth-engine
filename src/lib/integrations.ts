import { stripSecret } from "./scrub";
import { env } from "./env";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type JsonResult = { ok: true; status: number; json: Record<string, unknown>; text: string } | { ok: false; status: number; error: string; json: Record<string, unknown> | null };

async function asJson(res: Response, secret?: string): Promise<JsonResult> {
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    json = null;
  }
  if (!res.ok) return { ok: false, status: res.status, error: stripSecret(text || res.statusText, secret), json };
  return { ok: true, status: res.status, json: json ?? {}, text };
}

async function paged(url: string, headers: HeadersInit, fetchImpl: FetchLike, secret?: string) {
  const rows: Record<string, unknown>[] = [];
  let next: string | null = url;
  for (let page = 0; page < 5 && next; page += 1) {
    const res = await asJson(await fetchImpl(next, { headers }), secret);
    if (!res.ok) return res;
    const data = Array.isArray(res.json.data) ? (res.json.data as Record<string, unknown>[]) : [];
    rows.push(...data);
    const paging = res.json.paging as { next?: string } | undefined;
    next = paging?.next ?? null;
  }
  return { ok: true as const, rows };
}

function num(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function purchase(actions: unknown, values: unknown) {
  const list = Array.isArray(actions) ? actions : [];
  const valueList = Array.isArray(values) ? values : [];
  const action = list.find((item) => String((item as { action_type?: string }).action_type ?? "").includes("purchase")) as
    | { value?: string }
    | undefined;
  const value = valueList.find((item) => String((item as { action_type?: string }).action_type ?? "").includes("purchase")) as
    | { value?: string }
    | undefined;
  return { conversions: num(action?.value), revenue: num(value?.value) };
}

export async function pullMeta(opts: { token: string; accountId: string; version?: string; fetchImpl?: FetchLike }) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const version = opts.version || env("META_GRAPH_VERSION") || "v21.0";
  const account = opts.accountId.replace(/^act_/, "");
  const headers = { Authorization: `Bearer ${opts.token}` };
  const base = `https://graph.facebook.com/${version}/act_${account}`;
  const campaigns = await paged(`${base}/campaigns?fields=id,name,status,objective,daily_budget&limit=100`, headers, fetchImpl, opts.token);
  if (!campaigns.ok) return { ok: false as const, error: campaigns.error };
  const adsets = await paged(`${base}/adsets?fields=id,name,status,campaign_id,targeting&limit=100`, headers, fetchImpl, opts.token);
  if (!adsets.ok) return { ok: false as const, error: adsets.error };
  const ads = await paged(`${base}/ads?fields=id,name,status,adset_id,campaign_id&limit=100`, headers, fetchImpl, opts.token);
  if (!ads.ok) return { ok: false as const, error: ads.error };
  const insights = await paged(
    `${base}/insights?level=campaign&date_preset=last_30d&time_increment=1&fields=campaign_id,campaign_name,impressions,clicks,spend,actions,action_values,date_start&limit=200`,
    headers,
    fetchImpl,
    opts.token,
  );
  if (!insights.ok) return { ok: false as const, error: insights.error };
  return {
    ok: true as const,
    campaigns: campaigns.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name ?? "Untitled"),
      status: String(row.status ?? "UNKNOWN"),
      objective: String(row.objective ?? ""),
      dailyBudgetCents: row.daily_budget == null ? null : Math.round(num(row.daily_budget)),
    })),
    adsets: adsets.rows.map((row) => ({
      id: String(row.id),
      campaignId: String(row.campaign_id ?? ""),
      name: String(row.name ?? "Ad set"),
      status: String(row.status ?? ""),
      targeting: row.targeting ?? {},
    })),
    ads: ads.rows.map((row) => ({
      id: String(row.id),
      campaignId: String(row.campaign_id ?? ""),
      adsetId: String(row.adset_id ?? ""),
      name: String(row.name ?? "Ad"),
      status: String(row.status ?? ""),
    })),
    metrics: insights.rows.map((row) => {
      const bought = purchase(row.actions, row.action_values);
      return {
        campaignId: String(row.campaign_id ?? ""),
        name: String(row.campaign_name ?? ""),
        date: String(row.date_start ?? ""),
        impressions: Math.round(num(row.impressions)),
        clicks: Math.round(num(row.clicks)),
        spendCents: Math.round(num(row.spend) * 100),
        conversions: bought.conversions,
        revenueCents: Math.round(bought.revenue * 100),
      };
    }),
  };
}

export async function mutateMeta(opts: { token: string; id: string; body: Record<string, string>; version?: string; fetchImpl?: FetchLike }) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const version = opts.version || env("META_GRAPH_VERSION") || "v21.0";
  const res = await asJson(
    await fetchImpl(`https://graph.facebook.com/${version}/${opts.id}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.token}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(opts.body),
    }),
    opts.token,
  );
  if (!res.ok) return { ok: false as const, error: res.error };
  return { ok: true as const };
}

export async function googleAccessToken(fetchImpl: FetchLike = fetch) {
  if (env("GOOGLE_ADS_ACCESS_TOKEN")) return { ok: true as const, token: env("GOOGLE_ADS_ACCESS_TOKEN") };
  if (!env("GOOGLE_ADS_CLIENT_ID") || !env("GOOGLE_ADS_CLIENT_SECRET") || !env("GOOGLE_ADS_REFRESH_TOKEN")) {
    return { ok: false as const, error: "Google Ads needs an access token or a refresh-token set." };
  }
  const res = await asJson(
    await fetchImpl("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env("GOOGLE_ADS_CLIENT_ID"),
        client_secret: env("GOOGLE_ADS_CLIENT_SECRET"),
        refresh_token: env("GOOGLE_ADS_REFRESH_TOKEN"),
        grant_type: "refresh_token",
      }),
    }),
    env("GOOGLE_ADS_CLIENT_SECRET"),
  );
  if (!res.ok) return { ok: false as const, error: res.error };
  const token = String(res.json.access_token ?? "");
  if (!token) return { ok: false as const, error: "Google token response had no access_token." };
  return { ok: true as const, token };
}

export function googleConfigured() {
  return Boolean(env("GOOGLE_ADS_DEVELOPER_TOKEN") && env("GOOGLE_ADS_CUSTOMER_ID") && (env("GOOGLE_ADS_ACCESS_TOKEN") || (env("GOOGLE_ADS_CLIENT_ID") && env("GOOGLE_ADS_CLIENT_SECRET") && env("GOOGLE_ADS_REFRESH_TOKEN"))));
}

export async function pullGoogleAds(opts: { fetchImpl?: FetchLike } = {}) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const token = await googleAccessToken(fetchImpl);
  if (!token.ok) return token;
  const version = env("GOOGLE_ADS_API_VERSION") || "v18";
  const customer = env("GOOGLE_ADS_CUSTOMER_ID").replace(/-/g, "");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token.token}`,
    "developer-token": env("GOOGLE_ADS_DEVELOPER_TOKEN"),
    "Content-Type": "application/json",
  };
  if (env("GOOGLE_ADS_LOGIN_CUSTOMER_ID")) headers["login-customer-id"] = env("GOOGLE_ADS_LOGIN_CUSTOMER_ID").replace(/-/g, "");
  const query = `SELECT campaign.id, campaign.name, campaign.status, campaign_budget.amount_micros, campaign_budget.resource_name, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value, segments.date FROM campaign WHERE segments.date DURING LAST_30_DAYS`;
  const res = await asJson(
    await fetchImpl(`https://googleads.googleapis.com/${version}/customers/${customer}/googleAds:searchStream`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query }),
    }),
    env("GOOGLE_ADS_DEVELOPER_TOKEN"),
  );
  if (!res.ok) return { ok: false as const, error: res.error };
  const batches = Array.isArray(res.json) ? (res.json as unknown[]) : [res.json];
  const rows: Record<string, unknown>[] = [];
  for (const batch of batches) {
    const results = (batch as { results?: Record<string, unknown>[] }).results ?? [];
    rows.push(...results);
  }
  const campaigns = new Map<string, { id: string; name: string; status: string; dailyBudgetCents: number | null; budgetResource: string }>();
  const metrics = rows.map((row) => {
    const campaign = (row.campaign ?? {}) as Record<string, unknown>;
    const budget = (row.campaignBudget ?? {}) as Record<string, unknown>;
    const metric = (row.metrics ?? {}) as Record<string, unknown>;
    const segment = (row.segments ?? {}) as Record<string, unknown>;
    const id = String(campaign.id ?? "");
    const amount = budget.amountMicros == null ? null : Math.round(num(budget.amountMicros) / 10_000);
    campaigns.set(id, {
      id,
      name: String(campaign.name ?? "Untitled"),
      status: String(campaign.status ?? "UNKNOWN"),
      dailyBudgetCents: amount,
      budgetResource: String(budget.resourceName ?? ""),
    });
    return {
      campaignId: id,
      date: String(segment.date ?? ""),
      impressions: Math.round(num(metric.impressions)),
      clicks: Math.round(num(metric.clicks)),
      spendCents: Math.round(num(metric.costMicros) / 10_000),
      conversions: num(metric.conversions),
      revenueCents: Math.round(num(metric.conversionsValue) * 100),
    };
  });
  return { ok: true as const, campaigns: [...campaigns.values()], metrics, customer };
}

export async function mutateGoogle(opts: { path: string; body: unknown; fetchImpl?: FetchLike }) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const token = await googleAccessToken(fetchImpl);
  if (!token.ok) return token;
  const version = env("GOOGLE_ADS_API_VERSION") || "v18";
  const customer = env("GOOGLE_ADS_CUSTOMER_ID").replace(/-/g, "");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token.token}`,
    "developer-token": env("GOOGLE_ADS_DEVELOPER_TOKEN"),
    "Content-Type": "application/json",
  };
  if (env("GOOGLE_ADS_LOGIN_CUSTOMER_ID")) headers["login-customer-id"] = env("GOOGLE_ADS_LOGIN_CUSTOMER_ID").replace(/-/g, "");
  const res = await asJson(
    await fetchImpl(`https://googleads.googleapis.com/${version}/customers/${customer}/${opts.path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(opts.body),
    }),
    env("GOOGLE_ADS_DEVELOPER_TOKEN"),
  );
  if (!res.ok) return { ok: false as const, error: res.error };
  return { ok: true as const };
}

export async function pullTikTok(opts: { token: string; advertiserId: string; fetchImpl?: FetchLike }) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const headers = { "Access-Token": opts.token, "Content-Type": "application/json" };
  const campaigns = await asJson(
    await fetchImpl(`https://business-api.tiktok.com/open_api/v1.3/campaign/get/?advertiser_id=${encodeURIComponent(opts.advertiserId)}&page_size=100`, { headers }),
    opts.token,
  );
  if (!campaigns.ok) return { ok: false as const, error: campaigns.error };
  if (Number(campaigns.json.code ?? 0) !== 0) return { ok: false as const, error: stripSecret(JSON.stringify(campaigns.json), opts.token) };
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 86400000);
  const fmt = (date: Date) => date.toISOString().slice(0, 10);
  const report = await asJson(
    await fetchImpl("https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/", {
      method: "POST",
      headers,
      body: JSON.stringify({
        advertiser_id: opts.advertiserId,
        report_type: "BASIC",
        data_level: "AUCTION_CAMPAIGN",
        dimensions: ["campaign_id", "stat_time_day"],
        metrics: ["spend", "impressions", "clicks", "conversion", "complete_payment"],
        start_date: fmt(start),
        end_date: fmt(end),
        page_size: 200,
      }),
    }),
    opts.token,
  );
  if (!report.ok) return { ok: false as const, error: report.error };
  if (Number(report.json.code ?? 0) !== 0) return { ok: false as const, error: stripSecret(JSON.stringify(report.json), opts.token) };
  const list = ((campaigns.json.data as { list?: Record<string, unknown>[] } | undefined)?.list ?? []) as Record<string, unknown>[];
  const reportList = ((report.json.data as { list?: Record<string, unknown>[] } | undefined)?.list ?? []) as Record<string, unknown>[];
  return {
    ok: true as const,
    campaigns: list.map((row) => ({
      id: String(row.campaign_id ?? ""),
      name: String(row.campaign_name ?? "Untitled"),
      status: String(row.operation_status ?? row.secondary_status ?? "UNKNOWN"),
      dailyBudgetCents: row.budget == null ? null : Math.round(num(row.budget) * 100),
    })),
    metrics: reportList.map((row) => {
      const dimensions = (row.dimensions ?? {}) as Record<string, unknown>;
      const metrics = (row.metrics ?? {}) as Record<string, unknown>;
      return {
        campaignId: String(dimensions.campaign_id ?? ""),
        date: String(dimensions.stat_time_day ?? "").slice(0, 10),
        impressions: Math.round(num(metrics.impressions)),
        clicks: Math.round(num(metrics.clicks)),
        spendCents: Math.round(num(metrics.spend) * 100),
        conversions: num(metrics.conversion),
        revenueCents: Math.round(num(metrics.complete_payment) * 100),
      };
    }),
  };
}

export async function mutateTikTok(opts: { token: string; path: string; body: unknown; fetchImpl?: FetchLike }) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const res = await asJson(
    await fetchImpl(`https://business-api.tiktok.com/open_api/v1.3/${opts.path}`, {
      method: "POST",
      headers: { "Access-Token": opts.token, "Content-Type": "application/json" },
      body: JSON.stringify(opts.body),
    }),
    opts.token,
  );
  if (!res.ok) return { ok: false as const, error: res.error };
  const code = Number(res.json.code ?? 0);
  if (code !== 0) return { ok: false as const, error: stripSecret(JSON.stringify(res.json), opts.token) };
  return { ok: true as const };
}

export async function pullGa4(opts: { propertyId: string; token: string; fetchImpl?: FetchLike }) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const res = await asJson(
    await fetchImpl(`https://analyticsdata.googleapis.com/v1beta/properties/${opts.propertyId}:runReport`, {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
        dimensions: [{ name: "eventName" }, { name: "date" }],
        metrics: [{ name: "eventCount" }],
        limit: 500,
      }),
    }),
    opts.token,
  );
  if (!res.ok) return { ok: false as const, error: res.error };
  const rows = Array.isArray(res.json.rows) ? (res.json.rows as Record<string, unknown>[]) : [];
  return {
    ok: true as const,
    rows: rows.map((row) => {
      const dims = (row.dimensionValues as Array<{ value?: string }> | undefined) ?? [];
      const metrics = (row.metricValues as Array<{ value?: string }> | undefined) ?? [];
      return { event: dims[0]?.value ?? "event", date: dims[1]?.value ?? "", count: Math.round(num(metrics[0]?.value)) };
    }),
  };
}

export async function pullMixpanel(opts: { secret: string; from: string; to: string; fetchImpl?: FetchLike }) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const auth = Buffer.from(`${opts.secret}:`).toString("base64");
  const res = await fetchImpl(`https://data.mixpanel.com/api/2.0/export?from_date=${opts.from}&to_date=${opts.to}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const text = await res.text();
  if (!res.ok) return { ok: false as const, error: stripSecret(text, opts.secret) };
  const events = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as { event?: string; properties?: Record<string, unknown> };
      } catch {
        return null;
      }
    })
    .filter((row): row is { event?: string; properties?: Record<string, unknown> } => Boolean(row));
  return { ok: true as const, events };
}

export async function sendEmail(opts: { to: string; subject: string; text: string; fetchImpl?: FetchLike }) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const from = env("EMAIL_FROM");
  if (!from) return { ok: false as const, error: "Set EMAIL_FROM before sending." };
  if (env("RESEND_API_KEY")) {
    const res = await asJson(
      await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [opts.to], subject: opts.subject, text: opts.text }),
      }),
      env("RESEND_API_KEY"),
    );
    if (!res.ok) return { ok: false as const, error: res.error };
    return { ok: true as const, provider: "resend" as const, id: String(res.json.id ?? "") };
  }
  if (env("SENDGRID_API_KEY")) {
    const res = await asJson(
      await fetchImpl("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${env("SENDGRID_API_KEY")}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: opts.to }] }],
          from: { email: from },
          subject: opts.subject,
          content: [{ type: "text/plain", value: opts.text }],
        }),
      }),
      env("SENDGRID_API_KEY"),
    );
    if (!res.ok) return { ok: false as const, error: res.error };
    return { ok: true as const, provider: "sendgrid" as const, id: "" };
  }
  return { ok: false as const, error: "No email provider connected. Set RESEND_API_KEY or SENDGRID_API_KEY." };
}

export async function sendSms(opts: { to: string; body: string; fetchImpl?: FetchLike }) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  if (!env("TWILIO_ACCOUNT_SID") || !env("TWILIO_AUTH_TOKEN") || !env("TWILIO_FROM_NUMBER")) {
    return { ok: false as const, error: "Twilio is not connected." };
  }
  const auth = Buffer.from(`${env("TWILIO_ACCOUNT_SID")}:${env("TWILIO_AUTH_TOKEN")}`).toString("base64");
  const res = await asJson(
    await fetchImpl(`https://api.twilio.com/2010-04-01/Accounts/${env("TWILIO_ACCOUNT_SID")}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: opts.to, From: env("TWILIO_FROM_NUMBER"), Body: opts.body }),
    }),
    env("TWILIO_AUTH_TOKEN"),
  );
  if (!res.ok) return { ok: false as const, error: res.error };
  return { ok: true as const, provider: "twilio" as const, id: String(res.json.sid ?? "") };
}

export async function stripeTransfer(opts: { amountCents: number; destination: string; fetchImpl?: FetchLike }) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  if (!env("STRIPE_SECRET_KEY")) return { ok: false as const, error: "Stripe is not connected." };
  const res = await asJson(
    await fetchImpl("https://api.stripe.com/v1/transfers", {
      method: "POST",
      headers: { Authorization: `Bearer ${env("STRIPE_SECRET_KEY")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        amount: String(opts.amountCents),
        currency: "usd",
        destination: opts.destination,
      }),
    }),
    env("STRIPE_SECRET_KEY"),
  );
  if (!res.ok) return { ok: false as const, error: res.error };
  return { ok: true as const, id: String(res.json.id ?? "") };
}

export async function probeOllama(fetchImpl: FetchLike = fetch) {
  const base = (env("OLLAMA_BASE_URL") || "http://127.0.0.1:11434").replace(/\/$/, "");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 800);
  try {
    const res = await fetchImpl(`${base}/api/tags`, { signal: ctrl.signal });
    if (!res.ok) return { ok: false as const, error: `Ollama returned ${res.status}.` };
    const json = (await res.json()) as { models?: Array<{ name?: string }> };
    const models = (json.models ?? []).map((model) => model.name).filter((name): name is string => Boolean(name));
    if (!models.length) return { ok: false as const, error: "Ollama is running but no model is pulled." };
    const preferred = env("OLLAMA_MODEL") || "llama3.2";
    const model = models.find((name) => name === preferred || name.startsWith(`${preferred}:`)) ?? models[0];
    return { ok: true as const, model, base };
  } catch {
    return { ok: false as const, error: "Ollama is not running on this machine." };
  } finally {
    clearTimeout(timer);
  }
}

export async function generateText(prompt: string, fetchImpl: FetchLike = fetch) {
  const provider = env("LLM_PROVIDER");
  const want = (name: string) => !provider || provider === name;
  if (want("openai") && env("OPENAI_API_KEY")) {
    const model = env("OPENAI_MODEL") || "gpt-4o-mini";
    const res = await asJson(
      await fetchImpl("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${env("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, temperature: 0.4, messages: [{ role: "user", content: prompt }] }),
      }),
      env("OPENAI_API_KEY"),
    );
    if (!res.ok) return { ok: false as const, error: res.error };
    const text = ((res.json.choices as Array<{ message?: { content?: string } }> | undefined)?.[0]?.message?.content ?? "").trim();
    if (!text) return { ok: false as const, error: "OpenAI returned an empty completion." };
    return { ok: true as const, text, provider: "openai", model };
  }
  if (want("anthropic") && env("ANTHROPIC_API_KEY")) {
    const model = env("ANTHROPIC_MODEL") || "claude-3-5-haiku-latest";
    const res = await asJson(
      await fetchImpl("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": env("ANTHROPIC_API_KEY"),
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model, max_tokens: 1200, messages: [{ role: "user", content: prompt }] }),
      }),
      env("ANTHROPIC_API_KEY"),
    );
    if (!res.ok) return { ok: false as const, error: res.error };
    const blocks = (res.json.content as Array<{ text?: string }> | undefined) ?? [];
    const text = blocks.map((block) => block.text ?? "").join("\n").trim();
    if (!text) return { ok: false as const, error: "Anthropic returned an empty completion." };
    return { ok: true as const, text, provider: "anthropic", model };
  }
  if (want("ollama") || !provider) {
    const probe = await probeOllama(fetchImpl);
    if (probe.ok) {
      const res = await asJson(
        await fetchImpl(`${probe.base}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: probe.model, stream: false, messages: [{ role: "user", content: prompt }] }),
        }),
      );
      if (!res.ok) return { ok: false as const, error: res.error };
      const text = String((res.json.message as { content?: string } | undefined)?.content ?? "").trim();
      if (!text) return { ok: false as const, error: "Ollama returned an empty completion." };
      return { ok: true as const, text, provider: "ollama", model: probe.model };
    }
    if (provider === "ollama") return { ok: false as const, error: probe.error };
  }
  return {
    ok: false as const,
    error: "No model connected. Set OPENAI_API_KEY or ANTHROPIC_API_KEY, or run Ollama and pull a model.",
  };
}

export function integrationFlags() {
  return {
    meta: Boolean(env("META_ACCESS_TOKEN") && env("META_AD_ACCOUNT_ID")),
    metaLibrary: Boolean(env("META_AD_LIBRARY_TOKEN") || env("META_ACCESS_TOKEN")),
    google: googleConfigured(),
    tiktok: Boolean(env("TIKTOK_ACCESS_TOKEN") && env("TIKTOK_ADVERTISER_ID")),
    ga4: Boolean(env("GA4_PROPERTY_ID") && (env("GA4_ACCESS_TOKEN") || env("GOOGLE_ADS_ACCESS_TOKEN") || env("GOOGLE_ADS_REFRESH_TOKEN"))),
    mixpanel: Boolean(env("MIXPANEL_API_SECRET")),
    youtube: Boolean(env("YOUTUBE_API_KEY")),
    resend: Boolean(env("RESEND_API_KEY")),
    sendgrid: Boolean(env("SENDGRID_API_KEY")),
    emailFrom: Boolean(env("EMAIL_FROM")),
    twilio: Boolean(env("TWILIO_ACCOUNT_SID") && env("TWILIO_AUTH_TOKEN") && env("TWILIO_FROM_NUMBER")),
    stripe: Boolean(env("STRIPE_SECRET_KEY")),
    openai: Boolean(env("OPENAI_API_KEY")),
    anthropic: Boolean(env("ANTHROPIC_API_KEY")),
    trackKey: Boolean(env("TRACK_PUBLIC_KEY")),
  };
}
