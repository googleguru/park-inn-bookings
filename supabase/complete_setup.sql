-- ============================================================
-- DHANLAKSHMI PARK INN — COMPLETE DATABASE SETUP
-- Run this in: https://supabase.com/dashboard/project/svdifghjixteevbmccst/sql/new
-- Safe to re-run (fully idempotent)
-- ============================================================

-- ============================================================
-- 0. Helper: auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 1. Bookings Table (core table)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bookings (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_date            DATE NOT NULL UNIQUE,
  status                  TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','approved','rejected','booked')),
  name                    TEXT,
  mobile                  TEXT,
  email                   TEXT,
  event_type              TEXT,
  guest_count             INTEGER,
  time_slot               TEXT,
  notes                   TEXT,
  google_calendar_event_id TEXT,
  amount                  NUMERIC(12,2) DEFAULT 0,
  advance_paid            NUMERIC(12,2) DEFAULT 0,
  payment_status          TEXT DEFAULT 'pending'
                            CHECK (payment_status IN ('pending','paid','partial','refunded','cancelled')),
  is_blocked              BOOLEAN DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add missing columns if table already existed
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS amount          NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS advance_paid    NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS is_blocked      BOOLEAN DEFAULT false;

-- Fix payment_status column (add if missing)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN payment_status TEXT DEFAULT 'pending'
      CHECK (payment_status IN ('pending','paid','partial','refunded','cancelled'));
  END IF;
END $$;

-- Fix status constraint to include pending/approved/rejected
DO $$ BEGIN
  ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
  ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check
    CHECK (status IN ('pending','approved','rejected','booked'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Migrate old status values
UPDATE public.bookings SET status = 'booked'
WHERE status IN ('advanced') AND status NOT IN ('pending','approved','rejected','booked');

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bookings
DO $$ BEGIN
  DROP POLICY IF EXISTS "Anyone can view bookings"   ON public.bookings;
  DROP POLICY IF EXISTS "Anyone can create bookings" ON public.bookings;
  DROP POLICY IF EXISTS "Anyone can update bookings" ON public.bookings;
  DROP POLICY IF EXISTS "bookings_public_select"     ON public.bookings;
  DROP POLICY IF EXISTS "bookings_public_insert"     ON public.bookings;
  DROP POLICY IF EXISTS "bookings_admin_update"      ON public.bookings;
  DROP POLICY IF EXISTS "bookings_admin_delete"      ON public.bookings;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "bookings_public_select" ON public.bookings
  FOR SELECT USING (true);

CREATE POLICY "bookings_public_insert" ON public.bookings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "bookings_admin_update" ON public.bookings
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "bookings_admin_delete" ON public.bookings
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles r
      WHERE r.email = auth.jwt() ->> 'email'
        AND r.role IN ('super_admin','admin')
        AND r.is_active = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_bookings_date  ON public.bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_email ON public.bookings(email);

DROP TRIGGER IF EXISTS update_bookings_updated_at ON public.bookings;
CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. Admin Roles (whitelist + RBAC)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT UNIQUE NOT NULL,
  role       TEXT NOT NULL DEFAULT 'admin'
               CHECK (role IN ('super_admin','admin','finance_manager')),
  is_active  BOOLEAN NOT NULL DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "admin_roles_self_read"   ON public.admin_roles;
  DROP POLICY IF EXISTS "admin_roles_admins_read" ON public.admin_roles;
  DROP POLICY IF EXISTS "admin_roles_self_update" ON public.admin_roles;
  DROP POLICY IF EXISTS "admin_roles_super_write" ON public.admin_roles;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "admin_roles_self_read" ON public.admin_roles
  FOR SELECT TO authenticated
  USING (auth.jwt() ->> 'email' = email);

CREATE POLICY "admin_roles_admins_read" ON public.admin_roles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles r
      WHERE r.email = auth.jwt() ->> 'email'
        AND r.role IN ('super_admin','admin')
        AND r.is_active = true
    )
  );

CREATE POLICY "admin_roles_self_update" ON public.admin_roles
  FOR UPDATE TO authenticated
  USING  (auth.jwt() ->> 'email' = email)
  WITH CHECK (auth.jwt() ->> 'email' = email);

CREATE POLICY "admin_roles_super_write" ON public.admin_roles
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles r
      WHERE r.email = auth.jwt() ->> 'email'
        AND r.role = 'super_admin'
        AND r.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_roles r
      WHERE r.email = auth.jwt() ->> 'email'
        AND r.role = 'super_admin'
        AND r.is_active = true
    )
  );

