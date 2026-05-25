-- 1. Revoke anon discoverability on sensitive tables (linter fixes)
REVOKE SELECT ON public.admin_roles    FROM anon;
REVOKE SELECT ON public.audit_logs     FROM anon;
REVOKE SELECT ON public.blocked_users  FROM anon;
REVOKE SELECT ON public.ledger_entries FROM anon;
REVOKE SELECT ON public.bookings       FROM anon;

-- 2. Drop now-overly-broad public-read policies on bookings;
--    anon access continues via the safe RPC below.
DROP POLICY IF EXISTS "Anyone can view bookings" ON public.bookings;

CREATE POLICY "Authenticated users can view bookings"
ON public.bookings
FOR SELECT
TO authenticated
USING (true);

-- 3. Safe availability helper for the public calendar widget
CREATE OR REPLACE FUNCTION public.get_booked_dates()
RETURNS TABLE(booking_date date, status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT booking_date, status
  FROM public.bookings
  WHERE booking_date >= (CURRENT_DATE - INTERVAL '7 days');
$$;

GRANT EXECUTE ON FUNCTION public.get_booked_dates() TO anon, authenticated;

-- 4. Allow users to cancel their own PENDING bookings
DROP POLICY IF EXISTS "Users can cancel their own pending bookings" ON public.bookings;
CREATE POLICY "Users can cancel their own pending bookings"
ON public.bookings
FOR DELETE
TO authenticated
USING (
  email = (auth.jwt() ->> 'email')
  AND status = 'pending'
);