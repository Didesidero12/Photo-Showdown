
DROP POLICY IF EXISTS "teacher_select_own_assignments" ON assignments;
CREATE POLICY "teacher_select_own_assignments" ON assignments
  FOR SELECT USING (class_id IN (SELECT authz.get_teacher_class_ids()));

DROP POLICY IF EXISTS "teacher_update_own_assignments" ON assignments;
CREATE POLICY "teacher_update_own_assignments" ON assignments
  FOR UPDATE USING (class_id IN (SELECT authz.get_teacher_class_ids()));
