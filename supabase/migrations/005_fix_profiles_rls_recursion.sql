-- supabase/migrations/005_fix_profiles_rls_recursion.sql
--
-- Fixes "infinite recursion detected in policy for relation profiles" (Postgres 42P17),
-- discovered while verifying Phase 1: every "Admins can manage X" policy checks
-- admin status via `EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')`.
-- When that subquery runs against public.profiles, Postgres re-evaluates profiles' own RLS
-- policies — including "Admins can view all profiles", which contains the identical
-- self-referencing subquery, recursing forever. This breaks not just admin writes but any
-- anon/authenticated read that embeds a table carrying one of these policies (e.g. the
-- product detail page's `category:categories(*)` join).
--
-- Fix: a SECURITY DEFINER helper function reads public.profiles with the function owner's
-- privileges, bypassing profiles' RLS entirely, breaking the recursion. Every affected policy
-- is repointed at this function instead of the inline subquery.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin());

-- categories
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
CREATE POLICY "Admins can manage categories" ON public.categories
  USING (public.is_admin());

-- products
DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
CREATE POLICY "Admins can manage products" ON public.products
  USING (public.is_admin());

-- orders
DROP POLICY IF EXISTS "Admins can manage all orders" ON public.orders;
CREATE POLICY "Admins can manage all orders" ON public.orders
  USING (public.is_admin());

-- order_items
DROP POLICY IF EXISTS "Admins can view all order items" ON public.order_items;
CREATE POLICY "Admins can view all order items" ON public.order_items
  FOR SELECT USING (public.is_admin());

-- payments
DROP POLICY IF EXISTS "Admins can manage payments" ON public.payments;
CREATE POLICY "Admins can manage payments" ON public.payments
  USING (public.is_admin());

-- settings
DROP POLICY IF EXISTS "Admins can manage settings" ON public.settings;
CREATE POLICY "Admins can manage settings" ON public.settings
  USING (public.is_admin());

-- audit_logs
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
  FOR SELECT USING (public.is_admin());

-- analytics_events
DROP POLICY IF EXISTS "Admins can view analytics" ON public.analytics_events;
CREATE POLICY "Admins can view analytics" ON public.analytics_events
  FOR SELECT USING (public.is_admin());

-- newsletter_subscribers
DROP POLICY IF EXISTS "Admins can view subscribers" ON public.newsletter_subscribers;
CREATE POLICY "Admins can view subscribers" ON public.newsletter_subscribers
  FOR SELECT USING (public.is_admin());
