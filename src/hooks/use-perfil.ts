import { useQuery } from "@tanstack/react-query";
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
  escritorio_id: string;
  nome: string | null;
  email: string | null;
  papel: "super_admin" | "admin_escritorio" | "operador";
  permissoes: Permissoes;
  ativo: boolean;
};

export type Escritorio = {
  id: string;
  nome: string;
  logo_url: string | null;
  cor_primaria: string;
  cor_acento: string;
  plano: string;
  status: string;
  cnpj: string | null;
};

const DEFAULT_PERMISSOES: Permissoes = {
  clientes: true,
  documentos: true,
  competencias: true,
  relatorios: true,
  configuracoes: false,
};

export function usePerfil() {
  return useQuery({
    queryKey: ["perfil"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Perfil | null> => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, escritorio_id, nome, email, papel, permissoes, ativo")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        email: data.email ?? auth.user.email ?? null,
        papel: data.papel as Perfil["papel"],
        permissoes: { ...DEFAULT_PERMISSOES, ...(data.permissoes as Partial<Permissoes>) },
      };
    },
  });
}

export function useEscritorio() {
  const { data: perfil } = usePerfil();
  return useQuery({
    queryKey: ["escritorio", perfil?.escritorio_id],
    enabled: !!perfil?.escritorio_id,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<Escritorio | null> => {
      if (!perfil?.escritorio_id) return null;
      const { data, error } = await supabase
        .from("escritorios")
        .select("id, nome, logo_url, cor_primaria, cor_acento, plano, status, cnpj")
        .eq("id", perfil.escritorio_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function temPermissao(perfil: Perfil | null | undefined, modulo: keyof Permissoes): boolean {
  if (!perfil || !perfil.ativo) return false;
  if (perfil.papel === "super_admin") return true;
  if (perfil.papel === "admin_escritorio") return true;
  return perfil.permissoes[modulo] === true;
}
