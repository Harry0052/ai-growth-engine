"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CsvBox({ label, action }: { label: string; action: (text: string) => Promise<{ error?: string; rows?: number; ok?: boolean }> }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  return (
    <label className="block rounded-2xl border border-dashed border-line bg-card p-4 text-sm">
      <span className="font-medium">{label}</span>
      <input
        className="mt-3 block w-full text-xs"
        type="file"
        accept=".csv,text/csv"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const result = await action(await file.text());
          setMessage(result.error || `Imported ${result.rows ?? 0} rows.`);
          router.refresh();
        }}
      />
      {message ? <p className="mt-2 text-xs text-muted">{message}</p> : null}
    </label>
  );
}
