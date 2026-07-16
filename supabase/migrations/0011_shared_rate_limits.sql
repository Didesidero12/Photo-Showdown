-- =============================================================================
-- Shared Postgres Rate Limiting
-- =============================================================================

CREATE UNLOGGED TABLE IF NOT EXISTS public.rate_limits (
  key TEXT PRIMARY KEY,
  count INT NOT NULL DEFAULT 1,
  reset_at TIMESTAMPTZ NOT NULL
);

-- We only allow the server (service-role) to manage rate limits
REVOKE ALL ON public.rate_limits FROM PUBLIC, anon, authenticated;

-- Ensure an index on reset_at for fast cleanup
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON public.rate_limits(reset_at);

-- RPC for atomic rate limiting
CREATE OR REPLACE FUNCTION public.increment_rate_limit(p_key TEXT, p_window_interval INTERVAL)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INT;
BEGIN
  -- Cleanup expired for this key (optional but good for hygiene)
  DELETE FROM public.rate_limits WHERE key = p_key AND reset_at < now();

  INSERT INTO public.rate_limits (key, count, reset_at)
  VALUES (p_key, 1, now() + p_window_interval)
  ON CONFLICT (key) DO UPDATE
  SET count = rate_limits.count + 1
  RETURNING count INTO v_count;

  RETURN v_count;
END;
$$;
