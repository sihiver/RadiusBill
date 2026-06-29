-- Trigger to automatically set the authdate to the database server's transaction time (NOW())
-- on every new insertion. This overrides the timezone-less string inserted by FreeRADIUS (%S)
-- and ensures it is always saved with the correct, timezone-aware UTC timestamp.
DO $$
BEGIN
  BEGIN
    EXECUTE '
      CREATE OR REPLACE FUNCTION trg_radpostauth_authdate()
      RETURNS TRIGGER AS $func$
      BEGIN
        NEW.authdate := NOW();
        RETURN NEW;
      END;
      $func$ LANGUAGE plpgsql;
    ';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Gagal membuat/mengubah fungsi trg_radpostauth_authdate (bukan owner), melewati...';
  END;

  BEGIN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_radpostauth_authdate ON radpostauth';
    EXECUTE '
      CREATE TRIGGER trg_radpostauth_authdate
      BEFORE INSERT ON radpostauth
      FOR EACH ROW
      EXECUTE FUNCTION trg_radpostauth_authdate();
    ';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Gagal membuat trigger trg_radpostauth_authdate, melewati...';
  END;
END
$$;
