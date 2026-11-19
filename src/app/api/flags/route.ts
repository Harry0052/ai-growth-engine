import { NextResponse } from "next/server";
import { LANDING_EXPERIMENT } from "@/lib/constants";
import { assignVariant } from "@/lib/live-plan";
import { ensureReady } from "@/lib/ready";
import { getExperiment, saveAssignment } from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureReady();
  const url = new URL(request.url);
  const aid = url.searchParams.get("anonymous_id") || "";
  if (!aid) return NextResponse.json({ error: "anonymous_id is required." }, { status: 400 });
  const experiment = await getExperiment(LANDING_EXPERIMENT);
  const variants = experiment?.variants ?? ["A", "B"];
  const chosen = assignVariant(aid, LANDING_EXPERIMENT, variants);
  const variant = await saveAssignment(LANDING_EXPERIMENT, aid, chosen);
  return NextResponse.json({ [LANDING_EXPERIMENT]: variant });
}
