-- Add modulos_habilitados column for per-empresa module toggling
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS modulos_habilitados text[] DEFAULT ARRAY['clientes','documentos','competencias','configuracoes'];

-- Create logos storage bucket (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  true,
  2097152, -- 2MB
  ARRAY['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload logos
CREATE POLICY "Usuarios autenticados podem fazer upload de logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'logos');

-- Allow authenticated users to update their logos
CREATE POLICY "Usuarios autenticados podem atualizar logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'logos');

-- Allow authenticated users to delete their logos
CREATE POLICY "Usuarios autenticados podem deletar logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'logos');

-- Allow public read access to logos
CREATE POLICY "Logos sao publicos para leitura"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'logos');
