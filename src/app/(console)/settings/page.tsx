import { integrationFlags, probeOllama } from "@/lib/integrations";
import { env } from "@/lib/env";
import { getSetting } from "@/lib/repo";
import { passwordAction, quietAction } from "@/server/actions";
import { Card, PageTitle, Badge } from "@/components/ui";
import { TestConnectionButton } from "@/components/bound";

export const dynamic = "force-dynamic";

const CARDS = [
  { id: "meta", name: "Meta Marketing API", vars: ["META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID"], on: "meta" as const, unlocks: "Pull campaigns, ad sets, ads, and insights. Pause or budget changes run only after approval." },
  { id: "google", name: "Google Ads API", vars: ["GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CUSTOMER_ID", "GOOGLE_ADS_REFRESH_TOKEN"], on: "google" as const, unlocks: "Search campaign metrics. Pause, or change a budget when the budget resource was returned." },
  { id: "tiktok", name: "TikTok Marketing API", vars: ["TIKTOK_ACCESS_TOKEN", "TIKTOK_ADVERTISER_ID"], on: "tiktok" as const, unlocks: "Pull campaigns and reports. Status and budget updates wait for approval." },
  { id: "ga4", name: "GA4 Data API", vars: ["GA4_PROPERTY_ID", "GA4_ACCESS_TOKEN"], on: "ga4" as const, unlocks: "Import event counts. They are tagged import and kept out of the product funnel." },
  { id: "mixpanel", name: "Mixpanel export", vars: ["MIXPANEL_API_SECRET"], on: "mixpanel" as const, unlocks: "Import the last 7 days of export events." },
  { id: "ollama", name: "Ollama", vars: ["OLLAMA_BASE_URL", "OLLAMA_MODEL"], on: "openai" as const, unlocks: "Local model for rewrites, drafts, and the memo narrative. No key." },
];

export default async function SettingsPage() {
  const flags = integrationFlags();
  const ollama = await probeOllama();
  const [start, end, zone] = await Promise.all([getSetting("quiet_start"), getSetting("quiet_end"), getSetting("quiet_timezone")]);
  const defaultPassword = env("ADMIN_PASSWORD") === "growth-engine-local";
  return (
    <div>
      <PageTitle kicker="Connections" title="Keys stay in the environment." body="This page shows whether a variable is set. It never prints the value. Actions that spend or send still need a second approval click." />
      {defaultPassword ? <p className="mb-4 rounded-xl bg-amber/10 px-3 py-2 text-sm text-amber">You are using the local default password. Change it before this is on the internet.</p> : null}
      <div className="grid gap-3">
        {CARDS.map((card) => {
          const connected = card.id === "ollama" ? ollama.ok : flags[card.on];
          return (
            <Card key={card.id}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-medium">{card.name}</h2>
                <Badge tone={connected ? "live" : "stone"}>{connected ? "Connected" : "Not connected"}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted">{card.unlocks}</p>
              <p className="mt-2 text-xs">Env: {card.vars.join(", ")}</p>
              {card.id === "ollama" && !ollama.ok ? <p className="mt-1 text-xs text-muted">{ollama.error}</p> : null}
              <div className="mt-3"><TestConnectionButton id={card.id} /></div>
            </Card>
          );
        })}
        <Card>
          <h2 className="text-lg font-medium">Email, SMS, Stripe</h2>
          <p className="mt-2 text-sm">Resend {flags.resend ? "set" : "missing"} · SendGrid {flags.sendgrid ? "set" : "missing"} · From {flags.emailFrom ? "set" : "missing"} · Twilio {flags.twilio ? "set" : "missing"} · Stripe {flags.stripe ? "set" : "missing"}</p>
          <p className="mt-2 text-xs text-muted">EMAIL_FROM, RESEND_API_KEY or SENDGRID_API_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, STRIPE_SECRET_KEY. Webhooks need RESEND_WEBHOOK_SECRET and the Twilio signature.</p>
        </Card>
      </div>
      <Card className="mt-4">
        <h2 className="serif text-2xl">Quiet hours</h2>
        <form action={quietAction} className="mt-3 grid gap-2 md:grid-cols-3">
          <input name="start" defaultValue={start || "21:00"} className="rounded-xl border border-line px-3 py-2 text-sm" />
          <input name="end" defaultValue={end || "08:00"} className="rounded-xl border border-line px-3 py-2 text-sm" />
          <input name="timezone" defaultValue={zone || "America/Los_Angeles"} className="rounded-xl border border-line px-3 py-2 text-sm" />
          <button className="rounded-full bg-ink px-4 py-2 text-sm text-paper" type="submit">Save</button>
        </form>
      </Card>
      <Card className="mt-4">
        <h2 className="serif text-2xl">Password</h2>
        <form action={passwordAction} className="mt-3 grid gap-2 md:grid-cols-2">
          <input name="current" type="password" required placeholder="Current" className="rounded-xl border border-line px-3 py-2 text-sm" />
          <input name="next" type="password" required placeholder="New" className="rounded-xl border border-line px-3 py-2 text-sm" />
          <button className="rounded-full border border-line px-4 py-2 text-sm" type="submit">Change password</button>
        </form>
      </Card>
    </div>
  );
}
