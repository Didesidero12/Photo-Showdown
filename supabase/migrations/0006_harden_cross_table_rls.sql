-- =============================================================================
-- Security Reconciliation: Complete RLS Hardening
--
-- Replaces all remaining cross-table inline subqueries with SECURITY DEFINER
-- functions to break RLS recursion cycles (e.g., classes <-> class_memberships).
-- =============================================================================

-- 1. Function: get_teacher_student_ids()
CREATE OR REPLACE FUNCTION public.get_teacher_student_ids()
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

REVOKE EXECUTE ON FUNCTION public.get_teacher_student_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_teacher_student_ids() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_teacher_student_ids() TO authenticated;

-- 2. Function: get_student_class_ids()
CREATE OR REPLACE FUNCTION public.get_student_class_ids()
  RETURNS SETOF UUID
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = pg_catalog
AS $$
  SELECT class_id FROM public.class_memberships
  WHERE student_id = auth.uid() AND status = 'active';
$$;

REVOKE EXECUTE ON FUNCTION public.get_student_class_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_student_class_ids() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_student_class_ids() TO authenticated;

-- 3. Function: get_teacher_class_ids()
CREATE OR REPLACE FUNCTION public.get_teacher_class_ids()
  RETURNS SETOF UUID
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = pg_catalog
AS $$
  SELECT id FROM public.classes WHERE teacher_id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.get_teacher_class_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_teacher_class_ids() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_teacher_class_ids() TO authenticated;

-- 4. Function: get_org_owner_class_ids()
CREATE OR REPLACE FUNCTION public.get_org_owner_class_ids()
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

REVOKE EXECUTE ON FUNCTION public.get_org_owner_class_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_org_owner_class_ids() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_org_owner_class_ids() TO authenticated;

-- 5. Function: get_teacher_class_membership_ids()
CREATE OR REPLACE FUNCTION public.get_teacher_class_membership_ids()
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

REVOKE EXECUTE ON FUNCTION public.get_teacher_class_membership_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_teacher_class_membership_ids() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_teacher_class_membership_ids() TO authenticated;


-- =============================================================================
-- Update Policies
-- =============================================================================

-- profiles
DROP POLICY IF EXISTS "teachers_select_class_student_profiles" ON public.profiles;
CREATE POLICY "teachers_select_class_student_profiles" ON public.profiles
  FOR SELECT USING (id IN (SELECT public.get_teacher_student_ids()));

-- classes
DROP POLICY IF EXISTS "students_select_own_class" ON public.classes;
CREATE POLICY "students_select_own_class" ON public.classes
  FOR SELECT USING (id IN (SELECT public.get_student_class_ids()));

-- class_memberships
DROP POLICY IF EXISTS "teacher_select_class_memberships" ON public.class_memberships;
CREATE POLICY "teacher_select_class_memberships" ON public.class_memberships
  FOR SELECT USING (class_id IN (SELECT public.get_teacher_class_ids()));

DROP POLICY IF EXISTS "org_owner_select_memberships" ON public.class_memberships;
CREATE POLICY "org_owner_select_memberships" ON public.class_memberships
  FOR SELECT USING (class_id IN (SELECT public.get_org_owner_class_ids()));

DROP POLICY IF EXISTS "teacher_update_membership_status" ON public.class_memberships;
CREATE POLICY "teacher_update_membership_status" ON public.class_memberships
  FOR UPDATE USING (class_id IN (SELECT public.get_teacher_class_ids()));

-- recovery_codes
DROP POLICY IF EXISTS "teacher_select_recovery_codes" ON public.recovery_codes;
CREATE POLICY "teacher_select_recovery_codes" ON public.recovery_codes
  FOR SELECT USING (class_membership_id IN (SELECT public.get_teacher_class_membership_ids()));

DROP POLICY IF EXISTS "teacher_insert_recovery_codes" ON public.recovery_codes;
CREATE POLICY "teacher_insert_recovery_codes" ON public.recovery_codes
  FOR INSERT WITH CHECK (class_membership_id IN (SELECT public.get_teacher_class_membership_ids()));
