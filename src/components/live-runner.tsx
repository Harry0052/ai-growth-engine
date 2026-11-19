"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LIVE_TEST_BIAS } from "@/lib/constants";

export function LiveRunner() {
  const router = useRouter();
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");

  async function run() {
    setBusy(true);
    setLog(["Preparing the affiliate link…"]);
    const prepared = await fetch("/api/live-test/prepare", { method: "POST" });
    const prep = (await prepared.json()) as { url?: string; error?: string };
    if (!prepared.ok || !prep.url) {
      setLog([prep.error || "Could not prepare the test."]);
      setBusy(false);
      return;
    }
    setLink(prep.url);
    let visits = 0;
    let signups = 0;
    let purchases = 0;
    let errors = 0;
    for (let batch = 0; batch < 10; batch += 1) {
      const res = await fetch("/api/live-test/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ count: 24 }) });
      const json = (await res.json()) as { visits?: number; signups?: number; purchases?: number; errors?: number; error?: string };
      if (!res.ok) {
        setLog((lines) => [...lines, json.error || "Batch failed."]);
        break;
      }
      visits += json.visits || 0;
      signups += json.signups || 0;
      purchases += json.purchases || 0;
      errors += json.errors || 0;
      setLog([`Labeled test visits ${visits}/240`, `Signups ${signups}`, `Purchases ${purchases}`, `Errors ${errors}`]);
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-amber/30 bg-amber/5 p-5">
      <p className="text-sm leading-6">{LIVE_TEST_BIAS}</p>
      {link ? <p className="mt-3 text-sm">Affiliate link: <a className="underline" href={link}>{link}</a></p> : null}
      <button data-testid="send-test-traffic" disabled={busy} className="mt-4 rounded-full bg-ink px-4 py-2 text-sm text-paper disabled:opacity-50" onClick={run}>
        {busy ? "Sending labeled visits…" : "Send 240 labeled test visits"}
      </button>
      {log.length ? <pre className="mt-4 whitespace-pre-wrap text-xs text-muted">{log.join("\n")}</pre> : null}
    </div>
  );
}
