-- Dynamic SQL block to set the default timezone for the current database and user to Asia/Jakarta.
-- This ensures that both FreeRADIUS and Node.js connections default to the correct local timezone (WIB/UTC+7),
-- resolving timezone shift discrepancies in log insertions.
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER DATABASE ' || quote_ident(current_database()) || ' SET timezone TO ''Asia/Jakarta''';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Gagal mengubah timezone database (bukan owner), melewati...';
  END;

  BEGIN
    EXECUTE 'ALTER USER ' || quote_ident(current_user) || ' SET timezone TO ''Asia/Jakarta''';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Gagal mengubah timezone user, melewati...';
  END;
END
$$;
