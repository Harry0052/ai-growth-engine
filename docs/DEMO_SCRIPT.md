# Growth Engine demo script

Two to three minutes. Record the browser, not a terminal, except for one cutaway if you want to show `npm run live-test`. Every number on screen is either a live public source or a labeled test visit. Do not call the test visits customers.

## Before you hit record

```bash
npm install
npm run db:setup
npm run dev
```

Open http://127.0.0.1:3847 and sign in as `harry@localhost` with the password printed by `db:setup` (local default: `growth-engine-local`).

Optional, in a second terminal, after the server is up:

```bash
npm run live-test
```

That sends 240 real HTTP visits. The in-app button does the same thing if you would rather stay in the browser.

If Ollama is running, or `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` is set, the memo and hook rewrite will include a labeled model section. If not, say so and stay on the source-backed drafts. Do not read those drafts as model output.

## Shot list

| Time | What you show | What you say |
| --- | --- | --- |
| 0:00 | Overview. Point at the banner and the connection chips. | "This is Growth Engine. Nothing on this screen is a sample metric. Ads, email, SMS, and payouts stay off until a provider is connected and I approve the action." |
| 0:20 | Settings. Scroll the connection cards. | "Keys live in the environment. The page only says whether each one is set. Ollama is the no-key model path." |
| 0:35 | Discover. Click **Pull live public data**. Wait for Apple reviews, Hacker News, Wikipedia pageviews, Product Hunt, and YouTube. | "These are live public feeds. The reviews are Apple's. The pageviews are Wikimedia. Reddit is shown as refused if Reddit blocks us. I am not filling that in." |
| 1:05 | Click **Build a feature-gap report**. | "Same reviews, grouped by the words they share. The quotes are theirs." |
| 1:20 | Creative. Read one template and its citation. If a model is connected, click **Rewrite with a connected model** and point at the model name. | "The draft quotes the review. The rewrite, if you see one, is labeled with the model. If you don't see one, there is no model connected." |
| 1:40 | Open `/try` in a new tab. Show the test-surface line and the variant. Submit the test signup. | "This is the landing under test. The snippet posts to `/api/track`. The signup is stored here. It is not a customer." |
| 2:00 | Live test. Click **Send 240 labeled test visits**. Read the bias note out loud. | "These are scripted HTTP visits. Variant B is written to click more often so the math has a difference to read. They are labeled test traffic." |
| 2:25 | Experiments. Read visits, signup rates, z, and p. | "Two-proportion z-test. It will not call a winner without 30 visits on each side." |
| 2:40 | Affiliates. Show the `LIVETEST` link, clicks, conversions, and the line that test commission is not payable. | "The click went through `/r/LIVETEST`. The conversion is attributed. The test commission is calculated and excluded from payouts." |
| 2:55 | Weekly memo. Scroll the public section, the test section, and the gaps. | "The memo only uses rows we actually have. Empty sections stay empty. A narrative appears only if a model answered." |

## What not to say

- Don't say the test visits are users, customers, or revenue.
- Don't say a model wrote the source-backed hooks.
- Don't quote a CAC or LTV from the overview unless an ad account or a real purchase event is connected. The overview leaves those blank on purpose.
- Don't approve a pause or a payout on camera unless you intend the API call. Demo rows cannot be sent to an ad platform.
