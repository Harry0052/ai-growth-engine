export type HookDraft = {
  hook: string;
  citation: string;
  quote: string;
  basis: "review" | "story" | "attention";
};

type Review = { text: string; rating?: number | null; author?: string; app?: string };
type Story = { title: string; url?: string; points?: number | null };

function sentence(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  const cut = clean.split(/(?<=[.!?])\s/)[0] ?? clean;
  return cut.length > 140 ? `${cut.slice(0, 139).trim()}…` : cut;
}

export function sourceBackedHooks(input: { reviews?: Review[]; stories?: Story[]; terms?: string[] }): HookDraft[] {
  const drafts: HookDraft[] = [];
  const reviews = input.reviews ?? [];
  const complaints = reviews.filter((review) => (review.rating ?? 5) <= 3 && review.text.trim());
  const praise = reviews.filter((review) => (review.rating ?? 0) >= 4 && review.text.trim());
  const picked = [...complaints.slice(0, 3), ...praise.slice(0, 2)];
  for (const review of picked) {
    const quote = sentence(review.text);
    const who = [review.author, review.app].filter(Boolean).join(" · ");
    const stars = review.rating ? `${review.rating}★` : "unrated";
    const complaint = (review.rating ?? 5) <= 3;
    drafts.push({
      hook: complaint
        ? `The complaint, in their words: “${quote}”`
        : `People already said it: “${quote}”`,
      citation: `Apple review${who ? ` · ${who}` : ""} · ${stars}`,
      quote,
      basis: "review",
    });
  }
  for (const story of (input.stories ?? []).slice(0, 2)) {
    if (!story.title) continue;
    drafts.push({
      hook: `Hacker News is arguing about this: ${story.title}`,
      citation: story.points != null ? `Hacker News · ${story.points} points` : "Hacker News",
      quote: story.title,
      basis: "story",
    });
  }
  for (const term of (input.terms ?? []).slice(0, 2)) {
    drafts.push({
      hook: `Attention is on “${term}”. Lead with that, then show the product.`,
      citation: "Repeated words in the live sources above",
      quote: term,
      basis: "attention",
    });
  }
  return drafts.slice(0, 8);
}
