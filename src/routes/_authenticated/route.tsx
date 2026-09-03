import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { perfilQueryOptions } from "@/hooks/use-perfil";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Sistema de empresa única: a organização vem do perfil do usuário,
    // não da URL. Sem perfil vinculado não há o que mostrar.
    const perfil = await context.queryClient.ensureQueryData(perfilQueryOptions);
    if (!perfil?.org_id) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }
    return { user: data.user, orgId: perfil.org_id };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
