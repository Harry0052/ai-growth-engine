import { env } from "@/lib/env";
import { ensureReady } from "@/lib/ready";
import { addAudit, unsubscribe } from "@/lib/repo";
import { readUnsubToken } from "@/lib/signatures";

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  let message = "This unsubscribe link is not valid.";
  if (token) {
    try {
      await ensureReady();
      const parsed = readUnsubToken(token, env("AUTH_SECRET"));
      if (parsed) {
        await unsubscribe(parsed.channel, parsed.address);
        await addAudit("public", "unsubscribe", parsed.address, { channel: parsed.channel });
        message = `${parsed.address} will not receive more ${parsed.channel === "sms" ? "texts" : "email"} from this Growth Engine.`;
      }
    } catch (error) {
      message = error instanceof Error ? error.message : message;
    }
  }
  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <h1 className="serif text-4xl">Unsubscribed</h1>
      <p className="mt-3 text-sm leading-6 text-muted">{message}</p>
    </main>
  );
}
