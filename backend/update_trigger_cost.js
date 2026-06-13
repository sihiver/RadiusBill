require('dotenv').config();
const db = require('./src/db/pool');

async function updateTrigger() {
  try {
    await db.query(`
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
      BEGIN
          IF (TG_OP = 'INSERT' AND NEW.acctstarttime IS NOT NULL) OR
             (TG_OP = 'UPDATE' AND OLD.acctstarttime IS NULL AND NEW.acctstarttime IS NOT NULL) THEN
              SELECT package_id, status INTO v_pkg_id, v_status
              FROM vouchers WHERE code = NEW.username;

              IF FOUND AND v_status = 'Unused' THEN
                  SELECT duration, validity, cost_price, name INTO v_duration, v_validity, v_price, v_pkg_name
                  FROM packages WHERE id = v_pkg_id;

                  v_interval := INTERVAL '1 day';
                  IF v_duration ILIKE '%jam%' THEN
                      v_interval := (SUBSTRING(v_duration FROM '^[0-9]+')::INT || ' hours')::INTERVAL;
                  ELSIF v_duration ILIKE '%hari%' THEN
                      v_interval := (SUBSTRING(v_duration FROM '^[0-9]+')::INT || ' days')::INTERVAL;
                  ELSIF v_validity ILIKE '%hari%' THEN
                      v_interval := (SUBSTRING(v_validity FROM '^[0-9]+')::INT || ' days')::INTERVAL;
                  END IF;

                  UPDATE vouchers SET status = 'Active', activated_at = NEW.acctstarttime,
                      expires_at = NEW.acctstarttime + v_interval, updated_at = NOW()
                  WHERE code = NEW.username;

                  INSERT INTO transactions (type, reference_id, amount, description)
                  VALUES ('voucher', NEW.username, COALESCE(v_price, 0), 'Penggunaan voucher ' || NEW.username || ' paket ' || COALESCE(v_pkg_name, 'Unknown'));
              END IF;

              UPDATE members SET active_session = TRUE, ip_address = NEW.framedipaddress::TEXT,
                  mac_address = NEW.callingstationid, session_start = NEW.acctstarttime, updated_at = NOW()
              WHERE username = NEW.username;
          END IF;

          IF (TG_OP = 'UPDATE' AND OLD.acctstoptime IS NULL AND NEW.acctstoptime IS NOT NULL) OR
             (TG_OP = 'INSERT' AND NEW.acctstoptime IS NOT NULL) THEN
              UPDATE members SET active_session = FALSE, updated_at = NOW() WHERE username = NEW.username;
          END IF;

          UPDATE vouchers SET used_bytes = (
                  SELECT COALESCE(SUM(acctinputoctets + acctoutputoctets), 0) FROM radacct WHERE username = NEW.username
              ), ip_address = COALESCE(NEW.framedipaddress::TEXT, ip_address),
              mac_address = COALESCE(NEW.callingstationid, mac_address), session_id = COALESCE(NEW.acctsessionid, session_id),
              updated_at = NOW()
          WHERE code = NEW.username;

          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log("Trigger updated to use cost_price.");
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
}

updateTrigger();
