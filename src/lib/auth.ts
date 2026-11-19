import { cookies } from "next/headers";
import { env } from "./env";
import { getUserById } from "./repo";
import { readSession, SESSION_COOKIE, signSession } from "./session-token";

export async function currentUser() {
  const jar = await cookies();
  const session = await readSession(jar.get(SESSION_COOKIE)?.value, env("AUTH_SECRET"));
  if (!session) return null;
  const user = await getUserById(session.uid);
  return user ? { id: user.id, email: user.email } : null;
}

export async function setSessionCookie(userId: string) {
  const token = await signSession(userId, env("AUTH_SECRET"));
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
