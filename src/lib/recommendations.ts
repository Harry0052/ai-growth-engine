import type { Thresholds } from "./constants";

export type Verdict = "scale" | "kill" | "hold" | "insufficient";

export type CampaignMath = {
  impressions: number;
  clicks: number;
  spendCents: number;
  conversions: number;
  revenueCents: number;
};

export type Judgement = {
  verdict: Verdict;
  reasons: string[];
  cacCents: number | null;
  roas: number | null;
  ctr: number | null;
};

export function rates(input: CampaignMath) {
  const ctr = input.impressions > 0 ? input.clicks / input.impressions : null;
  const roas = input.spendCents > 0 ? input.revenueCents / input.spendCents : null;
  const cacCents = input.conversions > 0 ? input.spendCents / input.conversions : null;
  return { ctr, roas, cacCents };
}

export function judgeCampaign(input: CampaignMath, thresholds: Thresholds): Judgement {
  const { ctr, roas, cacCents } = rates(input);
  if (input.spendCents < thresholds.minSpendCents && input.impressions < thresholds.minImpressions) {
    return {
      verdict: "insufficient",
      reasons: ["Below the minimum spend and impression floor you set."],
      cacCents,
      roas,
      ctr,
    };
  }
  if (input.spendCents >= thresholds.minSpendCents && input.conversions === 0) {
    return {
      verdict: "kill",
      reasons: ["Spend is past your floor and there are no conversions."],
      cacCents,
      roas,
      ctr,
    };
  }
  if (roas != null && roas < thresholds.killRoas && input.spendCents >= thresholds.minSpendCents) {
    return {
      verdict: "kill",
      reasons: [`ROAS ${roas.toFixed(2)} is below your kill line of ${thresholds.killRoas}.`],
      cacCents,
      roas,
      ctr,
    };
  }
  if (
    ctr != null &&
    ctr < thresholds.minCtr &&
    input.impressions >= thresholds.minImpressions &&
    (cacCents == null || cacCents > thresholds.targetCacCents)
  ) {
    return {
      verdict: "kill",
      reasons: [
        `CTR ${(ctr * 100).toFixed(2)}% is below your minimum and CAC is not under the target.`,
      ],
      cacCents,
      roas,
      ctr,
    };
  }
  const scale =
    roas != null &&
    roas >= thresholds.scaleRoas &&
    cacCents != null &&
    cacCents <= thresholds.targetCacCents &&
    (ctr == null || ctr >= thresholds.minCtr);
  if (scale && roas != null) {
    return {
      verdict: "scale",
      reasons: [
        `ROAS ${roas.toFixed(2)} clears ${thresholds.scaleRoas}, CAC is within target, and CTR clears the floor.`,
      ],
      cacCents,
      roas,
      ctr,
    };
  }
  return {
    verdict: "hold",
    reasons: ["Does not clear the kill line or the scale line."],
    cacCents,
    roas,
    ctr,
  };
}
