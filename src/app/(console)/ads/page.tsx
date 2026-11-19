import { money, pct } from "@/lib/format";
import { getSetting } from "@/lib/repo";
import { DEFAULT_THRESHOLDS } from "@/lib/constants";
import { campaignBoard, thresholds } from "@/lib/services/ads";
import { importAdsAction, saveThresholdsAction } from "@/server/actions";
import { Badge, Card, Empty, PageTitle } from "@/components/ui";
import { CsvBox } from "@/components/csv-box";
import { CampaignButton, DemoButton, SyncButton } from "@/components/bound";

export const dynamic = "force-dynamic";

export default async function AdsPage() {
  const demo = (await getSetting("demo_mode")) === "1";
  const [board, rules] = await Promise.all([campaignBoard(demo), thresholds()]);
  return (
    <div>
      <PageTitle kicker="Paid" title="Scale or kill, only after you say so." body="Sync Meta, Google, or TikTok when those keys exist, or import an Ads Manager CSV. Recommendations use your thresholds. Approving a demo row is refused." />
      <div className="mb-4 flex flex-wrap gap-2">
        <SyncButton platform="meta" />
        <SyncButton platform="google" />
        <SyncButton platform="tiktok" />
        <DemoButton on={demo} />
      </div>
      <CsvBox label="Import a Meta, Google, or TikTok CSV export" action={importAdsAction} />
      {!board.length ? <div className="mt-4"><Empty title="No campaigns stored" body="Connect an ad account in Settings or import an export. Empty is the honest state." /></div> : null}
      <div className="mt-4 grid gap-3">
        {board.map((row) => (
          <Card key={row.campaign.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-medium">{row.campaign.name}</h2>
              <div className="flex gap-2">
                <Badge tone={row.campaign.source === "demo" ? "wait" : "stone"}>{row.campaign.source}</Badge>
                <Badge tone={row.judgement?.verdict === "scale" ? "live" : row.judgement?.verdict === "kill" ? "danger" : "stone"}>{row.judgement?.verdict ?? "no metrics"}</Badge>
              </div>
            </div>
            <p className="mt-2 text-sm text-muted">{row.campaign.platform} · {row.campaign.status} · {row.rowCount} metric rows{row.dates.length ? ` · ${row.dates[0]} to ${row.dates[row.dates.length - 1]}` : ""}</p>
            <p className="mt-2 text-sm">Spend {money(row.totals.spendCents, row.campaign.currency)} · CTR {pct(row.judgement?.ctr ?? null)} · CAC {money(row.judgement?.cacCents ?? null)} · ROAS {row.judgement?.roas == null ? "—" : row.judgement.roas.toFixed(2)}</p>
            <p className="mt-1 text-sm text-muted">{row.judgement?.reasons.join(" ")}</p>
            {row.judgement?.verdict === "kill" ? (
              <div className="mt-3"><CampaignButton id={row.campaign.id} action="pause" name={row.campaign.name} /></div>
            ) : null}
            {row.judgement?.verdict === "scale" ? (
              <div className="mt-3"><CampaignButton id={row.campaign.id} action="scale" name={row.campaign.name} /></div>
            ) : null}
          </Card>
        ))}
      </div>
      <Card className="mt-4">
        <h2 className="serif text-2xl">Your thresholds</h2>
        <form action={saveThresholdsAction} className="mt-3 grid gap-2 text-sm md:grid-cols-3">
          <label>Min spend $ <input name="minSpend" defaultValue={(rules.minSpendCents / 100).toString()} className="mt-1 w-full rounded-lg border border-line px-2 py-1" /></label>
          <label>Min impressions <input name="minImpressions" defaultValue={rules.minImpressions} className="mt-1 w-full rounded-lg border border-line px-2 py-1" /></label>
          <label>Kill ROAS <input name="killRoas" defaultValue={rules.killRoas} className="mt-1 w-full rounded-lg border border-line px-2 py-1" /></label>
          <label>Scale ROAS <input name="scaleRoas" defaultValue={rules.scaleRoas} className="mt-1 w-full rounded-lg border border-line px-2 py-1" /></label>
          <label>Min CTR % <input name="minCtr" defaultValue={(rules.minCtr * 100).toString()} className="mt-1 w-full rounded-lg border border-line px-2 py-1" /></label>
          <label>Target CAC $ <input name="targetCac" defaultValue={(rules.targetCacCents / 100).toString()} className="mt-1 w-full rounded-lg border border-line px-2 py-1" /></label>
          <button className="rounded-full bg-ink px-4 py-2 text-paper md:col-span-3" type="submit">Save thresholds</button>
        </form>
        <p className="mt-2 text-xs text-muted">Defaults are rules, not results. Current kill ROAS {DEFAULT_THRESHOLDS.killRoas} until you change it.</p>
      </Card>
    </div>
  );
}
