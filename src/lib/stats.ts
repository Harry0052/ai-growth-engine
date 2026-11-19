/** Two-tailed normal CDF approximation (Abramowitz and Stegun 7.1.26). */
export function normalCdf(x: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const p =
    d *
    t *
    (0.319381530 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

export type ProportionResult = {
  p1: number;
  p2: number;
  z: number;
  pValue: number;
  lift: number | null;
  significant: boolean;
  reason: string;
};

/**
 * Two-proportion z-test. Variant 1 is control, variant 2 is the challenger.
 * Significant means two-tailed p < 0.05, at least 30 visits each, and at least one conversion.
 */
export function twoProportion(n1: number, c1: number, n2: number, c2: number): ProportionResult {
  if (n1 <= 0 || n2 <= 0) {
    return {
      p1: 0,
      p2: 0,
      z: 0,
      pValue: 1,
      lift: null,
      significant: false,
      reason: "One of the variants has no visits yet.",
    };
  }
  const p1 = c1 / n1;
  const p2 = c2 / n2;
  const pooled = (c1 + c2) / (n1 + n2);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  const z = se === 0 ? 0 : (p2 - p1) / se;
  const pValue = se === 0 ? 1 : Math.max(0, Math.min(1, 2 * (1 - normalCdf(Math.abs(z)))));
  const lift = p1 === 0 ? null : (p2 - p1) / p1;
  const enough = n1 >= 30 && n2 >= 30 && c1 + c2 > 0;
  const significant = enough && pValue < 0.05;
  let reason = "Not significant at 95%.";
  if (!enough) reason = "Need at least 30 visits in each variant and one conversion before calling a result.";
  else if (significant) reason = p2 >= p1 ? "Variant B is ahead at 95% confidence." : "Variant A is ahead at 95% confidence.";
  return { p1, p2, z, pValue, lift, significant, reason };
}
