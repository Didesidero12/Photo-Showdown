-- 0017_moderation_audit.sql

-- Add Moderation Audit Columns
ALTER TABLE public.critiques
  ADD COLUMN IF NOT EXISTS hidden_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hidden_reason TEXT,
  ADD COLUMN IF NOT EXISTS unhidden_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unhidden_at TIMESTAMPTZ;

-- Drop old signature
DROP FUNCTION IF EXISTS public.toggle_critique_hidden(UUID, BOOLEAN);

-- Replace Moderation RPC
CREATE OR REPLACE FUNCTION public.toggle_critique_hidden(p_critique_id UUID, p_is_hidden BOOLEAN, p_reason TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_teacher_id UUID;
BEGIN
  -- Only the teacher of the session can do this
  SELECT ss.teacher_id INTO v_teacher_id
  FROM public.critiques c
  JOIN public.matchups m ON m.id = c.matchup_id
  JOIN public.showdown_sessions ss ON ss.id = m.session_id
  WHERE c.id = p_critique_id;

  IF v_teacher_id != auth.uid() OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_is_hidden THEN
    IF p_reason IS NULL OR trim(p_reason) = '' THEN
      RAISE EXCEPTION 'A reason is required when hiding feedback';
    END IF;

    UPDATE public.critiques
    SET is_hidden = true,
        hidden_by = auth.uid(),
        hidden_at = NOW(),
        hidden_reason = p_reason
    WHERE id = p_critique_id;
  ELSE
    UPDATE public.critiques
    SET is_hidden = false,
        unhidden_by = auth.uid(),
        unhidden_at = NOW()
    WHERE id = p_critique_id;
  END IF;
END;
$$;

-- Secure the RPC
REVOKE EXECUTE ON FUNCTION public.toggle_critique_hidden(UUID, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.toggle_critique_hidden(UUID, BOOLEAN, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.toggle_critique_hidden(UUID, BOOLEAN, TEXT) TO authenticated;
