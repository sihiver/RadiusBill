-- Migration 012: Add billing_type and fixed_date to packages table

ALTER TABLE packages 
ADD COLUMN IF NOT EXISTS billing_type VARCHAR(20) NOT NULL DEFAULT 'masa_aktif',
ADD COLUMN IF NOT EXISTS fixed_date INTEGER CHECK (fixed_date >= 1 AND fixed_date <= 31);
