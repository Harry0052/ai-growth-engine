import { tokens } from "./cluster";

export type CreatorVideo = {
  channel: string;
  channelId: string;
  title: string;
  url: string;
  published: string;
  views: number | null;
  description: string;
};

export type CreatorScore = {
  score: number;
  reasons: string[];
  viewsKnown: boolean;
};

export function scoreCreator(video: CreatorVideo, query: string, now = Date.now()): CreatorScore {
  const queryTokens = new Set(tokens(query));
  const hay = tokens(`${video.title} ${video.description} ${video.channel}`);
  const overlap = hay.filter((token) => queryTokens.has(token)).length;
  const relevance = queryTokens.size === 0 ? 0.4 : Math.min(1, overlap / Math.min(3, queryTokens.size));
  const published = Date.parse(video.published);
  const ageDays = Number.isFinite(published) ? Math.max(0, (now - published) / 86_400_000) : 90;
  const recency = Math.max(0, 1 - ageDays / 90);
  const reasons = [
    `Relevance ${Math.round(relevance * 100)} from words shared with “${query || "your query"}”.`,
    `Recency ${Math.round(recency * 100)} (${Math.round(ageDays)} days old).`,
  ];
  if (video.views == null) {
    reasons.push("Views are not in this feed, so they are not part of the score.");
    const score = Math.round(100 * (relevance * 0.65 + recency * 0.35));
    return { score, reasons, viewsKnown: false };
  }
  const viewScore = Math.min(1, Math.log10(video.views + 1) / 7);
  reasons.push(`Views ${video.views.toLocaleString("en-US")} from the public feed.`);
  const score = Math.round(100 * (relevance * 0.45 + recency * 0.25 + viewScore * 0.3));
  return { score, reasons, viewsKnown: true };
}
