-- Vidullanka PLC 5S Audit - Neon PostgreSQL
-- Run this once in the SAME Neon database used by the existing application.

CREATE TABLE IF NOT EXISTS five_s_users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','internal','external')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS five_s_user_sites (
  user_id BIGINT NOT NULL REFERENCES five_s_users(id) ON DELETE CASCADE,
  site TEXT NOT NULL,
  PRIMARY KEY (user_id, site)
);

CREATE TABLE IF NOT EXISTS five_s_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES five_s_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_five_s_sessions_token ON five_s_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_five_s_sessions_expiry ON five_s_sessions(expires_at);

CREATE TABLE IF NOT EXISTS five_s_audits (
  id BIGSERIAL PRIMARY KEY,
  organisation TEXT NOT NULL DEFAULT 'Vidullanka PLC',
  site TEXT NOT NULL,
  department TEXT,
  audit_month TEXT NOT NULL,
  auditor TEXT,
  auditor_type TEXT CHECK (auditor_type IN ('Internal Auditor','External Auditor')),
  scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  section_notes JSONB NOT NULL DEFAULT '{}'::jsonb,
  q14 JSONB NOT NULL DEFAULT '{"text":{},"score":{}}'::jsonb,
  special_note TEXT NOT NULL DEFAULT '',
  signature JSONB NOT NULL DEFAULT '{"dataUrl":"","signedAt":null}'::jsonb,
  overall_total INTEGER NOT NULL DEFAULT 0,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by BIGINT REFERENCES five_s_users(id) ON DELETE SET NULL,
  UNIQUE(site, audit_month)
);

CREATE INDEX IF NOT EXISTS idx_five_s_audits_site_month ON five_s_audits(site, audit_month);

-- Allowed Vidullanka plant/site list used by this application.
CREATE TABLE IF NOT EXISTS five_s_sites (
  site TEXT PRIMARY KEY,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO five_s_sites(site) VALUES
('BBO'),('BKN'),('BTO'),('EME'),('GNT'),('HOF'),('HRN'),('LKM'),('MGT'),('MVB'),('ORIC'),('RDP'),('UDW'),('VBL'),('WMB')
ON CONFLICT DO NOTHING;

-- IMPORTANT:
-- Do NOT store plain-text passwords here.
-- Use the included admin/create-user script or the Admin panel after the first admin is created.
