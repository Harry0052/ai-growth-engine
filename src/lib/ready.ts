import { DEFAULT_THRESHOLDS, FUNNEL_STEPS, LANDING_EXPERIMENT } from "./constants";
import { getDb } from "./db";
import { env } from "./env";
import { hashPassword } from "./password";
import { createUser, ensureTier, getSetting, getUserByEmail, setSetting, upsertExperiment } from "./repo";

let pending: Promise<void> | null = null;

export function ensureReady() {
  if (!pending) {
    pending = ready().catch((error) => {
      pending = null;
      throw error;
    });
  }
  return pending;
}

async function ready() {
  await getDb();
  if (!env("AUTH_SECRET")) throw new Error("AUTH_SECRET is missing. Run npm run db:setup.");
  const email = env("ADMIN_EMAIL") || (process.env.NODE_ENV === "production" ? "" : "harry@localhost");
  const password = env("ADMIN_PASSWORD") || (process.env.NODE_ENV === "production" ? "" : "growth-engine-local");
  if (!email || !password) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD.");
  if (process.env.NODE_ENV === "production" && password === "growth-engine-local") {
    throw new Error("Refusing the local default ADMIN_PASSWORD in production.");
  }
  const existing = await getUserByEmail(email);
  if (!existing) await createUser(email, hashPassword(password));
  if (!(await getSetting("thresholds"))) await setSetting("thresholds", JSON.stringify(DEFAULT_THRESHOLDS));
  if (!(await getSetting("quiet_start"))) await setSetting("quiet_start", "21:00");
  if (!(await getSetting("quiet_end"))) await setSetting("quiet_end", "08:00");
  if (!(await getSetting("quiet_timezone"))) await setSetting("quiet_timezone", "America/Los_Angeles");
  if (!(await getSetting("demo_mode"))) await setSetting("demo_mode", "0");
  if (!(await getSetting("discover_app"))) await setSetting("discover_app", "ChatGPT");
  if (!(await getSetting("discover_topic"))) await setSetting("discover_topic", "consumer AI");
  if (!(await getSetting("discover_wiki"))) await setSetting("discover_wiki", "ChatGPT");
  if (!(await getSetting("funnel_steps"))) await setSetting("funnel_steps", JSON.stringify([...FUNNEL_STEPS]));
  await ensureTier("Standard", 2000, 0);
  await upsertExperiment({
    key: LANDING_EXPERIMENT,
    name: "Test landing headline",
    status: "running",
    variants: ["A", "B"],
    metric: "signup",
  });
}
