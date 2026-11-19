import { cn } from "@/lib/format";

export function PageTitle({ kicker, title, body }: { kicker?: string; title: string; body?: string }) {
  return (
    <header className="mb-6 max-w-3xl">
      {kicker ? <p className="text-xs uppercase tracking-[0.16em] text-violet">{kicker}</p> : null}
      <h1 className="serif mt-1 text-4xl leading-tight">{title}</h1>
      {body ? <p className="mt-2 text-sm leading-6 text-muted">{body}</p> : null}
    </header>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("rounded-2xl border border-line bg-card p-5", className)}>{children}</section>;
}

export function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="serif mt-2 text-3xl">{value}</p>
      {hint ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
      {tone ? <p className="mt-2 text-xs text-amber">{tone}</p> : null}
    </div>
  );
}

export function Empty({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-card/70 px-6 py-10 text-center">
      <h2 className="serif text-2xl">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{body}</p>
      {children ? <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div> : null}
    </div>
  );
}

export function Badge({ children, tone = "stone" }: { children: React.ReactNode; tone?: "live" | "wait" | "danger" | "stone" | "violet" }) {
  const tones = {
    live: "bg-live/10 text-live",
    wait: "bg-amber/10 text-amber",
    danger: "bg-danger/10 text-danger",
    stone: "bg-ink/5 text-muted",
    violet: "bg-violet/10 text-violet",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", tones[tone])}>{children}</span>;
}

export function Live({ children }: { children: React.ReactNode }) {
  return (
    <Badge tone="live">
      <span className="size-1.5 rounded-full bg-live" />
      {children}
    </Badge>
  );
}

export function Btn({ children, tone = "ink", type = "submit", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "ink" | "ghost" | "danger" }) {
  const tones = {
    ink: "bg-ink text-paper hover:bg-violet",
    ghost: "border border-line bg-card hover:border-ink",
    danger: "bg-danger text-white",
  };
  return (
    <button type={type} {...props} className={cn("rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50", tones[tone], props.className)}>
      {children}
    </button>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-muted">{label}</span>
      {children}
    </label>
  );
}

export const control = "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none";
