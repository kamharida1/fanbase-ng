-- Migration: 05 — Admin roles & users
-- Fanbase NG

CREATE TABLE IF NOT EXISTS admin_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]',
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT admin_roles_slug_format CHECK (slug ~ '^[a-z0-9_]+$')
);

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role_id UUID NOT NULL REFERENCES admin_roles(id),
  profile_id UUID REFERENCES profiles(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  mfa_enabled BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users (role_id) WHERE is_active = true;

INSERT INTO admin_roles (slug, name, description, permissions, is_system) VALUES
  ('super_admin', 'Super Admin', 'Full platform access', '["*"]', true),
  ('admin', 'Admin', 'Operations and finance', '["users","creators","payouts","reports","moderation"]', true),
  ('moderator', 'Moderator', 'Content moderation only', '["moderation","reports"]', true);
