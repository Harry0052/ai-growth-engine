import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ensureReady } from "@/lib/ready";
import { Shell } from "@/components/shell";

export const dynamic = "force-dynamic";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  try {
    await ensureReady();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Setup failed.";
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <h1 className="serif text-4xl">Growth Engine needs setup</h1>
        <p className="mt-3 text-sm leading-6 text-muted">{message}</p>
        <p className="mt-4 text-sm">Run <code>npm run db:setup</code>, then start the app again.</p>
      </main>
    );
  }
  const user = await currentUser();
  if (!user) redirect("/login");
  return <Shell email={user.email}>{children}</Shell>;
}
