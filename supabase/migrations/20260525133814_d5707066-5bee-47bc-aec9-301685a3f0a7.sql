
-- Hide tables from pg_graphql (REST + RLS unaffected)
COMMENT ON TABLE public.bookings         IS E'@graphql({"visible": false})';
COMMENT ON TABLE public.admin_roles      IS E'@graphql({"visible": false})';
COMMENT ON TABLE public.audit_logs       IS E'@graphql({"visible": false})';
COMMENT ON TABLE public.blocked_users    IS E'@graphql({"visible": false})';
COMMENT ON TABLE public.ledger_entries   IS E'@graphql({"visible": false})';
COMMENT ON TABLE public.booking_timeline IS E'@graphql({"visible": false})';
COMMENT ON TABLE public.event_pricing    IS E'@graphql({"visible": false})';

-- Hide SECURITY DEFINER helper functions from pg_graphql
COMMENT ON FUNCTION public.is_admin()             IS E'@graphql({"visible": false})';
COMMENT ON FUNCTION public.is_senior_admin()      IS E'@graphql({"visible": false})';
COMMENT ON FUNCTION public.is_super_admin()       IS E'@graphql({"visible": false})';
COMMENT ON FUNCTION public.is_finance_or_super()  IS E'@graphql({"visible": false})';
COMMENT ON FUNCTION public.get_booked_dates()     IS E'@graphql({"visible": false})';
