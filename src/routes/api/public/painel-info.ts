import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/painel-info")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token");
        if (!token) {
          return Response.json({ erro: "Token ausente." }, { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: cliente } = await supabaseAdmin
          .from("clientes")
          .select("id, nome_fantasia, nome, ativo, deleted_at, org_id, logo_url, cor_primaria")
          .eq("painel_token", token)
          .maybeSingle();

        if (!cliente || cliente.deleted_at || cliente.ativo === false) {
          return Response.json({ erro: "Link invalido ou expirado." }, { status: 404 });
        }

        const { data: escritorio } = await supabaseAdmin
          .from("organizations")
          .select("nome, logo_url, cor_primaria")
          .eq("id", cliente.org_id)
          .maybeSingle();

        const { data: competencias } = await supabaseAdmin
          .from("competencias")
          .select("id, mes_ano, status, taxa_conciliacao, fechada_em")
          .eq("cliente_id", cliente.id)
          .is("deleted_at", null)
          .order("mes_ano", { ascending: false });

        const competenciaIds = (competencias ?? []).map((c) => c.id);
        let relatorios: Array<{
          id: string;
          tipo: string;
          publicado_painel: boolean | null;
          enviado_em: string | null;
          created_at: string;
          competencia_id: string;
        }> = [];

        if (competenciaIds.length > 0) {
          const { data } = await supabaseAdmin
            .from("relatorios")
            .select("id, tipo, publicado_painel, enviado_em, created_at, competencia_id")
            .in("competencia_id", competenciaIds)
            .eq("publicado_painel", true)
            .is("deleted_at", null)
            .order("created_at", { ascending: false });
          relatorios = data ?? [];
        }

        return Response.json({
          nome_fantasia: cliente.nome_fantasia ?? cliente.nome ?? "",
          cliente_branding: {
            logo_url: cliente.logo_url,
            cor_primaria: cliente.cor_primaria,
          },
          escritorio: escritorio
            ? {
                nome: escritorio.nome,
                logo_url: escritorio.logo_url,
                cor_primaria: escritorio.cor_primaria,
              }
            : null,
          competencias: competencias ?? [],
          relatorios,
        });
      },
    },
  },
});
