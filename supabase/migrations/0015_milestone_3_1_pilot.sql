-- =============================================================================
-- Milestone 3.1: Classroom Pilot Readiness
-- =============================================================================

-- 1. Analytics
ALTER TABLE public.showdown_sessions
  ADD COLUMN IF NOT EXISTS pilot_analytics JSONB DEFAULT '{}'::jsonb;

-- Example analytics structure:
-- {
--   "matchups_assigned": 0,
--   "matchups_completed": 0,
--   "coaching_triggers": { "too_short": 0, "generic_praise": 0, "missing_effect": 0 }
-- }

-- 2. Moderation
ALTER TABLE public.critiques
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;

-- RPC for incrementing analytics safely (coaching triggers)
CREATE OR REPLACE FUNCTION public.increment_session_coaching_trigger(p_session_id UUID, p_trigger_type TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- We allow an authenticated user to hit this.
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  -- Ensure pilot_analytics has a coaching_triggers object
  UPDATE public.showdown_sessions
  SET pilot_analytics = COALESCE(pilot_analytics, '{}'::jsonb) || '{"coaching_triggers": {}}'::jsonb
  WHERE id = p_session_id AND NOT (COALESCE(pilot_analytics, '{}'::jsonb) ? 'coaching_triggers');

  -- Now safe to increment
  UPDATE public.showdown_sessions
  SET pilot_analytics = jsonb_set(
    pilot_analytics,
    array['coaching_triggers', p_trigger_type],
    (COALESCE((pilot_analytics#>array['coaching_triggers', p_trigger_type])::int, 0) + 1)::text::jsonb,
    true
  )
  WHERE id = p_session_id;
END;
$$;

-- Allow authenticated users to call it (used during submitCritique failure)
REVOKE EXECUTE ON FUNCTION public.increment_session_coaching_trigger(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_session_coaching_trigger(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.increment_session_coaching_trigger(UUID, TEXT) TO authenticated;

-- Function for Teacher to hide a critique
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

  UPDATE public.critiques
  SET is_hidden = p_is_hidden
  WHERE id = p_critique_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.toggle_critique_hidden(UUID, BOOLEAN) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.toggle_critique_hidden(UUID, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.toggle_critique_hidden(UUID, BOOLEAN) TO authenticated;
