import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/convite-info")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token");
        if (!token) {
          return Response.json({ erro: "Token ausente." }, { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        try {
          const { data, error } = await supabaseAdmin
            .from("convites")
            .select("email, org_id")
            .eq("token", token)
            .is("aceito_em", null)
            .is("deleted_at", null)
            .gt("expira_em", new Date().toISOString())
            .maybeSingle();

          if (error || !data) {
            return Response.json(
              { erro: "Convite invalido ou expirado." },
              { status: 404 },
            );
          }

          const { data: org } = await supabaseAdmin
            .from("organizations")
            .select("nome, logo_url, cor_primaria")
            .eq("id", data.org_id)
            .maybeSingle();

          return Response.json({
            email: data.email,
            escritorio_nome: org?.nome ?? "",
            escritorio_logo_url: org?.logo_url ?? null,
            escritorio_cor_primaria: org?.cor_primaria ?? null,
          });
        } catch {
          return Response.json(
            { erro: "Convite invalido ou expirado." },
            { status: 404 },
          );
        }
      },
    },
  },
});
