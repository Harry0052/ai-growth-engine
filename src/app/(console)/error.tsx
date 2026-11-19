"use client";

export default function ConsoleError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-8">
      <h1 className="serif text-3xl">This page hit an error</h1>
      <p className="mt-2 text-sm text-muted">{error.message}</p>
      <button className="mt-4 rounded-full bg-ink px-4 py-2 text-sm text-paper" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
