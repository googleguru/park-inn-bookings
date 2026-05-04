-- ============================================================
-- Admin System: RBAC, Ledger, Audit Logs
-- ============================================================

-- 1. Admin Roles (whitelist + RBAC)
CREATE TABLE IF NOT EXISTS admin_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  role        TEXT NOT NULL DEFAULT 'admin'
                CHECK (role IN ('super_admin', 'admin', 'finance_manager')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  last_login  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read their own row (to verify access on login)
CREATE POLICY "admin_roles_self_read" ON admin_roles
  FOR SELECT TO authenticated
  USING (auth.jwt() ->> 'email' = email);

-- super_admin and admin can read all rows
CREATE POLICY "admin_roles_admins_read" ON admin_roles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_roles r
      WHERE r.email = auth.jwt() ->> 'email'
        AND r.role IN ('super_admin', 'admin')
        AND r.is_active = true
    )
  );

-- Any authenticated user can update their own last_login
CREATE POLICY "admin_roles_self_update" ON admin_roles
  FOR UPDATE TO authenticated
  USING  (auth.jwt() ->> 'email' = email)
  WITH CHECK (auth.jwt() ->> 'email' = email);

-- Only super_admin can insert / delete roles
CREATE POLICY "admin_roles_super_write" ON admin_roles
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_roles r
      WHERE r.email = auth.jwt() ->> 'email'
        AND r.role = 'super_admin'
        AND r.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_roles r
      WHERE r.email = auth.jwt() ->> 'email'
        AND r.role = 'super_admin'
        AND r.is_active = true
    )
  );

-- ============================================================
-- 2. Event Pricing Configuration
-- ============================================================
CREATE TABLE IF NOT EXISTS event_pricing (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type       TEXT UNIQUE NOT NULL,
  base_price       NUMERIC(12,2) NOT NULL DEFAULT 0,
  per_guest_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  minimum_guests   INTEGER NOT NULL DEFAULT 1,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  description      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE event_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_pricing_public_read"  ON event_pricing FOR SELECT USING (true);

CREATE POLICY "event_pricing_admin_write" ON event_pricing
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_roles r
      WHERE r.email = auth.jwt() ->> 'email'
        AND r.role IN ('super_admin', 'admin')
        AND r.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_roles r
      WHERE r.email = auth.jwt() ->> 'email'
        AND r.role IN ('super_admin', 'admin')
        AND r.is_active = true
    )
  );

-- ============================================================
-- 3. Extend Bookings Table
-- ============================================================
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS amount         NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS advance_paid   NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending'
    CHECK (payment_status IN ('pending','paid','partial','refunded','cancelled')),
  ADD COLUMN IF NOT EXISTS is_blocked     BOOLEAN DEFAULT false;

-- ============================================================
-- 4. Ledger Entries  (double-entry accounting)
-- ============================================================
CREATE TABLE IF NOT EXISTS ledger_entries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id       UUID REFERENCES bookings(id) ON DELETE SET NULL,
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

CREATE INDEX IF NOT EXISTS idx_ledger_booking    ON ledger_entries(booking_id);
CREATE INDEX IF NOT EXISTS idx_ledger_created_at ON ledger_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_user_email ON ledger_entries(user_email);

ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ledger_admin_read" ON ledger_entries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_roles r
      WHERE r.email = auth.jwt() ->> 'email' AND r.is_active = true
    )
  );

CREATE POLICY "ledger_admin_insert" ON ledger_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_roles r
      WHERE r.email = auth.jwt() ->> 'email' AND r.is_active = true
    )
  );

CREATE POLICY "ledger_finance_update" ON ledger_entries
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_roles r
      WHERE r.email = auth.jwt() ->> 'email'
        AND r.role IN ('super_admin','finance_manager')
        AND r.is_active = true
    )
  );

-- ============================================================
-- 5. Audit Logs
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
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

CREATE INDEX IF NOT EXISTS idx_audit_email      ON audit_logs(admin_email);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource   ON audit_logs(resource_type);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_admins_read" ON audit_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_roles r
      WHERE r.email = auth.jwt() ->> 'email'
        AND r.role IN ('super_admin','admin')
        AND r.is_active = true
    )
  );

CREATE POLICY "audit_admins_insert" ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_roles r
      WHERE r.email = auth.jwt() ->> 'email' AND r.is_active = true
    )
  );

-- ============================================================
-- 6. Blocked Users
-- ============================================================
CREATE TABLE IF NOT EXISTS blocked_users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT UNIQUE NOT NULL,
  name         TEXT,
  reason       TEXT,
  blocked_by   TEXT NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  blocked_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unblocked_at TIMESTAMPTZ
);

ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blocked_public_read"  ON blocked_users FOR SELECT USING (true);

CREATE POLICY "blocked_admin_write" ON blocked_users
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_roles r
      WHERE r.email = auth.jwt() ->> 'email'
        AND r.role IN ('super_admin','admin')
        AND r.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_roles r
      WHERE r.email = auth.jwt() ->> 'email'
        AND r.role IN ('super_admin','admin')
        AND r.is_active = true
    )
  );

-- ============================================================
-- 7. Triggers: auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_admin_roles_updated_at
  BEFORE UPDATE ON admin_roles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_event_pricing_updated_at
  BEFORE UPDATE ON event_pricing
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 8. Seed Default Event Pricing
-- ============================================================
INSERT INTO event_pricing (event_type, base_price, per_guest_price, minimum_guests, description) VALUES
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
