-- Trigger to automatically set the authdate to the database server's transaction time (NOW())
-- on every new insertion. This overrides the timezone-less string inserted by FreeRADIUS (%S)
-- and ensures it is always saved with the correct, timezone-aware UTC timestamp.
CREATE OR REPLACE FUNCTION trg_radpostauth_authdate()
RETURNS TRIGGER AS $$
BEGIN
  NEW.authdate := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_radpostauth_authdate ON radpostauth;
CREATE TRIGGER trg_radpostauth_authdate
BEFORE INSERT ON radpostauth
FOR EACH ROW
EXECUTE FUNCTION trg_radpostauth_authdate();
