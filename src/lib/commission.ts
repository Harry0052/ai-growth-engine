export function commissionCents(revenueCents: number, rateBps: number, bountyCents: number) {
  const rate = Math.max(0, rateBps) / 10_000;
  return Math.round(Math.max(0, revenueCents) * rate) + Math.max(0, bountyCents);
}
