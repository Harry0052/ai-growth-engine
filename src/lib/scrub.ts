const SECRET = /token|secret|password|authorization|api[_-]?key|credential/i;

export function scrub(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SECRET.test(key) ? "[redacted]" : scrub(inner);
    }
    return out;
  }
  return value;
}

export function stripSecret(text: string, secret?: string) {
  const sliced = text.slice(0, 800);
  if (!secret) return sliced;
  return sliced.split(secret).join("[redacted]");
}
