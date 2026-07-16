-- Storage bucket setup for Milestone 2
-- Run via Supabase dashboard or supabase/seed.sql extension

-- submissions-raw: private, students upload to signed URLs only
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'submissions-raw',
  'submissions-raw',
  FALSE,
  20971520,  -- 20 MB limit (server re-validates actual bytes)
  ARRAY['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- submissions-processed: private, teachers/students access via signed URLs only
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'submissions-processed',
  'submissions-processed',
  FALSE,
  20971520,
  ARRAY['image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- ─── Storage RLS ─────────────────────────────────────────────────────────────

-- submissions-raw: Students may upload to their authorized path (issued by initiate_submission).
-- No SELECT from students — only the processing function (service_role) reads raw files.
CREATE POLICY "student_upload_raw_submission"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'submissions-raw'
    -- Path is always: raw/{assignment_id}/{membership_id}/{uuid}
    -- Verified server-side via initiate_submission; this policy just prevents other buckets.
  );

-- submissions-processed: No student SELECT — accessed only via authorized signed URLs.
-- Service role writes processed objects.
CREATE POLICY "no_public_read_processed"
  ON storage.objects FOR SELECT
  TO public
  USING (FALSE);

-- Allow authenticated users to SELECT their own processed objects via signed URL (PostgREST handles signing)
-- Actual authorization is enforced by the signed-URL generation logic in the API route.
CREATE POLICY "service_write_processed"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id IN ('submissions-processed', 'submissions-raw'));

CREATE POLICY "service_delete_raw"
  ON storage.objects FOR DELETE
  TO service_role
  USING (bucket_id = 'submissions-raw');
