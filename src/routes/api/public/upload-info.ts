import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/upload-info")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token");
        if (!token) {
          return Response.json({ erro: "Token ausente." }, { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("clientes")
          .select("nome_fantasia, nome, ativo, deleted_at, escritorio_id")
          .eq("upload_token", token)
          .maybeSingle();

        if (!data || data.deleted_at || data.ativo === false) {
          return Response.json({ erro: "Link inválido ou expirado." }, { status: 404 });
        }

        const { data: escritorio } = await supabaseAdmin
          .from("escritorios")
          .select("nome, logo_url, cor_primaria, cor_acento")
          .eq("id", data.escritorio_id)
          .maybeSingle();

        return Response.json({
          nome_fantasia: data.nome_fantasia ?? data.nome ?? "",
          escritorio: escritorio
            ? {
                nome: escritorio.nome,
                logo_url: escritorio.logo_url,
                cor_primaria: escritorio.cor_primaria,
                cor_acento: escritorio.cor_acento,
              }
            : null,
        });
      },
    },
  },
});
