-- Customers must be approved by an admin before they can book.
-- A signed-in customer may request access for their own email; senior admins
-- approve/reject, revoke, or pre-approve emails directly.

CREATE TABLE IF NOT EXISTS public.customer_access (
  email         TEXT PRIMARY KEY CHECK (email = lower(email) AND char_length(email) <= 254),
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name          TEXT CHECK (char_length(name) <= 100),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  note          TEXT CHECK (char_length(note) <= 500),
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_by    TEXT,
  decided_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_customer_access_status ON public.customer_access(status);

ALTER TABLE public.customer_access ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.customer_access IS E'@graphql({"visible": false})';

REVOKE ALL ON public.customer_access FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_access TO authenticated;

CREATE POLICY "customer_access_read_own_or_admin" ON public.customer_access
  FOR SELECT TO authenticated
  USING (email = lower(auth.jwt() ->> 'email') OR public.is_admin());

CREATE POLICY "customer_access_self_request" ON public.customer_access
  FOR INSERT TO authenticated
  WITH CHECK (
    email = lower(auth.jwt() ->> 'email')
    AND status = 'pending'
    AND (user_id IS NULL OR user_id = auth.uid())
    AND decided_by IS NULL
    AND decided_at IS NULL
    AND note IS NULL
  );

CREATE POLICY "customer_access_admin_insert" ON public.customer_access
  FOR INSERT TO authenticated
  WITH CHECK (public.is_senior_admin());

CREATE POLICY "customer_access_admin_update" ON public.customer_access
  FOR UPDATE TO authenticated
  USING (public.is_senior_admin())
  WITH CHECK (public.is_senior_admin());

CREATE POLICY "customer_access_admin_delete" ON public.customer_access
  FOR DELETE TO authenticated
  USING (public.is_senior_admin());

-- Approved and not blocked. SECURITY DEFINER so the bookings policy can read
-- blocked_users, which customers cannot select directly.
CREATE OR REPLACE FUNCTION public.is_approved_customer()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.customer_access
    WHERE email = lower(auth.jwt() ->> 'email') AND status = 'approved'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE lower(email) = lower(auth.jwt() ->> 'email') AND is_active = true
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_approved_customer() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_approved_customer() TO authenticated;
COMMENT ON FUNCTION public.is_approved_customer() IS E'@graphql({"visible": false})';

-- Re-create the client insert policy with the approval requirement added.
DROP POLICY IF EXISTS "Clients create own pending booking requests" ON public.bookings;

CREATE POLICY "Clients create own pending booking requests"
  ON public.bookings FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_approved_customer()
    AND email = (auth.jwt() ->> 'email')
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

-- Queue past customers for review rather than approving them silently.
INSERT INTO public.customer_access (email, name, status, note)
SELECT DISTINCT ON (lower(email)) lower(email), left(name, 100), 'pending', 'Existing customer'
FROM public.bookings
WHERE email IS NOT NULL AND email <> '' AND char_length(email) <= 254
ORDER BY lower(email), created_at DESC
ON CONFLICT (email) DO NOTHING;
