-- =============================================================================
-- Photo Showdown — Milestone 0 Schema Migration
-- =============================================================================

-- ── Enable required extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ── Utility function ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN 
  NEW.updated_at = NOW(); 
  RETURN NEW; 
END;
$$ LANGUAGE plpgsql;

-- ── Custom enum types ────────────────────────────────────────────────────────
CREATE TYPE org_member_role   AS ENUM ('owner', 'teacher');
CREATE TYPE org_member_status AS ENUM ('active', 'suspended', 'removed');
CREATE TYPE class_member_status AS ENUM ('active', 'suspended', 'removed');

-- =============================================================================
-- TABLES (created first so policies can reference them)
-- =============================================================================

-- 1. organizations
CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        CITEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. organization_memberships
CREATE TABLE organization_memberships (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role             org_member_role NOT NULL DEFAULT 'teacher',
  status           org_member_status NOT NULL DEFAULT 'active',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id)
);

CREATE TRIGGER organization_memberships_updated_at
  BEFORE UPDATE ON organization_memberships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_org_memberships_user ON organization_memberships(user_id);
CREATE INDEX idx_org_memberships_org  ON organization_memberships(organization_id);

-- 3. profiles
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT NOT NULL,
  is_anonymous  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4. classes
CREATE TABLE classes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id),
  teacher_id       UUID NOT NULL REFERENCES profiles(id),
  name             TEXT NOT NULL,
  class_code       CHAR(6) UNIQUE NOT NULL,
  archived_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER classes_updated_at
  BEFORE UPDATE ON classes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_classes_org        ON classes(organization_id);
CREATE INDEX idx_classes_teacher    ON classes(teacher_id);
CREATE INDEX idx_classes_class_code ON classes(class_code);

