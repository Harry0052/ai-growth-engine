"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { replyTicketAction } from "@/server/actions";

export function TicketReply({ ticketId, channel }: { ticketId: string; channel: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  return (
    <div className="grid gap-2">
      <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write the reply a human is approving." className="min-h-28 rounded-xl border border-line px-3 py-2 text-sm" />
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-full border border-line px-4 py-2 text-sm"
          onClick={async () => {
            const result = await replyTicketAction(ticketId, body, false);
            setMessage(result.ok ? result.message || "Saved" : result.error);
            router.refresh();
          }}
        >
          Save draft
        </button>
        <button
          className="rounded-full bg-ink px-4 py-2 text-sm text-paper"
          onClick={async () => {
            const warning = channel === "chat" ? "Save this as an in-app reply? No email or SMS will be sent." : "Approve and send this reply through the connected provider?";
            if (!window.confirm(warning)) return;
            const result = await replyTicketAction(ticketId, body, true);
            setMessage(result.ok ? result.message || "Sent" : result.error);
            router.refresh();
          }}
        >
          {channel === "chat" ? "Approve in-app reply" : "Approve and send"}
        </button>
      </div>
      {message ? <p className="text-xs text-muted">{message}</p> : null}
    </div>
  );
}
