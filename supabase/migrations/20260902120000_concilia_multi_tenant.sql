-- =============================================================================
-- ConcilIA: Migração para plataforma multi-tenant
-- Renomeia organizations → escritorios, org_id → escritorio_id
-- Adiciona tabelas convites e eventos_uso
-- Atualiza RLS, triggers e funções
-- =============================================================================

-- 1. Renomear tabela organizations → escritorios
ALTER TABLE public.organizations RENAME TO escritorios;

-- 2. Adicionar novos campos em escritorios
ALTER TABLE public.escritorios
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS cor_acento text NOT NULL DEFAULT '#1E8C80',
  ADD COLUMN IF NOT EXISTS plano text NOT NULL DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS trial_expira_em timestamptz,
  ADD COLUMN IF NOT EXISTS criado_por uuid;

-- Atualizar seed da P&A
UPDATE public.escritorios
  SET plano = 'pro', status = 'ativo'
  WHERE id = '11111111-1111-1111-1111-111111111111';

-- 3. Renomear coluna org_id → escritorio_id em todas as tabelas
ALTER TABLE public.profiles RENAME COLUMN org_id TO escritorio_id;
ALTER TABLE public.clientes RENAME COLUMN org_id TO escritorio_id;
ALTER TABLE public.competencias RENAME COLUMN org_id TO escritorio_id;
ALTER TABLE public.documentos RENAME COLUMN org_id TO escritorio_id;
ALTER TABLE public.plano_contas RENAME COLUMN org_id TO escritorio_id;
ALTER TABLE public.lancamentos RENAME COLUMN org_id TO escritorio_id;
ALTER TABLE public.regras_aprendizado RENAME COLUMN org_id TO escritorio_id;
ALTER TABLE public.relatorios RENAME COLUMN org_id TO escritorio_id;
ALTER TABLE public.auditoria RENAME COLUMN org_id TO escritorio_id;

-- 4. Adicionar novos campos em profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS permissoes jsonb NOT NULL DEFAULT '{"clientes":true,"documentos":true,"competencias":true,"relatorios":true,"configuracoes":false}'::jsonb,
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ultimo_acesso_em timestamptz;

-- Atualizar papéis existentes: admin → admin_escritorio
UPDATE public.profiles SET papel = 'admin_escritorio' WHERE papel = 'admin';

-- Admin tem todas as permissões
UPDATE public.profiles
  SET permissoes = '{"clientes":true,"documentos":true,"competencias":true,"relatorios":true,"configuracoes":true}'::jsonb
  WHERE papel = 'admin_escritorio';

-- 5. Criar tabela convites
CREATE TABLE IF NOT EXISTS public.convites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escritorio_id uuid NOT NULL REFERENCES public.escritorios(id),
  email text NOT NULL,
  papel text NOT NULL DEFAULT 'operador',
  permissoes jsonb NOT NULL DEFAULT '{"clientes":true,"documentos":true,"competencias":true,"relatorios":true,"configuracoes":false}'::jsonb,
  token text NOT NULL DEFAULT gen_random_uuid()::text,
  expira_em timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  aceito_em timestamptz,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS convites_token_key ON public.convites(token);

-- 6. Criar tabela eventos_uso
CREATE TABLE IF NOT EXISTS public.eventos_uso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escritorio_id uuid NOT NULL REFERENCES public.escritorios(id),
  tipo_evento text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  ocorrido_em timestamptz NOT NULL DEFAULT now()
);

-- 7. Função current_escritorio_id (substitui current_org_id)
CREATE OR REPLACE FUNCTION public.current_escritorio_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT escritorio_id FROM public.profiles WHERE id = auth.uid()
$$;

-- Manter compatibilidade: current_org_id chama current_escritorio_id
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.current_escritorio_id()
$$;

-- 8. Função para verificar se é super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND papel = 'super_admin' AND ativo = true
  )
$$;

-- 9. Função para verificar permissão específica
CREATE OR REPLACE FUNCTION public.has_permission(p_module text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND ativo = true
      AND (
        papel = 'super_admin'
        OR papel = 'admin_escritorio'
        OR (permissoes ->> p_module)::boolean = true
      )
  )
$$;

-- 10. Atualizar trigger handle_new_user para suportar convites
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_convite record;
  v_escritorio_id uuid;
  v_papel text;
  v_permissoes jsonb;
