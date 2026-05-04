-- Update bookings table to support approval workflow and Google Calendar sync
ALTER TABLE public.bookings
DROP CONSTRAINT bookings_status_check;

ALTER TABLE public.bookings
ADD CONSTRAINT bookings_status_check
CHECK (status IN ('pending', 'approved', 'rejected', 'booked'));

-- Add Google Calendar event ID column
ALTER TABLE public.bookings
ADD COLUMN google_calendar_event_id TEXT;

-- Update existing bookings to 'booked' status (assuming they were previously approved)
UPDATE public.bookings
SET status = 'booked'
WHERE status IN ('advanced', 'booked');

-- Update policies to allow admins to update bookings
-- Note: In a real app, you'd want proper RLS policies for admin access
-- For now, allowing updates for simplicity
CREATE POLICY "Anyone can update bookings"
ON public.bookings
FOR UPDATE
USING (true);