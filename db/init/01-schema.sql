-- PlacidWay Social Autopilot: application database.
-- n8n keeps its own metadata in the `n8n` database. Everything the pipeline
-- owns (dedupe store, drafts, run log, alerts, engagement) lives here in `pw`.

CREATE DATABASE pw;
\connect pw

-- Runtime configuration. The dashboard edits these at runtime; secrets stay in .env.
CREATE TABLE settings (
  key         text PRIMARY KEY,
  value       text NOT NULL,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO settings (key, value, description) VALUES
  ('publish_mode',        'approval', 'approval = drafts wait for a human in the dashboard; auto = publish as soon as guardrails pass'),
  ('dry_run',             'true',     'true = simulate the Facebook call (no network write); false = call the Graph API'),
  ('post_time',           'now',      '"now" publishes immediately; "HH:MM" (local time) schedules natively on Facebook'),
  ('brand_images',        'true',     'Overlay a PlacidWay brand bar on the featured image (or render a card when none exists)'),
  ('crosspost_instagram', 'false',    'Also publish the branded image to the linked Instagram Business account'),
  ('max_attempts',        '3',        'LLM generation attempts before a draft is escalated to human review'),
  ('avoid_recent_categories', '3',    'Do not repeat a treatment category used in the last N posts'),
  ('rotation',            '{"0":"answer","1":"article","2":"package","3":"answer","4":"article","5":"package","6":"news"}',
                          'Content type per weekday (0 = Sunday). Falls back to any type when the day''s type has no fresh item');

-- One row per source URL. UNIQUE(source_url) is the hard "never post the same URL twice" guarantee.
CREATE TABLE posts (
  id              serial PRIMARY KEY,
  source_url      text NOT NULL UNIQUE,
  content_type    text NOT NULL,              -- article | package | answer | news
  category        text,
  title           text,
  summary         text,
  image_url       text,                       -- original featured image on PlacidWay CDN
  media_path      text,                       -- branded image written by the pipeline (served at /media/...)
  source_excerpt  text,                       -- the exact source text the LLM was allowed to use
  source_published_at timestamptz,
  post_text       text,
  hook            text,
  hashtags        text[],
  claims          jsonb,                      -- [{statement, source_quote}] produced by the generator
  guardrail       jsonb,                      -- full rule + LLM review report of the final attempt
  attempts        int NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'drafting',
                  -- drafting | pending_approval | needs_review | approved | scheduled | published | rejected | failed
  dry_run         boolean NOT NULL DEFAULT true,
  scheduled_for   timestamptz,
  fb_post_id      text,
  fb_permalink    text,
  ig_media_id     text,
  edited          boolean NOT NULL DEFAULT false,
  reviewed_by     text,
  review_note     text,
  run_id          text,
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  published_at    timestamptz
);
CREATE INDEX posts_status_idx  ON posts (status);
CREATE INDEX posts_created_idx ON posts (created_at DESC);

-- One row per pipeline/publish execution.
CREATE TABLE runs (
  id            serial PRIMARY KEY,
  run_id        text NOT NULL UNIQUE,         -- n8n execution id (prefixed by workflow)
  workflow      text NOT NULL,                -- pipeline | publish | engagement
  trigger       text,                         -- schedule | manual | dashboard | approval
  mode          text,
  dry_run       boolean,
  status        text NOT NULL DEFAULT 'running', -- running | success | needs_review | skipped | error
  item_url      text,
  post_id       int REFERENCES posts(id) ON DELETE SET NULL,
  fb_post_id    text,
  error         text,
  details       jsonb,
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz
);
CREATE INDEX runs_started_idx ON runs (started_at DESC);

-- Alerts surface on the dashboard (and optionally a Slack/Discord webhook).
CREATE TABLE alerts (
  id            serial PRIMARY KEY,
  severity      text NOT NULL DEFAULT 'error', -- info | warning | error
  source        text NOT NULL,
  message       text NOT NULL,
  details       jsonb,
  acknowledged  boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Engagement read-back, one snapshot per fetch so trends are visible.
CREATE TABLE engagement (
  id          serial PRIMARY KEY,
  post_id     int NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  reactions   int,
  comments    int,
  shares      int,
  clicks      int,
  raw         jsonb,
  fetched_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX engagement_post_idx ON engagement (post_id, fetched_at DESC);

CREATE VIEW post_latest_engagement AS
SELECT DISTINCT ON (post_id) post_id, reactions, comments, shares, clicks, fetched_at
FROM engagement ORDER BY post_id, fetched_at DESC;
