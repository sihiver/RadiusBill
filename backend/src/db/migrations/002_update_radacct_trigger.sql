-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 002: Update radacct session trigger to keep used_bytes updated in real-time
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION trg_radacct_session_start()
RETURNS TRIGGER AS $$
DECLARE
    v_pkg_id INT;
    v_duration VARCHAR(50);
    v_validity VARCHAR(50);
    v_status VARCHAR(10);
    v_interval INTERVAL;
BEGIN
    -- 1. Handle activation if Unused when a session starts
    IF (TG_OP = 'INSERT' AND NEW.acctstarttime IS NOT NULL) OR
       (TG_OP = 'UPDATE' AND OLD.acctstarttime IS NULL AND NEW.acctstarttime IS NOT NULL) THEN
        -- Find voucher
        SELECT package_id, status INTO v_pkg_id, v_status
        FROM vouchers
        WHERE code = NEW.username;

        IF FOUND AND v_status = 'Unused' THEN
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

            -- Activate voucher (status = 'Active')
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

    -- 2. Handle Accounting Stop (set member active_session = FALSE)
    IF (TG_OP = 'UPDATE' AND OLD.acctstoptime IS NULL AND NEW.acctstoptime IS NOT NULL) OR
       (TG_OP = 'INSERT' AND NEW.acctstoptime IS NOT NULL) THEN
        UPDATE members
        SET active_session = FALSE,
            updated_at = NOW()
        WHERE username = NEW.username;
    END IF;

    -- 3. Always update connection info and accumulated usage (used_bytes) for vouchers
    UPDATE vouchers
    SET used_bytes = (
            SELECT COALESCE(SUM(acctinputoctets + acctoutputoctets), 0)
            FROM radacct
            WHERE username = NEW.username
        ),
        ip_address = COALESCE(NEW.framedipaddress::TEXT, ip_address),
        mac_address = COALESCE(NEW.callingstationid, mac_address),
        session_id = COALESCE(NEW.acctsessionid, session_id),
        updated_at = NOW()
    WHERE code = NEW.username;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
