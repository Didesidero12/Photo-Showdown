-- =============================================================================
-- Milestone 2.6: Quick Showdown Critique Experience
-- =============================================================================

-- 1. Create `matchups` table
CREATE TABLE public.matchups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  critic_membership_id UUID NOT NULL REFERENCES public.class_memberships(id) ON DELETE CASCADE,
  submission_a_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  submission_b_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(critic_membership_id, submission_a_id, submission_b_id)
);

-- Ensure submission A != submission B
ALTER TABLE public.matchups ADD CONSTRAINT check_different_submissions CHECK (submission_a_id != submission_b_id);

-- 2. Create `critiques` table
CREATE TABLE public.critiques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matchup_id UUID NOT NULL UNIQUE REFERENCES public.matchups(id) ON DELETE CASCADE,
  selected_submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  lens_type TEXT NOT NULL, 
  justification TEXT NOT NULL,
  structured_response JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure selected_submission_id is either A or B from the matchup
-- This requires a trigger or an application-level constraint. 
-- We will enforce it via the application layer (Server Action) and a basic check.
-- A trigger is safer but let's stick to Server Action enforcement + RLS for now.

GRANT ALL ON public.matchups TO authenticated, service_role, anon;
GRANT ALL ON public.critiques TO authenticated, service_role, anon;

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
ALTER TABLE public.matchups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.critiques ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Matchups RLS
-- -----------------------------------------------------------------------------
-- Service role has full access by default.
-- Teachers can view matchups for their classes
CREATE POLICY "Teachers can view matchups for their classes"
  ON public.matchups FOR SELECT TO authenticated
  USING (
    assignment_id IN (
      SELECT id FROM public.assignments 
      WHERE class_id IN (SELECT authz.get_teacher_class_ids())
    )
  );

-- Students can view ONLY their own assigned matchups
CREATE POLICY "Students can view their assigned matchups"
  ON public.matchups FOR SELECT TO authenticated
  USING (
    critic_membership_id IN (SELECT authz.get_student_class_ids())
  );

-- Only Server Actions (service role) can INSERT or UPDATE matchups.
-- No INSERT/UPDATE policy for authenticated.

-- -----------------------------------------------------------------------------
-- Critiques RLS
-- -----------------------------------------------------------------------------
-- Teachers can view all critiques for their classes
CREATE POLICY "Teachers can view critiques for their classes"
  ON public.critiques FOR SELECT TO authenticated
  USING (
    matchup_id IN (
      SELECT id FROM public.matchups WHERE assignment_id IN (
        SELECT id FROM public.assignments 
        WHERE class_id IN (SELECT authz.get_teacher_class_ids())
      )
    )
  );

-- Students can view their OWN authored critiques (for the Reveal phase immediately after completing)
CREATE POLICY "Students can view their authored critiques"
  ON public.critiques FOR SELECT TO authenticated
  USING (
    matchup_id IN (
      SELECT id FROM public.matchups WHERE critic_membership_id IN (SELECT authz.get_student_class_ids())
    )
  );

-- Students can view critiques of their OWN submissions ONLY IF the assignment is in results_reveal
-- AND they have completed the Give-to-Get (which we will enforce at the application layer to keep RLS performant,
-- or via a specialized DB view). For base RLS, we restrict to the `results_reveal` state.
CREATE POLICY "Students can view received critiques during results_reveal"
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
      JOIN public.assignments a ON a.id = m.assignment_id
      WHERE a.status = 'results_reveal' OR a.status = 'reflection' OR a.status = 'complete'
    )
  );

-- Students can INSERT a critique ONLY IF they own the matchup AND the assignment is active_critique.
-- (This prevents students from critiquing randomly).
CREATE POLICY "Students can insert critiques for their active matchups"
  ON public.critiques FOR INSERT TO authenticated
  WITH CHECK (
    matchup_id IN (
      SELECT m.id FROM public.matchups m
      JOIN public.assignments a ON a.id = m.assignment_id
      WHERE m.critic_membership_id IN (SELECT authz.get_student_class_ids())
        AND a.status = 'active_critique'
        AND m.completed_at IS NULL
    )
  );
