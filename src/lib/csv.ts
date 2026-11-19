import { asNumber, moneyToCents } from "./format";

export type CsvRow = Record<string, string>;

export function parseCsv(text: string): CsvRow[] {
  const input = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (char === "\n") {
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  if (cell.length || row.length) {
    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);
  }
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.trim().toLowerCase().replace(/\s+/g, " "));
  return rows.slice(1).map((values) => {
    const record: CsvRow = {};
    headers.forEach((header, index) => {
      if (header) record[header] = (values[index] ?? "").trim();
    });
    return record;
  });
}

function pick(row: CsvRow, names: string[]) {
  for (const name of names) {
    if (row[name] != null && row[name] !== "") return row[name];
  }
  return "";
}

export type NormalizedAdRow = {
  platform: "meta" | "google" | "tiktok" | "unknown";
  campaign: string;
  adSet: string;
  ad: string;
  date: string;
  impressions: number;
  clicks: number;
  spendCents: number;
  conversions: number;
  revenueCents: number;
};

export function detectAdsPlatform(headers: string[]): NormalizedAdRow["platform"] {
  const set = new Set(headers);
  if (set.has("ad set name") || set.has("amount spent (usd)") || set.has("amount spent")) return "meta";
  if (set.has("ad group name") && (set.has("impression") || set.has("click (destination)"))) return "tiktok";
  if (set.has("ad group") || set.has("conv. value") || set.has("currency code")) return "google";
  if (set.has("campaign name") && set.has("cost")) return "tiktok";
  return "unknown";
}

export function parseAdsCsv(text: string): { platform: NormalizedAdRow["platform"]; rows: NormalizedAdRow[] } {
  const records = parseCsv(text);
  if (!records.length) return { platform: "unknown", rows: [] };
  const platform = detectAdsPlatform(Object.keys(records[0]));
  const rows = records
    .map((row) => {
      const campaign = pick(row, ["campaign name", "campaign", "campaign_name"]);
      if (!campaign) return null;
      const date = pick(row, ["day", "date", "reporting starts", "stat time day"]) || "undated";
      return {
        platform,
        campaign,
        adSet: pick(row, ["ad set name", "ad group name", "ad group", "adset name"]),
        ad: pick(row, ["ad name", "ad", "ad title"]),
        date,
        impressions: Math.round(asNumber(pick(row, ["impressions", "impression"]))),
        clicks: Math.round(asNumber(pick(row, ["link clicks", "clicks", "click (destination)", "clicks (all)", "click"]))),
        spendCents: moneyToCents(pick(row, ["amount spent (usd)", "amount spent", "cost", "spend", "cost (usd)"])),
        conversions: asNumber(pick(row, ["purchases", "results", "conversions", "conversion", "website purchases"])),
        revenueCents: moneyToCents(
          pick(row, [
            "purchase conversion value",
            "purchases conversion value",
            "conv. value",
            "conversion value",
            "total conversion value",
          ]),
        ),
      } satisfies NormalizedAdRow;
    })
    .filter((row): row is NormalizedAdRow => Boolean(row));
  return { platform, rows };
}

export type FeedbackCsvRow = { body: string; rating: number | null; author: string; source: string };

export function parseFeedbackCsv(text: string, fallbackSource = "csv"): FeedbackCsvRow[] {
  return parseCsv(text)
    .map((row) => {
      const title = pick(row, ["title", "review title"]);
      const body = pick(row, ["body", "review", "text", "content", "feedback", "comment"]);
      const combined = [title, body].filter(Boolean).join(" — ");
      if (!combined) return null;
      const ratingRaw = pick(row, ["rating", "stars", "score"]);
      const rating = ratingRaw ? Math.round(asNumber(ratingRaw)) : null;
      return {
        body: combined,
        rating: rating && rating > 0 ? rating : null,
        author: pick(row, ["author", "reviewer", "name", "user"]),
        source: pick(row, ["source"]) || fallbackSource,
      };
    })
    .filter((row): row is FeedbackCsvRow => Boolean(row));
}
