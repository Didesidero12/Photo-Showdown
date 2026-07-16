-- =============================================================================
-- Final Security Hardening & Recovery Code Claim
--
-- 1. Creates `authz` schema for RLS helpers to prevent public API execution.
-- 2. Migrates all 7 security helpers to `authz` schema.
-- 3. Updates all policies to reference `authz.*` instead of `public.*`.
-- 4. Creates `public.claim_recovery_code(code)` function.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS authz;
GRANT USAGE ON SCHEMA authz TO authenticated;

-- =============================================================================
-- 1. Helper Functions in authz schema
-- =============================================================================

CREATE OR REPLACE FUNCTION authz.get_owner_org_ids()
  RETURNS SETOF UUID
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = pg_catalog
AS $$
  SELECT organization_id
  FROM public.organization_memberships
  WHERE user_id = auth.uid()
    AND role = 'owner'
    AND status = 'active';
$$;
REVOKE EXECUTE ON FUNCTION authz.get_owner_org_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION authz.get_owner_org_ids() FROM anon;
GRANT  EXECUTE ON FUNCTION authz.get_owner_org_ids() TO authenticated;

CREATE OR REPLACE FUNCTION authz.get_active_org_ids()
  RETURNS SETOF UUID
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = pg_catalog
AS $$
  SELECT organization_id
  FROM public.organization_memberships
  WHERE user_id = auth.uid()
    AND status = 'active';
$$;
REVOKE EXECUTE ON FUNCTION authz.get_active_org_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION authz.get_active_org_ids() FROM anon;
GRANT  EXECUTE ON FUNCTION authz.get_active_org_ids() TO authenticated;

CREATE OR REPLACE FUNCTION authz.get_teacher_student_ids()
  RETURNS SETOF UUID
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = pg_catalog
AS $$
  SELECT cm.student_id
  FROM public.class_memberships cm
  JOIN public.classes c ON c.id = cm.class_id
  WHERE c.teacher_id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION authz.get_teacher_student_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION authz.get_teacher_student_ids() FROM anon;
GRANT EXECUTE ON FUNCTION authz.get_teacher_student_ids() TO authenticated;

CREATE OR REPLACE FUNCTION authz.get_student_class_ids()
  RETURNS SETOF UUID
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = pg_catalog
AS $$
  SELECT class_id FROM public.class_memberships
  WHERE student_id = auth.uid() AND status = 'active';
$$;
REVOKE EXECUTE ON FUNCTION authz.get_student_class_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION authz.get_student_class_ids() FROM anon;
GRANT EXECUTE ON FUNCTION authz.get_student_class_ids() TO authenticated;

CREATE OR REPLACE FUNCTION authz.get_teacher_class_ids()
  RETURNS SETOF UUID
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = pg_catalog
AS $$
  SELECT id FROM public.classes WHERE teacher_id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION authz.get_teacher_class_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION authz.get_teacher_class_ids() FROM anon;
GRANT EXECUTE ON FUNCTION authz.get_teacher_class_ids() TO authenticated;

CREATE OR REPLACE FUNCTION authz.get_org_owner_class_ids()
  RETURNS SETOF UUID
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = pg_catalog
AS $$
  SELECT c.id FROM public.classes c
  WHERE c.organization_id IN (
    SELECT organization_id FROM public.organization_memberships
    WHERE user_id = auth.uid() AND role = 'owner' AND status = 'active'
  );
$$;
REVOKE EXECUTE ON FUNCTION authz.get_org_owner_class_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION authz.get_org_owner_class_ids() FROM anon;
GRANT EXECUTE ON FUNCTION authz.get_org_owner_class_ids() TO authenticated;

CREATE OR REPLACE FUNCTION authz.get_teacher_class_membership_ids()
  RETURNS SETOF UUID
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = pg_catalog
AS $$
  SELECT cm.id FROM public.class_memberships cm
  JOIN public.classes c ON c.id = cm.class_id
  WHERE c.teacher_id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION authz.get_teacher_class_membership_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION authz.get_teacher_class_membership_ids() FROM anon;
GRANT EXECUTE ON FUNCTION authz.get_teacher_class_membership_ids() TO authenticated;


-- =============================================================================
-- 2. Update Policies
-- =============================================================================

