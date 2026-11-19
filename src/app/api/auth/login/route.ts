import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import { loginWithPassword } from "@/lib/login";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string };
  try {
    const user = await loginWithPassword(String(body.email || ""), String(body.password || ""));
    if (!user) return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    await setSessionCookie(user.id);
    return NextResponse.json({ ok: true, email: user.email });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Login failed." }, { status: 500 });
  }
}
