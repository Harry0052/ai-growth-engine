import { LIVE_AFFILIATE_CODE, LIVE_TEST_UA, TEST_PURCHASE_CENTS } from "./constants";
import { planVisit, mulberry32 } from "./live-plan";

export type DriveResult = { visits: number; clicks: number; signups: number; purchases: number; errors: number };

function storeCookies(jar: Map<string, string>, res: Response) {
  const lines = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  for (const line of lines) {
    const pair = line.split(";")[0] ?? "";
    const index = pair.indexOf("=");
    if (index > 0) jar.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
  }
}

function cookieHeader(jar: Map<string, string>) {
  return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
}

async function request(baseUrl: string, path: string, jar: Map<string, string>) {
  let current = path;
  for (let hop = 0; hop < 5; hop += 1) {
    const res = await fetch(new URL(current, baseUrl), {
      redirect: "manual",
      headers: { cookie: cookieHeader(jar), "user-agent": LIVE_TEST_UA, accept: "text/html" },
    });
    storeCookies(jar, res);
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get("location");
      if (!location) return { status: res.status, body: "" };
      const url = new URL(location, baseUrl);
      current = `${url.pathname}${url.search}`;
      continue;
    }
    return { status: res.status, body: await res.text() };
  }
  return { status: 0, body: "" };
}

async function postTrack(baseUrl: string, jar: Map<string, string>, body: Record<string, unknown>) {
  const res = await fetch(new URL("/api/track", baseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader(jar),
      "user-agent": LIVE_TEST_UA,
    },
    body: JSON.stringify(body),
  });
  return res.ok;
}

export async function driveVisits(options: {
  baseUrl: string;
  count: number;
  concurrency?: number;
  seed?: number;
  affiliateCode?: string | null;
}): Promise<DriveResult> {
  const random = mulberry32(options.seed ?? 20261119);
  const plans = Array.from({ length: options.count }, () => ({
    throughAffiliate: Boolean(options.affiliateCode) && random() < 0.6,
    rolls: [random(), random(), random()],
  }));
  const concurrency = options.concurrency ?? 6;
  const result: DriveResult = { visits: 0, clicks: 0, signups: 0, purchases: 0, errors: 0 };
  let cursor = 0;
  async function one(index: number) {
    const plan = plans[index];
    const jar = new Map<string, string>();
    const firstPath = plan.throughAffiliate ? `/r/${options.affiliateCode}` : "/try";
    try {
      const page = await request(options.baseUrl, firstPath, jar);
      if (page.status >= 400 || !page.body) {
        result.errors += 1;
        return;
      }
      const variantMatch = page.body.match(/id="ge-variant"[^>]*>\s*([AB])/);
      const variant = variantMatch?.[1] === "B" ? "B" : "A";
      const aid = jar.get("ge_aid") || `live-${options.seed ?? 20261119}-${index}`;
      jar.set("ge_aid", aid);
      const ref = jar.get("ge_ref") || "";
      let roll = 0;
      const events = planVisit(() => plan.rolls[roll++] ?? 0, variant);
      for (const event of events) {
        const properties: Record<string, unknown> = { variant, path: "/try", ref };
        if (event === "signup") properties.email = `live-test+${index}@example.test`;
        if (event === "purchase") properties.revenue = TEST_PURCHASE_CENTS / 100;
        const ok = await postTrack(options.baseUrl, jar, {
          event,
          anonymous_id: aid,
          properties,
          context: { ref, path: "/try" },
        });
        if (!ok) {
          result.errors += 1;
          return;
        }
      }
      result.visits += 1;
      if (events.includes("cta_click")) result.clicks += 1;
      if (events.includes("signup")) result.signups += 1;
      if (events.includes("purchase")) result.purchases += 1;
    } catch {
      result.errors += 1;
    }
  }
  async function worker() {
    while (cursor < options.count) {
      const index = cursor;
      cursor += 1;
      await one(index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, options.count) }, () => worker()));
  return result;
}

export { LIVE_AFFILIATE_CODE };
