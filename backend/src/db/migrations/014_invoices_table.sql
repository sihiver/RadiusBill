-- ─────────────────────────────────────────────────────────────────────────────
-- 014_invoices_table.sql
-- Invoices table for Payment Gateway integration & Client Portal
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    username VARCHAR(50) NOT NULL, -- references members(username) or routers(pppoe_user)
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('member', 'pppoe')),
    amount INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'UNPAID' CHECK (status IN ('UNPAID', 'PAID', 'EXPIRED', 'FAILED')),
    payment_method VARCHAR(50),
    payment_ref VARCHAR(100), -- reference ID from Tripay/Midtrans
    checkout_url TEXT,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    expired_at TIMESTAMPTZ NOT NULL
);

-- Index for querying client invoices
CREATE INDEX IF NOT EXISTS idx_invoices_username ON invoices(username);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_ref ON invoices(payment_ref);

-- Insert setting for Payment Gateway keys
INSERT INTO system_settings (key, value, description) VALUES
  ('pg_active',         'mock',        'Active payment gateway (mock, tripay, midtrans)'),
  ('pg_api_key',        '',            'Payment Gateway API Key'),
  ('pg_private_key',    '',            'Payment Gateway Private Key'),
  ('pg_merchant_code',  '',            'Payment Gateway Merchant Code')
ON CONFLICT (key) DO NOTHING;
