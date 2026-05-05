-- Replace public insert with authenticated-only, email-bound insert
DROP POLICY IF EXISTS "Anyone can create bookings" ON public.bookings;

CREATE POLICY "Authenticated users can create their own bookings"
ON public.bookings FOR INSERT TO authenticated
WITH CHECK (
  email = (auth.jwt() ->> 'email')
);

-- Allow admins to update bookings
CREATE POLICY "Admins can update bookings"
ON public.bookings FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_roles r
    WHERE r.email = auth.jwt() ->> 'email'
      AND r.role IN ('super_admin','admin')
      AND r.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_roles r
    WHERE r.email = auth.jwt() ->> 'email'
      AND r.role IN ('super_admin','admin')
      AND r.is_active = true
  )
);

-- Allow admins to delete bookings
CREATE POLICY "Admins can delete bookings"
ON public.bookings FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_roles r
    WHERE r.email = auth.jwt() ->> 'email'
      AND r.role IN ('super_admin','admin')
      AND r.is_active = true
  )
);