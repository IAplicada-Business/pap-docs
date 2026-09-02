-- organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS cor_primaria text NOT NULL DEFAULT '#1B4B5A';

-- profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS papel text NOT NULL DEFAULT 'operador',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- clientes
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS razao_social text,
  ADD COLUMN IF NOT EXISTS nome_fantasia text,
  ADD COLUMN IF NOT EXISTS email_contato text,
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

UPDATE public.clientes SET razao_social = COALESCE(razao_social, nome), nome_fantasia = COALESCE(nome_fantasia, nome);
ALTER TABLE public.clientes ALTER COLUMN nome DROP NOT NULL;
ALTER TABLE public.clientes ALTER COLUMN upload_token SET DEFAULT gen_random_uuid()::text;
ALTER TABLE public.clientes ALTER COLUMN painel_token SET DEFAULT gen_random_uuid()::text;
UPDATE public.clientes SET upload_token = COALESCE(upload_token, gen_random_uuid()::text), painel_token = COALESCE(painel_token, gen_random_uuid()::text);
CREATE UNIQUE INDEX IF NOT EXISTS clientes_upload_token_key ON public.clientes(upload_token);
CREATE UNIQUE INDEX IF NOT EXISTS clientes_painel_token_key ON public.clientes(painel_token);

-- competencias
ALTER TABLE public.competencias
  ADD COLUMN IF NOT EXISTS fechada_em timestamptz,
  ADD COLUMN IF NOT EXISTS fechada_por uuid;
CREATE UNIQUE INDEX IF NOT EXISTS competencias_cliente_mes_key ON public.competencias(cliente_id, mes_ano);

-- documentos
ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS nome_original text,
  ADD COLUMN IF NOT EXISTS tamanho_bytes bigint,
  ADD COLUMN IF NOT EXISTS hash_sha256 text,
  ADD COLUMN IF NOT EXISTS erro_motivo text,
  ADD COLUMN IF NOT EXISTS enviado_em timestamptz NOT NULL DEFAULT now();
UPDATE public.documentos SET hash_sha256 = COALESCE(hash_sha256, hash);
CREATE UNIQUE INDEX IF NOT EXISTS documentos_cliente_hash_key ON public.documentos(cliente_id, hash_sha256) WHERE deleted_at IS NULL AND hash_sha256 IS NOT NULL;

-- plano_contas
ALTER TABLE public.plano_contas
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

-- seed org
INSERT INTO public.organizations (id, nome)
SELECT '11111111-1111-1111-1111-111111111111', 'P&A Consultoria'
WHERE NOT EXISTS (SELECT 1 FROM public.organizations);

-- new user -> profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org uuid;
  v_papel text;
BEGIN
  SELECT id INTO v_org FROM public.organizations ORDER BY created_at LIMIT 1;
  IF v_org IS NULL THEN
    INSERT INTO public.organizations (nome) VALUES ('P&A Consultoria') RETURNING id INTO v_org;
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE org_id = v_org) THEN
    v_papel := 'operador';
  ELSE
    v_papel := 'admin';
  END IF;
  INSERT INTO public.profiles (id, org_id, nome, email, papel)
  VALUES (NEW.id, v_org, COALESCE(NEW.raw_user_meta_data ->> 'nome', split_part(NEW.email, '@', 1)), NEW.email, v_papel)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- seed clientes
INSERT INTO public.clientes (org_id, nome, razao_social, nome_fantasia, cnpj, email_contato, telefone, origem_documentos, ativo)
SELECT '11111111-1111-1111-1111-111111111111', 'Igreja Batista Central', 'Igreja Batista Central de Brasília', 'Igreja Batista Central', '12345678000190', 'tesouraria@ibcbrasilia.org.br', '(61) 3333-1010', ARRAY['email','extrato']::text[], true
WHERE NOT EXISTS (SELECT 1 FROM public.clientes WHERE cnpj = '12345678000190');

INSERT INTO public.clientes (org_id, nome, razao_social, nome_fantasia, cnpj, email_contato, telefone, origem_documentos, ativo)
SELECT '11111111-1111-1111-1111-111111111111', 'Igreja Vida Nova', 'Associação Igreja Vida Nova', 'Igreja Vida Nova', '98765432000155', 'financeiro@vidanova.org.br', '(61) 3333-2020', ARRAY['conta_azul','aprisco']::text[], true
WHERE NOT EXISTS (SELECT 1 FROM public.clientes WHERE cnpj = '98765432000155');