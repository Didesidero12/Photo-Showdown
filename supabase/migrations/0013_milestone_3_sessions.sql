-- =============================================================================
-- Milestone 3: Quick Showdown Session Refactoring
-- =============================================================================

-- Drop previous tables to recreate them with the new Session paradigm
DROP TABLE IF EXISTS public.critiques CASCADE;
DROP TABLE IF EXISTS public.matchups CASCADE;

CREATE TYPE showdown_session_status AS ENUM (
  'preparing',
  'active',
  'reveal',
  'closed'
);

-- 1. Create `showdown_sessions` table
CREATE TABLE public.showdown_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status showdown_session_status NOT NULL DEFAULT 'preparing',
  lens_type TEXT NOT NULL DEFAULT 'lighting',
  reveal_intent BOOLEAN NOT NULL DEFAULT false,
  reveal_votes BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create `session_submissions` (The Frozen Pool)
CREATE TABLE public.session_submissions (
  session_id UUID NOT NULL REFERENCES public.showdown_sessions(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, submission_id)
);

-- 3. Recreate `matchups` linking to `session_id`
CREATE TABLE public.matchups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.showdown_sessions(id) ON DELETE CASCADE,
  critic_membership_id UUID NOT NULL REFERENCES public.class_memberships(id) ON DELETE CASCADE,
  submission_a_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  submission_b_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(critic_membership_id, session_id) -- One active matchup per student per session
);

-- Ensure submission A != submission B
ALTER TABLE public.matchups ADD CONSTRAINT check_different_submissions CHECK (submission_a_id != submission_b_id);
-- Ensure both submissions are part of the frozen pool
-- This is hard to do natively without complex triggers across tables, so we will enforce via Server Action & RLS.

-- 4. Recreate `critiques` 
CREATE TABLE public.critiques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matchup_id UUID NOT NULL UNIQUE REFERENCES public.matchups(id) ON DELETE CASCADE,
  selected_submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  lens_type TEXT NOT NULL, 
  justification TEXT NOT NULL,
  structured_response JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.showdown_sessions TO authenticated, service_role, anon;
GRANT ALL ON public.session_submissions TO authenticated, service_role, anon;
GRANT ALL ON public.matchups TO authenticated, service_role, anon;
GRANT ALL ON public.critiques TO authenticated, service_role, anon;

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
ALTER TABLE public.showdown_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.critiques ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- showdown_sessions RLS
-- -----------------------------------------------------------------------------
CREATE POLICY "Teachers can manage their own sessions"
  ON public.showdown_sessions FOR ALL TO authenticated
  USING (teacher_id = auth.uid());

CREATE POLICY "Students can view active/reveal sessions for their assignments"
  ON public.showdown_sessions FOR SELECT TO authenticated
  USING (
    assignment_id IN (
      SELECT assignment_id FROM public.submissions 
      JOIN public.class_memberships cm ON cm.id = class_membership_id
      WHERE cm.student_id = auth.uid()
    )
    AND status IN ('active', 'reveal', 'closed')
  );

-- -----------------------------------------------------------------------------
-- session_submissions RLS
-- -----------------------------------------------------------------------------
CREATE POLICY "Teachers can view session submissions"
  ON public.session_submissions FOR SELECT TO authenticated
  USING (
    session_id IN (SELECT id FROM public.showdown_sessions WHERE teacher_id = auth.uid())
  );
-- Students do not need access to the raw session_submissions table, they only interact with matchups.

-- -----------------------------------------------------------------------------
-- Matchups RLS
-- -----------------------------------------------------------------------------
CREATE POLICY "Teachers can view matchups for their sessions"
  ON public.matchups FOR SELECT TO authenticated
  USING (
    session_id IN (SELECT id FROM public.showdown_sessions WHERE teacher_id = auth.uid())
  );

CREATE POLICY "Students can view their assigned matchups"
  ON public.matchups FOR SELECT TO authenticated
  USING (
    critic_membership_id IN (SELECT id FROM public.class_memberships WHERE student_id = auth.uid())
  );

-- -----------------------------------------------------------------------------
-- Critiques RLS
-- -----------------------------------------------------------------------------
CREATE POLICY "Teachers can view critiques for their sessions"
  ON public.critiques FOR SELECT TO authenticated
  USING (
    matchup_id IN (
      SELECT id FROM public.matchups WHERE session_id IN (
        SELECT id FROM public.showdown_sessions WHERE teacher_id = auth.uid()
      )
    )
  );

CREATE POLICY "Students can view their authored critiques"
  ON public.critiques FOR SELECT TO authenticated
  USING (
    matchup_id IN (
      SELECT id FROM public.matchups WHERE critic_membership_id IN (SELECT id FROM public.class_memberships WHERE student_id = auth.uid())
    )
  );

CREATE POLICY "Students can view received critiques during reveal"
  ON public.critiques FOR SELECT TO authenticated
  USING (
    selected_submission_id IN (
      SELECT s.id FROM public.submissions s
      JOIN public.class_memberships cm ON cm.id = s.class_membership_id
      WHERE cm.student_id = auth.uid()
    )
    AND 
    matchup_id IN (
      SELECT m.id FROM public.matchups m
      JOIN public.showdown_sessions ss ON ss.id = m.session_id
      WHERE ss.status IN ('reveal', 'closed')
    )
  );

CREATE POLICY "Students can insert critiques for their active matchups"
  ON public.critiques FOR INSERT TO authenticated
  WITH CHECK (
    matchup_id IN (
      SELECT m.id FROM public.matchups m
      JOIN public.showdown_sessions ss ON ss.id = m.session_id
      WHERE m.critic_membership_id IN (SELECT id FROM public.class_memberships WHERE student_id = auth.uid())
        AND ss.status = 'active'
        AND m.completed_at IS NULL
    )
  );
