
-- 1) Remove broad SELECT-all on bookings; replace with owner-or-admin
DROP POLICY IF EXISTS "Authenticated users can view bookings" ON public.bookings;

CREATE POLICY "Users view own bookings or admins view all"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (
    email = (auth.jwt() ->> 'email')
    OR public.is_admin()
  );

-- 2) Restrict admin self-update to last_login only (drop privilege-escalation policy)
DROP POLICY IF EXISTS admin_roles_self_update ON public.admin_roles;

CREATE OR REPLACE FUNCTION public.admin_touch_last_login()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.admin_roles
     SET last_login = now()
   WHERE email = (auth.jwt() ->> 'email');
$$;

REVOKE EXECUTE ON FUNCTION public.admin_touch_last_login() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_touch_last_login() TO authenticated;

-- 3) Tighten bookings INSERT: enforce email = jwt email (remove permissive duplicate)
DROP POLICY IF EXISTS bookings_auth_insert ON public.bookings;
