-- =============================================================================
-- Fix: Grant DML privileges to authenticated + service_role on all tables.
--
-- Root cause of 42501 (profiles_upsert_failed):
--   The initial migration created tables but never ran GRANT statements.
--   Without explicit grants, the authenticated and service_role Postgres
--   roles have no INSERT/UPDATE/DELETE on any table — causing all writes
--   to fail with "insufficient privilege" regardless of RLS policies.
--
-- GRANT is idempotent: safe to re-run even if privileges already exist.
-- RLS policies and ALTER TABLE are handled by 0001 to avoid duplicates.
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_memberships TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_memberships TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recovery_codes TO authenticated, service_role;
