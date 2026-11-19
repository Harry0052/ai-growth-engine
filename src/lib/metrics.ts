import { twoProportion, type ProportionResult } from "./stats";

export type VariantKey = "A" | "B";

export type ExperimentEvent = {
  anonymousId: string | null;
  name: string;
  variant: string | null;
  traffic: string;
};

export function experimentMath(events: ExperimentEvent[], metric: string, traffic: "product" | "live-test" | "all" = "all") {
  const rows = events.filter((event) => (traffic === "all" ? true : event.traffic === traffic));
  const visits: Record<VariantKey, Set<string>> = { A: new Set(), B: new Set() };
  const conversions: Record<VariantKey, Set<string>> = { A: new Set(), B: new Set() };
  const purchases: Record<VariantKey, Set<string>> = { A: new Set(), B: new Set() };
  for (const event of rows) {
    if (!event.anonymousId || (event.variant !== "A" && event.variant !== "B")) continue;
    const variant = event.variant;
    if (event.name === "page_view") visits[variant].add(event.anonymousId);
    if (event.name === metric) conversions[variant].add(event.anonymousId);
    if (event.name === "purchase") purchases[variant].add(event.anonymousId);
  }
  for (const variant of ["A", "B"] as const) {
    for (const id of conversions[variant]) if (!visits[variant].has(id)) conversions[variant].delete(id);
    for (const id of purchases[variant]) if (!visits[variant].has(id)) purchases[variant].delete(id);
  }
  const result: ProportionResult = twoProportion(visits.A.size, conversions.A.size, visits.B.size, conversions.B.size);
  const purchaseResult = twoProportion(visits.A.size, purchases.A.size, visits.B.size, purchases.B.size);
  return {
    visitsA: visits.A.size,
    visitsB: visits.B.size,
    conversionsA: conversions.A.size,
    conversionsB: conversions.B.size,
    purchasesA: purchases.A.size,
    purchasesB: purchases.B.size,
    result,
    purchaseResult,
  };
}
