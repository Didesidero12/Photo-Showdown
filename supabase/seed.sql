-- Development seed: two test teachers with complete provisioning.
-- Run automatically by: supabase db reset
-- UUIDs are fixed so test code can reference them by constant.

DO $$
DECLARE
  teacher_a_id UUID := '00000000-0000-0000-0000-000000000001';
  teacher_b_id UUID := '00000000-0000-0000-0000-000000000002';
  org_a_id     UUID := '11111111-1111-1111-1111-111111111111';
  org_b_id     UUID := '22222222-2222-2222-2222-222222222222';
BEGIN
  -- Create auth users (idempotent)
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
  )
  VALUES
  (
    '00000000-0000-0000-0000-000000000000', teacher_a_id, 'authenticated', 'authenticated', 'teacher-a@dev.local', 
    '$2a$10$wE/.7F2.O4uH1Hh2G3e7u.Kx.QzWkUq3q1Gz.zYlE2V9e2k9gG4', now(), null, now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000', teacher_b_id, 'authenticated', 'authenticated', 'teacher-b@dev.local', 
    '$2a$10$wE/.7F2.O4uH1Hh2G3e7u.Kx.QzWkUq3q1Gz.zYlE2V9e2k9gG4', now(), null, now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  )
  ON CONFLICT (id) DO NOTHING;

  -- Create profiles
  INSERT INTO public.profiles (id, display_name, school, profile_complete)
  VALUES
    (teacher_a_id, 'Seed Teacher A', 'Dev High', true),
    (teacher_b_id, 'Seed Teacher B', 'Dev Academy', true)
  ON CONFLICT (id) DO NOTHING;

  -- Create organizations
  INSERT INTO public.organizations (id, name, slug)
  VALUES
    (org_a_id, 'Personal Workspace (Seed A)', 'seed-a'),
    (org_b_id, 'Personal Workspace (Seed B)', 'seed-b')
  ON CONFLICT (id) DO NOTHING;

  -- Create organization_memberships
  INSERT INTO public.organization_memberships (organization_id, user_id, role, status)
  VALUES
    (org_a_id, teacher_a_id, 'owner', 'active'),
    (org_b_id, teacher_b_id, 'owner', 'active')
  ON CONFLICT (organization_id, user_id) DO NOTHING;

END $$;
