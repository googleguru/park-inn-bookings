-- ============================================================
-- SECURITY HARDENING + PROFILE + GOOGLE CALENDAR SUPPORT
-- Fixes all Supabase linter critical warnings
-- ============================================================

-- ============================================================
-- 1. Fix set_updated_at (missing SET search_path — linter critical)
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

-- ============================================================
-- 2. SECURITY DEFINER helpers — eliminates recursive RLS on admin_roles
--    Linter critical: policies that query the same table they guard
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_roles
    WHERE email = (auth.jwt() ->> 'email') AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_roles
    WHERE email = (auth.jwt() ->> 'email')
      AND role = 'super_admin' AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_senior_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_roles
    WHERE email = (auth.jwt() ->> 'email')
      AND role IN ('super_admin','admin') AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_finance_or_super()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_roles
    WHERE email = (auth.jwt() ->> 'email')
      AND role IN ('super_admin','finance_manager') AND is_active = true
  );
$$;

-- ============================================================
-- 3. Extend bookings table
-- ============================================================
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_notes   TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings(user_id);

-- Add 'cancelled' status
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('pending','approved','rejected','booked','cancelled'));

-- ============================================================
-- 4. booking_timeline — status-change history
-- ============================================================
CREATE TABLE IF NOT EXISTS public.booking_timeline (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  status      TEXT NOT NULL,
  changed_by  TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timeline_booking_id ON public.booking_timeline(booking_id);

ALTER TABLE public.booking_timeline ENABLE ROW LEVEL SECURITY;

-- Admins or booking owner can read timeline
CREATE POLICY "timeline_read" ON public.booking_timeline
  FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id
        AND b.email = (auth.jwt() ->> 'email')
    )
  );

