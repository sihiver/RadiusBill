-- ─────────────────────────────────────────────────────────────────────────────
-- Seed Data: RT/RW NET Billing System
-- Run AFTER migration 001_initial_schema.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- Packages
INSERT INTO packages (name, type, speed_upload, speed_download, duration, validity, price, description)
VALUES
  ('Hotspot Hemat 5Mbps',   'Hotspot', '2 Mbps', '5 Mbps',  'Unlimited', '30 Hari', 50000, 'Paket portal hotspot bulanan perumahan.'),
  ('Hotspot Eceran 2Mbps',  'Hotspot', '1 Mbps', '2 Mbps',  '12 Jam',    '1 Hari',  3000,  'Voucher eceran murah untuk akses harian.'),
  ('PPPoE Home 10Mbps',     'PPPoE',   '3 Mbps', '10 Mbps', 'Unlimited', '30 Hari', 100000,'Router rumah unlimited standar bulanan.'),
  ('PPPoE Premium 20Mbps',  'PPPoE',   '5 Mbps', '20 Mbps', 'Unlimited', '30 Hari', 180000,'Router rumah premium unlimited bulanan.')
ON CONFLICT DO NOTHING;

-- FreeRADIUS Group Policies
-- hotspot-5mbps
INSERT INTO radgroupcheck (groupname, attribute, op, value)
VALUES ('hotspot-5mbps', 'Auth-Type', ':=', 'Local')
ON CONFLICT DO NOTHING;

INSERT INTO radgroupreply (groupname, attribute, op, value)
VALUES ('hotspot-5mbps', 'Mikrotik-Rate-Limit', '=', '2M/5M')
ON CONFLICT DO NOTHING;

-- hotspot-2mbps
INSERT INTO radgroupcheck (groupname, attribute, op, value)
VALUES ('hotspot-2mbps', 'Auth-Type', ':=', 'Local')
ON CONFLICT DO NOTHING;

INSERT INTO radgroupreply (groupname, attribute, op, value)
VALUES ('hotspot-2mbps', 'Mikrotik-Rate-Limit', '=', '1M/2M')
ON CONFLICT DO NOTHING;

-- pppoe-10mbps
INSERT INTO radgroupcheck (groupname, attribute, op, value)
VALUES ('pppoe-10mbps', 'Auth-Type', ':=', 'Local')
ON CONFLICT DO NOTHING;

INSERT INTO radgroupreply (groupname, attribute, op, value)
VALUES ('pppoe-10mbps', 'Mikrotik-Rate-Limit', '=', '3M/10M')
ON CONFLICT DO NOTHING;

-- pppoe-20mbps
INSERT INTO radgroupcheck (groupname, attribute, op, value)
VALUES ('pppoe-20mbps', 'Auth-Type', ':=', 'Local')
ON CONFLICT DO NOTHING;

INSERT INTO radgroupreply (groupname, attribute, op, value)
VALUES ('pppoe-20mbps', 'Mikrotik-Rate-Limit', '=', '5M/20M')
ON CONFLICT DO NOTHING;

-- Sample Active Vouchers
INSERT INTO vouchers (code, password, package_id, package_name, price, status, ip_address, activated_at, expires_at, used_bytes)
VALUES
  ('RW-A93K7', 'RW-A93K7', 2, 'Hotspot Eceran 2Mbps', 3000, 'Active', '192.168.1.45', NOW() - INTERVAL '2 hours', NOW() + INTERVAL '18 hours', 440401920),
  ('RW-P82X9', 'RW-P82X9', 2, 'Hotspot Eceran 2Mbps', 3000, 'Active', '192.168.1.67', NOW() - INTERVAL '1 hour', NOW() + INTERVAL '22 hours', 115343360),
  ('RW-H92B8', 'RW-H92B8', 1, 'Hotspot Hemat 5Mbps',  50000,'Unused', NULL, NULL, NOW() + INTERVAL '30 days', 0),
  ('RW-Z17Q2', 'RW-Z17Q2', 1, 'Hotspot Hemat 5Mbps',  50000,'Unused', NULL, NULL, NOW() + INTERVAL '30 days', 0)
ON CONFLICT DO NOTHING;

-- Sync sample vouchers to radcheck
INSERT INTO radcheck (username, attribute, op, value)
VALUES
  ('RW-A93K7', 'Cleartext-Password', ':=', 'RW-A93K7'),
  ('RW-P82X9', 'Cleartext-Password', ':=', 'RW-P82X9'),
  ('RW-H92B8', 'Cleartext-Password', ':=', 'RW-H92B8'),
  ('RW-Z17Q2', 'Cleartext-Password', ':=', 'RW-Z17Q2')
