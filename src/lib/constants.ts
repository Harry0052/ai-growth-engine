export const LANDING_EXPERIMENT = "hero_headline";
export const LIVE_AFFILIATE_CODE = "LIVETEST";
export const LIVE_TEST_UA = "GrowthEngineLiveTest/1.0";

export const LIVE_TEST_BIAS =
  "Variant B is scripted to click more often than variant A so the significance math has a difference to read. These are labeled test visits, not customers.";

export const CLICK_RATE = { A: 0.22, B: 0.42 } as const;
export const SIGNUP_GIVEN_CLICK = 0.55;
export const PURCHASE_GIVEN_SIGNUP = 0.35;
export const TEST_PURCHASE_CENTS = 2000;

export const FUNNEL_STEPS = ["page_view", "cta_click", "signup", "purchase"] as const;

export const DEFAULT_THRESHOLDS = {
  minSpendCents: 2000,
  minImpressions: 1000,
  killRoas: 1,
  scaleRoas: 2,
  minCtr: 0.008,
  targetCacCents: 4000,
};

export type Thresholds = typeof DEFAULT_THRESHOLDS;

export const STARTER_CHANNELS = [
  { id: "UCXZCJLdBC09xxGZ6gcdrc6A", label: "OpenAI" },
  { id: "UCbfYPyITQ-7l4upoX8nvctg", label: "Two Minute Papers" },
  { id: "UChpleBmo18P08aKCIgti38g", label: "Matt Wolfe" },
  { id: "UC_x5XG1OV2P6uZZ5FSM9Ttw", label: "Google for Developers" },
];

export const LANDING_EVENTS = [
  {
    name: "page_view",
    description: "Test landing was served to a browser or to the labeled load script.",
    properties: [
      { name: "variant", type: "string", required: true },
      { name: "path", type: "string", required: false },
    ],
  },
  {
    name: "cta_click",
    description: "The primary call to action was clicked.",
    properties: [{ name: "variant", type: "string", required: true }],
  },
  {
    name: "signup",
    description: "The test form was submitted. This is not a customer account.",
    properties: [
      { name: "variant", type: "string", required: true },
      { name: "method", type: "string", required: false },
    ],
  },
  {
    name: "purchase",
    description: "A labeled test purchase amount was recorded. No card is charged.",
    properties: [
      { name: "variant", type: "string", required: true },
      { name: "revenue", type: "number", required: false },
    ],
  },
];

export const USER_AGENT = "GrowthEngine/1.0 (Harry Malhi; +https://github.com/Harry0052)";

export const TABLE_NAMES = [
  "users",
  "settings",
  "audit_log",
  "campaigns",
  "ad_sets",
  "ads",
  "ad_metrics",
  "events",
  "experiments",
  "assignments",
  "tracking_plans",
  "tiers",
  "affiliates",
  "referral_clicks",
  "conversions",
  "payouts",
  "payout_items",
  "tickets",
  "ticket_messages",
  "flows",
  "enrollments",
  "outbox",
  "unsubscribes",
  "feedback",
  "reports",
  "snapshots",
  "leads",
  "jobs",
] as const;
