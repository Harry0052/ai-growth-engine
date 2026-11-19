import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { ensureReady } from "@/lib/ready";
import { pullPublic } from "@/lib/services/discover";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  await ensureReady();
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const summary = await pullPublic(user.email);
  return NextResponse.json({ summary });
}
