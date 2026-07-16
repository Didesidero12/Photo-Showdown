-- =============================================================================
-- Milestone 3.1: Verification & Hardening
-- =============================================================================

-- 1. Split Justification into Notice and Effect
ALTER TABLE public.critiques
  RENAME COLUMN justification TO notice;

ALTER TABLE public.critiques
  ADD COLUMN effect TEXT;

-- For existing critiques, we just set effect to empty or null, but notice holds the old string.
-- Wait, the `effect` is NOT NULL? For existing ones, let's just make it nullable or default empty.
-- We'll make it NOT NULL but default to empty string for safety, then drop default.
ALTER TABLE public.critiques
  ALTER COLUMN effect SET DEFAULT '';
UPDATE public.critiques SET effect = '' WHERE effect IS NULL;
ALTER TABLE public.critiques
  ALTER COLUMN effect SET NOT NULL;
ALTER TABLE public.critiques
  ALTER COLUMN effect DROP DEFAULT;

-- 2. Expand Moderation Schema
ALTER TABLE public.critiques
  ADD COLUMN hidden_by UUID REFERENCES auth.users(id),
  ADD COLUMN hidden_at TIMESTAMPTZ,
  ADD COLUMN hidden_reason TEXT,
  ADD COLUMN unhidden_by UUID REFERENCES auth.users(id),
  ADD COLUMN unhidden_at TIMESTAMPTZ;

-- 3. Update the toggle_critique_hidden RPC
CREATE OR REPLACE FUNCTION public.toggle_critique_hidden(p_critique_id UUID, p_is_hidden BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
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

  IF v_teacher_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_is_hidden THEN
    UPDATE public.critiques
    SET is_hidden = true,
        hidden_by = auth.uid(),
        hidden_at = now(),
        hidden_reason = 'Teacher Moderation'
    WHERE id = p_critique_id;
  ELSE
    UPDATE public.critiques
    SET is_hidden = false,
        unhidden_by = auth.uid(),
        unhidden_at = now()
    WHERE id = p_critique_id;
  END IF;
END;
$$;
