-- Private storage for customer documents received by Hermes.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hermes-private-media',
  'hermes-private-media',
  FALSE,
  16777216,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET public = FALSE,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Members can read Hermes private media" ON storage.objects;
CREATE POLICY "Members can read Hermes private media"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'hermes-private-media'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND ('account-' || p.account_id::text) = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "Members can delete Hermes private media" ON storage.objects;
CREATE POLICY "Members can delete Hermes private media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'hermes-private-media'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND ('account-' || p.account_id::text) = (storage.foldername(name))[1]
    )
  );