DROP TRIGGER IF EXISTS trg_admin_roles_updated_at ON public.admin_roles;
CREATE TRIGGER trg_admin_roles_updated_at
  BEFORE UPDATE ON public.admin_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. Event Pricing
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_pricing (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      TEXT UNIQUE NOT NULL,
  base_price      NUMERIC(12,2) NOT NULL DEFAULT 0,
  per_guest_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  minimum_guests  INTEGER NOT NULL DEFAULT 1,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.event_pricing ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "event_pricing_public_read"  ON public.event_pricing;
  DROP POLICY IF EXISTS "event_pricing_admin_write"  ON public.event_pricing;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "event_pricing_public_read" ON public.event_pricing
  FOR SELECT USING (true);

CREATE POLICY "event_pricing_admin_write" ON public.event_pricing
  FOR ALL TO authenticated
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

DROP TRIGGER IF EXISTS trg_event_pricing_updated_at ON public.event_pricing;
CREATE TRIGGER trg_event_pricing_updated_at
  BEFORE UPDATE ON public.event_pricing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4. Ledger Entries (double-entry accounting)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id       UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  entry_type       TEXT NOT NULL
                     CHECK (entry_type IN ('booking','payment','advance','refund','adjustment')),
  description      TEXT NOT NULL,
  user_email       TEXT,
  user_name        TEXT,
  event_type       TEXT,
  event_date       DATE,
  debit_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  credit_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  running_balance  NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method   TEXT
                     CHECK (payment_method IN ('cash','card','upi','bank_transfer','cheque','online') OR payment_method IS NULL),
  reference_number TEXT,
  notes            TEXT,
  created_by       TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_booking    ON public.ledger_entries(booking_id);
CREATE INDEX IF NOT EXISTS idx_ledger_created_at ON public.ledger_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_user_email ON public.ledger_entries(user_email);

ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "ledger_admin_read"     ON public.ledger_entries;
  DROP POLICY IF EXISTS "ledger_admin_insert"   ON public.ledger_entries;
  DROP POLICY IF EXISTS "ledger_finance_update" ON public.ledger_entries;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "ledger_admin_read" ON public.ledger_entries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles r
      WHERE r.email = auth.jwt() ->> 'email' AND r.is_active = true
    )
  );

CREATE POLICY "ledger_admin_insert" ON public.ledger_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_roles r
      WHERE r.email = auth.jwt() ->> 'email' AND r.is_active = true
    )
  );

CREATE POLICY "ledger_finance_update" ON public.ledger_entries
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles r
      WHERE r.email = auth.jwt() ->> 'email'
        AND r.role IN ('super_admin','finance_manager')
        AND r.is_active = true
    )
  );

-- ============================================================
-- 5. Audit Logs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email   TEXT NOT NULL,
  admin_role    TEXT,
  action        TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id   TEXT,
  old_values    JSONB,
  new_values    JSONB,
  ip_address    TEXT,
  user_agent    TEXT,
  success       BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_email      ON public.audit_logs(admin_email);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource   ON public.audit_logs(resource_type);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "audit_admins_read"   ON public.audit_logs;
  DROP POLICY IF EXISTS "audit_admins_insert" ON public.audit_logs;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "audit_admins_read" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_roles r
      WHERE r.email = auth.jwt() ->> 'email'
        AND r.role IN ('super_admin','admin')
        AND r.is_active = true
    )
  );

CREATE POLICY "audit_admins_insert" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_roles r
      WHERE r.email = auth.jwt() ->> 'email' AND r.is_active = true
    )
  );

-- ============================================================
-- 6. Blocked Users
-- ============================================================
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT UNIQUE NOT NULL,
  name         TEXT,
  reason       TEXT,
  blocked_by   TEXT NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  blocked_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unblocked_at TIMESTAMPTZ
);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "blocked_public_read"  ON public.blocked_users;
  DROP POLICY IF EXISTS "blocked_admin_write"  ON public.blocked_users;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "blocked_public_read" ON public.blocked_users
  FOR SELECT USING (true);

CREATE POLICY "blocked_admin_write" ON public.blocked_users
  FOR ALL TO authenticated
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

-- ============================================================
-- 7. Seed: Event Pricing defaults
-- ============================================================
INSERT INTO public.event_pricing (event_type, base_price, per_guest_price, minimum_guests, description)
VALUES
  ('Wedding',     50000, 150, 50, 'Full venue for wedding ceremonies and receptions'),
  ('Reception',   40000, 120, 30, 'Reception parties and post-wedding celebrations'),
  ('Birthday',    15000,  80, 20, 'Birthday parties and special occasion celebrations'),
  ('Corporate',   25000, 100, 25, 'Corporate events, conferences, and team gatherings'),
  ('Anniversary', 20000,  90, 15, 'Anniversary and milestone celebrations'),
  ('Other',       10000,  75, 10, 'Custom and other special events')
ON CONFLICT (event_type) DO UPDATE SET
  base_price      = EXCLUDED.base_price,
  per_guest_price = EXCLUDED.per_guest_price,
  minimum_guests  = EXCLUDED.minimum_guests,
  description     = EXCLUDED.description;

-- ============================================================
-- 8. Seed: Super Admin user
-- ============================================================
INSERT INTO public.admin_roles (email, role, is_active)
VALUES ('yashvchauhan02@gmail.com', 'super_admin', true)
ON CONFLICT (email) DO UPDATE SET
  role      = 'super_admin',
  is_active = true;

-- ============================================================
-- Done! Verify with:
--   SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
--   SELECT * FROM admin_roles;
--   SELECT * FROM event_pricing;
-- ============================================================
