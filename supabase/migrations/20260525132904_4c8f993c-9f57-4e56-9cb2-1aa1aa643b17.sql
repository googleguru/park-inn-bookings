DROP FUNCTION IF EXISTS public.get_booked_dates();

CREATE OR REPLACE VIEW public.booked_dates
WITH (security_invoker = false) AS
SELECT booking_date, status
FROM public.bookings
WHERE booking_date >= (CURRENT_DATE - INTERVAL '7 days');

GRANT SELECT ON public.booked_dates TO anon, authenticated;