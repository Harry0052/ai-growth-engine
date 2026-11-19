CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  detail TEXT NOT NULL DEFAULT '{}',
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  objective TEXT NOT NULL DEFAULT '',
  daily_budget_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'USD',
  source TEXT NOT NULL,
  raw_json TEXT NOT NULL DEFAULT '{}',
  updated_at BIGINT NOT NULL,
  UNIQUE (platform, external_id, source)
);

CREATE TABLE IF NOT EXISTS ad_sets (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT '',
  targeting TEXT NOT NULL DEFAULT '{}',
  source TEXT NOT NULL,
  UNIQUE (campaign_id, external_id, source)
);

CREATE TABLE IF NOT EXISTS ads (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  ad_set_id TEXT NOT NULL DEFAULT '',
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL,
  UNIQUE (campaign_id, external_id, source)
);

CREATE TABLE IF NOT EXISTS ad_metrics (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  metric_date TEXT NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  spend_cents INTEGER NOT NULL DEFAULT 0,
  conversions REAL NOT NULL DEFAULT 0,
  revenue_cents INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL,
  ad_set_name TEXT NOT NULL DEFAULT '',
  ad_name TEXT NOT NULL DEFAULT '',
  UNIQUE (campaign_id, metric_date, source, ad_set_name, ad_name)
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  anonymous_id TEXT,
  user_id TEXT,
  properties TEXT NOT NULL DEFAULT '{}',
  context TEXT NOT NULL DEFAULT '{}',
  source TEXT NOT NULL,
  traffic TEXT NOT NULL DEFAULT 'unknown',
  ts BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_name_ts ON events (event_name, ts);
CREATE INDEX IF NOT EXISTS idx_events_aid ON events (anonymous_id);
CREATE INDEX IF NOT EXISTS idx_events_traffic ON events (traffic);

CREATE TABLE IF NOT EXISTS experiments (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  variants TEXT NOT NULL,
  metric TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  experiment_key TEXT NOT NULL,
  anonymous_id TEXT NOT NULL,
  variant TEXT NOT NULL,
  assigned_at BIGINT NOT NULL,
  UNIQUE (experiment_key, anonymous_id)
);

CREATE TABLE IF NOT EXISTS tracking_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  events_json TEXT NOT NULL,
  utm_json TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS tiers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rate_bps INTEGER NOT NULL,
  bounty_cents INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS affiliates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL UNIQUE,
  tier_id TEXT NOT NULL,
  status TEXT NOT NULL,
  stripe_account_id TEXT NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS referral_clicks (
  id TEXT PRIMARY KEY,
  affiliate_id TEXT NOT NULL,
  anonymous_id TEXT,
  path TEXT NOT NULL DEFAULT '',
  referrer TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  traffic TEXT NOT NULL,
  ts BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversions (
  id TEXT PRIMARY KEY,
  affiliate_id TEXT NOT NULL,
  anonymous_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  revenue_cents INTEGER NOT NULL DEFAULT 0,
  commission_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  traffic TEXT NOT NULL,
  ts BIGINT NOT NULL,
  UNIQUE (affiliate_id, anonymous_id)
);

CREATE TABLE IF NOT EXISTS payouts (
  id TEXT PRIMARY KEY,
  affiliate_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT '',
  external_id TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL,
  decided_at BIGINT
);

CREATE TABLE IF NOT EXISTS payout_items (
  payout_id TEXT NOT NULL,
  conversion_id TEXT NOT NULL,
  PRIMARY KEY (payout_id, conversion_id)
);

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  from_name TEXT NOT NULL DEFAULT '',
  from_address TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  category TEXT NOT NULL,
  triage TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  body TEXT NOT NULL,
  author TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS flows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  channel TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  auto_send INTEGER NOT NULL DEFAULT 0,
  respect_quiet_hours INTEGER NOT NULL DEFAULT 1,
  definition TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,
  flow_id TEXT NOT NULL,
  subject_key TEXT NOT NULL,
  recipient TEXT NOT NULL DEFAULT '',
  step_index INTEGER NOT NULL,
  status TEXT NOT NULL,
  next_run_at BIGINT,
  created_at BIGINT NOT NULL,
  UNIQUE (flow_id, subject_key)
);

CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  status TEXT NOT NULL,
  flow_id TEXT NOT NULL DEFAULT '',
  ticket_id TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT '',
  provider_id TEXT NOT NULL DEFAULT '',
  error TEXT NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL,
  sent_at BIGINT
);

CREATE TABLE IF NOT EXISTS unsubscribes (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  address TEXT NOT NULL,
  ts BIGINT NOT NULL,
  UNIQUE (channel, address)
);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  body TEXT NOT NULL,
  rating INTEGER,
  author TEXT NOT NULL DEFAULT '',
  theme TEXT NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  query TEXT NOT NULL,
  payload TEXT NOT NULL,
  ok INTEGER NOT NULL,
  error TEXT NOT NULL DEFAULT '',
  fetched_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_snapshots_source ON snapshots (source, fetched_at);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  anonymous_id TEXT NOT NULL DEFAULT '',
  variant TEXT NOT NULL DEFAULT '',
  ref_code TEXT NOT NULL DEFAULT '',
  traffic TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  progress TEXT NOT NULL,
  updated_at BIGINT NOT NULL
);
