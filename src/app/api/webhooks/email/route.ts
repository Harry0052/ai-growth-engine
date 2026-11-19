import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { ensureReady } from "@/lib/ready";
import { addAudit, createTicket } from "@/lib/repo";
import { verifySvix } from "@/lib/signatures";
import { triageMessage } from "@/lib/triage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  await ensureReady();
  const secret = env("RESEND_WEBHOOK_SECRET");
  const body = await request.text();
  if (!secret) return NextResponse.json({ error: "Set RESEND_WEBHOOK_SECRET before accepting inbound email." }, { status: 401 });
  const ok = verifySvix(
    secret,
    request.headers.get("svix-id") || "",
    request.headers.get("svix-timestamp") || "",
    body,
    request.headers.get("svix-signature") || "",
  );
  if (!ok) return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  const payload = JSON.parse(body) as { type?: string; data?: { from?: string; subject?: string; text?: string } };
  const text = payload.data?.text || payload.data?.subject || "";
  if (!text) return NextResponse.json({ ok: true, ignored: true });
  const triage = triageMessage(text);
  const id = await createTicket({
    channel: "email",
    fromName: "",
    fromAddress: String(payload.data?.from || ""),
    subject: String(payload.data?.subject || "Email"),
    body: text.slice(0, 8000),
    priority: triage.priority,
    category: triage.category,
    triage: triage.triage,
  });
  await addAudit("webhook", "support.email_inbound", id, { type: payload.type || "email" });
  return NextResponse.json({ ok: true, id });
}
