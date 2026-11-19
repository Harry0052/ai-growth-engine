import { loadEnvFile } from "../src/lib/env";
import { LIVE_TEST_BIAS } from "../src/lib/constants";
import { driveVisits } from "../src/lib/driver";

loadEnvFile();

const base = (process.env.BASE_URL || "http://127.0.0.1:3847").replace(/\/$/, "");
const email = process.env.ADMIN_EMAIL || "harry@localhost";
const password = process.env.ADMIN_PASSWORD || "growth-engine-local";

function takeCookies(res: Response, jar: Map<string, string>) {
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

async function authed(jar: Map<string, string>, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cookie", cookieHeader(jar));
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  const res = await fetch(`${base}${path}`, { ...init, headers });
  takeCookies(res, jar);
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`${path} ${res.status}: ${text.slice(0, 300)}`);
  return data;
}

async function main() {
  console.log(LIVE_TEST_BIAS);
  const health = await fetch(`${base}/api/health`).catch(() => null);
  if (!health?.ok) {
    console.error(`Start the app first: npm run dev  (expected ${base})`);
    process.exit(1);
  }
  const jar = new Map<string, string>();
  const login = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  takeCookies(login, jar);
  if (!login.ok) {
    console.error("Login failed. Check ADMIN_EMAIL and ADMIN_PASSWORD.");
    process.exit(1);
  }
  console.log("Pulling live public sources…");
  const pulled = await authed(jar, "/api/live/pull", { method: "POST" });
  console.log(JSON.stringify(pulled.summary, null, 2));
  const prepared = await authed(jar, "/api/live-test/prepare", { method: "POST" });
  console.log(`Affiliate link ${prepared.url}`);
  console.log("Sending 240 labeled HTTP visits…");
  const traffic = await driveVisits({ baseUrl: base, count: 240, concurrency: 8, affiliateCode: prepared.code });
  console.log(traffic);
  console.log("Writing the weekly memo…");
  const memo = await authed(jar, "/api/live/memo", { method: "POST" });
  const results = await authed(jar, "/api/live/results");
  console.log(JSON.stringify({ traffic, results, memoModel: memo.model || "none" }, null, 2));
  if (!traffic.visits || !results.clicks) {
    console.error("Live test did not record visits and affiliate clicks.");
    process.exit(1);
  }
  console.log("Live test finished. These visits are labeled test traffic, not customers.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
