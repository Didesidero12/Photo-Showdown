-- =============================================================================
-- Security Reconciliation: Harden RLS functions and fix inline subqueries
--
-- 1. Drops the parameterized get_owner_org_ids(UUID)
-- 2. Creates a parameterless, search_path-secured version using auth.uid()
-- 3. Creates get_active_org_ids() for the insert policy
-- 4. Revokes PUBLIC execute on both, grants to authenticated
-- 5. Updates all policies to use the secure helpers instead of inline subqueries
-- =============================================================================

-- Drop the policy that depends on the parameterized function first.
DROP POLICY IF EXISTS "owners_select_org_memberships" ON public.organization_memberships;

-- Drop the parameterized version that accepts an arbitrary UID.
DROP FUNCTION IF EXISTS public.get_owner_org_ids(UUID);

-- Parameterless version: identity derived from auth.uid() internally.
-- SET search_path prevents search-path injection.
-- SECURITY DEFINER runs as the function owner (postgres) to bypass RLS.
CREATE OR REPLACE FUNCTION public.get_owner_org_ids()
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

-- Revoke default PUBLIC execute, explicitly revoke from anon, then grant only to authenticated.
REVOKE EXECUTE ON FUNCTION public.get_owner_org_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_owner_org_ids() FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_owner_org_ids() TO authenticated;

-- Helper for active (non-owner) org IDs
CREATE OR REPLACE FUNCTION public.get_active_org_ids()
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

REVOKE EXECUTE ON FUNCTION public.get_active_org_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_active_org_ids() FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_active_org_ids() TO authenticated;

-- =============================================================================
-- Update Policies
-- =============================================================================

-- 1. organization_memberships
CREATE POLICY "owners_select_org_memberships" ON public.organization_memberships
  FOR SELECT USING (
    organization_id IN (SELECT public.get_owner_org_ids())
  );

-- 2. classes (org_owner_select_classes)
DROP POLICY IF EXISTS "org_owner_select_classes" ON public.classes;
CREATE POLICY "org_owner_select_classes" ON public.classes
  FOR SELECT USING (
    organization_id IN (SELECT public.get_owner_org_ids())
  );

-- 3. classes (class_owner_insert)
DROP POLICY IF EXISTS "class_owner_insert" ON public.classes;
CREATE POLICY "class_owner_insert" ON public.classes
  FOR INSERT WITH CHECK (
    teacher_id = auth.uid()
    AND organization_id IN (SELECT public.get_active_org_ids())
  );

-- 4. class_memberships (org_owner_select_memberships)
DROP POLICY IF EXISTS "org_owner_select_memberships" ON public.class_memberships;
CREATE POLICY "org_owner_select_memberships" ON public.class_memberships
  FOR SELECT USING (
    class_id IN (
      SELECT c.id FROM public.classes c
      WHERE c.organization_id IN (SELECT public.get_owner_org_ids())
    )
  );
