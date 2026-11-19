"use server";

import { redirect } from "next/navigation";
import { clearSessionCookie, currentUser } from "@/lib/auth";
import { addAudit } from "@/lib/repo";

export async function logoutAction() {
  const user = await currentUser();
  if (user) await addAudit(user.email, "auth.logout", user.email, {});
  await clearSessionCookie();
  redirect("/login");
}