-- 5. class_memberships
CREATE TABLE class_memberships (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id      UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES auth.users(id),
  display_name  TEXT NOT NULL,
  status        class_member_status NOT NULL DEFAULT 'active',
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER class_memberships_updated_at
  BEFORE UPDATE ON class_memberships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_class_memberships_class   ON class_memberships(class_id);
CREATE INDEX idx_class_memberships_student ON class_memberships(student_id);
CREATE UNIQUE INDEX idx_class_memberships_active_student
  ON class_memberships(class_id, student_id) WHERE status = 'active';

-- 6. recovery_codes
CREATE TABLE recovery_codes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_membership_id   UUID NOT NULL REFERENCES class_memberships(id) ON DELETE CASCADE,
  code                  TEXT UNIQUE NOT NULL,
  expires_at            TIMESTAMPTZ NOT NULL,
  used_at               TIMESTAMPTZ,
  created_by            UUID NOT NULL REFERENCES profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recovery_codes_membership ON recovery_codes(class_membership_id);
CREATE INDEX idx_recovery_codes_code       ON recovery_codes(code);

-- =============================================================================
-- RLS POLICIES (now that all tables exist)
-- =============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_members_select_own" ON organizations
FOR SELECT USING (
  id IN (
    SELECT organization_id FROM organization_memberships
    WHERE user_id = auth.uid()
      AND status = 'active'
  )
);

ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_select_own_membership" ON organization_memberships
FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "owners_select_org_memberships" ON organization_memberships
FOR SELECT USING (
  organization_id IN (
    SELECT organization_id FROM organization_memberships
    WHERE user_id = auth.uid()
      AND role = 'owner'
      AND status = 'active'
  )
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_select_own_profile" ON profiles
FOR SELECT USING (id = auth.uid());
CREATE POLICY "teachers_select_class_student_profiles" ON profiles
FOR SELECT USING (
  id IN (
    SELECT cm.student_id
    FROM class_memberships cm
    JOIN classes c ON c.id = cm.class_id
    WHERE c.teacher_id = auth.uid()
  )
);
CREATE POLICY "users_update_own_display_name" ON profiles
FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
-- Provisioning: allow a user to INSERT their own profile row.
-- The service-role client used in ensureTeacherProvisioned() bypasses RLS,
-- but this policy is the required safety-net for the insert to succeed
-- when RLS is enforced (e.g., local dev with anon-key fallback).
CREATE POLICY "users_insert_own_profile" ON profiles
FOR INSERT
WITH CHECK (id = auth.uid());


ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "class_owner_select" ON classes
FOR SELECT USING (teacher_id = auth.uid());
CREATE POLICY "org_owner_select_classes" ON classes
FOR SELECT USING (
  organization_id IN (
    SELECT organization_id FROM organization_memberships
    WHERE user_id = auth.uid()
      AND role = 'owner'
      AND status = 'active'
  )
);
CREATE POLICY "students_select_own_class" ON classes
FOR SELECT USING (
  id IN (
    SELECT class_id FROM class_memberships
    WHERE student_id = auth.uid()
      AND status = 'active'
  )
);
CREATE POLICY "class_owner_insert" ON classes
FOR INSERT WITH CHECK (
  teacher_id = auth.uid()
  AND organization_id IN (
    SELECT organization_id FROM organization_memberships
    WHERE user_id = auth.uid()
      AND status = 'active'
  )
);
CREATE POLICY "class_owner_update" ON classes
FOR UPDATE USING (teacher_id = auth.uid());

ALTER TABLE class_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "students_select_own_memberships" ON class_memberships
FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "teacher_select_class_memberships" ON class_memberships
FOR SELECT USING (
  class_id IN (
    SELECT id FROM classes WHERE teacher_id = auth.uid()
  )
);
CREATE POLICY "org_owner_select_memberships" ON class_memberships
FOR SELECT USING (
  class_id IN (
    SELECT c.id FROM classes c
    JOIN organization_memberships om ON om.organization_id = c.organization_id
    WHERE om.user_id = auth.uid()
      AND om.role = 'owner'
      AND om.status = 'active'
  )
);
CREATE POLICY "students_insert_own_membership" ON class_memberships
FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "teacher_update_membership_status" ON class_memberships
FOR UPDATE USING (
  class_id IN (
    SELECT id FROM classes WHERE teacher_id = auth.uid()
  )
);

ALTER TABLE recovery_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teacher_select_recovery_codes" ON recovery_codes
FOR SELECT USING (
  class_membership_id IN (
    SELECT cm.id FROM class_memberships cm
    JOIN classes c ON c.id = cm.class_id
    WHERE c.teacher_id = auth.uid()
  )
);
CREATE POLICY "teacher_insert_recovery_codes" ON recovery_codes
FOR INSERT WITH CHECK (
  class_membership_id IN (
    SELECT cm.id FROM class_memberships cm
    JOIN classes c ON c.id = cm.class_id
    WHERE c.teacher_id = auth.uid()
  )
);
CREATE POLICY "teacher_update_recovery_codes" ON recovery_codes
FOR UPDATE USING (
  class_membership_id IN (
    SELECT cm.id FROM class_memberships cm
    JOIN classes c ON c.id = cm.class_id
    WHERE c.teacher_id = auth.uid()
  )
);

-- =============================================================================
-- Utility functions
-- =============================================================================

CREATE OR REPLACE FUNCTION generate_class_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code  TEXT := '';
  i     INT;
BEGIN
  FOR i IN 1..6 LOOP
    code := code || substr(chars, floor(random() * length(chars) + 1)::INT, 1);
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_recovery_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'abcdefghjkmnpqrstuvwxyz23456789';
  code  TEXT := '';
  i     INT;
BEGIN
  FOR i IN 1..8 LOOP
    code := code || substr(chars, floor(random() * length(chars) + 1)::INT, 1);
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Grants: allow authenticated and service_role to perform DML on all tables.
-- Without these, Postgres roles have no INSERT/UPDATE/DELETE even as owner.
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_memberships TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_memberships TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recovery_codes TO authenticated, service_role;