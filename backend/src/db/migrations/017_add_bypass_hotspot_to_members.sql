-- Migration: Add bypass_hotspot and bypass_created columns to members table
ALTER TABLE members ADD COLUMN IF NOT EXISTS bypass_hotspot BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE members ADD COLUMN IF NOT EXISTS bypass_created BOOLEAN NOT NULL DEFAULT FALSE;
