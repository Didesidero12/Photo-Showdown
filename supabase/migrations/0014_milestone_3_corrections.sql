-- =============================================================================
-- Milestone 3 Corrections
-- =============================================================================

-- 1. Add missing reveal settings to showdown_sessions
ALTER TABLE public.showdown_sessions
ADD COLUMN reveal_photographer_identity BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN reveal_peer_critiques BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN reveal_critic_identity BOOLEAN NOT NULL DEFAULT false;

-- 2. Create session_participations
CREATE TABLE public.session_participations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.showdown_sessions(id) ON DELETE CASCADE,
  class_membership_id UUID NOT NULL REFERENCES public.class_memberships(id) ON DELETE CASCADE,
  critiques_required INTEGER NOT NULL DEFAULT 1,
  override_active BOOLEAN NOT NULL DEFAULT false,
  override_reason TEXT,
  override_actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  override_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, class_membership_id)
);

GRANT ALL ON public.session_participations TO authenticated, service_role, anon;
ALTER TABLE public.session_participations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage session participations"
  ON public.session_participations FOR ALL TO authenticated
  USING (
    session_id IN (SELECT id FROM public.showdown_sessions WHERE teacher_id = auth.uid())
  );

CREATE POLICY "Students can view their own session participations"
  ON public.session_participations FOR SELECT TO authenticated
  USING (
    class_membership_id IN (SELECT id FROM public.class_memberships WHERE student_id = auth.uid())
  );

-- 3. Update matchups for sequence_number
ALTER TABLE public.matchups DROP CONSTRAINT IF EXISTS matchups_critic_membership_id_session_id_key;

ALTER TABLE public.matchups 
ADD COLUMN sequence_number INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.matchups 
ADD CONSTRAINT matchups_session_critic_sequence_key UNIQUE(session_id, critic_membership_id, sequence_number);

-- 4. Authoritative Trigger: Matchup Validation
CREATE OR REPLACE FUNCTION public.fn_validate_matchup() RETURNS TRIGGER AS $$
DECLARE
  v_critic_student_id UUID;
  v_sub_a_student_id UUID;
  v_sub_b_student_id UUID;
  v_sub_a_frozen BOOLEAN;
  v_sub_b_frozen BOOLEAN;
BEGIN
  -- 1. Neither A nor B belongs to critic
  SELECT student_id INTO v_critic_student_id FROM public.class_memberships WHERE id = NEW.critic_membership_id;
  
  SELECT cm.student_id INTO v_sub_a_student_id FROM public.submissions s JOIN public.class_memberships cm ON cm.id = s.class_membership_id WHERE s.id = NEW.submission_a_id;
  SELECT cm.student_id INTO v_sub_b_student_id FROM public.submissions s JOIN public.class_memberships cm ON cm.id = s.class_membership_id WHERE s.id = NEW.submission_b_id;

  IF v_sub_a_student_id = v_critic_student_id OR v_sub_b_student_id = v_critic_student_id THEN
    RAISE EXCEPTION 'Self-critique is not allowed (critic cannot own submission A or B)';
  END IF;

  -- 2. Both submissions exist in the frozen pool
  SELECT EXISTS(SELECT 1 FROM public.session_submissions WHERE session_id = NEW.session_id AND submission_id = NEW.submission_a_id) INTO v_sub_a_frozen;
  SELECT EXISTS(SELECT 1 FROM public.session_submissions WHERE session_id = NEW.session_id AND submission_id = NEW.submission_b_id) INTO v_sub_b_frozen;

  IF NOT v_sub_a_frozen OR NOT v_sub_b_frozen THEN
    RAISE EXCEPTION 'Both submissions must be in the frozen session_submissions pool';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_validate_matchup
  BEFORE INSERT ON public.matchups
  FOR EACH ROW EXECUTE FUNCTION public.fn_validate_matchup();


-- 5. Authoritative Trigger: Critique Selection Validation
CREATE OR REPLACE FUNCTION public.fn_validate_critique_selection() RETURNS TRIGGER AS $$
DECLARE
  v_sub_a UUID;
  v_sub_b UUID;
BEGIN
  SELECT submission_a_id, submission_b_id INTO v_sub_a, v_sub_b FROM public.matchups WHERE id = NEW.matchup_id;
  
  IF NEW.selected_submission_id != v_sub_a AND NEW.selected_submission_id != v_sub_b THEN
    RAISE EXCEPTION 'Selected submission must be either submission A or submission B from the matchup';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_validate_critique_selection
  BEFORE INSERT OR UPDATE ON public.critiques
  FOR EACH ROW EXECUTE FUNCTION public.fn_validate_critique_selection();


