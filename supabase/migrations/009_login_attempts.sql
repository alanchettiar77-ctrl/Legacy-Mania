-- supabase/migrations/009_login_attempts.sql
--
-- Backs AUTH_AUDIT.md Finding #4: the existing per-IP rate limiter
-- (src/lib/rate-limit.ts) is in-memory and resets per serverless instance,
-- so it's not a real ceiling. This table lets the login route enforce a
-- real per-account lockout (5 consecutive failures -> 15 min lock) that
-- survives cold starts, matching the audit-logs table's access pattern
-- (service-role only, no anon/authenticated access).

CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identifier TEXT NOT NULL,
  ip TEXT NOT NULL,
  succeeded BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier_created
  ON public.login_attempts (identifier, created_at DESC);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- No policies: service-role key bypasses RLS entirely (same pattern as audit_logs).
-- REVOKE ensures anon/authenticated can never read or write attempt history directly.
REVOKE ALL ON public.login_attempts FROM PUBLIC, anon, authenticated;

-- Housekeeping: attempt rows are only ever queried within the last 5 rows /
-- 15 minutes per identifier, so anything older than 24h is dead weight.
-- Matches the release-expired-reservations cron pattern from migration 004.
CREATE OR REPLACE FUNCTION public.cleanup_old_login_attempts()
RETURNS void AS $$
BEGIN
  DELETE FROM public.login_attempts WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

SELECT cron.schedule(
  'cleanup-old-login-attempts',
  '0 * * * *',
  $$SELECT public.cleanup_old_login_attempts();$$
);
