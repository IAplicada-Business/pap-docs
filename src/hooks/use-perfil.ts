import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Perfil = {
  id: string;
  org_id: string;
  nome: string | null;
  email: string | null;
  papel: string;
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
      return { ...data, email: data.email ?? auth.user.email ?? null };
    },
  });
}
