import { clip, compact } from "@/lib/format";
import { getSetting } from "@/lib/repo";
import { publicState } from "@/lib/services/discover";
import { featureGapAction, pullPublicAction, saveDiscoverAction, saveReviewsAction } from "@/server/actions";
import { Badge, Card, Empty, Live, PageTitle } from "@/components/ui";
import { Runner } from "@/components/runner";
import { STARTER_CHANNELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const [state, app, topic, wiki, channels] = await Promise.all([
    publicState(),
    getSetting("discover_app"),
    getSetting("discover_topic"),
    getSetting("discover_wiki"),
    getSetting("youtube_channels"),
  ]);
  const bySource = new Map(state.map((entry) => [entry.source, entry.ok || entry.latest]));
  const itunes = bySource.get("itunes")?.payload as { apps?: Array<{ name: string; seller: string; rating: number | null; ratingCount: number | null }>; reviews?: Array<{ title: string; body: string; rating: number | null; author: string }> } | undefined;
  const hn = bySource.get("hn")?.payload as { stories?: Array<{ title: string; url: string; points: number | null; author: string }> } | undefined;
  const wikiPoints = bySource.get("wiki")?.payload as { points?: Array<{ date: string; views: number }> } | undefined;
  const posts = bySource.get("producthunt")?.payload as { posts?: Array<{ title: string; url: string; author: string; summary: string }> } | undefined;
  const videos = bySource.get("youtube")?.payload as { videos?: Array<{ title: string; channel: string; url: string; views: number | null; score: number; reasons: string[] }>; errors?: string[] } | undefined;
  const reddit = state.find((entry) => entry.source === "reddit");

  return (
    <div>
      <PageTitle kicker="Live public data" title="Listen before you spend." body="These feeds are official public endpoints. Nothing here is a scraped login, and missing sources stay missing." />
      <form action={saveDiscoverAction} className="mb-4 grid gap-2 rounded-2xl border border-line bg-card p-4 md:grid-cols-4">
        <input name="app" defaultValue={app || "ChatGPT"} className="rounded-xl border border-line px-3 py-2 text-sm" aria-label="App" />
        <input name="topic" defaultValue={topic || "consumer AI"} className="rounded-xl border border-line px-3 py-2 text-sm" aria-label="Topic" />
        <input name="wiki" defaultValue={wiki || "ChatGPT"} className="rounded-xl border border-line px-3 py-2 text-sm" aria-label="Wikipedia title" />
        <input name="channels" defaultValue={channels || ""} placeholder="YouTube channel ids, optional" className="rounded-xl border border-line px-3 py-2 text-sm" />
        <button className="rounded-full bg-ink px-4 py-2 text-sm text-paper md:col-span-1" type="submit">Save queries</button>
        <div className="md:col-span-3"><Runner label="Pull live public data" action={pullPublicAction} /></div>
      </form>
      {!itunes?.reviews?.length ? <Empty title="No live pull yet" body="Save a query and pull. Apple reviews, Hacker News, Wikipedia pageviews, Product Hunt, and YouTube channel feeds come back without a key." /> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between gap-2"><h2 className="serif text-2xl">App Store</h2><Live>Apple RSS</Live></div>
          {itunes?.apps?.[0] ? <p className="mt-2 text-sm">{itunes.apps[0].name} · {itunes.apps[0].seller} · Apple rating {itunes.apps[0].rating?.toFixed(2) ?? "—"} from {compact(itunes.apps[0].ratingCount)} ratings</p> : <p className="mt-2 text-sm text-muted">No app yet.</p>}
          <ul className="mt-3 space-y-3 text-sm">
            {(itunes?.reviews ?? []).slice(0, 6).map((review, index) => (
              <li key={index}>
                <p className="font-medium">{review.rating ? `${review.rating}★` : "No stars"} · {review.author || "Anonymous"}</p>
                <p className="text-muted">{clip(review.body || review.title, 220)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Runner label="Save reviews as feedback" action={saveReviewsAction} tone="ghost" />
            <Runner label="Build a feature-gap report" action={featureGapAction} tone="ghost" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between"><h2 className="serif text-2xl">Hacker News</h2><Live>Algolia API</Live></div>
          <ul className="mt-3 space-y-2 text-sm">
            {(hn?.stories ?? []).slice(0, 8).map((story) => (
              <li key={story.title}><a className="underline" href={story.url || "#"}>{story.title}</a> <span className="text-muted">{story.points ?? "—"} points · {story.author}</span></li>
            ))}
          </ul>
        </Card>
        <Card>
          <div className="flex items-center justify-between"><h2 className="serif text-2xl">Wikipedia attention</h2><Live>Wikimedia</Live></div>
          <p className="mt-2 text-sm text-muted">Not Google Trends. Google does not offer a keyless Trends API, so this is pageviews.</p>
          <ul className="mt-3 grid grid-cols-2 gap-1 text-xs">
            {(wikiPoints?.points ?? []).slice(-14).map((point) => (
              <li key={point.date} className="flex justify-between rounded-lg bg-ink/5 px-2 py-1"><span>{point.date}</span><span>{compact(point.views)}</span></li>
            ))}
          </ul>
        </Card>
        <Card>
          <div className="flex items-center justify-between"><h2 className="serif text-2xl">Product Hunt</h2><Live>Public Atom feed</Live></div>
          <ul className="mt-3 space-y-2 text-sm">
            {(posts?.posts ?? []).slice(0, 6).map((post) => (
              <li key={post.url}><a className="underline" href={post.url}>{post.title}</a> <span className="text-muted">{post.author} · {clip(post.summary, 90)}</span></li>
            ))}
          </ul>
        </Card>
        <Card>
          <div className="flex items-center justify-between"><h2 className="serif text-2xl">Creators</h2><Live>YouTube channel RSS</Live></div>
          <p className="mt-2 text-xs text-muted">Starter channels: {STARTER_CHANNELS.map((channel) => channel.label).join(", ")}. Score uses title overlap, recency, and views only when the feed includes them.</p>
          <ul className="mt-3 space-y-2 text-sm">
            {(videos?.videos ?? []).slice(0, 6).map((video) => (
              <li key={video.url}><a className="underline" href={video.url}>{video.title}</a><p className="text-muted">{video.channel} · score {video.score} · views {video.views == null ? "not in feed" : compact(video.views)}</p></li>
            ))}
          </ul>
          {videos?.errors?.length ? <p className="mt-2 text-xs text-danger">{videos.errors.join(" ")}</p> : null}
        </Card>
        <Card>
          <div className="flex items-center justify-between"><h2 className="serif text-2xl">Reddit and ad libraries</h2><Badge tone={reddit?.latest?.ok ? "live" : "wait"}>{reddit?.latest?.ok ? "Live" : "Not available"}</Badge></div>
          <p className="mt-2 text-sm text-muted">{reddit?.latest?.error || reddit?.ok?.error || "Pull to check Reddit."}</p>
          <p className="mt-3 text-sm text-muted">Meta Ad Library and TikTok Creative Center are not scraped. Ad Library loads only when META_AD_LIBRARY_TOKEN is set. TikTok Creative Center has no official keyless API.</p>
        </Card>
      </div>
    </div>
  );
}
