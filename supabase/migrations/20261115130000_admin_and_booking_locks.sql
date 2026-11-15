-- Admin + booking locks
--   1. Admin rights require a Google (OAuth) sign-in and are bound to the
--      admin's most recent sign-in session (one device at a time).
--   2. The admin list is locked to super admins, can never lose its last
--      super admin, and every change is audited by the database itself.
--   3. Approved/booked bookings are locked: a date can be confirmed only once,
--      and core details can't change or be deleted unless a super admin unlocks.

-- ------------------------------------------------------------------
-- 1. Google-only, single-session admin rights
-- ------------------------------------------------------------------
ALTER TABLE public.admin_roles
  ADD COLUMN IF NOT EXISTS active_session_id TEXT,
  ADD COLUMN IF NOT EXISTS active_session_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.current_admin_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.role FROM public.admin_roles r
  WHERE lower(r.email) = lower(auth.jwt() ->> 'email')
    AND r.is_active
    AND COALESCE(auth.jwt() -> 'amr', '[]'::jsonb) @> '[{"method":"oauth"}]'
    AND r.active_session_id = (auth.jwt() ->> 'session_id')
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_admin_role() IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.current_admin_role() = 'super_admin', false)
$$;

CREATE OR REPLACE FUNCTION public.is_senior_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.current_admin_role() IN ('super_admin','admin'), false)
$$;

CREATE OR REPLACE FUNCTION public.is_finance_or_super()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.current_admin_role() IN ('super_admin','finance_manager'), false)
$$;

-- Starts (claim = true) or checks the caller's admin session. The newest
-- sign-in takes over; an older session can never take the lock back.
CREATE OR REPLACE FUNCTION public.admin_session(claim BOOLEAN DEFAULT false)
RETURNS JSONB LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.admin_roles%ROWTYPE;
  sid TEXT := auth.jwt() ->> 'session_id';
  new_created TIMESTAMPTZ;
  cur_created TIMESTAMPTZ;
BEGIN
  SELECT * INTO r FROM public.admin_roles WHERE lower(email) = lower(auth.jwt() ->> 'email');
  IF NOT FOUND OR sid IS NULL THEN
    RETURN jsonb_build_object('status', 'not_admin');
  END IF;
  IF NOT r.is_active THEN
    RETURN jsonb_build_object('status', 'inactive');
  END IF;
  IF NOT COALESCE(auth.jwt() -> 'amr', '[]'::jsonb) @> '[{"method":"oauth"}]' THEN
    RETURN jsonb_build_object('status', 'not_google');
  END IF;

  IF r.active_session_id IS DISTINCT FROM sid THEN
    IF NOT claim THEN
      RETURN jsonb_build_object('status', 'superseded');
    END IF;
    SELECT created_at INTO new_created FROM auth.sessions WHERE id::text = sid;
    SELECT created_at INTO cur_created FROM auth.sessions WHERE id::text = r.active_session_id;
    IF cur_created IS NOT NULL AND (new_created IS NULL OR new_created <= cur_created) THEN
      RETURN jsonb_build_object('status', 'superseded');
    END IF;

    UPDATE public.admin_roles
       SET active_session_id = sid, active_session_at = NOW(), last_login = NOW()
     WHERE id = r.id;
    INSERT INTO public.audit_logs (admin_email, admin_role, action, resource_type, resource_id, new_values)
    VALUES (r.email, r.role, 'ADMIN_SIGN_IN', 'admin_session', r.email,
            jsonb_build_object('replaced_other_device', r.active_session_id IS NOT NULL));
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'role', r.role, 'last_login', r.last_login);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.current_admin_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_session(BOOLEAN) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.current_admin_role() TO authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_session(BOOLEAN) TO authenticated;
COMMENT ON FUNCTION public.current_admin_role()       IS E'@graphql({"visible": false})';
COMMENT ON FUNCTION public.admin_session(BOOLEAN)     IS E'@graphql({"visible": false})';

-- Legacy policies matched admin_roles by email alone, bypassing the checks above.
DROP POLICY IF EXISTS "Admins can update bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admins can delete bookings" ON public.bookings;

-- ------------------------------------------------------------------
-- 2. Admin list lock + audit
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_admin_roles()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
-- SECURITY INVOKER on purpose: current_user is then the role doing the write.
BEGIN
  -- Session columns are written only by admin_session(), which runs as the table owner.
  IF TG_OP = 'UPDATE'
     AND (NEW.active_session_id IS DISTINCT FROM OLD.active_session_id
          OR NEW.active_session_at IS DISTINCT FROM OLD.active_session_at)
     AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Admin session fields cannot be edited directly' USING ERRCODE = '42501';
  END IF;

  IF OLD.role = 'super_admin' AND OLD.is_active
     AND (TG_OP = 'DELETE' OR NEW.role <> 'super_admin' OR NOT NEW.is_active)
     AND NOT EXISTS (
       SELECT 1 FROM public.admin_roles
       WHERE id <> OLD.id AND role = 'super_admin' AND is_active
     ) THEN
    RAISE EXCEPTION 'Cannot remove or demote the last active super admin' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_admin_roles ON public.admin_roles;
