export const SESSION_COOKIE = "ge_session";

function toB64Url(bytes: BufferSource) {
  const view = ArrayBuffer.isView(bytes) ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength) : new Uint8Array(bytes);
  let binary = "";
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromB64Url(value: string) {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  return atob(value.replace(/-/g, "+").replace(/_/g, "/") + pad);
}

async function hmac(secret: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toB64Url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
}

export async function signSession(uid: string, secret: string, now = Date.now()) {
  const body = toB64Url(new TextEncoder().encode(JSON.stringify({ uid, exp: now + 14 * 24 * 60 * 60 * 1000 })));
  const sig = await hmac(secret, body);
  return `${body}.${sig}`;
}

export async function readSession(token: string | undefined, secret: string, now = Date.now()) {
  if (!token || !secret) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = await hmac(secret, body);
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const json = JSON.parse(fromB64Url(body)) as { uid?: unknown; exp?: unknown };
    if (typeof json.uid !== "string" || typeof json.exp !== "number") return null;
    if (json.exp < now) return null;
    return { uid: json.uid };
  } catch {
    return null;
  }
}