-- 6. DB RPC for Matchup Assignment
CREATE OR REPLACE FUNCTION public.assign_matchup_rpc(p_session_id UUID, p_critic_membership_id UUID)
RETURNS UUID AS $$
DECLARE
  v_existing_matchup_id UUID;
  v_sub_a UUID;
  v_sub_b UUID;
  v_critic_student_id UUID;
  v_eligible_count INTEGER;
  v_new_matchup_id UUID;
BEGIN
  -- Obtain advisory lock for this session to ensure strict concurrency control over counting
  -- This blocks other processes trying to assign matchups for the SAME session concurrently.
  PERFORM pg_advisory_xact_lock(hashtext(p_session_id::text));

  -- Return existing sequence 1 matchup if it exists
  SELECT id INTO v_existing_matchup_id FROM public.matchups 
  WHERE session_id = p_session_id AND critic_membership_id = p_critic_membership_id AND sequence_number = 1;

  IF v_existing_matchup_id IS NOT NULL THEN
    RETURN v_existing_matchup_id;
  END IF;

  -- Get critic student_id
  SELECT student_id INTO v_critic_student_id FROM public.class_memberships WHERE id = p_critic_membership_id;

  -- Verify session is active
  IF NOT EXISTS (SELECT 1 FROM public.showdown_sessions WHERE id = p_session_id AND status = 'active') THEN
    RAISE EXCEPTION 'Session is not active';
  END IF;

  -- Ensure student is active in the class
  IF NOT EXISTS (
    SELECT 1 FROM public.showdown_sessions ss
    JOIN public.class_memberships cm ON cm.class_id = (SELECT class_id FROM public.assignments WHERE id = ss.assignment_id)
    WHERE ss.id = p_session_id AND cm.id = p_critic_membership_id AND cm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Critic must be an active member of the class';
  END IF;

  -- Count eligible submissions
  SELECT COUNT(*) INTO v_eligible_count
  FROM public.session_submissions ss
  JOIN public.submissions sub ON sub.id = ss.submission_id
  JOIN public.class_memberships cm ON cm.id = sub.class_membership_id
  WHERE ss.session_id = p_session_id AND cm.student_id != v_critic_student_id;

  IF v_eligible_count < 2 THEN
    RAISE EXCEPTION 'Not enough eligible submissions for this critic (minimum 2 required)';
  END IF;

  -- Select the two submissions with the fewest current matchups
  -- Using random() to break ties prevents hot-spotting
  WITH sub_counts AS (
    SELECT 
      ss.submission_id,
      (
        SELECT COUNT(*) FROM public.matchups m 
        WHERE m.session_id = p_session_id 
        AND (m.submission_a_id = ss.submission_id OR m.submission_b_id = ss.submission_id)
      ) as matchup_count
    FROM public.session_submissions ss
    JOIN public.submissions sub ON sub.id = ss.submission_id
    JOIN public.class_memberships cm ON cm.id = sub.class_membership_id
    WHERE ss.session_id = p_session_id AND cm.student_id != v_critic_student_id
  )
  SELECT submission_id INTO v_sub_a
  FROM sub_counts
  ORDER BY matchup_count ASC, random()
  LIMIT 1;

  WITH sub_counts AS (
    SELECT 
      ss.submission_id,
      (
        SELECT COUNT(*) FROM public.matchups m 
        WHERE m.session_id = p_session_id 
        AND (m.submission_a_id = ss.submission_id OR m.submission_b_id = ss.submission_id)
      ) as matchup_count
    FROM public.session_submissions ss
    JOIN public.submissions sub ON sub.id = ss.submission_id
    JOIN public.class_memberships cm ON cm.id = sub.class_membership_id
    WHERE ss.session_id = p_session_id AND cm.student_id != v_critic_student_id AND ss.submission_id != v_sub_a
  )
  SELECT submission_id INTO v_sub_b
  FROM sub_counts
  ORDER BY matchup_count ASC, random()
  LIMIT 1;

  -- Randomly swap A and B
  IF random() > 0.5 THEN
    INSERT INTO public.matchups (session_id, critic_membership_id, submission_a_id, submission_b_id, sequence_number)
    VALUES (p_session_id, p_critic_membership_id, v_sub_b, v_sub_a, 1)
    RETURNING id INTO v_new_matchup_id;
  ELSE
    INSERT INTO public.matchups (session_id, critic_membership_id, submission_a_id, submission_b_id, sequence_number)
    VALUES (p_session_id, p_critic_membership_id, v_sub_a, v_sub_b, 1)
    RETURNING id INTO v_new_matchup_id;
  END IF;

  RETURN v_new_matchup_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
