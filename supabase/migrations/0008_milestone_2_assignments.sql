-- =============================================================================
-- Photo Showdown — Milestone 2 Schema
--
-- Creates:
--   • assignment_status, submission_status, processing_status, experience_mode ENUMs
--   • assignments table (with share_token)
--   • submissions table (anchored to class_membership_id)
--   • authz helpers for assignments and submissions
--   • RLS policies
--   • DB functions: generate_share_token, initiate_submission
-- =============================================================================

-- ─── ENUMs ───────────────────────────────────────────────────────────────────

CREATE TYPE assignment_status AS ENUM (
  'draft',
  'accepting_submissions',
  'submission_review',
  'ready',
  'active_critique',
  'results_reveal',
  'reflection',
  'complete',
  'archived'
);

CREATE TYPE submission_status AS ENUM (
  'pending',
  'approved',
  'returned',
  'rejected'
);

CREATE TYPE processing_status AS ENUM (
  'pending',
  'processing',
  'ready',
  'failed'
);

CREATE TYPE experience_mode AS ENUM (
  'quick_showdown',
  'critique_studio'
);

-- ─── assignments ─────────────────────────────────────────────────────────────

CREATE TABLE assignments (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id             UUID        NOT NULL REFERENCES organizations(id),
  class_id                    UUID        NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id                  UUID        NOT NULL REFERENCES profiles(id),
  title                       TEXT        NOT NULL,
  instructions                TEXT,
  experience_mode             experience_mode NOT NULL DEFAULT 'quick_showdown',
  status                      assignment_status NOT NULL DEFAULT 'draft',
  share_token                 TEXT        UNIQUE NOT NULL,
  submission_deadline         TIMESTAMPTZ,
  max_submissions_per_student INT         NOT NULL DEFAULT 1,
  creative_intent_prompt      TEXT        NOT NULL DEFAULT 'Explain the creative choices behind your photograph.',
  reflection_prompt           TEXT,
  allow_comments              BOOLEAN     NOT NULL DEFAULT TRUE,
  restrict_self_evaluation    BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER assignments_updated_at
  BEFORE UPDATE ON assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_assignments_class   ON assignments(class_id);
CREATE INDEX idx_assignments_teacher ON assignments(teacher_id);
CREATE INDEX idx_assignments_share_token ON assignments(share_token);

-- ─── submissions ─────────────────────────────────────────────────────────────

CREATE TABLE submissions (
  id                    UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID              NOT NULL REFERENCES organizations(id),
  assignment_id         UUID              NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  class_membership_id   UUID              NOT NULL REFERENCES class_memberships(id),
  status                submission_status NOT NULL DEFAULT 'pending',
  storage_path_raw      TEXT,
  storage_path_processed TEXT,
  creative_intent       TEXT              NOT NULL,
  teacher_note          TEXT,
  processing_status     processing_status NOT NULL DEFAULT 'pending',
  processing_error      TEXT,
  submitted_at          TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  reviewed_at           TIMESTAMPTZ,
  reviewed_by           UUID              REFERENCES profiles(id),
  revision_number       INT               NOT NULL DEFAULT 1,
  previous_submission_id UUID             REFERENCES submissions(id),
  created_at            TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE TRIGGER submissions_updated_at
  BEFORE UPDATE ON submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_submissions_assignment       ON submissions(assignment_id);
CREATE INDEX idx_submissions_class_membership ON submissions(class_membership_id);
CREATE INDEX idx_submissions_org             ON submissions(organization_id);

-- One active (non-returned, non-rejected) submission per student per assignment.
-- 'returned' submissions are replaced in-place (same row updated), so this
-- partial unique index guards against duplicate concurrent inserts.
CREATE UNIQUE INDEX idx_submissions_one_active
  ON submissions(assignment_id, class_membership_id)
  WHERE status IN ('pending', 'approved');

-- ─── authz helpers ───────────────────────────────────────────────────────────

-- Returns assignment IDs the current teacher owns (via class ownership)
CREATE OR REPLACE FUNCTION authz.get_teacher_assignment_ids()
  RETURNS SETOF UUID
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = pg_catalog
AS $$
  SELECT a.id
  FROM public.assignments a
  JOIN public.classes c ON c.id = a.class_id
  WHERE c.teacher_id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION authz.get_teacher_assignment_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION authz.get_teacher_assignment_ids() FROM anon;
GRANT  EXECUTE ON FUNCTION authz.get_teacher_assignment_ids() TO authenticated;

-- Returns assignment IDs the current student can see (published, active membership)
CREATE OR REPLACE FUNCTION authz.get_student_visible_assignment_ids()
  RETURNS SETOF UUID
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = pg_catalog
AS $$
  SELECT a.id
  FROM public.assignments a
  JOIN public.class_memberships cm ON cm.class_id = a.class_id
  WHERE cm.student_id = auth.uid()
    AND cm.status = 'active'
    AND a.status IN ('accepting_submissions', 'submission_review', 'ready', 'complete');
$$;
REVOKE EXECUTE ON FUNCTION authz.get_student_visible_assignment_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION authz.get_student_visible_assignment_ids() FROM anon;
GRANT  EXECUTE ON FUNCTION authz.get_student_visible_assignment_ids() TO authenticated;

-- Returns the current student's class_membership_id for a given class
CREATE OR REPLACE FUNCTION authz.get_my_membership_id_for_class(p_class_id UUID)
  RETURNS UUID
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = pg_catalog
AS $$
  SELECT id
  FROM public.class_memberships
  WHERE class_id = p_class_id
    AND student_id = auth.uid()
    AND status = 'active'
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION authz.get_my_membership_id_for_class(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION authz.get_my_membership_id_for_class(UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION authz.get_my_membership_id_for_class(UUID) TO authenticated;

-- Returns submission IDs the teacher can review (own class)
CREATE OR REPLACE FUNCTION authz.get_teacher_reviewable_submission_ids()
  RETURNS SETOF UUID
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = pg_catalog
AS $$
  SELECT s.id
  FROM public.submissions s
  JOIN public.assignments a ON a.id = s.assignment_id
  JOIN public.classes c ON c.id = a.class_id
  WHERE c.teacher_id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION authz.get_teacher_reviewable_submission_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION authz.get_teacher_reviewable_submission_ids() FROM anon;
GRANT  EXECUTE ON FUNCTION authz.get_teacher_reviewable_submission_ids() TO authenticated;

-- Returns submission IDs the current student controls (via class_membership_id)
CREATE OR REPLACE FUNCTION authz.get_my_submission_ids()
  RETURNS SETOF UUID
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = pg_catalog
AS $$
  SELECT s.id
  FROM public.submissions s
  JOIN public.class_memberships cm ON cm.id = s.class_membership_id
  WHERE cm.student_id = auth.uid()
    AND cm.status = 'active';
$$;
REVOKE EXECUTE ON FUNCTION authz.get_my_submission_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION authz.get_my_submission_ids() FROM anon;
GRANT  EXECUTE ON FUNCTION authz.get_my_submission_ids() TO authenticated;

-- ─── RLS: assignments ────────────────────────────────────────────────────────

ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

-- Teacher: full access to own assignments
CREATE POLICY "teacher_select_own_assignments" ON assignments
  FOR SELECT USING (class_id IN (SELECT authz.get_teacher_class_ids()));

CREATE POLICY "teacher_insert_assignment" ON assignments
  FOR INSERT WITH CHECK (
    teacher_id = auth.uid()
    AND class_id IN (SELECT authz.get_teacher_class_ids())
  );

CREATE POLICY "teacher_update_own_assignments" ON assignments
  FOR UPDATE USING (class_id IN (SELECT authz.get_teacher_class_ids()));

-- Student: only published-and-visible assignments in active enrolled classes
CREATE POLICY "student_select_visible_assignments" ON assignments
  FOR SELECT USING (id IN (SELECT authz.get_student_visible_assignment_ids()));

-- ─── RLS: submissions ────────────────────────────────────────────────────────

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Teacher: may SELECT submissions they can review
CREATE POLICY "teacher_select_submissions" ON submissions
  FOR SELECT USING (id IN (SELECT authz.get_teacher_reviewable_submission_ids()));

-- Teacher: may UPDATE (review) submissions from their classes
CREATE POLICY "teacher_update_submissions" ON submissions
  FOR UPDATE USING (id IN (SELECT authz.get_teacher_reviewable_submission_ids()));

-- Student: may SELECT only their own submissions
CREATE POLICY "student_select_own_submissions" ON submissions
  FOR SELECT USING (id IN (SELECT authz.get_my_submission_ids()));

-- Students INSERT submissions only via initiate_submission() SECURITY DEFINER function.
-- No direct INSERT RLS policy for students — the function bypasses and enforces its own checks.

-- ─── DB functions ────────────────────────────────────────────────────────────

-- Generates a URL-safe random share token (32 chars, base62-ish)
CREATE OR REPLACE FUNCTION generate_share_token()
  RETURNS TEXT
  LANGUAGE plpgsql
  SET search_path = pg_catalog
AS $$
DECLARE
  chars TEXT := 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  token TEXT := '';
  i     INT;
BEGIN
  FOR i IN 1..32 LOOP
    token := token || substr(chars, floor(random() * length(chars) + 1)::INT, 1);
  END LOOP;
  RETURN token;
END;
$$;

-- initiate_submission: Concurrency-safe submission creation/revision.
-- Validates membership, assignment state, deadline, and submission limit.
-- Returns the submission ID and the expected raw storage path.
-- Only authenticated users may call this; the function verifies identity internally.
CREATE OR REPLACE FUNCTION public.initiate_submission(
  p_assignment_id   UUID,
  p_creative_intent TEXT
)
RETURNS TABLE(submission_id UUID, raw_path TEXT, is_revision BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_assignment        RECORD;
  v_membership_id     UUID;
  v_existing          RECORD;
  v_submission_id     UUID;
  v_raw_path          TEXT;
  v_is_revision       BOOLEAN := FALSE;
  v_active_count      INT;
BEGIN
  -- 1. Validate assignment exists and is in accepting_submissions state
  SELECT a.*, c.id AS class_id_val, c.organization_id AS org_id_val
  INTO v_assignment
  FROM public.assignments a
  JOIN public.classes c ON c.id = a.class_id
  WHERE a.id = p_assignment_id
    AND a.status = 'accepting_submissions';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'assignment_not_accepting' USING ERRCODE = 'P0001';
  END IF;

  -- 2. Enforce deadline (server clock)
  IF v_assignment.submission_deadline IS NOT NULL
     AND NOW() > v_assignment.submission_deadline THEN
    RAISE EXCEPTION 'deadline_passed' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Verify active membership for calling user
  SELECT id INTO v_membership_id
  FROM public.class_memberships
  WHERE class_id = v_assignment.class_id_val
    AND student_id = auth.uid()
    AND status = 'active';

  IF v_membership_id IS NULL THEN
    RAISE EXCEPTION 'no_active_membership' USING ERRCODE = 'P0003';
  END IF;

  -- 4. Lock: check existing submissions (FOR UPDATE prevents race conditions)
  SELECT * INTO v_existing
  FROM public.submissions
  WHERE assignment_id = p_assignment_id
    AND class_membership_id = v_membership_id
    AND status IN ('pending', 'approved')
  FOR UPDATE SKIP LOCKED;

  IF FOUND THEN
    -- Already has an active (non-returned) submission — idempotently return it
    RETURN QUERY SELECT v_existing.id, v_existing.storage_path_raw, FALSE;
    RETURN;
  END IF;

  -- Check for returned submission (eligible for revision)
  SELECT * INTO v_existing
  FROM public.submissions
  WHERE assignment_id = p_assignment_id
    AND class_membership_id = v_membership_id
    AND status = 'returned'
  FOR UPDATE SKIP LOCKED;

  IF FOUND THEN
    -- Resubmission path: update the existing row (same identity, new upload)
    v_raw_path := 'raw/' || p_assignment_id::TEXT || '/' || v_membership_id::TEXT || '/' || gen_random_uuid()::TEXT;
    UPDATE public.submissions
    SET status             = 'pending',
        processing_status  = 'pending',
        storage_path_raw   = v_raw_path,
        storage_path_processed = NULL,
        creative_intent    = p_creative_intent,
        processing_error   = NULL,
        submitted_at       = NOW(),
        reviewed_at        = NULL,
        reviewed_by        = NULL,
        revision_number    = v_existing.revision_number + 1,
        previous_submission_id = v_existing.id,
        updated_at         = NOW()
    WHERE id = v_existing.id;

    RETURN QUERY SELECT v_existing.id, v_raw_path, TRUE;
    RETURN;
  END IF;

  -- 5. Enforce submission limit (for new first submission)
  SELECT COUNT(*) INTO v_active_count
  FROM public.submissions
  WHERE assignment_id = p_assignment_id
    AND class_membership_id = v_membership_id;

  -- Allow if count is 0; if limit exceeded (rejected submissions don't count toward resubmit)
  IF v_active_count >= v_assignment.max_submissions_per_student THEN
    RAISE EXCEPTION 'submission_limit_reached' USING ERRCODE = 'P0004';
  END IF;

  -- 6. Create new submission record
  v_raw_path := 'raw/' || p_assignment_id::TEXT || '/' || v_membership_id::TEXT || '/' || gen_random_uuid()::TEXT;

  INSERT INTO public.submissions (
    organization_id,
    assignment_id,
    class_membership_id,
    creative_intent,
    storage_path_raw,
    processing_status,
    status
  ) VALUES (
    v_assignment.org_id_val,
    p_assignment_id,
    v_membership_id,
    p_creative_intent,
    v_raw_path,
    'pending',
    'pending'
  )
  RETURNING id INTO v_submission_id;

  RETURN QUERY SELECT v_submission_id, v_raw_path, FALSE;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.initiate_submission(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.initiate_submission(UUID, TEXT) FROM anon;
GRANT  EXECUTE ON FUNCTION public.initiate_submission(UUID, TEXT) TO authenticated;

-- ─── Grants ───────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE ON public.assignments TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.submissions TO authenticated, service_role;
