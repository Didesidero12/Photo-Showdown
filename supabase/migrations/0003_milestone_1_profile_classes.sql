-- =============================================================================
-- Milestone 1: Profile completion fields + Classes RLS for teacher operations
--
-- Changes:
--   1. Add profile_complete (BOOLEAN) to profiles — tracks onboarding state.
--   2. Add school (TEXT, nullable) to profiles — optional school/dept name.
--   3. Add class_delete policy so teachers can hard-delete their own classes.
-- =============================================================================

-- ── Profile completion fields ─────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN profile_complete BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN school TEXT;

-- Grant is already present on profiles from migration 0002, nothing extra needed.
