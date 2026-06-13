-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 004: Update vouchers for quota-based billing (Session-Timeout)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Add quota_seconds and used_seconds to vouchers if not exists
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS quota_seconds INT DEFAULT 0;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS used_seconds INT DEFAULT 0;

-- 2. Add same columns to voucher_logs for historical records
ALTER TABLE voucher_logs ADD COLUMN IF NOT EXISTS quota_seconds INT DEFAULT 0;
ALTER TABLE voucher_logs ADD COLUMN IF NOT EXISTS used_seconds INT DEFAULT 0;

-- 3. Replace the session start/stop trigger
CREATE OR REPLACE FUNCTION trg_radacct_session_start()
RETURNS TRIGGER AS $$
DECLARE
    v_pkg_id INT;
    v_duration VARCHAR(50);
    v_validity VARCHAR(50);
    v_status VARCHAR(10);
    v_interval INTERVAL;
    v_quota_seconds INT;
    v_used_seconds INT;
    v_remaining_seconds INT;
BEGIN
    -- =========================================================================
    -- 1. Handle activation if Unused when a session starts
    -- =========================================================================
    IF (TG_OP = 'INSERT' AND NEW.acctstarttime IS NOT NULL) OR
       (TG_OP = 'UPDATE' AND OLD.acctstarttime IS NULL AND NEW.acctstarttime IS NOT NULL) THEN
        
        -- Find voucher
        SELECT package_id, status, quota_seconds INTO v_pkg_id, v_status, v_quota_seconds
        FROM vouchers
        WHERE code = NEW.username;

        IF FOUND AND v_status = 'Unused' THEN
            -- Fetch package validity
            SELECT validity INTO v_validity
            FROM packages
            WHERE id = v_pkg_id;

            -- Default validity 1 day
            v_interval := INTERVAL '1 day';

            -- Parse validity (Absolute expiration date from first login)
            IF v_validity ILIKE '%hari%' THEN
                v_interval := (SUBSTRING(v_validity FROM '^[0-9]+')::INT || ' days')::INTERVAL;
            ELSIF v_validity ILIKE '%bulan%' THEN
                v_interval := (SUBSTRING(v_validity FROM '^[0-9]+')::INT * 30 || ' days')::INTERVAL;
            ELSIF v_validity ILIKE '%minggu%' THEN
                v_interval := (SUBSTRING(v_validity FROM '^[0-9]+')::INT * 7 || ' days')::INTERVAL;
            END IF;

            -- Activate voucher (status = 'Active')
            -- (We only set expires_at based on validity. Quota is handled via used_seconds)
            UPDATE vouchers
            SET status = 'Active',
                activated_at = NEW.acctstarttime,
                expires_at = NEW.acctstarttime + v_interval,
                updated_at = NOW()
            WHERE code = NEW.username;
        END IF;

        -- Update member status to active session
        UPDATE members
        SET active_session = TRUE,
            ip_address = NEW.framedipaddress::TEXT,
            mac_address = NEW.callingstationid,
            session_start = NEW.acctstarttime,
            updated_at = NOW()
        WHERE username = NEW.username;
    END IF;

    -- =========================================================================
    -- 2. Handle Accounting Stop (User Disconnected)
    -- =========================================================================
    IF (TG_OP = 'UPDATE' AND OLD.acctstoptime IS NULL AND NEW.acctstoptime IS NOT NULL) OR
       (TG_OP = 'INSERT' AND NEW.acctstoptime IS NOT NULL) THEN
       
        -- Set member active_session = FALSE
        UPDATE members
        SET active_session = FALSE,
            updated_at = NOW()
        WHERE username = NEW.username;
        
    END IF;

    -- =========================================================================
    -- 3. Always update connection info and accumulated usage (bytes & time)
    -- =========================================================================
    -- Calculate total used time across all sessions for this username
    SELECT COALESCE(SUM(acctsessiontime), 0) INTO v_used_seconds
    FROM radacct
    WHERE username = NEW.username;

    UPDATE vouchers
    SET used_bytes = (
            SELECT COALESCE(SUM(acctinputoctets + acctoutputoctets), 0)
            FROM radacct
            WHERE username = NEW.username
        ),
        used_seconds = v_used_seconds,
        ip_address = COALESCE(NEW.framedipaddress::TEXT, ip_address),
        mac_address = COALESCE(NEW.callingstationid, mac_address),
        session_id = COALESCE(NEW.acctsessionid, session_id),
        updated_at = NOW()
    WHERE code = NEW.username;

    -- =========================================================================
    -- 4. Automatically update Session-Timeout in radreply for Quota vouchers
    -- =========================================================================
    -- If it's a voucher and it has a quota, calculate remaining and update radreply
    SELECT quota_seconds INTO v_quota_seconds
    FROM vouchers
    WHERE code = NEW.username;

    IF FOUND AND v_quota_seconds > 0 THEN
        v_remaining_seconds := v_quota_seconds - v_used_seconds;
        IF v_remaining_seconds < 0 THEN
            v_remaining_seconds := 0;
        END IF;

        -- Update radreply
        UPDATE radreply 
        SET value = v_remaining_seconds::text 
        WHERE username = NEW.username AND attribute = 'Session-Timeout';
        
        -- If radreply row didn't exist for some reason, insert it
        IF NOT FOUND THEN
            INSERT INTO radreply (username, attribute, op, value)
            VALUES (NEW.username, 'Session-Timeout', ':=', v_remaining_seconds::text);
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
