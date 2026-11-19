import { NextResponse } from "next/server";
import { ensureReady } from "@/lib/ready";
import { addAudit, addFeedback } from "@/lib/repo";

export const runtime = "nodejs";

export async function POST(request: Request) {
  await ensureReady();
  const body = (await request.json().catch(() => ({}))) as { message?: string; rating?: number; author?: string };
  const text = String(body.message || "").slice(0, 8000);
  if (!text) return NextResponse.json({ error: "Feedback is required." }, { status: 400 });
  const id = await addFeedback({
    source: "widget",
    body: text,
    rating: typeof body.rating === "number" ? body.rating : null,
    author: String(body.author || "").slice(0, 120),
  });
  await addAudit("public", "feedback.widget", id, {});
  return NextResponse.json({ ok: true, id });
}
