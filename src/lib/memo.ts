import { money, num, pct } from "./format";
import type { ProportionResult } from "./stats";

export type MemoInput = {
  weekLabel: string;
  reviews?: { app: string; count: number; themes: Array<{ name: string; count: number; quote?: string }> };
  attention?: { article: string; last7: number | null; prior7: number | null; days: number };
  stories?: Array<{ title: string; points: number | null }>;
  experiment?: {
    visitsA: number;
    visitsB: number;
    conversionsA: number;
    conversionsB: number;
    result: ProportionResult;
    traffic: string;
  } | null;
  affiliate?: { code: string; clicks: number; conversions: number; commissionCents: number; traffic: string } | null;
  productFunnel?: Array<{ step: string; count: number }> | null;
  feedbackThemes?: Array<{ name: string; count: number }>;
  gaps: string[];
};

export function buildMemo(input: MemoInput) {
  const lines = [
    `# Weekly growth memo · ${input.weekLabel}`,
    "",
    "Figures below are counted from data stored in this Growth Engine. Empty sections stay empty.",
    "",
    "## What the public record says",
  ];
  if (!input.reviews && !input.attention && !(input.stories && input.stories.length)) {
    lines.push("No live public source has been pulled yet.");
  }
  if (input.reviews) {
    lines.push("", `Apple reviews for ${input.reviews.app}: ${input.reviews.count} in the latest fetch.`);
    if (!input.reviews.themes.length) lines.push("No repeated words to group.");
    for (const theme of input.reviews.themes) {
      lines.push(`- ${theme.name}: ${theme.count} review${theme.count === 1 ? "" : "s"}${theme.quote ? ` — “${theme.quote}”` : ""}`);
    }
  }
  if (input.attention) {
    const direction =
      input.attention.last7 == null || input.attention.prior7 == null
        ? "not enough days to compare"
        : input.attention.last7 === input.attention.prior7
          ? "flat versus the prior 7 days"
          : input.attention.last7 > input.attention.prior7
            ? "up versus the prior 7 days"
            : "down versus the prior 7 days";
    lines.push(
      "",
      `Wikipedia pageviews for ${input.attention.article}: ${input.attention.days} days returned. Last 7 days ${num(input.attention.last7)} views, prior 7 days ${num(input.attention.prior7)} (${direction}).`,
    );
  }
  if (input.stories?.length) {
    lines.push("", "Hacker News:");
    for (const story of input.stories.slice(0, 5)) {
      lines.push(`- ${story.title}${story.points == null ? "" : ` (${story.points} points)`}`);
    }
  }

  lines.push("", "## This product");
  if (!input.productFunnel) lines.push("No product traffic yet. Test traffic is reported separately and is not treated as customers.");
  else {
    lines.push("First-party funnel, product traffic only:");
    for (const step of input.productFunnel) lines.push(`- ${step.step}: ${step.count}`);
  }

  lines.push("", "## Labeled test");
  if (!input.experiment) lines.push("No labeled test visits yet.");
  else {
    const { experiment } = input;
    lines.push(
      `${experiment.traffic}. Variant A ${experiment.visitsA} visits, ${experiment.conversionsA} signups (${pct(experiment.visitsA ? experiment.conversionsA / experiment.visitsA : null)}). Variant B ${experiment.visitsB} visits, ${experiment.conversionsB} signups (${pct(experiment.visitsB ? experiment.conversionsB / experiment.visitsB : null)}).`,
      `z ${experiment.result.z.toFixed(2)}, p ${experiment.result.pValue.toFixed(3)}. ${experiment.result.reason}`,
    );
  }
  if (input.affiliate) {
    lines.push(
      `Affiliate ${input.affiliate.code} (${input.affiliate.traffic}): ${input.affiliate.clicks} clicks, ${input.affiliate.conversions} conversions, commission ${money(input.affiliate.commissionCents)}. Test commission is not payable.`,
    );
  }

  lines.push("", "## Feedback themes");
  if (!input.feedbackThemes?.length) lines.push("No feedback has been imported or captured.");
  else for (const theme of input.feedbackThemes) lines.push(`- ${theme.name}: ${theme.count}`);

  lines.push("", "## Not connected");
  if (!input.gaps.length) lines.push("Every tracked integration has credentials.");
  else for (const gap of input.gaps) lines.push(`- ${gap}`);

  lines.push(
    "",
    "## What to do next",
    "- Keep the variant that the test actually supports, or keep collecting if the result says it is not significant.",
    "- Turn the loudest review theme into one landing change, then measure it with the same snippet.",
    "- Connect an ad account or import an export before making a scale or kill call. There is no recommendation without those rows.",
  );
  return lines.join("\n");
}
