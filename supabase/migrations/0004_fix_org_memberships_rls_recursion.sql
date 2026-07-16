-- =============================================================================
-- Fix: Resolve RLS infinite recursion in organization_memberships.
--
-- The original "owners_select_org_memberships" policy had a self-referencing
-- sub-query on the same table, causing Postgres error 42P17 whenever any
-- operation triggered evaluation of that policy.
--
-- Fix: Create a SECURITY DEFINER function that queries organization_memberships
-- as the table owner (bypassing RLS), then use that function in the policy.
-- This breaks the recursive cycle while preserving the intended access rule.
-- =============================================================================

-- Helper function that returns the org IDs a user owns.
-- SECURITY DEFINER runs as the function owner (postgres), bypassing RLS,
-- so it can query organization_memberships without triggering the same policy.
CREATE OR REPLACE FUNCTION get_owner_org_ids(uid UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT organization_id
  FROM organization_memberships
  WHERE user_id = uid
    AND role = 'owner'
    AND status = 'active'
$$;

-- Replace the recursive policy with one that uses the helper function.
DROP POLICY IF EXISTS "owners_select_org_memberships" ON organization_memberships;

CREATE POLICY "owners_select_org_memberships" ON organization_memberships
FOR SELECT USING (
  organization_id IN (SELECT get_owner_org_ids(auth.uid()))
);
