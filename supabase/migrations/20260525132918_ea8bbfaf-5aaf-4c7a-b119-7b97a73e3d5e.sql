DROP VIEW IF EXISTS public.booked_dates;

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

REVOKE ALL ON FUNCTION public.get_booked_dates() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_booked_dates() TO anon, authenticated;