import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { ensureReady } from "@/lib/ready";
import { addAudit, createTicket } from "@/lib/repo";
import { triageMessage } from "@/lib/triage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  await ensureReady();
  const required = env("SUPPORT_INBOUND_KEY");
  if (required && request.headers.get("x-ge-key") !== required) {
    return NextResponse.json({ error: "Support key required." }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { name?: string; from?: string; message?: string; channel?: string };
  const message = String(body.message || "").slice(0, 8000);
  if (!message) return NextResponse.json({ error: "Message is required." }, { status: 400 });
  const triage = triageMessage(message);
  const id = await createTicket({
    channel: body.channel === "email" || body.channel === "sms" ? body.channel : "chat",
    fromName: String(body.name || "Visitor").slice(0, 120),
    fromAddress: String(body.from || "").slice(0, 200),
    subject: message.slice(0, 80),
    body: message,
    priority: triage.priority,
    category: triage.category,
    triage: triage.triage,
  });
  await addAudit("public", "support.inbound", id, { channel: body.channel || "chat", triage: triage.category });
  return NextResponse.json({ ok: true, id });
}