-- organization_memberships
DROP POLICY IF EXISTS "owners_select_org_memberships" ON public.organization_memberships;
CREATE POLICY "owners_select_org_memberships" ON public.organization_memberships
  FOR SELECT USING (organization_id IN (SELECT authz.get_owner_org_ids()));

-- profiles
DROP POLICY IF EXISTS "teachers_select_class_student_profiles" ON public.profiles;
CREATE POLICY "teachers_select_class_student_profiles" ON public.profiles
  FOR SELECT USING (id IN (SELECT authz.get_teacher_student_ids()));

-- classes
DROP POLICY IF EXISTS "org_owner_select_classes" ON public.classes;
CREATE POLICY "org_owner_select_classes" ON public.classes
  FOR SELECT USING (organization_id IN (SELECT authz.get_owner_org_ids()));

DROP POLICY IF EXISTS "class_owner_insert" ON public.classes;
CREATE POLICY "class_owner_insert" ON public.classes
  FOR INSERT WITH CHECK (
    teacher_id = auth.uid()
    AND organization_id IN (SELECT authz.get_active_org_ids())
  );

DROP POLICY IF EXISTS "students_select_own_class" ON public.classes;
CREATE POLICY "students_select_own_class" ON public.classes
  FOR SELECT USING (id IN (SELECT authz.get_student_class_ids()));

-- class_memberships
DROP POLICY IF EXISTS "teacher_select_class_memberships" ON public.class_memberships;
CREATE POLICY "teacher_select_class_memberships" ON public.class_memberships
  FOR SELECT USING (class_id IN (SELECT authz.get_teacher_class_ids()));

DROP POLICY IF EXISTS "org_owner_select_memberships" ON public.class_memberships;
CREATE POLICY "org_owner_select_memberships" ON public.class_memberships
  FOR SELECT USING (class_id IN (SELECT authz.get_org_owner_class_ids()));

DROP POLICY IF EXISTS "teacher_update_membership_status" ON public.class_memberships;
CREATE POLICY "teacher_update_membership_status" ON public.class_memberships
  FOR UPDATE USING (class_id IN (SELECT authz.get_teacher_class_ids()));

-- recovery_codes
DROP POLICY IF EXISTS "teacher_select_recovery_codes" ON public.recovery_codes;
CREATE POLICY "teacher_select_recovery_codes" ON public.recovery_codes
  FOR SELECT USING (class_membership_id IN (SELECT authz.get_teacher_class_membership_ids()));

DROP POLICY IF EXISTS "teacher_insert_recovery_codes" ON public.recovery_codes;
CREATE POLICY "teacher_insert_recovery_codes" ON public.recovery_codes
  FOR INSERT WITH CHECK (class_membership_id IN (SELECT authz.get_teacher_class_membership_ids()));


-- =============================================================================
-- 3. Drop Public Helpers
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_owner_org_ids();
DROP FUNCTION IF EXISTS public.get_active_org_ids();
DROP FUNCTION IF EXISTS public.get_teacher_student_ids();
DROP FUNCTION IF EXISTS public.get_student_class_ids();
DROP FUNCTION IF EXISTS public.get_teacher_class_ids();
DROP FUNCTION IF EXISTS public.get_org_owner_class_ids();
DROP FUNCTION IF EXISTS public.get_teacher_class_membership_ids();


-- =============================================================================
-- 4. claim_recovery_code
-- =============================================================================

CREATE OR REPLACE FUNCTION public.claim_recovery_code(provided_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  target_membership_id UUID;
BEGIN
  -- 1. Find the recovery code and lock it for update
  SELECT class_membership_id
  INTO target_membership_id
  FROM public.recovery_codes
  WHERE code = provided_code
    AND expires_at > now()
    AND used_at IS NULL
  FOR UPDATE SKIP LOCKED;

  IF target_membership_id IS NULL THEN
    RETURN FALSE; 
  END IF;

  -- 2. Update the class membership to link to the caller's auth.uid()
  UPDATE public.class_memberships
  SET student_id = auth.uid(),
      updated_at = now()
  WHERE id = target_membership_id;

  -- 3. Mark the recovery code as used
  UPDATE public.recovery_codes
  SET used_at = now()
  WHERE class_membership_id = target_membership_id 
    AND code = provided_code;

  RETURN TRUE;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.claim_recovery_code(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_recovery_code(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_recovery_code(TEXT) TO authenticated;
