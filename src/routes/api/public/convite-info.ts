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
        const { data, error } = await supabaseAdmin
          .from("convites")
          .select("email, escritorios(nome, logo_url, cor_primaria, cor_acento)")
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

        const escritorio = data.escritorios as {
          nome: string;
          logo_url: string | null;
          cor_primaria: string | null;
          cor_acento: string | null;
        } | null;

        return Response.json({
          email: data.email,
          escritorio_nome: escritorio?.nome ?? "",
          escritorio_logo_url: escritorio?.logo_url ?? null,
          escritorio_cor_primaria: escritorio?.cor_primaria ?? null,
          escritorio_cor_acento: escritorio?.cor_acento ?? null,
        });
      },
    },
  },
});
