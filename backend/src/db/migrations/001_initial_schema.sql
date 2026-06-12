-- ═══════════════════════════════════════════════════════════════════════════
-- RT/RW NET Billing System — PostgreSQL Schema
-- Includes: Billing tables + FreeRADIUS standard tables
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for LIKE query optimization

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PACKAGES — Paket Internet (Hotspot & PPPoE)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS packages (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    type            VARCHAR(10)  NOT NULL CHECK (type IN ('Hotspot', 'PPPoE')),
    speed_upload    VARCHAR(20)  NOT NULL DEFAULT '1 Mbps',
    speed_download  VARCHAR(20)  NOT NULL DEFAULT '5 Mbps',
    duration        VARCHAR(50)  NOT NULL DEFAULT 'Unlimited',
    validity        VARCHAR(50)  NOT NULL DEFAULT '30 Hari',
    price           INTEGER      NOT NULL DEFAULT 0,
    description     TEXT,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_packages_type       ON packages (type);
CREATE INDEX idx_packages_is_active  ON packages (is_active);
CREATE INDEX idx_packages_name_trgm  ON packages USING GIN (name gin_trgm_ops);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. VOUCHERS — Voucher AKTIF (Unused / Active)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vouchers (
    id              SERIAL PRIMARY KEY,
    code            VARCHAR(50)  NOT NULL,
    password        VARCHAR(100) NOT NULL,
    package_id      INTEGER      REFERENCES packages(id) ON DELETE SET NULL,
    package_name    VARCHAR(100) NOT NULL,
    price           INTEGER      NOT NULL DEFAULT 0,
    status          VARCHAR(10)  NOT NULL DEFAULT 'Unused' CHECK (status IN ('Unused', 'Active')),
    mac_binding     BOOLEAN      NOT NULL DEFAULT FALSE,
    mac_address     VARCHAR(20),
    ip_address      VARCHAR(20),
    activated_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    used_bytes      BIGINT       NOT NULL DEFAULT 0,        -- in bytes
    session_id      VARCHAR(64),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- !! MANDATORY INDEXES — vouchers !!
CREATE UNIQUE INDEX idx_vouchers_code        ON vouchers (code);
CREATE        INDEX idx_vouchers_status      ON vouchers (status);
CREATE        INDEX idx_vouchers_package_id  ON vouchers (package_id);
CREATE        INDEX idx_vouchers_expires_at  ON vouchers (expires_at) WHERE expires_at IS NOT NULL;
CREATE        INDEX idx_vouchers_ip_address  ON vouchers (ip_address) WHERE ip_address IS NOT NULL;
CREATE        INDEX idx_vouchers_mac_address ON vouchers (mac_address) WHERE mac_address IS NOT NULL;
CREATE        INDEX idx_vouchers_created_at  ON vouchers (created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. VOUCHER_LOGS — Voucher HANGUS / Expired (TABEL TERPISAH)
--    Data dari vouchers dipindahkan ke sini setelah expired
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS voucher_logs (
    id              SERIAL PRIMARY KEY,
    original_id     INTEGER      NOT NULL,   -- ID asli dari tabel vouchers
    code            VARCHAR(50)  NOT NULL,
    password        VARCHAR(100) NOT NULL,
    package_id      INTEGER,
    package_name    VARCHAR(100) NOT NULL,
    price           INTEGER      NOT NULL DEFAULT 0,
    mac_address     VARCHAR(20),
    ip_address      VARCHAR(20),
    activated_at    TIMESTAMPTZ,
    expired_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),  -- kapan expired
    used_bytes      BIGINT       NOT NULL DEFAULT 0,
    session_id      VARCHAR(64),
    expire_reason   VARCHAR(50)  NOT NULL DEFAULT 'auto' CHECK (expire_reason IN ('auto','manual','admin_kick','time_limit')),
    created_at      TIMESTAMPTZ  NOT NULL,   -- Waktu asli voucher dibuat
    moved_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()  -- Waktu dipindahkan ke log
);

-- !! MANDATORY INDEXES — voucher_logs !!
CREATE        INDEX idx_vlog_code          ON voucher_logs (code);
CREATE        INDEX idx_vlog_original_id   ON voucher_logs (original_id);
CREATE        INDEX idx_vlog_expired_at    ON voucher_logs (expired_at DESC);
CREATE        INDEX idx_vlog_moved_at      ON voucher_logs (moved_at DESC);
CREATE        INDEX idx_vlog_package_id    ON voucher_logs (package_id);
CREATE        INDEX idx_vlog_expire_reason ON voucher_logs (expire_reason);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. MEMBERS — Member Hotspot Bulanan
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS members (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    username        VARCHAR(50)  NOT NULL,
    password        VARCHAR(100) NOT NULL,
    phone           VARCHAR(20),
    email           VARCHAR(100),
    package_id      INTEGER      REFERENCES packages(id) ON DELETE SET NULL,
    package_name    VARCHAR(100),
    mac_binding     BOOLEAN      NOT NULL DEFAULT FALSE,
    mac_address     VARCHAR(20),
    balance         INTEGER      NOT NULL DEFAULT 0,
    expiry_date     DATE,
    active_session  BOOLEAN      NOT NULL DEFAULT FALSE,
    ip_address      VARCHAR(20),
    session_start   TIMESTAMPTZ,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- !! MANDATORY INDEXES — members !!
CREATE UNIQUE INDEX idx_members_username    ON members (username);
CREATE        INDEX idx_members_phone       ON members (phone);
CREATE        INDEX idx_members_expiry_date ON members (expiry_date);
CREATE        INDEX idx_members_is_active   ON members (is_active);
CREATE        INDEX idx_members_name_trgm   ON members USING GIN (name gin_trgm_ops);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. MEMBER_SESSIONS — Riwayat Sesi Member
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS member_sessions (
    id              SERIAL PRIMARY KEY,
    member_id       INTEGER      NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    session_id      VARCHAR(64),
    ip_address      VARCHAR(20),
    started_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    ended_at        TIMESTAMPTZ,
    used_bytes      BIGINT       NOT NULL DEFAULT 0,
    duration_secs   INTEGER
);

CREATE INDEX idx_msessions_member_id  ON member_sessions (member_id);
CREATE INDEX idx_msessions_started_at ON member_sessions (started_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. ROUTERS — Router PPPoE Pelanggan Rumah
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS routers (
    id              SERIAL PRIMARY KEY,
    customer_name   VARCHAR(100) NOT NULL,
    pppoe_user      VARCHAR(50)  NOT NULL,
    pppoe_pass      VARCHAR(100) NOT NULL,
    router_ip       INET,
    package_id      INTEGER      REFERENCES packages(id) ON DELETE SET NULL,
    package_name    VARCHAR(100),
    status          VARCHAR(20)  NOT NULL DEFAULT 'Online' CHECK (status IN ('Online', 'Offline', 'Isolated')),
    isolir          BOOLEAN      NOT NULL DEFAULT FALSE,
    isolir_reason   VARCHAR(200),
    isolir_since    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- !! MANDATORY INDEXES — routers !!
CREATE UNIQUE INDEX idx_routers_pppoe_user   ON routers (pppoe_user);
CREATE        INDEX idx_routers_status        ON routers (status);
CREATE        INDEX idx_routers_router_ip     ON routers (router_ip);
CREATE        INDEX idx_routers_cname_trgm    ON routers USING GIN (customer_name gin_trgm_ops);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RADIUS_LOGS — Log aktivitas FreeRADIUS (mirror untuk dashboard)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS radius_logs (
    id              SERIAL PRIMARY KEY,
    log_type        VARCHAR(10)  NOT NULL CHECK (log_type IN ('AUTH','REJECT','ACCT','SYSTEM')),
    username        VARCHAR(100),
    ip_address      VARCHAR(20),
    service         VARCHAR(20),
    action          VARCHAR(50),
    reason          VARCHAR(200),
    session_id      VARCHAR(64),
    message         TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- !! MANDATORY INDEXES — radius_logs !!
CREATE INDEX idx_rlogs_log_type   ON radius_logs (log_type);
CREATE INDEX idx_rlogs_username   ON radius_logs (username);
CREATE INDEX idx_rlogs_created_at ON radius_logs (created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. SYSTEM_SETTINGS — Konfigurasi Sistem
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_settings (
    key             VARCHAR(100) PRIMARY KEY,
    value           TEXT,
    description     VARCHAR(200),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_settings_key ON system_settings (key);

-- Defaults
INSERT INTO system_settings (key, value, description) VALUES
  ('radius_host',       '127.0.0.1',   'FreeRADIUS DB host'),
  ('radius_port',       '5432',        'FreeRADIUS DB port'),
  ('radius_secret',     'testing123',  'RADIUS shared secret'),
  ('mikrotik_host',     '192.168.88.1','Mikrotik API host'),
  ('mikrotik_port',     '8728',        'Mikrotik API port'),
  ('mikrotik_user',     'admin',       'Mikrotik API user'),
  ('mikrotik_pass',     '',            'Mikrotik API password'),
  ('auto_sync_interval','30',          'Auto-sync interval in seconds'),
  ('voucher_expire_cron','*/5 * * * *','Cron for auto expire vouchers'),
  ('app_name',          'RT/RW NET Billing', 'Application name'),
  ('ssid_name',         'RT_RW_NET_HOTSPOT', 'Hotspot SSID name')
ON CONFLICT (key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- FREERADIUS STANDARD TABLES
-- Compatible with FreeRADIUS rlm_sql PostgreSQL driver
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- radcheck — Authentication rules per user
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS radcheck (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(64)  NOT NULL DEFAULT '',
    attribute       VARCHAR(64)  NOT NULL DEFAULT '',
    op              VARCHAR(2)   NOT NULL DEFAULT '==',
    value           VARCHAR(253) NOT NULL DEFAULT ''
);

-- !! MANDATORY INDEXES — radcheck !!
CREATE INDEX idx_radcheck_username  ON radcheck (username);
CREATE INDEX idx_radcheck_attribute ON radcheck (attribute);

-- ─────────────────────────────────────────────────────────────────────────────
-- radreply — Reply attributes per user (speed limit, IP pool, etc.)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS radreply (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(64)  NOT NULL DEFAULT '',
    attribute       VARCHAR(64)  NOT NULL DEFAULT '',
    op              VARCHAR(2)   NOT NULL DEFAULT '=',
    value           VARCHAR(253) NOT NULL DEFAULT ''
);

CREATE INDEX idx_radreply_username  ON radreply (username);

-- ─────────────────────────────────────────────────────────────────────────────
-- radusergroup — User to group mapping
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS radusergroup (
    username        VARCHAR(64)  NOT NULL DEFAULT '',
    groupname       VARCHAR(64)  NOT NULL DEFAULT '',
    priority        INTEGER      NOT NULL DEFAULT 1
);

CREATE INDEX idx_radusergroup_username  ON radusergroup (username);
CREATE INDEX idx_radusergroup_groupname ON radusergroup (groupname);

-- ─────────────────────────────────────────────────────────────────────────────
-- radgroupcheck — Auth rules per group
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS radgroupcheck (
    id              SERIAL PRIMARY KEY,
    groupname       VARCHAR(64)  NOT NULL DEFAULT '',
    attribute       VARCHAR(64)  NOT NULL DEFAULT '',
    op              VARCHAR(2)   NOT NULL DEFAULT '==',
    value           VARCHAR(253) NOT NULL DEFAULT ''
);

CREATE INDEX idx_radgroupcheck_groupname ON radgroupcheck (groupname);

-- ─────────────────────────────────────────────────────────────────────────────
-- radgroupreply — Reply attributes per group
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS radgroupreply (
    id              SERIAL PRIMARY KEY,
    groupname       VARCHAR(64)  NOT NULL DEFAULT '',
    attribute       VARCHAR(64)  NOT NULL DEFAULT '',
    op              VARCHAR(2)   NOT NULL DEFAULT '=',
    value           VARCHAR(253) NOT NULL DEFAULT ''
);

CREATE INDEX idx_radgroupreply_groupname ON radgroupreply (groupname);

-- ─────────────────────────────────────────────────────────────────────────────
-- radacct — Accounting sessions (FreeRADIUS writes here)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS radacct (
    radacctid           BIGSERIAL PRIMARY KEY,
    acctsessionid       VARCHAR(64)  NOT NULL DEFAULT '',
    acctuniqueid        VARCHAR(32)  NOT NULL DEFAULT '',
    username            VARCHAR(64)  NOT NULL DEFAULT '',
    realm               VARCHAR(64),
    nasipaddress        INET         NOT NULL,
    nasportid           VARCHAR(15),
    nasporttype         VARCHAR(32),
    acctstarttime       TIMESTAMPTZ,
    acctupdatetime      TIMESTAMPTZ,
    acctstoptime        TIMESTAMPTZ,
    acctinterval        INTEGER,
    acctsessiontime     INTEGER      NOT NULL DEFAULT 0,
    acctauthentic       VARCHAR(32),
    connectinfo_start   VARCHAR(50),
    connectinfo_stop    VARCHAR(50),
    acctinputoctets     BIGINT       NOT NULL DEFAULT 0,
    acctoutputoctets    BIGINT       NOT NULL DEFAULT 0,
    calledstationid     VARCHAR(50)  NOT NULL DEFAULT '',
    callingstationid    VARCHAR(50)  NOT NULL DEFAULT '',
    acctterminatecause  VARCHAR(32)  NOT NULL DEFAULT '',
    servicetype         VARCHAR(32),
    framedprotocol      VARCHAR(32),
    framedipaddress     INET,
    framedipv6address   INET,
    framedipv6prefix    INET,
    framedinterfaceid   VARCHAR(44),
    delegatedipv6prefix INET,
    class               VARCHAR(64)
);

-- !! MANDATORY INDEXES — radacct !!
CREATE UNIQUE INDEX idx_radacct_acctuniqueid    ON radacct (acctuniqueid);
CREATE        INDEX idx_radacct_username         ON radacct (username);
CREATE        INDEX idx_radacct_acctsessionid    ON radacct (acctsessionid);
CREATE        INDEX idx_radacct_acctstarttime    ON radacct (acctstarttime DESC);
CREATE        INDEX idx_radacct_acctstoptime     ON radacct (acctstoptime DESC);
CREATE        INDEX idx_radacct_nasipaddress     ON radacct (nasipaddress);
CREATE        INDEX idx_radacct_framedipaddress  ON radacct (framedipaddress);
-- Partial index for active sessions (hot path query)
CREATE        INDEX idx_radacct_active_sessions  ON radacct (username, acctstarttime DESC)
    WHERE acctstoptime IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- radpostauth — Post-authentication log
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS radpostauth (
    id              BIGSERIAL PRIMARY KEY,
    username        VARCHAR(64)  NOT NULL DEFAULT '',
    pass            VARCHAR(64),
    reply           VARCHAR(32)  NOT NULL DEFAULT '',
    calledstationid VARCHAR(50)  NOT NULL DEFAULT '',
    callingstationid VARCHAR(50) NOT NULL DEFAULT '',
    authdate        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    class           VARCHAR(64)
);

-- !! MANDATORY INDEXES — radpostauth !!
CREATE INDEX idx_radpostauth_username  ON radpostauth (username);
CREATE INDEX idx_radpostauth_authdate  ON radpostauth (authdate DESC);
CREATE INDEX idx_radpostauth_reply     ON radpostauth (reply);

-- ─────────────────────────────────────────────────────────────────────────────
-- nas — NAS clients (MikroTik)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nas (
    id              SERIAL PRIMARY KEY,
    nasname         VARCHAR(128) NOT NULL,
    shortname       VARCHAR(32),
    type            VARCHAR(30)  DEFAULT 'other',
    ports           INTEGER,
    secret          VARCHAR(60)  NOT NULL DEFAULT 'testing123',
    server          VARCHAR(64),
    community       VARCHAR(50),
    description     VARCHAR(200) DEFAULT 'MikroTik NAS'
);

CREATE UNIQUE INDEX idx_nas_nasname ON nas (nasname);

-- Default MikroTik NAS
INSERT INTO nas (nasname, shortname, type, secret, description)
VALUES ('192.168.88.1', 'mikrotik', 'other', 'testing123', 'MikroTik Router')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger: update updated_at on UPDATE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_packages_updated_at   BEFORE UPDATE ON packages  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_vouchers_updated_at   BEFORE UPDATE ON vouchers  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_members_updated_at    BEFORE UPDATE ON members   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_routers_updated_at    BEFORE UPDATE ON routers   FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- View: active_sessions — gabungan radacct + vouchers/members
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW active_sessions AS
SELECT
    ra.radacctid,
    ra.username,
    ra.framedipaddress   AS ip_address,
    ra.callingstationid  AS mac_address,
    ra.nasipaddress      AS nas_ip,
    ra.acctstarttime     AS started_at,
    ra.acctsessiontime   AS session_secs,
    ra.acctinputoctets + ra.acctoutputoctets AS total_bytes,
    CASE
        WHEN v.id IS NOT NULL THEN 'voucher'
        WHEN m.id IS NOT NULL THEN 'member'
        ELSE 'pppoe'
    END AS user_type
FROM radacct ra
LEFT JOIN vouchers v ON v.code = ra.username
LEFT JOIN members  m ON m.username = ra.username
WHERE ra.acctstoptime IS NULL;

COMMENT ON VIEW active_sessions IS 'Semua sesi aktif dari FreeRADIUS radacct (hotspot + PPPoE)';

-- ─────────────────────────────────────────────────────────────────────────────
-- radacct accounting session trigger — update vouchers and members in real time
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_radacct_session_start()
RETURNS TRIGGER AS $$
DECLARE
    v_pkg_id INT;
    v_duration VARCHAR(50);
    v_validity VARCHAR(50);
    v_status VARCHAR(10);
    v_interval INTERVAL;
BEGIN
    -- Handle Accounting Start (INSERT with starttime set, or UPDATE that sets starttime)
    IF (TG_OP = 'INSERT' AND NEW.acctstarttime IS NOT NULL) OR
       (TG_OP = 'UPDATE' AND OLD.acctstarttime IS NULL AND NEW.acctstarttime IS NOT NULL) THEN
        -- Find voucher
        SELECT package_id, status INTO v_pkg_id, v_status
        FROM vouchers
        WHERE code = NEW.username;

        IF FOUND THEN
            IF v_status = 'Unused' THEN
                -- Fetch package duration/validity
                SELECT duration, validity INTO v_duration, v_validity
                FROM packages
                WHERE id = v_pkg_id;

                -- Default interval 1 day
                v_interval := INTERVAL '1 day';

                -- Parse interval
                IF v_duration ILIKE '%jam%' THEN
                    v_interval := (SUBSTRING(v_duration FROM '^[0-9]+')::INT || ' hours')::INTERVAL;
                ELSIF v_duration ILIKE '%hari%' THEN
                    v_interval := (SUBSTRING(v_duration FROM '^[0-9]+')::INT || ' days')::INTERVAL;
                ELSIF v_validity ILIKE '%hari%' THEN
                    v_interval := (SUBSTRING(v_validity FROM '^[0-9]+')::INT || ' days')::INTERVAL;
                END IF;

                -- Activate voucher
                UPDATE vouchers
                SET status = 'Active',
                    activated_at = NEW.acctstarttime,
                    expires_at = NEW.acctstarttime + v_interval,
                    ip_address = NEW.framedipaddress::TEXT,
                    mac_address = NEW.callingstationid,
                    session_id = NEW.acctsessionid,
                    updated_at = NOW()
                WHERE code = NEW.username;
            ELSE
                -- Update active session info
                UPDATE vouchers
                SET ip_address = NEW.framedipaddress::TEXT,
                    mac_address = NEW.callingstationid,
                    session_id = NEW.acctsessionid,
                    updated_at = NOW()
                WHERE code = NEW.username;
            END IF;
        END IF;

        -- Update member status
        UPDATE members
        SET active_session = TRUE,
            ip_address = NEW.framedipaddress::TEXT,
            mac_address = NEW.callingstationid,
            session_start = NEW.acctstarttime,
            updated_at = NOW()
        WHERE username = NEW.username;
    END IF;

    -- Handle Accounting Stop (either UPDATE where acctstoptime is set, or INSERT with acctstoptime set)
    IF (TG_OP = 'UPDATE' AND OLD.acctstoptime IS NULL AND NEW.acctstoptime IS NOT NULL) OR
       (TG_OP = 'INSERT' AND NEW.acctstoptime IS NOT NULL) THEN
        UPDATE members
        SET active_session = FALSE,
            updated_at = NOW()
        WHERE username = NEW.username;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_radacct_session ON radacct;
CREATE TRIGGER trg_radacct_session
AFTER INSERT OR UPDATE ON radacct
FOR EACH ROW
EXECUTE FUNCTION trg_radacct_session_start();
