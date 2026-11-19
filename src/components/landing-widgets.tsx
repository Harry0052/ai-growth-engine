"use client";

import { useEffect, useState } from "react";

export function LandingTracker({ aid, variant, refCode, writeKey }: { aid: string; variant: string; refCode: string; writeKey: string }) {
  useEffect(() => {
    const config = { aid, variant, ref: refCode, endpoint: "/api/track", key: writeKey, manual: true };
    window.__GE__ = config;
    const seen = `ge-seen-${aid}`;
    if (sessionStorage.getItem(seen)) return;
    sessionStorage.setItem(seen, "1");
    void fetch("/api/track", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", ...(writeKey ? { "x-ge-key": writeKey } : {}) },
      body: JSON.stringify({
        event: "page_view",
        anonymous_id: aid,
        properties: { variant, path: "/try", ref: refCode },
        context: { ref: refCode, path: "/try" },
      }),
    });
  }, [aid, variant, refCode, writeKey]);
  return null;
}

async function track(event: string, aid: string, variant: string, refCode: string, extra: Record<string, unknown> = {}) {
  await fetch("/api/track", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      event,
      anonymous_id: aid,
      properties: { variant, path: "/try", ref: refCode, ...extra },
      context: { ref: refCode, path: "/try" },
    }),
  });
}

export function CtaButton({ aid, variant, refCode, label, dark }: { aid: string; variant: string; refCode: string; label: string; dark?: boolean }) {
  return (
    <button
      data-testid="cta"
      className={`rounded-full px-5 py-3 text-sm font-medium ${dark ? "bg-paper text-ink" : "bg-ink text-paper"}`}
      onClick={() => {
        void track("cta_click", aid, variant, refCode);
        document.getElementById("signup")?.scrollIntoView({ behavior: "smooth" });
      }}
    >
      {label}
    </button>
  );
}

export function SignupForm({ aid, variant, refCode }: { aid: string; variant: string; refCode: string }) {
  const [done, setDone] = useState(false);
  if (done) return <p className="text-sm">Saved in this Growth Engine only. This is not a customer account.</p>;
  return (
    <form
      id="signup"
      data-testid="signup-form"
      className="grid gap-2 sm:grid-cols-[1fr_auto]"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        await track("signup", aid, variant, refCode, { email: String(data.get("email") || ""), name: String(data.get("name") || ""), method: "test-form" });
        setDone(true);
      }}
    >
      <input name="name" required placeholder="Name" className="rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink" />
      <input name="email" required type="email" placeholder="Email" className="rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink" />
      <button className="rounded-full bg-ink px-4 py-2 text-sm text-paper sm:col-span-2" type="submit">
        Record a test signup
      </button>
    </form>
  );
}

export function TestPurchase({ aid, variant, refCode }: { aid: string; variant: string; refCode: string }) {
  const [done, setDone] = useState(false);
  return (
    <details className="rounded-2xl border border-dashed border-line bg-white/70 p-4 text-sm text-ink">
      <summary className="cursor-pointer font-medium">Test controls</summary>
      <p className="mt-2 text-muted">Records a labeled $20 purchase event. No card is charged.</p>
      <button
        className="mt-3 rounded-full border border-line px-4 py-2"
        onClick={async () => {
          await track("purchase", aid, variant, refCode, { revenue: 20, currency: "USD" });
          setDone(true);
        }}
      >
        {done ? "Purchase event stored" : "Record a test purchase"}
      </button>
    </details>
  );
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState("");
  const [reply, setReply] = useState("");
  return (
    <div className="fixed bottom-4 right-4 z-20">
      {open ? (
        <form
          className="w-72 rounded-2xl border border-line bg-card p-4 shadow-xl"
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const res = await fetch("/api/support/inbound", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ name: data.get("name"), from: data.get("email"), message: data.get("message"), channel: "chat" }),
            });
            const json = (await res.json()) as { id?: string };
            setSent(json.id || "sent");
          }}
        >
          <p className="text-sm font-medium text-ink">Ask the inbox</p>
          <p className="mt-1 text-xs text-muted">A person approves any reply. Nothing is auto-sent.</p>
          {sent ? (
            <Thread id={sent} reply={reply} setReply={setReply} />
          ) : (
            <div className="mt-3 grid gap-2">
              <input name="name" placeholder="Name" className="rounded-lg border border-line px-2 py-1 text-sm" />
              <input name="email" placeholder="Email" className="rounded-lg border border-line px-2 py-1 text-sm" />
              <textarea name="message" required placeholder="What is broken or confusing?" className="min-h-20 rounded-lg border border-line px-2 py-1 text-sm" />
              <button className="rounded-full bg-ink px-3 py-2 text-sm text-paper" type="submit">
                Send to inbox
              </button>
            </div>
          )}
        </form>
      ) : null}
      <button className="mt-2 rounded-full bg-violet px-4 py-2 text-sm text-white" onClick={() => setOpen((value) => !value)}>
        {open ? "Close" : "Support"}
      </button>
    </div>
  );
}

function Thread({ id, reply, setReply }: { id: string; reply: string; setReply: (value: string) => void }) {
  useEffect(() => {
    const timer = setInterval(async () => {
      const res = await fetch(`/api/support/thread?id=${id}`);
      const json = (await res.json()) as { messages?: Array<{ body: string }> };
      const last = json.messages?.[json.messages.length - 1];
      if (last) setReply(last.body);
    }, 4000);
    return () => clearInterval(timer);
  }, [id, setReply]);
  return <p className="mt-3 text-sm text-muted">{reply || "Sent. The reply will show here after someone approves it."}</p>;
}

declare global {
  interface Window {
    __GE__?: { aid?: string; variant?: string; ref?: string; endpoint?: string; key?: string; manual?: boolean };
  }
}
