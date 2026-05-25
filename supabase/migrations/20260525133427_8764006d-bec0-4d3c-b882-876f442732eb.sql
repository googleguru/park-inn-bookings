
-- Drop redundant public SELECT policy on bookings (public calendar uses get_booked_dates RPC)
DROP POLICY IF EXISTS bookings_public_select ON public.bookings;

-- Revoke direct table access from anon/authenticated (RLS still allows policy-based access)
REVOKE SELECT ON public.bookings FROM anon, authenticated;
REVOKE SELECT ON public.admin_roles FROM anon, authenticated;
REVOKE SELECT ON public.audit_logs FROM anon, authenticated;
REVOKE SELECT ON public.blocked_users FROM anon, authenticated;
REVOKE SELECT ON public.ledger_entries FROM anon, authenticated;
REVOKE SELECT ON public.booking_timeline FROM anon, authenticated;
REVOKE SELECT ON public.event_pricing FROM anon;
-- event_pricing intentionally readable by authenticated for booking flow; keep that

-- Restore the grants that RLS policies need to function via PostgREST
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT INSERT ON public.bookings TO anon; -- not needed; keep revoked
REVOKE INSERT ON public.bookings FROM anon;
GRANT SELECT, UPDATE ON public.admin_roles TO authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocked_users TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ledger_entries TO authenticated;
GRANT SELECT, INSERT ON public.booking_timeline TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_pricing TO authenticated;
GRANT SELECT ON public.event_pricing TO anon;

-- Revoke EXECUTE on internal SECURITY DEFINER functions from anon
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_booking_status_change() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_booking_created() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_senior_admin() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_finance_or_super() FROM anon, PUBLIC;

-- get_booked_dates is the public calendar's data source: keep callable by anon/authenticated
GRANT EXECUTE ON FUNCTION public.get_booked_dates() TO anon, authenticated;
