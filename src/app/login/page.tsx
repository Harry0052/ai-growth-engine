import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ensureReady } from "@/lib/ready";
import { loginAction } from "@/server/actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const params = await searchParams;
  let setup = "";
  try {
    await ensureReady();
    const user = await currentUser();
    if (user) redirect(params.next && params.next.startsWith("/") ? params.next : "/");
  } catch (error) {
    setup = error instanceof Error ? error.message : "Run npm run db:setup.";
  }
  const error = params.error === "1" ? "That email and password did not match." : params.error && params.error !== "1" ? params.error : "";
  return (
    <main className="mx-auto flex min-h-[calc(100vh-40px)] max-w-md flex-col justify-center px-6 py-16">
      <p className="text-xs uppercase tracking-[0.16em] text-violet">AI Head of Growth & Operations</p>
      <h1 className="serif mt-2 text-5xl">Growth Engine</h1>
      <p className="mt-3 text-sm leading-6 text-muted">Sign in to operate acquisition, lifecycle, and affiliates. Built by Harry Malhi.</p>
      <form action={loginAction} data-testid="login-form" className="mt-8 grid gap-3">
        <input type="hidden" name="next" value={params.next || "/"} />
        <input name="email" type="email" required placeholder="harry@localhost" className="rounded-xl border border-line bg-card px-3 py-3 text-sm" />
        <input name="password" type="password" required placeholder="Password" className="rounded-xl border border-line bg-card px-3 py-3 text-sm" />
        <button className="rounded-full bg-ink py-3 text-sm text-paper" type="submit">
          Sign in
        </button>
      </form>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      {setup ? <p className="mt-3 text-sm text-danger">{setup}</p> : null}
      <p className="mt-6 text-xs leading-5 text-muted">Local quickstart password is written by <code>npm run db:setup</code>. Change it before a public deploy.</p>
    </main>
  );
}
