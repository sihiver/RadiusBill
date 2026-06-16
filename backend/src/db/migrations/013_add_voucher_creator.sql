-- Migration 013: Add created_by column to vouchers and voucher_logs

ALTER TABLE vouchers 
ADD COLUMN IF NOT EXISTS created_by VARCHAR(50);

ALTER TABLE voucher_logs 
ADD COLUMN IF NOT EXISTS created_by VARCHAR(50);

-- Update existing vouchers/logs to have 'admin' as creator by default (to prevent null issues)
UPDATE vouchers SET created_by = 'admin' WHERE created_by IS NULL;
UPDATE voucher_logs SET created_by = 'admin' WHERE created_by IS NULL;
