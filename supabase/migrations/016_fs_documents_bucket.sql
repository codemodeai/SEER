-- Create fs-documents storage bucket (private, 10MB max per file)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('fs-documents', 'fs-documents', false, 10485760)
ON CONFLICT (id) DO NOTHING;

-- RLS: users can only access their own folder
CREATE POLICY "fs_documents_user_folder" ON storage.objects
  FOR ALL USING (bucket_id = 'fs-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
