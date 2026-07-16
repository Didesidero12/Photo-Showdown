const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
});

async function run() {
  await client.connect();
  const sql = `
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

GRANT EXECUTE ON FUNCTION public.increment_session_coaching_trigger(UUID, TEXT) TO authenticated;

DROP FUNCTION IF EXISTS public.toggle_critique_hidden(UUID, BOOLEAN);

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

REVOKE EXECUTE ON FUNCTION public.toggle_critique_hidden(UUID, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.toggle_critique_hidden(UUID, BOOLEAN, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.toggle_critique_hidden(UUID, BOOLEAN, TEXT) TO authenticated;
  `;
  await client.query(sql);
  console.log("RPC updated");
  await client.end();
}
run();