CREATE TRIGGER trg_guard_admin_roles
  BEFORE UPDATE OR DELETE ON public.admin_roles
  FOR EACH ROW EXECUTE FUNCTION public.guard_admin_roles();

CREATE OR REPLACE FUNCTION public.audit_admin_roles()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  noise TEXT[] := ARRAY['last_login', 'active_session_id', 'active_session_at', 'updated_at'];
BEGIN
  IF TG_OP = 'UPDATE' AND (to_jsonb(NEW) - noise) = (to_jsonb(OLD) - noise) THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.audit_logs (admin_email, admin_role, action, resource_type, resource_id, old_values, new_values)
  VALUES (
    COALESCE(auth.jwt() ->> 'email', 'system'),
    public.current_admin_role(),
    'ADMIN_ROLE_' || TG_OP,
    'admin_role',
    COALESCE(NEW.email, OLD.email),
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) - noise END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) - noise END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_admin_roles ON public.admin_roles;
CREATE TRIGGER trg_audit_admin_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.admin_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_admin_roles();

-- ------------------------------------------------------------------
-- 3. Booking lock
-- ------------------------------------------------------------------
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_by TEXT;

-- One row per date (any status) meant a rejected request blocked the date forever
-- and Google events could not be imported onto a date with a pending request.
-- Only confirmed bookings made here must be unique; Google-imported blocks may overlap.
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_booking_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_confirmed_booking_per_date
  ON public.bookings (booking_date)
  WHERE status IN ('approved', 'booked') AND NOT COALESCE(is_blocked, false);

CREATE OR REPLACE FUNCTION public.enforce_booking_rules()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  -- No JWT means a direct database session (migrations, dashboard SQL).
  trusted BOOLEAN := COALESCE(auth.jwt() ->> 'role', 'service_role') = 'service_role';
  super   BOOLEAN := trusted OR public.is_super_admin();
  admin   BOOLEAN := trusted OR public.is_admin();
  -- Fields a non-super admin may still change on a locked booking.
  mutable TEXT[]  := ARRAY['amount', 'advance_paid', 'payment_status', 'admin_notes', 'updated_at'];
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.locked_at IS NOT NULL AND NOT super THEN
      RAISE EXCEPTION 'This booking is locked. A super admin must unlock it before it can be deleted.' USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NOT admin
       AND (to_jsonb(NEW) - ARRAY['status', 'cancelled_at', 'updated_at'])
           IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status', 'cancelled_at', 'updated_at']) THEN
      RAISE EXCEPTION 'You can only cancel your booking request' USING ERRCODE = '42501';
    END IF;
    IF OLD.locked_at IS NOT NULL AND NOT super
       AND (to_jsonb(NEW) - mutable) IS DISTINCT FROM (to_jsonb(OLD) - mutable) THEN
      RAISE EXCEPTION 'This booking is locked. Only payment details can change until a super admin unlocks it.' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' AND NOT admin AND EXISTS (
    SELECT 1 FROM public.bookings
    WHERE booking_date = NEW.booking_date AND status IN ('approved', 'booked')
  ) THEN
    RAISE EXCEPTION 'This date is already booked' USING ERRCODE = '23505';
  END IF;

  IF NEW.status IN ('approved', 'booked') THEN
    IF TG_OP = 'INSERT' OR OLD.status NOT IN ('approved', 'booked') OR NEW.booking_date <> OLD.booking_date THEN
      -- Google Calendar (service role) is the master and may overlap; people may not.
      IF NOT trusted AND EXISTS (
        SELECT 1 FROM public.bookings
        WHERE booking_date = NEW.booking_date AND status IN ('approved', 'booked') AND id <> NEW.id
      ) THEN
        RAISE EXCEPTION 'Another booking is already confirmed for %', NEW.booking_date USING ERRCODE = '23505';
      END IF;
      NEW.locked_at := NOW();
      NEW.locked_by := COALESCE(auth.jwt() ->> 'email', 'system');
    END IF;
  ELSE
    NEW.locked_at := NULL;
    NEW.locked_by := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_booking_rules ON public.bookings;
CREATE TRIGGER trg_enforce_booking_rules
  BEFORE INSERT OR UPDATE OR DELETE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_booking_rules();

REVOKE EXECUTE ON FUNCTION public.guard_admin_roles()     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_admin_roles()     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_booking_rules() FROM PUBLIC, anon, authenticated;

-- Lock bookings that are already confirmed.
UPDATE public.bookings
   SET locked_at = COALESCE(updated_at, NOW()), locked_by = 'migration'
 WHERE status IN ('approved', 'booked') AND locked_at IS NULL;
