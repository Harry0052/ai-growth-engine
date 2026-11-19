import { CLICK_RATE, PURCHASE_GIVEN_SIGNUP, SIGNUP_GIVEN_CLICK } from "./constants";

export function mulberry32(seed: number) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function planVisit(random: () => number, variant: "A" | "B") {
  const events = ["page_view"];
  if (random() < CLICK_RATE[variant]) {
    events.push("cta_click");
    if (random() < SIGNUP_GIVEN_CLICK) {
      events.push("signup");
      if (random() < PURCHASE_GIVEN_SIGNUP) events.push("purchase");
    }
  }
  return events;
}

export function assignVariant(anonymousId: string, experimentKey: string, variants = ["A", "B"]) {
  let hash = 2166136261;
  const input = `${experimentKey}:${anonymousId}`;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const index = (hash >>> 0) % variants.length;
  return variants[index] ?? variants[0];
}
