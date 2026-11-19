import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { ensureReady } from "@/lib/ready";
import { addAudit, createTicket, unsubscribe } from "@/lib/repo";
import { isStopKeyword, verifyTwilio } from "@/lib/signatures";
import { triageMessage } from "@/lib/triage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  await ensureReady();
  const token = env("TWILIO_AUTH_TOKEN");
  if (!token) return NextResponse.json({ error: "Set TWILIO_AUTH_TOKEN before accepting SMS webhooks." }, { status: 401 });
  const form = await request.formData();
  const params: Record<string, string> = {};
  form.forEach((value, key) => {
    params[key] = String(value);
  });
  const url = env("APP_ORIGIN") ? `${env("APP_ORIGIN")}/api/webhooks/sms` : request.url.split("?")[0];
  if (!verifyTwilio(token, url, params, request.headers.get("x-twilio-signature") || "")) {
    return NextResponse.json({ error: "Invalid Twilio signature." }, { status: 401 });
  }
  const text = params.Body || "";
  const from = params.From || "";
  if (isStopKeyword(text)) {
    await unsubscribe("sms", from);
    await addAudit("webhook", "sms.stop", from, {});
    return new NextResponse("<Response></Response>", { headers: { "content-type": "text/xml" } });
  }
  const triage = triageMessage(text);
  const id = await createTicket({
    channel: "sms",
    fromName: "",
    fromAddress: from,
    subject: text.slice(0, 80) || "SMS",
    body: text.slice(0, 8000),
    priority: triage.priority,
    category: triage.category,
    triage: triage.triage,
  });
  await addAudit("webhook", "support.sms_inbound", id, {});
  return new NextResponse("<Response></Response>", { headers: { "content-type": "text/xml" } });
}
