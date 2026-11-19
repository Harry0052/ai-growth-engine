import { STARTER_CHANNELS, USER_AGENT } from "../constants";
import { scoreCreator, type CreatorVideo } from "../creators";
import { env } from "../env";
import { addAudit, addSnapshot, getSetting, latestSnapshot } from "../repo";
import { parseAtom, parseHn, parseItunesReviews, parseItunesSearch, parseReddit, parseWiki } from "../public/parse";

async function grab(url: string, headers: Record<string, string> = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, { headers: { "user-agent": USER_AGENT, accept: "application/json, application/xml, text/xml, */*", ...headers }, signal: ctrl.signal });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch (error) {
    return { ok: false, status: 0, text: error instanceof Error ? error.message : "Request failed" };
  } finally {
    clearTimeout(timer);
  }
}

function ymd(date: Date) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

export async function pullPublic(actor: string) {
  const appQuery = (await getSetting("discover_app")) || "ChatGPT";
  const topic = (await getSetting("discover_topic")) || "consumer AI";
  const wikiTitle = ((await getSetting("discover_wiki")) || "ChatGPT").replace(/ /g, "_");
  const channelSetting = await getSetting("youtube_channels");
  const channels = channelSetting
    ? channelSetting.split(/[\s,]+/).filter(Boolean).map((id) => ({ id, label: id }))
    : STARTER_CHANNELS;
  const summary: Array<{ source: string; ok: boolean; error?: string; count: number }> = [];

  const search = await grab(`https://itunes.apple.com/search?term=${encodeURIComponent(appQuery)}&entity=software&limit=5`);
  let apps: ReturnType<typeof parseItunesSearch> = [];
  let reviews: ReturnType<typeof parseItunesReviews> = [];
  if (!search.ok) {
    await addSnapshot({ source: "itunes", query: appQuery, payload: {}, ok: false, error: `Apple search failed (${search.status}). ${search.text.slice(0, 180)}` });
    summary.push({ source: "itunes", ok: false, error: "Apple search failed", count: 0 });
  } else {
    try {
      apps = parseItunesSearch(JSON.parse(search.text));
    } catch {
      apps = [];
    }
    const chosen = apps[0];
    if (chosen) {
      const reviewRes = await grab(`https://itunes.apple.com/us/rss/customerreviews/id=${chosen.id}/sortBy=mostRecent/json`);
      if (reviewRes.ok) {
        try {
          reviews = parseItunesReviews(JSON.parse(reviewRes.text));
        } catch {
          reviews = [];
        }
      }
    }
    await addSnapshot({ source: "itunes", query: appQuery, payload: { apps, reviews }, ok: true });
    summary.push({ source: "itunes", ok: true, count: reviews.length });
  }

  const hn = await grab(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(topic)}&tags=story&hitsPerPage=20`);
  if (!hn.ok) {
    await addSnapshot({ source: "hn", query: topic, payload: {}, ok: false, error: `Hacker News failed (${hn.status}).` });
    summary.push({ source: "hn", ok: false, error: "Hacker News failed", count: 0 });
  } else {
    const stories = parseHn(JSON.parse(hn.text));
    await addSnapshot({ source: "hn", query: topic, payload: { stories }, ok: true });
    summary.push({ source: "hn", ok: true, count: stories.length });
  }

  const end = new Date(Date.now() - 86400000);
  const start = new Date(end.getTime() - 13 * 86400000);
  const wiki = await grab(
    `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(wikiTitle)}/daily/${ymd(start)}/${ymd(end)}`,
  );
  if (!wiki.ok) {
    await addSnapshot({ source: "wiki", query: wikiTitle, payload: {}, ok: false, error: `Wikipedia returned ${wiki.status}.` });
    summary.push({ source: "wiki", ok: false, error: `Wikipedia returned ${wiki.status}`, count: 0 });
  } else {
    const points = parseWiki(JSON.parse(wiki.text));
    await addSnapshot({ source: "wiki", query: wikiTitle, payload: { points }, ok: true });
    summary.push({ source: "wiki", ok: true, count: points.length });
  }

  const ph = await grab("https://www.producthunt.com/feed");
  if (!ph.ok) {
    await addSnapshot({ source: "producthunt", query: "front page", payload: {}, ok: false, error: `Product Hunt feed returned ${ph.status}.` });
    summary.push({ source: "producthunt", ok: false, count: 0 });
  } else {
    const posts = parseAtom(ph.text).map((item) => ({ title: item.title, url: item.url, author: item.author, published: item.published, summary: item.summary }));
    await addSnapshot({ source: "producthunt", query: "front page", payload: { posts }, ok: true });
    summary.push({ source: "producthunt", ok: true, count: posts.length });
  }

  const videos: CreatorVideo[] = [];
  const channelErrors: string[] = [];
  for (const channel of channels) {
    const feed = await grab(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channel.id)}`);
    if (!feed.ok) {
      channelErrors.push(`${channel.label} returned ${feed.status}`);
      continue;
    }
    for (const item of parseAtom(feed.text).slice(0, 4)) {
      videos.push({
        channel: item.author || channel.label,
        channelId: item.channelId || channel.id,
        title: item.title,
        url: item.url || (item.videoId ? `https://www.youtube.com/watch?v=${item.videoId}` : ""),
        published: item.published,
        views: item.views,
        description: item.summary,
      });
    }
  }
  const scored = videos
    .map((video) => ({ ...video, ...scoreCreator(video, `${appQuery} ${topic}`) }))
    .sort((a, b) => b.score - a.score);
  await addSnapshot({
    source: "youtube",
    query: channels.map((channel) => channel.id).join(","),
    payload: { videos: scored, errors: channelErrors, mode: "channel-rss" },
    ok: scored.length > 0,
    error: scored.length ? "" : channelErrors.join("; ") || "No videos in the public channel feeds.",
  });
  summary.push({ source: "youtube", ok: scored.length > 0, count: scored.length, error: channelErrors[0] });

  if (env("YOUTUBE_API_KEY")) {
    const searched = await grab(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=8&q=${encodeURIComponent(topic)}&key=${encodeURIComponent(env("YOUTUBE_API_KEY"))}`,
    );
    if (searched.ok) {
      const data = JSON.parse(searched.text) as { items?: Array<{ id?: { videoId?: string }; snippet?: Record<string, string> }> };
      const items = (data.items ?? []).map((item) => ({
        title: item.snippet?.title ?? "",
        channel: item.snippet?.channelTitle ?? "",
        url: item.id?.videoId ? `https://www.youtube.com/watch?v=${item.id.videoId}` : "",
        published: item.snippet?.publishedAt ?? "",
      }));
      await addSnapshot({ source: "youtube-search", query: topic, payload: { items }, ok: true });
      summary.push({ source: "youtube-search", ok: true, count: items.length });
    } else {
      await addSnapshot({ source: "youtube-search", query: topic, payload: {}, ok: false, error: `YouTube API returned ${searched.status}.` });
      summary.push({ source: "youtube-search", ok: false, count: 0 });
    }
  }

  const reddit = await grab("https://www.reddit.com/r/artificial/hot.json?limit=20");
  if (!reddit.ok || reddit.text.trim().startsWith("<")) {
    await addSnapshot({
      source: "reddit",
      query: "r/artificial",
      payload: {},
      ok: false,
      error: `Reddit refused this network (${reddit.status || "blocked"}). No Reddit posts were filled in. Reddit's public JSON now requires an approved app.`,
    });
    summary.push({ source: "reddit", ok: false, error: "Reddit refused the request", count: 0 });
  } else {
    const posts = parseReddit(JSON.parse(reddit.text));
    await addSnapshot({ source: "reddit", query: "r/artificial", payload: { posts }, ok: true });
    summary.push({ source: "reddit", ok: true, count: posts.length });
  }

  const libraryToken = env("META_AD_LIBRARY_TOKEN") || "";
  if (libraryToken) {
    const library = await grab(
      `https://graph.facebook.com/v21.0/ads_archive?search_terms=${encodeURIComponent(topic)}&ad_reached_countries=US&ad_type=ALL&fields=page_name,ad_creative_bodies,ad_delivery_start_time,ad_snapshot_url&limit=15&access_token=${encodeURIComponent(libraryToken)}`,
    );
    if (!library.ok) {
      await addSnapshot({ source: "meta_ad_library", query: topic, payload: {}, ok: false, error: `Ad Library returned ${library.status}.` });
      summary.push({ source: "meta_ad_library", ok: false, count: 0 });
    } else {
      const data = JSON.parse(library.text) as { data?: unknown[] };
      await addSnapshot({ source: "meta_ad_library", query: topic, payload: { ads: data.data ?? [] }, ok: true });
      summary.push({ source: "meta_ad_library", ok: true, count: (data.data ?? []).length });
    }
  }

  await addAudit(actor, "public.pull", null, { summary });
  return summary;
}

export async function publicState() {
  const sources = ["itunes", "hn", "wiki", "producthunt", "youtube", "youtube-search", "reddit", "meta_ad_library"];
  const entries = await Promise.all(sources.map(async (source) => ({ source, latest: await latestSnapshot(source), ok: await latestSnapshot(source, true) })));
  return entries;
}
