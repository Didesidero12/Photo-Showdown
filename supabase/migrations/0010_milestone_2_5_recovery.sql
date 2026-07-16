-- =============================================================================
-- Milestone 2.5: Recovery and Conflicts
-- =============================================================================

-- 1. Rename column to enforce hashing
ALTER TABLE public.recovery_codes 
  RENAME COLUMN code TO code_hash;

-- 2. Drop the old function
DROP FUNCTION IF EXISTS public.claim_recovery_code(TEXT);

-- 3. Create the hardened RPC
CREATE OR REPLACE FUNCTION public.claim_recovery_code(provided_code_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  target_membership_id UUID;
  target_class_id UUID;
  current_owner UUID;
  existing_conflict_membership_id UUID;
BEGIN
  -- We require an authenticated anonymous student
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  -- 1. Find and lock the recovery code
  SELECT rc.class_membership_id, cm.class_id, cm.student_id
  INTO target_membership_id, target_class_id, current_owner
  FROM public.recovery_codes rc
  JOIN public.class_memberships cm ON cm.id = rc.class_membership_id
  WHERE rc.code_hash = provided_code_hash
    AND rc.expires_at > now()
    AND rc.used_at IS NULL
  FOR UPDATE OF rc SKIP LOCKED;

  IF target_membership_id IS NULL THEN
    -- Either invalid hash, expired, used, or couldn't obtain lock
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  -- 2. Conflict Handling
  -- If the destination already owns the target membership, return success idempotently
  IF current_owner = auth.uid() THEN
    -- Mark used anyway since they claimed it, or leave it?
    -- The requirement says: "return success idempotently"
    UPDATE public.recovery_codes SET used_at = now() WHERE code_hash = provided_code_hash AND class_membership_id = target_membership_id;
    RETURN jsonb_build_object('ok', true, 'message', 'already_owned');
  END IF;

  -- Check if the destination already has a *different* active membership in the same class
  SELECT id INTO existing_conflict_membership_id
  FROM public.class_memberships
  WHERE class_id = target_class_id
    AND student_id = auth.uid()
    AND status != 'removed'; -- Only active or suspended matter for conflict

  IF existing_conflict_membership_id IS NOT NULL THEN
    -- Fail safely and require teacher resolution
    RETURN jsonb_build_object('ok', false, 'error', 'conflict_existing_membership');
  END IF;

  -- 3. Transfer the membership
  UPDATE public.class_memberships
  SET student_id = auth.uid(),
      updated_at = now()
  WHERE id = target_membership_id;

  -- 4. Mark code as used
  UPDATE public.recovery_codes
  SET used_at = now()
  WHERE code_hash = provided_code_hash 
    AND class_membership_id = target_membership_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_recovery_code(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_recovery_code(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_recovery_code(TEXT) TO authenticated;
