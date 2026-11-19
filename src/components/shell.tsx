"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logoutAction } from "@/server/logout";

const GROUPS = [
  {
    label: "Operate",
    items: [
      { href: "/", label: "Overview" },
      { href: "/live", label: "Live test" },
      { href: "/ads", label: "Ads" },
      { href: "/experiments", label: "Experiments" },
      { href: "/tracking", label: "Tracking" },
    ],
  },
  {
    label: "Listen",
    items: [
      { href: "/discover", label: "Discover" },
      { href: "/creative", label: "Creative" },
      { href: "/feedback", label: "Feedback" },
      { href: "/memo", label: "Weekly memo" },
    ],
  },
  {
    label: "Customers",
    items: [
      { href: "/support", label: "Support" },
      { href: "/lifecycle", label: "Lifecycle" },
      { href: "/community", label: "Community" },
      { href: "/affiliates", label: "Affiliates" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/settings", label: "Settings" },
      { href: "/audit", label: "Audit log" },
    ],
  },
];

export function Shell({ email, children }: { email: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const nav = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-5">
        <Link href="/" className="block" onClick={() => setOpen(false)}>
          <span className="serif text-2xl text-paper">Growth Engine</span>
          <span className="mt-1 block text-[11px] uppercase tracking-[0.16em] text-paper/50">Harry Malhi</span>
        </Link>
        <button className="text-paper md:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
          Close
        </button>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-2 text-[10px] uppercase tracking-[0.16em] text-paper/40">{group.label}</p>
            <div className="mt-1 space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`block rounded-xl px-2 py-2 text-sm ${active ? "bg-white/10 text-white" : "text-paper/75 hover:bg-white/5 hover:text-white"}`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 px-4 py-4 text-xs text-paper/60">
        <p className="truncate">{email}</p>
        <form action={logoutAction} className="mt-2">
          <button className="text-paper/80 hover:text-white">Sign out</button>
        </form>
        <a className="mt-3 block text-paper/80 underline decoration-white/30" href="https://github.com/Harry0052" target="_blank" rel="noreferrer">
          Harry Malhi
        </a>
      </div>
    </div>
  );
  return (
    <div className="md:grid md:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 hidden h-[calc(100vh-32px)] bg-sidebar md:block">{nav}</aside>
      {open ? <div className="fixed inset-0 z-40 bg-sidebar md:hidden">{nav}</div> : null}
      <div className="min-w-0">
        <div className="flex items-center justify-between border-b border-line px-4 py-3 md:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="text-sm">
            Menu
          </button>
          <span className="serif text-lg">Growth Engine</span>
        </div>
        <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</div>
      </div>
    </div>
  );
}
