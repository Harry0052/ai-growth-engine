import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ensureReady } from "@/lib/ready";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureReady();
    const database = await getDb();
    return NextResponse.json({ ok: true, db: database.dialect });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "unhealthy" }, { status: 500 });
  }
}
