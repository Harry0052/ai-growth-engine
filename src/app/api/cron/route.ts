import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { ensureReady } from "@/lib/ready";
import { addAudit } from "@/lib/repo";
import { processDueFlows } from "@/lib/services/messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = env("CRON_SECRET");
  const auth = request.headers.get("authorization");
  const vercel = request.headers.get("x-vercel-cron");
  if (process.env.NODE_ENV === "production") {
    if (secret && auth !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!secret && !vercel) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureReady();
  await processDueFlows();
  await addAudit("cron", "lifecycle.process", null, {});
  return NextResponse.json({ ok: true });
}
