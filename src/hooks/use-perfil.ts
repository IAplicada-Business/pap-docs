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
  org_id: string;
  nome: string | null;
  email: string | null;
  papel: "super_admin" | "admin" | "operador";
  permissoes: Permissoes;
};

export type Escritorio = {
  id: string;
  nome: string;
  logo_url: string | null;
  cor_primaria: string;
  cor_acento: string | null;
  status: string;
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
}

export function useEscritorio() {
  const { data: perfil } = usePerfil();
  return useQuery({
    queryKey: ["escritorio", perfil?.org_id],
    enabled: !!perfil?.org_id,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<Escritorio | null> => {
      if (!perfil?.org_id) return null;
      const { data, error } = await supabase
        .from("organizations")
        .select("id, nome, logo_url, cor_primaria, cor_acento, status")
        .eq("id", perfil.org_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useEmpresa(empresaId: string | undefined) {
  return useQuery({
    queryKey: ["empresa", empresaId],
    enabled: !!empresaId,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<Escritorio | null> => {
      if (!empresaId) return null;
      const { data, error } = await supabase
        .from("organizations")
        .select("id, nome, logo_url, cor_primaria, cor_acento, status")
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
