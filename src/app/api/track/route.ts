import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { ensureReady } from "@/lib/ready";
import { classifyTraffic, ingestTrackedEvent } from "@/lib/services/tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const eventSchema = z.object({
  event: z.string().min(1).max(80),
  anonymous_id: z.string().max(120).optional().nullable(),
  user_id: z.string().max(120).optional().nullable(),
  properties: z.record(z.string(), z.unknown()).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  api_key: z.string().optional(),
});

function cors() {
  return {
    "access-control-allow-origin": env("TRACK_CORS_ORIGIN") || "*",
    "access-control-allow-headers": "content-type, x-ge-key",
    "access-control-allow-methods": "POST, OPTIONS",
  };
}

export function OPTIONS() {
  return new NextResponse(null, { headers: cors() });
}

export async function POST(request: Request) {
  await ensureReady();
  const body = await request.json().catch(() => null);
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid event." }, { status: 400, headers: cors() });
  const key = env("TRACK_PUBLIC_KEY");
  if (key && request.headers.get("x-ge-key") !== key && parsed.data.api_key !== key) {
    return NextResponse.json({ error: "Tracking key required." }, { status: 401, headers: cors() });
  }
  const cookie = request.headers.get("cookie") || "";
  const refCookie = cookie.match(/(?:^|;\s*)ge_ref=([^;]+)/)?.[1];
  const properties = parsed.data.properties ?? {};
  const context = { ...(parsed.data.context ?? {}) };
  if (refCookie && !context.ref && !properties.ref) context.ref = decodeURIComponent(refCookie);
  const traffic = classifyTraffic(request.headers.get("user-agent") || "", properties);
  const saved = await ingestTrackedEvent({
    event: parsed.data.event,
    anonymousId: parsed.data.anonymous_id ?? null,
    userId: parsed.data.user_id ?? null,
    properties,
    context,
    source: "first-party",
    traffic,
  });
  return NextResponse.json({ ok: true, id: saved.id, duplicate: saved.duplicate }, { headers: cors() });
}