-- Only admins insert timeline entries (trigger also inserts as system)
CREATE POLICY "timeline_admin_insert" ON public.booking_timeline
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- ============================================================
-- 5. Trigger: log status changes to booking_timeline
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_booking_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.booking_timeline (booking_id, status, changed_by, notes)
    VALUES (
      NEW.id,
      NEW.status,
      COALESCE(auth.jwt() ->> 'email', NEW.email, 'system'),
      CASE
        WHEN NEW.status = 'cancelled' THEN COALESCE(NEW.admin_notes, 'Booking cancelled')
        WHEN NEW.status = 'approved'  THEN COALESCE(NEW.admin_notes, 'Booking approved')
        WHEN NEW.status = 'rejected'  THEN COALESCE(NEW.admin_notes, 'Booking rejected')
        ELSE NEW.admin_notes
      END
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_booking_status_timeline ON public.bookings;
CREATE TRIGGER trg_booking_status_timeline
  AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.log_booking_status_change();

-- Trigger: log initial booking creation
CREATE OR REPLACE FUNCTION public.log_booking_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.booking_timeline (booking_id, status, changed_by, notes)
  VALUES (NEW.id, NEW.status, NEW.email, 'Booking request submitted');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_booking_created_timeline ON public.bookings;
CREATE TRIGGER trg_booking_created_timeline
  AFTER INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.log_booking_created();

-- Backfill timeline for existing bookings
INSERT INTO public.booking_timeline (booking_id, status, changed_by, notes, created_at)
SELECT id, status, email, 'Booking request submitted', created_at
FROM public.bookings
WHERE NOT EXISTS (
  SELECT 1 FROM public.booking_timeline t WHERE t.booking_id = bookings.id
);

-- ============================================================
-- 6. Fix bookings RLS (linter critical: anonymous inserts + any-auth update)
-- ============================================================
DO $$ BEGIN
  DROP POLICY IF EXISTS "bookings_public_select"     ON public.bookings;
  DROP POLICY IF EXISTS "bookings_public_insert"     ON public.bookings;
  DROP POLICY IF EXISTS "bookings_auth_insert"       ON public.bookings;
  DROP POLICY IF EXISTS "bookings_admin_update"      ON public.bookings;
  DROP POLICY IF EXISTS "bookings_client_cancel"     ON public.bookings;
  DROP POLICY IF EXISTS "bookings_admin_delete"      ON public.bookings;
  DROP POLICY IF EXISTS "Anyone can view bookings"   ON public.bookings;
  DROP POLICY IF EXISTS "Anyone can create bookings" ON public.bookings;
  DROP POLICY IF EXISTS "Anyone can update bookings" ON public.bookings;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Public read (booking_date + status only needed, but keeping full row for admin)
CREATE POLICY "bookings_public_select" ON public.bookings
  FOR SELECT USING (true);

-- Authenticated users only can create bookings (requires Google sign-in)
CREATE POLICY "bookings_auth_insert" ON public.bookings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Admins can update any booking
CREATE POLICY "bookings_admin_update" ON public.bookings
  FOR UPDATE TO authenticated
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

-- Client can cancel their own pending booking only
CREATE POLICY "bookings_client_cancel" ON public.bookings
  FOR UPDATE TO authenticated
  USING  (email = (auth.jwt() ->> 'email') AND status = 'pending')
  WITH CHECK (email = (auth.jwt() ->> 'email') AND status = 'cancelled');

-- Senior admins can delete
CREATE POLICY "bookings_admin_delete" ON public.bookings
  FOR DELETE TO authenticated
  USING (public.is_senior_admin());

-- ============================================================
-- 7. Fix admin_roles RLS (linter critical: recursive policy)
-- ============================================================
DO $$ BEGIN
  DROP POLICY IF EXISTS "admin_roles_admins_read" ON public.admin_roles;
  DROP POLICY IF EXISTS "admin_roles_super_write" ON public.admin_roles;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "admin_roles_admins_read" ON public.admin_roles
  FOR SELECT TO authenticated
  USING (public.is_senior_admin());

CREATE POLICY "admin_roles_super_write" ON public.admin_roles
  FOR ALL TO authenticated
  USING  (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ============================================================
-- 8. Fix blocked_users (linter: exposes all blocked emails to public)
-- ============================================================
DO $$ BEGIN
  DROP POLICY IF EXISTS "blocked_public_read" ON public.blocked_users;
  DROP POLICY IF EXISTS "blocked_admin_write" ON public.blocked_users;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Admins read all; clients can only check if their own email is blocked
CREATE POLICY "blocked_admin_read" ON public.blocked_users
  FOR SELECT TO authenticated
  USING (public.is_senior_admin());

CREATE POLICY "blocked_self_check" ON public.blocked_users
  FOR SELECT
  USING (email = (auth.jwt() ->> 'email') AND is_active = true);

CREATE POLICY "blocked_admin_write" ON public.blocked_users
  FOR ALL TO authenticated
  USING  (public.is_senior_admin())
  WITH CHECK (public.is_senior_admin());

-- ============================================================
-- 9. Fix other table policies to use SECURITY DEFINER functions
-- ============================================================

-- event_pricing
DO $$ BEGIN
  DROP POLICY IF EXISTS "event_pricing_admin_write" ON public.event_pricing;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "event_pricing_admin_write" ON public.event_pricing
  FOR ALL TO authenticated
  USING  (public.is_senior_admin())
  WITH CHECK (public.is_senior_admin());

-- ledger_entries
DO $$ BEGIN
  DROP POLICY IF EXISTS "ledger_admin_read"     ON public.ledger_entries;
  DROP POLICY IF EXISTS "ledger_admin_insert"   ON public.ledger_entries;
  DROP POLICY IF EXISTS "ledger_finance_update" ON public.ledger_entries;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "ledger_admin_read"   ON public.ledger_entries
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY "ledger_admin_insert" ON public.ledger_entries
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "ledger_finance_update" ON public.ledger_entries
  FOR UPDATE TO authenticated USING (public.is_finance_or_super());

-- audit_logs
DO $$ BEGIN
  DROP POLICY IF EXISTS "audit_admins_read"   ON public.audit_logs;
  DROP POLICY IF EXISTS "audit_admins_insert" ON public.audit_logs;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "audit_admins_read"   ON public.audit_logs
  FOR SELECT TO authenticated USING (public.is_senior_admin());

CREATE POLICY "audit_admins_insert" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

-- ============================================================
-- Done. Verify with:
--   SELECT * FROM public.booking_timeline LIMIT 5;
--   SELECT proname FROM pg_proc WHERE proname LIKE 'is_%';
-- ============================================================
