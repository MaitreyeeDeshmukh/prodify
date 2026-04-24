-- Migration 002: activity_events + api_keys tables
-- Run this in your InsForge dashboard → SQL Editor

-- Activity events (used by the dashboard activity feed)
CREATE TABLE IF NOT EXISTS activity_events (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"    TEXT NOT NULL,
  "projectId" TEXT,
  "projectName" TEXT,
  type        TEXT NOT NULL,
  message     TEXT NOT NULL,
  metadata    JSONB,
  "createdAt" TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_events_user_idx
  ON activity_events ("userId");

CREATE INDEX IF NOT EXISTS activity_events_project_idx
  ON activity_events ("projectId");

-- API keys (used by Settings → API Keys tab)
CREATE TABLE IF NOT EXISTS api_keys (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"     TEXT NOT NULL,
  name         TEXT NOT NULL DEFAULT 'My Key',
  token        TEXT NOT NULL UNIQUE,
  prefix       TEXT NOT NULL,
  "lastUsedAt" TIMESTAMPTZ,
  "createdAt"  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_keys_user_idx
  ON api_keys ("userId");

CREATE INDEX IF NOT EXISTS api_keys_token_idx
  ON api_keys (token);
