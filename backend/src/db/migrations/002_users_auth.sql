-- Migration: Create users table for Authentication and RBAC
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'reseller', -- 'admin' or 'reseller'
  balance NUMERIC(10, 2) DEFAULT 0, -- Wallet balance for resellers
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
