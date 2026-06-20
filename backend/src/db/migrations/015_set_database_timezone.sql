-- Dynamic SQL block to set the default timezone for the current database and user to Asia/Jakarta.
-- This ensures that both FreeRADIUS and Node.js connections default to the correct local timezone (WIB/UTC+7),
-- resolving timezone shift discrepancies in log insertions.
DO $$
BEGIN
  EXECUTE 'ALTER DATABASE ' || quote_ident(current_database()) || ' SET timezone TO ''Asia/Jakarta''';
  EXECUTE 'ALTER USER ' || quote_ident(current_user) || ' SET timezone TO ''Asia/Jakarta''';
END
$$;
