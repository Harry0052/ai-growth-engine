export function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export function stripTags(value: string) {
  return decodeXml(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(entry: string, name: string) {
  const match = entry.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return match ? decodeXml(match[1].trim()) : "";
}

function attr(entry: string, name: string) {
  const match = entry.match(new RegExp(`${name}="([^"]+)"`));
  return match ? decodeXml(match[1]) : "";
}

export type AtomItem = {
  title: string;
  url: string;
  author: string;
  published: string;
  summary: string;
  views: number | null;
  videoId: string;
  channelId: string;
};

export function parseAtom(xml: string): AtomItem[] {
  return xml
    .split("<entry>")
    .slice(1)
    .map((chunk) => chunk.split("</entry>")[0] ?? "")
    .map((entry) => {
      const link = entry.match(/<link[^>]*href="([^"]+)"[^>]*\/?>/);
      const viewsRaw = attr(entry, "views");
      const views = viewsRaw && Number.isFinite(Number(viewsRaw)) ? Number(viewsRaw) : null;
      return {
        title: stripTags(tag(entry, "title")),
        url: link?.[1] ?? "",
        author: stripTags(tag(entry, "name")),
        published: tag(entry, "published") || tag(entry, "updated"),
        summary: stripTags(tag(entry, "content") || tag(entry, "media:description") || tag(entry, "summary")),
        views,
        videoId: tag(entry, "yt:videoId"),
        channelId: tag(entry, "yt:channelId"),
      };
    })
    .filter((item) => item.title);
}

export type ReviewItem = {
  id: string;
  title: string;
  body: string;
  rating: number | null;
  author: string;
};

function label(value: unknown) {
  if (value && typeof value === "object" && "label" in value) return String((value as { label: unknown }).label ?? "");
  return "";
}

export function parseItunesReviews(data: unknown): ReviewItem[] {
  const feed = data as { feed?: { entry?: unknown } };
  const raw = feed.feed?.entry;
  const entries = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return entries
    .map((entry) => {
      const record = entry as Record<string, unknown>;
      const author = record.author as Record<string, unknown> | undefined;
      const rating = Number(label(record["im:rating"]));
      return {
        id: label(record.id),
        title: label(record.title),
        body: label(record.content),
        rating: Number.isFinite(rating) && rating > 0 ? rating : null,
        author: label(author?.name),
      };
    })
    .filter((review) => review.body || review.title);
}

export type ItunesApp = {
  id: number;
  name: string;
  seller: string;
  rating: number | null;
  ratingCount: number | null;
  url: string;
};

export function parseItunesSearch(data: unknown): ItunesApp[] {
  const results = (data as { results?: unknown[] }).results ?? [];
  return results
    .map((item) => {
      const app = item as Record<string, unknown>;
      return {
        id: Number(app.trackId),
        name: String(app.trackName ?? ""),
        seller: String(app.sellerName ?? ""),
        rating: typeof app.averageUserRating === "number" ? app.averageUserRating : null,
        ratingCount: typeof app.userRatingCount === "number" ? app.userRatingCount : null,
        url: String(app.trackViewUrl ?? ""),
      };
    })
    .filter((app) => app.id && app.name);
}

export type HnStory = {
  id: string;
  title: string;
  url: string;
  author: string;
  points: number | null;
  comments: number | null;
  createdAt: string;
};

export function parseHn(data: unknown): HnStory[] {
  const hits = (data as { hits?: unknown[] }).hits ?? [];
  return hits
    .map((item) => {
      const hit = item as Record<string, unknown>;
      return {
        id: String(hit.objectID ?? ""),
        title: String(hit.title ?? hit.story_title ?? ""),
        url: String(hit.url ?? ""),
        author: String(hit.author ?? ""),
        points: typeof hit.points === "number" ? hit.points : null,
        comments: typeof hit.num_comments === "number" ? hit.num_comments : null,
        createdAt: String(hit.created_at ?? ""),
      };
    })
    .filter((story) => story.title);
}

export type WikiPoint = { date: string; views: number };

export function parseWiki(data: unknown): WikiPoint[] {
  const items = (data as { items?: unknown[] }).items ?? [];
  return items
    .map((item) => {
      const row = item as { timestamp?: string; views?: number };
      const stamp = String(row.timestamp ?? "");
      const date = stamp.length >= 8 ? `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}` : "";
      return { date, views: typeof row.views === "number" ? row.views : 0 };
    })
    .filter((point) => point.date);
}

export type RedditPost = {
  title: string;
  url: string;
  author: string;
  score: number | null;
  comments: number | null;
};

export function parseReddit(data: unknown): RedditPost[] {
  const children = (data as { data?: { children?: unknown[] } }).data?.children ?? [];
  return children
    .map((child) => {
      const post = (child as { data?: Record<string, unknown> }).data ?? {};
      return {
        title: String(post.title ?? ""),
        url: post.permalink ? `https://www.reddit.com${String(post.permalink)}` : String(post.url ?? ""),
        author: String(post.author ?? ""),
        score: typeof post.score === "number" ? post.score : null,
        comments: typeof post.num_comments === "number" ? post.num_comments : null,
      };
    })
    .filter((post) => post.title);
}
