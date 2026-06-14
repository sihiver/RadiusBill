-- Migration 012: Add billing_type and fixed_date to packages table

ALTER TABLE packages
ADD COLUMN billing_type VARCHAR(20) DEFAULT 'masa_aktif',
ADD COLUMN fixed_date INTEGER DEFAULT NULL;
