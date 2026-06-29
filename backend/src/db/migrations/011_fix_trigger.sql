CREATE OR REPLACE FUNCTION trg_radacct_session_start()
RETURNS TRIGGER AS $$
DECLARE
    v_pkg_id INT;
    v_duration VARCHAR(50);
    v_validity VARCHAR(50);
    v_status VARCHAR(10);
    v_interval INTERVAL;
    v_price INT;
    v_pkg_name VARCHAR(100);
    v_used_seconds INT;
BEGIN
    -- 1. Handle activation if Unused when a session starts
    IF (TG_OP = 'INSERT' AND NEW.acctstarttime IS NOT NULL) OR
       (TG_OP = 'UPDATE' AND OLD.acctstarttime IS NULL AND NEW.acctstarttime IS NOT NULL) THEN
        
        -- Find voucher
        SELECT package_id, status INTO v_pkg_id, v_status
        FROM vouchers
        WHERE code = NEW.username;

        IF FOUND AND v_status = 'Unused' THEN
            -- Fetch package duration/validity, price, and name
            SELECT duration, validity, cost_price, name INTO v_duration, v_validity, v_price, v_pkg_name
            FROM packages
            WHERE id = v_pkg_id;

            v_interval := INTERVAL '1 day';

            IF v_validity IS NOT NULL THEN
                v_interval := parse_mikrotik_time(v_validity);
            END IF;
            IF v_interval = '0 seconds'::INTERVAL THEN
                v_interval := INTERVAL '1 day';
            END IF;

            -- Activate voucher (status = 'Active')
            UPDATE vouchers
            SET status = 'Active',
                activated_at = NEW.acctstarttime,
                expires_at = NEW.acctstarttime + v_interval,
                updated_at = NOW()
            WHERE code = NEW.username;

            -- Log transaction (Revenue comes when voucher is activated/used)
            INSERT INTO transactions (type, reference_id, amount, description)
            VALUES ('voucher', NEW.username, COALESCE(v_price, 0), 'Penggunaan voucher ' || NEW.username || ' paket ' || COALESCE(v_pkg_name, 'Unknown'));
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

    -- 2. Handle Accounting Stop (set member active_session = FALSE)
    IF (TG_OP = 'UPDATE' AND OLD.acctstoptime IS NULL AND NEW.acctstoptime IS NOT NULL) OR
       (TG_OP = 'INSERT' AND NEW.acctstoptime IS NOT NULL) THEN
        UPDATE members
        SET active_session = FALSE,
            updated_at = NOW()
        WHERE username = NEW.username;
    END IF;

    -- 3. Always update connection info and accumulated usage (used_bytes and used_seconds)
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
        ip_address = CASE WHEN NEW.acctstoptime IS NOT NULL THEN NULL ELSE COALESCE(NEW.framedipaddress::TEXT, ip_address) END,
        mac_address = COALESCE(mac_address, NEW.callingstationid),
        session_id = CASE WHEN NEW.acctstoptime IS NOT NULL THEN NULL ELSE COALESCE(NEW.acctsessionid, session_id) END,
        updated_at = NOW()
    WHERE code = NEW.username;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
