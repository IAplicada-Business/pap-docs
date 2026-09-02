import { createFileRoute } from "@tanstack/react-router";

const TIPOS = ["extrato", "conta_azul", "aprisco", "folha", "nota_fiscal", "outro"];
const TAMANHO_MAXIMO = 20 * 1024 * 1024;

export const Route = createFileRoute("/api/public/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const form = await request.formData();
          const token = String(form.get("token") ?? "");
          const tipo = String(form.get("tipo") ?? "outro");
          const mes = String(form.get("mes") ?? "");
          const arquivo = form.get("arquivo");

          if (!token || !(arquivo instanceof File)) {
            return Response.json({ erro: "Requisição inválida." }, { status: 400 });
          }
          if (!TIPOS.includes(tipo)) {
            return Response.json({ erro: "Tipo de documento inválido." }, { status: 400 });
          }
          if (!/^\d{4}-\d{2}$/.test(mes)) {
            return Response.json({ erro: "Mês de referência inválido." }, { status: 400 });
          }
          if (arquivo.size > TAMANHO_MAXIMO) {
            return Response.json(
              { erro: "Arquivo maior que 20 MB. Envie um arquivo menor." },
              { status: 400 },
            );
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: cliente } = await supabaseAdmin
            .from("clientes")
            .select("id, org_id, ativo, deleted_at")
            .eq("upload_token", token)
            .maybeSingle();

          if (!cliente || cliente.deleted_at || cliente.ativo === false) {
            return Response.json({ erro: "Link inválido ou expirado." }, { status: 404 });
          }

          const buffer = new Uint8Array(await arquivo.arrayBuffer());
          const digest = await crypto.subtle.digest("SHA-256", buffer);
          const hash = Array.from(new Uint8Array(digest))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");

          const { data: duplicado } = await supabaseAdmin
            .from("documentos")
            .select("id")
            .eq("cliente_id", cliente.id)
            .eq("hash_sha256", hash)
            .is("deleted_at", null)
            .maybeSingle();

          if (duplicado) {
            return Response.json(
              { erro: "Este arquivo já havia sido enviado antes. Não precisa enviar de novo." },
              { status: 409 },
            );
          }

          const nomeSeguro = arquivo.name.replace(/[^\w.\-]+/g, "_");
          const path = `${cliente.org_id}/${cliente.id}/${mes}/${crypto.randomUUID()}-${nomeSeguro}`;

          const { error: erroUpload } = await supabaseAdmin.storage
            .from("documentos")
            .upload(path, buffer, {
              contentType: arquivo.type || "application/octet-stream",
            });
          if (erroUpload) {
            return Response.json({ erro: "Falha ao guardar o arquivo." }, { status: 500 });
          }

          const primeiroDia = `${mes}-01`;
          let competenciaId: string | null = null;
          const { data: comp } = await supabaseAdmin
            .from("competencias")
            .select("id")
            .eq("cliente_id", cliente.id)
            .eq("mes_ano", primeiroDia)
            .maybeSingle();
          if (comp) {
            competenciaId = comp.id;
          } else {
            const { data: nova } = await supabaseAdmin
              .from("competencias")
              .insert({
                org_id: cliente.org_id,
                cliente_id: cliente.id,
                mes_ano: primeiroDia,
                status: "aberta",
              })
              .select("id")
              .single();
            competenciaId = nova?.id ?? null;
          }

          const { error } = await supabaseAdmin.from("documentos").insert({
            org_id: cliente.org_id,
            cliente_id: cliente.id,
            competencia_id: competenciaId,
            tipo,
            origem: "upload_link",
            arquivo_path: path,
            nome_original: arquivo.name,
            tamanho_bytes: arquivo.size,
            hash_sha256: hash,
            status_processamento: "recebido",
          });
          if (error) {
            return Response.json({ erro: "Falha ao registrar o documento." }, { status: 500 });
          }

          return Response.json({ ok: true });
        } catch (e) {
          console.error(e);
          return Response.json({ erro: "Erro inesperado. Tente novamente." }, { status: 500 });
        }
      },
    },
  },
});
