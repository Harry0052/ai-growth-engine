import { cookies, headers } from "next/headers";
import Script from "next/script";
import { LANDING_EXPERIMENT } from "@/lib/constants";
import { env } from "@/lib/env";
import { assignVariant } from "@/lib/live-plan";
import { ensureReady } from "@/lib/ready";
import { saveAssignment } from "@/lib/repo";
import { ChatWidget, CtaButton, SignupForm, TestPurchase } from "@/components/landing-widgets";

export const dynamic = "force-dynamic";

const COPY = {
  A: {
    eyebrow: "A quieter kind of AI",
    title: "Remember everyone who matters.",
    body: "KIN keeps the thread of your relationships — birthdays, promises, the thing they said last month — and nudges you before you forget.",
    cta: "Start a private test",
    dark: true,
  },
  B: {
    eyebrow: "Built for real life",
    title: "Never lose the thread.",
    body: "A personal AI that remembers the people you care about, and stays out of the way until you need it.",
    cta: "Try it for a week",
    dark: false,
  },
} as const;

export default async function TryPage() {
  await ensureReady();
  const headerStore = await headers();
  const cookieStore = await cookies();
  const aid = headerStore.get("x-ge-aid") || cookieStore.get("ge_aid")?.value || crypto.randomUUID();
  const ref = cookieStore.get("ge_ref")?.value || "";
  const proposed = assignVariant(aid, LANDING_EXPERIMENT);
  const variant = (await saveAssignment(LANDING_EXPERIMENT, aid, proposed)) === "B" ? "B" : "A";
  const copy = COPY[variant];
  const writeKey = env("TRACK_PUBLIC_KEY");
  const config = JSON.stringify({ aid, variant, ref, endpoint: "/api/track", key: writeKey });
  return (
    <main className={copy.dark ? "bg-ink text-paper" : "bg-paper text-ink"}>
      <span id="ge-variant" hidden>{variant}</span>
      <meta name="ge-config" content={config} />
      <Script src="/snippet.js" strategy="afterInteractive" />
      <div className="mx-auto flex min-h-[calc(100vh-36px)] max-w-3xl flex-col justify-center px-6 py-16">
        <p className={`text-xs uppercase tracking-[0.16em] ${copy.dark ? "text-paper/60" : "text-violet"}`}>
          Growth Engine test surface · variant {variant} · not a launched product
        </p>
        <p className="mt-6 text-sm">{copy.eyebrow}</p>
        <h1 className="serif mt-2 text-5xl leading-tight md:text-7xl">{copy.title}</h1>
        <p className={`mt-5 max-w-xl text-lg leading-8 ${copy.dark ? "text-paper/80" : "text-muted"}`}>{copy.body}</p>
        <div className="mt-8">
          <CtaButton aid={aid} variant={variant} refCode={ref} label={copy.cta} dark={copy.dark} />
        </div>
        <div className={`mt-10 rounded-3xl p-5 ${copy.dark ? "bg-white/5" : "bg-card border border-line"}`}>
          <p className="text-sm font-medium">Test signup</p>
          <p className={`mt-1 text-xs ${copy.dark ? "text-paper/60" : "text-muted"}`}>Stored in this Growth Engine. It does not create a customer.</p>
          <div className="mt-3">
            <SignupForm aid={aid} variant={variant} refCode={ref} />
          </div>
        </div>
        <div className="mt-4">
          <TestPurchase aid={aid} variant={variant} refCode={ref} />
        </div>
        {ref ? <p className="mt-6 text-xs opacity-70">Referral {ref} is on this browser.</p> : null}
      </div>
      <ChatWidget />
    </main>
  );
}
