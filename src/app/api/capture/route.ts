import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { ensureReady } from "@/lib/ready";
import { classifyTraffic, ingestTrackedEvent } from "@/lib/services/tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAP: Record<string, string> = { $pageview: "page_view" };

export async function POST(request: Request) {
  await ensureReady();
  const body = (await request.json().catch(() => ({}))) as {
    api_key?: string;
    event?: string;
    distinct_id?: string;
    properties?: Record<string, unknown>;
    batch?: Array<{ event?: string; distinct_id?: string; properties?: Record<string, unknown> }>;
  };
  const key = env("TRACK_PUBLIC_KEY");
  if (key && body.api_key !== key && request.headers.get("x-ge-key") !== key) {
    return NextResponse.json({ error: "Tracking key required." }, { status: 401 });
  }
  const events = body.batch?.length ? body.batch : [{ event: body.event, distinct_id: body.distinct_id, properties: body.properties }];
  let accepted = 0;
  for (const event of events.slice(0, 100)) {
    if (!event.event) continue;
    const properties = event.properties ?? {};
    await ingestTrackedEvent({
      event: MAP[event.event] ?? event.event.replace(/^\$/, ""),
      anonymousId: event.distinct_id ?? null,
      userId: null,
      properties,
      context: { path: properties.$current_url ?? properties.path },
      source: "posthog-compatible",
      traffic: classifyTraffic(request.headers.get("user-agent") || "", properties),
    });
    accepted += 1;
  }
  return NextResponse.json({ ok: true, accepted });
}