ON CONFLICT DO NOTHING;

INSERT INTO radusergroup (username, groupname, priority)
VALUES
  ('RW-A93K7', 'hotspot-2mbps', 1),
  ('RW-P82X9', 'hotspot-2mbps', 1),
  ('RW-H92B8', 'hotspot-5mbps', 1),
  ('RW-Z17Q2', 'hotspot-5mbps', 1)
ON CONFLICT DO NOTHING;

-- Sample Members
INSERT INTO members (name, username, password, phone, package_id, package_name, expiry_date, is_active)
VALUES
  ('Budi Santoso', 'budi_san', 'budi123',  '081234567890', 1, 'Hotspot Hemat 5Mbps',  CURRENT_DATE + 28, TRUE),
  ('Siti Aminah',  'siti_a',   'siti456',  '085712345678', 1, 'Hotspot Hemat 5Mbps',  CURRENT_DATE + 20, TRUE),
  ('Rian Hidayat', 'rian_h',   'rian789',  '089987654321', 2, 'Hotspot Eceran 2Mbps', CURRENT_DATE + 1,  TRUE)
ON CONFLICT DO NOTHING;

-- Sync members to radcheck
INSERT INTO radcheck (username, attribute, op, value)
VALUES
  ('budi_san', 'Cleartext-Password', ':=', 'budi123'),
  ('siti_a',   'Cleartext-Password', ':=', 'siti456'),
  ('rian_h',   'Cleartext-Password', ':=', 'rian789')
ON CONFLICT DO NOTHING;

INSERT INTO radusergroup (username, groupname, priority)
VALUES
  ('budi_san', 'hotspot-5mbps', 1),
  ('siti_a',   'hotspot-5mbps', 1),
  ('rian_h',   'hotspot-2mbps', 1)
ON CONFLICT DO NOTHING;

-- Sample Routers (PPPoE)
INSERT INTO routers (customer_name, pppoe_user, pppoe_pass, router_ip, package_id, package_name, status, isolir)
VALUES
  ('Bapak Ahmad (Blok A3)', 'router_ahmad', 'ahmad123', '10.10.10.2', 3, 'PPPoE Home 10Mbps',    'Online',   FALSE),
  ('Ibu Ratna (Blok B12)',  'router_ratna', 'ratna456', '10.10.10.3', 3, 'PPPoE Home 10Mbps',    'Online',   FALSE),
  ('Pak Wahyu (Blok C8)',   'router_wahyu', 'wahyu789', '10.10.10.4', 4, 'PPPoE Premium 20Mbps', 'Offline',  FALSE),
  ('Bu Dewi (Blok F15)',    'router_dewi',  'dewi321',  '10.10.10.5', 3, 'PPPoE Home 10Mbps',    'Isolated', TRUE)
ON CONFLICT DO NOTHING;

-- Sync routers to radcheck
INSERT INTO radcheck (username, attribute, op, value)
VALUES
  ('router_ahmad', 'Cleartext-Password', ':=', 'ahmad123'),
  ('router_ratna', 'Cleartext-Password', ':=', 'ratna456'),
  ('router_wahyu', 'Cleartext-Password', ':=', 'wahyu789'),
  ('router_dewi',  'Cleartext-Password', ':=', 'dewi321'),
  ('router_dewi',  'Auth-Type',          ':=', 'Reject')    -- Isolir!
ON CONFLICT DO NOTHING;

INSERT INTO radusergroup (username, groupname, priority)
VALUES
  ('router_ahmad', 'pppoe-10mbps', 1),
  ('router_ratna', 'pppoe-10mbps', 1),
  ('router_wahyu', 'pppoe-20mbps', 1),
  ('router_dewi',  'pppoe-10mbps', 1)
ON CONFLICT DO NOTHING;

-- Sample Radius Logs
INSERT INTO radius_logs (log_type, message, created_at)
VALUES
  ('SYSTEM', 'System initialized. FreeRADIUS listening on port 1812/1813...', NOW() - INTERVAL '30 minutes'),
  ('AUTH',   'Auth: budi_san dari 192.168.1.120', NOW() - INTERVAL '20 minutes'),
  ('AUTH',   'Auth: router_ahmad dari 10.10.10.2', NOW() - INTERVAL '15 minutes'),
  ('REJECT', 'Reject: guest_temp — Invalid password', NOW() - INTERVAL '10 minutes'),
  ('ACCT',   'ACCT Start: budi_san session 88A9B2', NOW() - INTERVAL '5 minutes')
ON CONFLICT DO NOTHING;
