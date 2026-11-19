import { NextResponse } from "next/server";
import { ticketMessages } from "@/lib/repo";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ messages: [] });
  const messages = await ticketMessages(id);
  return NextResponse.json({
    messages: messages.filter((message) => message.direction === "out").map((message) => ({ body: message.body, at: message.created_at })),
  });
}
