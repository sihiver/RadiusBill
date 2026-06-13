-- Migration 005: Parse Mikrotik Time Format

CREATE OR REPLACE FUNCTION parse_mikrotik_time(t VARCHAR) RETURNS INTERVAL AS $$
DECLARE
    res INTERVAL := '0 seconds';
    match_arr TEXT[];
    part VARCHAR;
    val INT;
    unit CHAR(1);
BEGIN
    FOR match_arr IN SELECT regexp_matches(t, '(\d+[wdhms])', 'gi') LOOP
        part := match_arr[1];
        val := regexp_replace(part, '[^0-9]', '', 'g')::INT;
        unit := lower(regexp_replace(part, '[0-9]', '', 'g'));
        IF unit = 'w' THEN res := res + (val || ' weeks')::INTERVAL;
        ELSIF unit = 'd' THEN res := res + (val || ' days')::INTERVAL;
        ELSIF unit = 'h' THEN res := res + (val || ' hours')::INTERVAL;
        ELSIF unit = 'm' THEN res := res + (val || ' minutes')::INTERVAL;
        ELSIF unit = 's' THEN res := res + (val || ' seconds')::INTERVAL;
        END IF;
    END LOOP;
    
    -- fallback to old format
    IF res = '0 seconds'::INTERVAL THEN
        IF t ILIKE '%hari%' THEN res := (SUBSTRING(t FROM '^[0-9]+')::INT || ' days')::INTERVAL;
        ELSIF t ILIKE '%jam%' THEN res := (SUBSTRING(t FROM '^[0-9]+')::INT || ' hours')::INTERVAL;
        ELSIF t ILIKE '%menit%' THEN res := (SUBSTRING(t FROM '^[0-9]+')::INT || ' minutes')::INTERVAL;
        ELSIF t ILIKE '%bulan%' THEN res := (SUBSTRING(t FROM '^[0-9]+')::INT * 30 || ' days')::INTERVAL;
        ELSIF t ILIKE '%minggu%' THEN res := (SUBSTRING(t FROM '^[0-9]+')::INT * 7 || ' days')::INTERVAL;
        END IF;
    END IF;
    
    RETURN res;
END;
$$ LANGUAGE plpgsql;

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
        SELECT package_id, status, quota_seconds, mac_binding, mac_address 
        INTO v_pkg_id, v_status, v_quota_seconds, v_mac_binding, v_mac_address
        FROM vouchers
        WHERE code = NEW.username;

        IF FOUND THEN
            -- MAC Binding is handled by FreeRADIUS unlang script in sites-enabled/default.
            -- The trigger only updates vouchers.mac_address below on first login.

            -- Handle Activation
            IF v_status = 'Unused' THEN
                SELECT validity INTO v_validity
                FROM packages
                WHERE id = v_pkg_id;

                v_interval := INTERVAL '1 day';

                IF v_validity IS NOT NULL THEN
                    v_interval := parse_mikrotik_time(v_validity);
                END IF;
                IF v_interval = '0 seconds'::INTERVAL THEN
                    v_interval := INTERVAL '1 day';
                END IF;

                UPDATE vouchers
                SET status = 'Active',
                    activated_at = NEW.acctstarttime,
                    expires_at = NEW.acctstarttime + v_interval,
                    updated_at = NOW()
                WHERE code = NEW.username;
            END IF;
        END IF;

        -- Update member status to active session
        UPDATE members
        SET active_session = TRUE,
            ip_address = COALESCE(NEW.framedipaddress::TEXT, ip_address),
            mac_address = COALESCE(mac_address, NEW.callingstationid),
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
        mac_address = COALESCE(mac_address, NEW.callingstationid),
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
