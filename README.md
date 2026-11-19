# AI Growth Engine

[Demo video (1080p)](docs/video/ai-growth-engine-1080p.mp4)

Operating system for the growth seat at a stealth consumer AI company launching in 2027. It is built to run on data you connect: ad accounts, analytics, a model, email, SMS, and Stripe. With no keys, it still does real work from public sources and from a first-party tracking endpoint.

Built by [Harry Malhi](https://github.com/Harry0052).

## Quickstart

```bash
npm install
npm run db:setup
npm run dev
```

Open http://127.0.0.1:3847 and sign in. `db:setup` creates `.env` (gitignored) and a local admin:

- email: `harry@localhost`
- password: `growth-engine-local` unless you set `ADMIN_PASSWORD`

Change that password before any public deploy. Production refuses the default password.

Record the demo from [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md). With the server running:

```bash
npm run live-test
```

That pulls live public sources, sends 240 real HTTP visits labeled as test traffic, attributes an affiliate conversion, and writes the weekly memo.

## Architecture

```text
Browser / snippet / load script
        │
        ▼
Next.js route handlers and server actions
        │
        ├── SQLite (local) or Postgres (DATABASE_URL)
        ├── Public sources (no key): Apple RSS, Hacker News, Wikimedia, Product Hunt, YouTube channel RSS
        └── Optional providers, only after a human approval click
              Meta, Google Ads, TikTok, GA4, Mixpanel, OpenAI, Anthropic, Ollama,
              Resend or SendGrid, Twilio, Stripe
```

| Path | What it does |
| --- | --- |
| `src/app` | UI and HTTP: `/api/track`, webhooks, referral links, the test landing |
| `src/lib` | Stats, CSV parsers, ad clients, lifecycle, memo, public-source parsers |
| `src/server` | Server actions. Secrets never go to the browser. |
| `scripts/live-test.ts` | External load script. User-Agent `GrowthEngineLiveTest/1.0`. |
| `data/` | Local SQLite. Gitignored. |

Auth is one admin. The session cookie is an HMAC signed with `AUTH_SECRET`. Every external action is written to the audit log with secrets redacted.

Postgres is used when `DATABASE_URL` starts with `postgres://` or `postgresql://`. Otherwise the app uses Node's built-in SQLite. On Vercel, `DATABASE_URL` is required. If the Postgres server has `pgvector`, the boot migration enables it and records that. Clustering still runs in the app from the words in the text, so a missing extension does not block the product.

## What is real, and what is not

Real without any paid key:

- Apple App Store search and customer-review RSS
- Hacker News via the Algolia API
- Wikimedia pageviews (this is not Google Trends; Google has no official keyless Trends API)
- The public Product Hunt Atom feed
- YouTube channel RSS, including view counts when the feed includes them
- First-party events at `POST /api/track` and a PostHog-shaped `POST /api/capture`
- The test landing at `/try`, with a stable 50/50 hash assignment and a two-proportion z-test
- Affiliate links at `/r/{code}`, click records, conversion attribution, commission math, and a CSV ledger
- Keyword clustering of feedback and reviews, with the quotes left intact
- A structured weekly memo built only from rows that exist

Real only when the matching env vars are set:

- Pulling and mutating Meta, Google Ads, and TikTok campaigns
- GA4 Data API and Mixpanel export imports
- OpenAI, Anthropic, or a local Ollama model for rewrites and the memo narrative
- Email through Resend or SendGrid, SMS through Twilio
- Stripe transfers

Never automatic:

- Pause and budget changes run only after an approval click, and only then call the ad API.
- Email and SMS send only after approval, unless that flow's auto-send switch is on. Test traffic does not enroll in flows.
- Stripe transfers run only after an approval click. Labeled test commission is calculated and excluded from payouts.
- Quiet hours default to 21:00–08:00 America/Los_Angeles. SMS `STOP` and email unsubscribe links are honored.

Not invented:

- Empty states stay empty. There is no placeholder CAC, LTV, or audience size.
- Reddit is requested. If Reddit refuses the network, the card says so and no posts are filled in.
- Meta Ad Library is not scraped. It loads only with `META_AD_LIBRARY_TOKEN`.
- TikTok Creative Center has no official keyless API, so it is not scraped.
- Source-backed hooks are templates around a real quote. They are not model output. Model text is labeled with the provider and model, and it is omitted when no model answers.
- Demo mode is off by default. Turning it on inserts rows named `EXAMPLE` and badges them. Those rows cannot be sent to an ad platform.

The load script's variant B clicks more often than variant A on purpose, so the significance math has a difference to read. The UI says that in the same words as the script. Those visits are not customers.

## Keys

Copy `.env.example`. Blank values are fine.

| Variables | Unlocks |
| --- | --- |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `AUTH_SECRET` | Sign-in. Required. |
| `DATABASE_URL` | Postgres in production. Omit locally to use SQLite. |
| `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` | Model rewrites, support is still human-approved, memo narrative. |
| `OLLAMA_BASE_URL`, `OLLAMA_MODEL` | Same features with a local model and no key. Default `http://127.0.0.1:11434` and `llama3.2`. |
| `LLM_PROVIDER` | Force `openai`, `anthropic`, or `ollama`. |
| `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID` | Sync and, after approval, pause or change Meta budgets. |
| `META_AD_LIBRARY_TOKEN` | Search the public Ad Library. |
| `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID`, plus an access token or the refresh-token trio | Google Ads search and approved mutations. |
| `TIKTOK_ACCESS_TOKEN`, `TIKTOK_ADVERTISER_ID` | TikTok campaigns and approved mutations. |
| `GA4_PROPERTY_ID`, `GA4_ACCESS_TOKEN` | Import GA4 event counts. They are tagged `import` and kept out of the product funnel. |
| `MIXPANEL_API_SECRET` | Import a Mixpanel export. |
| `YOUTUBE_API_KEY` | YouTube search on top of the keyless channel feeds. |
| `RESEND_API_KEY` or `SENDGRID_API_KEY`, and `EMAIL_FROM` | Send email after approval. |
| `RESEND_WEBHOOK_SECRET` | Verify inbound email. Without it the webhook rejects the call. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | Send SMS after approval. The inbound webhook checks the Twilio signature. |
| `STRIPE_SECRET_KEY` | Approved transfers to an affiliate's Stripe account id. |
| `TRACK_PUBLIC_KEY` | Require this public write key on `/api/track`. It ships in the snippet. Set it before the endpoint is on the internet. |
| `APP_ORIGIN` | Origin used in referral and unsubscribe links. |
| `CRON_SECRET` | Protect `GET /api/cron`, which also runs when lifecycle pages and product events are processed. |

Settings shows whether each variable is present. It never prints the value.

## Tracking snippet

```html
<script>
  window.__GE__ = { endpoint: "https://YOUR_HOST/api/track" };
</script>
<script src="https://YOUR_HOST/snippet.js"></script>
```

`window.ge.track("signup", { email: "ada@example.com" })` sends a named event. PostHog-style batches can `POST /api/capture`.

## Tests

```bash
npm test          # unit tests, including mocked ad APIs and the z-test
npm run test:e2e  # Playwright against the local tracking and affiliate path
npm run build
```

## Deploy

Do not deploy from this repo automatically. The app is ready for two targets.

### Docker

```bash
docker build -t growth-engine .
docker run --rm -p 3847:3847 \
  -e ADMIN_EMAIL=you@company.com \
  -e ADMIN_PASSWORD='a long password' \
  -e AUTH_SECRET="$(openssl rand -hex 32)" \
  -e APP_ORIGIN=https://growth.example.com \
  -v growth-data:/app/data \
  growth-engine
```

Mount a volume for SQLite, or set `DATABASE_URL` instead.

### Vercel

1. Create a Postgres database and set `DATABASE_URL`.
2. Set `ADMIN_EMAIL`, `ADMIN_PASSWORD` (not the local default), `AUTH_SECRET`, and `APP_ORIGIN`.
3. Import the repo. `vercel.json` sets a daily cron on `/api/cron`. Hourly crons need a plan that allows them; opening the app also processes due sends.
4. Add provider keys only for the channels you want live.

The first request creates the schema and the admin user.

## Demo

See [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) for the two-to-three minute shot list. Screenshots from a live run are in `docs/screenshots/`.
