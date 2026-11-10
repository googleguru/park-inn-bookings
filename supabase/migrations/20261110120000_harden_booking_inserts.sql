-- Tighten client booking inserts: a signed-in user may only create a plain
-- pending request for themselves. Previously only the email was checked, so a
-- client could insert status 'booked'/'approved' or is_blocked=true and block
-- arbitrary dates on the public calendar.
-- Length limits live in the policy (not CHECK constraints) because the
-- calendar-sync function inserts long Google event descriptions via service role.

DROP POLICY IF EXISTS "Authenticated users can create their own bookings" ON public.bookings;
DROP POLICY IF EXISTS bookings_auth_insert ON public.bookings;
DROP POLICY IF EXISTS "Anyone can create bookings" ON public.bookings;

CREATE POLICY "Clients create own pending booking requests"
  ON public.bookings FOR INSERT
  TO authenticated
  WITH CHECK (
    email = (auth.jwt() ->> 'email')
    AND status = 'pending'
    AND COALESCE(is_blocked, false) = false
    AND google_calendar_event_id IS NULL
    AND admin_notes IS NULL
    AND (user_id IS NULL OR user_id = auth.uid())
    AND booking_date >= CURRENT_DATE
    AND char_length(COALESCE(name, ''))       BETWEEN 1 AND 100
    AND char_length(COALESCE(mobile, ''))     BETWEEN 10 AND 16
    AND char_length(COALESCE(notes, ''))      <= 1000
    AND char_length(COALESCE(event_type, '')) <= 50
    AND char_length(COALESCE(time_slot, ''))  <= 20
    AND (guest_count IS NULL OR guest_count BETWEEN 1 AND 5000)
  );
