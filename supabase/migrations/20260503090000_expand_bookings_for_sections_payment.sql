ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_booking_date_key;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS venue_section TEXT NOT NULL DEFAULT 'grand_hall',
  ADD COLUMN IF NOT EXISTS payment_link TEXT;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_venue_section_check CHECK (venue_section IN ('grand_hall', 'sky_pavilion'));

CREATE UNIQUE INDEX IF NOT EXISTS bookings_date_section_unique
ON public.bookings (booking_date, venue_section);
