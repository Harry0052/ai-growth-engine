import { verifyPassword } from "./password";
import { addAudit, getUserByEmail } from "./repo";
import { ensureReady } from "./ready";

export async function loginWithPassword(email: string, password: string) {
  await ensureReady();
  const user = await getUserByEmail(email.trim());
  if (!user || !verifyPassword(password, user.password_hash)) return null;
  await addAudit(user.email, "auth.login", user.email, {});
  return user;
}
