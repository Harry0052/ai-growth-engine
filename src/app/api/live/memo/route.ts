import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { ensureReady } from "@/lib/ready";
import { writeMemo } from "@/lib/services/ops";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  await ensureReady();
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await writeMemo(user.email);
  return NextResponse.json(result);
}
