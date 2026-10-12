-- Soy Amor Eventos · Cloudflare D1 staging
-- SQLite schema; no credentials or personal production turns are copied here.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY CHECK(id=1),
  brand_name TEXT NOT NULL DEFAULT 'Soy Amor Universal 111',
  whatsapp_number TEXT,
  instagram_url TEXT,
  website_url TEXT,
  google_review_url TEXT,
  public_subtitle TEXT,
  whatsapp_instruction TEXT,
  waiting_message TEXT,
  completed_title TEXT,
  completed_message TEXT,
  review_prompt TEXT,
  closed_message TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  event_code TEXT NOT NULL,
  description TEXT,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  queue_opens_at TEXT,
  queue_closes_at TEXT,
  location_name TEXT,
  location_address TEXT,
  maps_url TEXT,
  official_url TEXT,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','finished','cancelled')),
  queue_status TEXT NOT NULL DEFAULT 'closed' CHECK(queue_status IN ('open','closed')),
  show_upcoming INTEGER NOT NULL DEFAULT 1,
  current_number INTEGER NOT NULL DEFAULT 0,
  now_serving_number INTEGER NOT NULL DEFAULT 0,
  max_turns INTEGER CHECK(max_turns IS NULL OR max_turns>0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS service_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER,
  price_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'EUR',
  included_with_entry INTEGER NOT NULL DEFAULT 0,
  whatsapp_extra TEXT,
  sort_order INTEGER NOT NULL DEFAULT 10,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  template_id TEXT REFERENCES service_templates(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER,
  price_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'EUR',
  sort_order INTEGER NOT NULL DEFAULT 10,
  active INTEGER NOT NULL DEFAULT 1,
  included_with_entry INTEGER NOT NULL DEFAULT 0,
  customized INTEGER NOT NULL DEFAULT 0,
  whatsapp_extra TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS turns (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  service_id TEXT REFERENCES services(id) ON DELETE SET NULL,
  number INTEGER NOT NULL CHECK(number>0),
  code TEXT NOT NULL,
  device_token TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'issued' CHECK(status IN ('issued','called','in_service','done','skipped','cancelled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id,number),
  UNIQUE(event_id,device_token)
);
CREATE INDEX IF NOT EXISTS idx_events_public ON events(status,queue_status,starts_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_services_event ON services(event_id,active,sort_order);
CREATE INDEX IF NOT EXISTS idx_turns_order ON turns(event_id,number,status);
CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT,
  role TEXT NOT NULL CHECK(role IN ('admin','staff')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
