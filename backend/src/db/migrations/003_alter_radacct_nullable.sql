-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 003: Alter radacct table columns to make them nullable
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE radacct ALTER COLUMN acctterminatecause DROP NOT NULL;
ALTER TABLE radacct ALTER COLUMN acctsessiontime DROP NOT NULL;
ALTER TABLE radacct ALTER COLUMN calledstationid DROP NOT NULL;
ALTER TABLE radacct ALTER COLUMN callingstationid DROP NOT NULL;
