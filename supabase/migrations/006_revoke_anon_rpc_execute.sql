-- supabase/migrations/006_revoke_anon_rpc_execute.sql
--
-- Fixes a live, exploitable vulnerability found in the Phase 1 final whole-branch
-- review: Postgres grants EXECUTE on new functions to PUBLIC by default, and
-- Supabase/PostgREST exposes public-schema functions to the anon role. None of
-- migration 004's RPCs revoked this, so any anonymous caller holding only the
-- publicly-embedded anon key could call consume_reservation/release_reservation
-- directly via POST /rest/v1/rpc/<name> — bypassing all application logic,
-- auth checks, and (for consume_reservation specifically) the missing floor
-- guard, allowing arbitrary stock corruption. Confirmed live: an anon-key POST
-- to consume_reservation returned 204 (success) rather than a permission error.
--
-- These RPCs must only ever be called by service-role-backed API routes
-- (checkout-repository.ts, inventory-repository.ts), which are unaffected by
-- this REVOKE since the service_role key bypasses grants entirely.

REVOKE ALL ON FUNCTION public.create_order(
  TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.consume_reservation(UUID, INTEGER) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.release_reservation(UUID, INTEGER) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.release_expired_reservations() FROM PUBLIC, anon, authenticated;
