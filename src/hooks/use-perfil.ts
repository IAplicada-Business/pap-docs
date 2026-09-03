import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Permissoes = {
  clientes: boolean;
  documentos: boolean;
  competencias: boolean;
  relatorios: boolean;
  configuracoes: boolean;
};

export type Perfil = {
  id: string;
  org_id: string;
  nome: string | null;
  email: string | null;
  papel: "super_admin" | "admin" | "operador";
  permissoes: Permissoes;
};

export type Escritorio = {
  id: string;
  nome: string;
  nome_curto: string | null;
  logo_url: string | null;
  cor_primaria: string;
  cor_acento: string | null;
  status: string;
  modulos_habilitados: string[] | null;
};

const DEFAULT_PERMISSOES: Permissoes = {
  clientes: true,
  documentos: true,
  competencias: true,
  relatorios: true,
  configuracoes: false,
};

const MODULOS_PADRAO = ["clientes", "documentos", "competencias", "configuracoes"];

// Compartilhado entre o guard de rota (_authenticated) e o hook usePerfil,
// para que o org_id seja resolvido uma única vez por sessão.
export const perfilQueryOptions = queryOptions({
  queryKey: ["perfil"],
  staleTime: 5 * 60 * 1000,
  queryFn: async (): Promise<Perfil | null> => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, org_id, nome, email, papel")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const papel = data.papel as Perfil["papel"];
    return {
      ...data,
      email: data.email ?? auth.user.email ?? null,
      papel,
      permissoes:
        papel === "super_admin" || papel === "admin"
          ? { ...DEFAULT_PERMISSOES, configuracoes: true }
          : { ...DEFAULT_PERMISSOES },
    };
  },
});

export function usePerfil() {
  return useQuery(perfilQueryOptions);
}

// Empresa do usuário logado (única no sistema). O id vem do contexto da rota
// autenticada, resolvido a partir de profiles.org_id.
export function useEmpresa(empresaId: string | undefined) {
  return useQuery({
    queryKey: ["empresa", empresaId],
    enabled: !!empresaId,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<Escritorio | null> => {
      if (!empresaId) return null;
      const { data, error } = await supabase
        .from("organizations")
        .select(
          "id, nome, nome_curto, logo_url, cor_primaria, cor_acento, status, modulos_habilitados",
        )
        .eq("id", empresaId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function temPermissao(perfil: Perfil | null | undefined, modulo: keyof Permissoes): boolean {
  if (!perfil) return false;
  if (perfil.papel === "super_admin") return true;
  if (perfil.papel === "admin") return true;
  return perfil.permissoes[modulo] === true;
}

export function moduloHabilitado(empresa: Escritorio | null | undefined, modulo: string): boolean {
  if (!empresa) return true;
  const habilitados = empresa.modulos_habilitados ?? MODULOS_PADRAO;
  return habilitados.includes(modulo);
}
