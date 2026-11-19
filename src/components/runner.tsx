"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function Runner({
  label,
  confirmText,
  tone = "ink",
  action,
}: {
  label: string;
  confirmText?: string;
  tone?: "ink" | "ghost";
  action: () => Promise<unknown>;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <div>
      <button
        disabled={pending}
        className={`rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50 ${tone === "ghost" ? "border border-line bg-card" : "bg-ink text-paper"}`}
        onClick={async () => {
          if (confirmText && !window.confirm(confirmText)) return;
          setPending(true);
          try {
            const result = await action();
            if (result && typeof result === "object" && "error" in result && (result as { error?: string }).error) {
              setMessage(String((result as { error: string }).error));
            } else if (result && typeof result === "object" && "message" in result) {
              setMessage(String((result as { message: string }).message));
            } else setMessage("Done.");
            router.refresh();
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Failed.");
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "Working…" : label}
      </button>
      {message ? <p className="mt-2 text-xs text-muted">{message}</p> : null}
    </div>
  );
}
