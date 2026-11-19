import { createHmac, timingSafeEqual } from "crypto";

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function signTwilio(authToken: string, url: string, params: Record<string, string>) {
  const data = url + Object.keys(params).sort().map((key) => key + params[key]).join("");
  return createHmac("sha1", authToken).update(data).digest("base64");
}

export function verifyTwilio(authToken: string, url: string, params: Record<string, string>, signature: string) {
  if (!authToken || !signature) return false;
  return safeEqual(signTwilio(authToken, url, params), signature);
}

export function signSvix(secret: string, id: string, timestamp: string, body: string) {
  const key = secret.startsWith("whsec_") ? Buffer.from(secret.slice("whsec_".length), "base64") : Buffer.from(secret);
  return createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
}

export function verifySvix(secret: string, id: string, timestamp: string, body: string, header: string, now = Date.now()) {
  if (!secret || !id || !timestamp || !header) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now - ts * 1000) > 5 * 60 * 1000) return false;
  const expected = signSvix(secret, id, timestamp, body);
  return header.split(" ").some((part) => {
    const sig = part.startsWith("v1,") ? part.slice(3) : part;
    return safeEqual(sig, expected);
  });
}

export function isStopKeyword(body: string) {
  return /^(stop|stopall|unsubscribe|cancel|end|quit)$/i.test(body.trim());
}

export function makeUnsubToken(channel: string, address: string, secret: string) {
  const body = Buffer.from(`${channel}:${address.trim().toLowerCase()}`).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readUnsubToken(token: string, secret: string) {
  const [body, sig] = token.split(".");
  if (!body || !sig || !secret) return null;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  if (!safeEqual(expected, sig)) return null;
  const decoded = Buffer.from(body, "base64url").toString("utf8");
  const index = decoded.indexOf(":");
  if (index < 1) return null;
  return { channel: decoded.slice(0, index), address: decoded.slice(index + 1) };
}