BEGIN
  -- Verificar se existe convite pendente para este email
  SELECT * INTO v_convite
  FROM public.convites
  WHERE email = NEW.email
    AND aceito_em IS NULL
    AND deleted_at IS NULL
    AND expira_em > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_convite IS NOT NULL THEN
    -- Usar dados do convite
    v_escritorio_id := v_convite.escritorio_id;
    v_papel := v_convite.papel;
    v_permissoes := v_convite.permissoes;

    -- Marcar convite como aceito
    UPDATE public.convites SET aceito_em = now() WHERE id = v_convite.id;
  ELSE
    -- Sem convite: criar novo escritório e tornar admin
    INSERT INTO public.escritorios (nome, plano, status)
    VALUES (
      COALESCE(NEW.raw_user_meta_data ->> 'nome_escritorio', 'Meu Escritório'),
      'starter',
      'trial'
    )
    RETURNING id INTO v_escritorio_id;

    v_papel := 'admin_escritorio';
    v_permissoes := '{"clientes":true,"documentos":true,"competencias":true,"relatorios":true,"configuracoes":true}'::jsonb;
  END IF;

  INSERT INTO public.profiles (id, escritorio_id, nome, email, papel, permissoes)
  VALUES (
    NEW.id,
    v_escritorio_id,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    v_papel,
    v_permissoes
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 11. RLS: escritorios
ALTER TABLE public.escritorios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Membro vê próprio escritório" ON public.escritorios;
DROP POLICY IF EXISTS "Super admin vê todos" ON public.escritorios;
CREATE POLICY "Membro vê próprio escritório" ON public.escritorios
  FOR SELECT USING (id = public.current_escritorio_id());
CREATE POLICY "Super admin vê todos escritórios" ON public.escritorios
  FOR ALL USING (public.is_super_admin());
CREATE POLICY "Admin edita próprio escritório" ON public.escritorios
  FOR UPDATE USING (
    id = public.current_escritorio_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND papel = 'admin_escritorio'
    )
  );

-- 12. RLS: convites
ALTER TABLE public.convites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin do escritório gerencia convites" ON public.convites
  FOR ALL USING (
    escritorio_id = public.current_escritorio_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND papel IN ('admin_escritorio', 'super_admin')
    )
  );
CREATE POLICY "Super admin vê todos convites" ON public.convites
  FOR SELECT USING (public.is_super_admin());

-- 13. RLS: eventos_uso
ALTER TABLE public.eventos_uso ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admin vê todos eventos" ON public.eventos_uso
  FOR SELECT USING (public.is_super_admin());
CREATE POLICY "Escritório insere próprios eventos" ON public.eventos_uso
  FOR INSERT WITH CHECK (escritorio_id = public.current_escritorio_id());

-- 14. Atualizar RLS das tabelas existentes para usar escritorio_id
-- profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_org_isolation" ON public.profiles;
CREATE POLICY "Membro vê perfis do escritório" ON public.profiles
  FOR SELECT USING (
    escritorio_id = public.current_escritorio_id()
    OR public.is_super_admin()
  );
CREATE POLICY "Usuário edita próprio perfil" ON public.profiles
  FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Admin edita perfis do escritório" ON public.profiles
  FOR UPDATE USING (
    escritorio_id = public.current_escritorio_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND papel = 'admin_escritorio'
    )
  );

-- clientes
DROP POLICY IF EXISTS "clientes_org_isolation" ON public.clientes;
CREATE POLICY "Isolamento por escritório" ON public.clientes
  FOR ALL USING (
    escritorio_id = public.current_escritorio_id()
    OR public.is_super_admin()
  );

-- competencias
DROP POLICY IF EXISTS "competencias_org_isolation" ON public.competencias;
CREATE POLICY "Isolamento por escritório" ON public.competencias
  FOR ALL USING (
    escritorio_id = public.current_escritorio_id()
    OR public.is_super_admin()
  );

-- documentos
DROP POLICY IF EXISTS "documentos_org_isolation" ON public.documentos;
CREATE POLICY "Isolamento por escritório" ON public.documentos
  FOR ALL USING (
    escritorio_id = public.current_escritorio_id()
    OR public.is_super_admin()
  );

-- plano_contas
DROP POLICY IF EXISTS "plano_contas_org_isolation" ON public.plano_contas;
CREATE POLICY "Isolamento por escritório" ON public.plano_contas
  FOR ALL USING (
    escritorio_id = public.current_escritorio_id()
    OR public.is_super_admin()
  );

-- lancamentos
DROP POLICY IF EXISTS "lancamentos_org_isolation" ON public.lancamentos;
CREATE POLICY "Isolamento por escritório" ON public.lancamentos
  FOR ALL USING (
    escritorio_id = public.current_escritorio_id()
    OR public.is_super_admin()
  );

-- regras_aprendizado
DROP POLICY IF EXISTS "regras_aprendizado_org_isolation" ON public.regras_aprendizado;
CREATE POLICY "Isolamento por escritório" ON public.regras_aprendizado
  FOR ALL USING (
    escritorio_id = public.current_escritorio_id()
    OR public.is_super_admin()
  );

-- relatorios
DROP POLICY IF EXISTS "relatorios_org_isolation" ON public.relatorios;
CREATE POLICY "Isolamento por escritório" ON public.relatorios
  FOR ALL USING (
    escritorio_id = public.current_escritorio_id()
    OR public.is_super_admin()
  );

-- auditoria
DROP POLICY IF EXISTS "auditoria_org_isolation" ON public.auditoria;
CREATE POLICY "Isolamento por escritório" ON public.auditoria
  FOR ALL USING (
    escritorio_id = public.current_escritorio_id()
    OR public.is_super_admin()
  );

-- 15. Atualizar storage policies para usar escritorio_id
-- (As políticas existentes usam current_org_id() que agora chama current_escritorio_id(),
-- então continuam funcionando. Mas vamos atualizar os nomes por clareza.)
