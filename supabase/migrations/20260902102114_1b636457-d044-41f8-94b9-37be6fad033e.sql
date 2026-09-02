CREATE POLICY "documentos_org_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documentos' AND (storage.foldername(name))[1] = (SELECT public.current_org_id())::text);

CREATE POLICY "documentos_org_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documentos' AND (storage.foldername(name))[1] = (SELECT public.current_org_id())::text);

CREATE POLICY "documentos_org_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documentos' AND (storage.foldername(name))[1] = (SELECT public.current_org_id())::text);

CREATE POLICY "documentos_org_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documentos' AND (storage.foldername(name))[1] = (SELECT public.current_org_id())::text);