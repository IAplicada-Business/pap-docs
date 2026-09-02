import { supabase } from "@/integrations/supabase/client";

export async function calcularHash(arquivo: File) {
  const buffer = await arquivo.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function caminhoArquivo(
  orgId: string,
  clienteId: string,
  mesAno: string,
  nomeArquivo: string,
) {
  const seguro = nomeArquivo.replace(/[^\w.\-]+/g, "_");
  return `${orgId}/${clienteId}/${mesAno}/${crypto.randomUUID()}-${seguro}`;
}

export async function garantirCompetencia(orgId: string, clienteId: string, mesAno: string) {
  const primeiroDia = `${mesAno}-01`;
  const { data: existente } = await supabase
    .from("competencias")
    .select("id")
    .eq("cliente_id", clienteId)
    .eq("mes_ano", primeiroDia)
    .maybeSingle();
  if (existente) return existente.id;
  const { data, error } = await supabase
    .from("competencias")
    .insert({ org_id: orgId, cliente_id: clienteId, mes_ano: primeiroDia, status: "aberta" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function enviarDocumentoEquipe(params: {
  orgId: string;
  clienteId: string;
  tipo: string;
  mesAno: string;
  arquivo: File;
}) {
  const { orgId, clienteId, tipo, mesAno, arquivo } = params;
  const hash = await calcularHash(arquivo);

  const { data: duplicado } = await supabase
    .from("documentos")
    .select("id, nome_original")
    .eq("cliente_id", clienteId)
    .eq("hash_sha256", hash)
    .is("deleted_at", null)
    .maybeSingle();
  if (duplicado) {
    throw new Error(
      `Este arquivo já foi recebido anteriormente${duplicado.nome_original ? ` (${duplicado.nome_original})` : ""}.`,
    );
  }

  const path = caminhoArquivo(orgId, clienteId, mesAno, arquivo.name);
  const { error: erroUpload } = await supabase.storage
    .from("documentos")
    .upload(path, arquivo, { contentType: arquivo.type || "application/octet-stream" });
  if (erroUpload) throw erroUpload;

  const competenciaId = await garantirCompetencia(orgId, clienteId, mesAno);

  const { error } = await supabase.from("documentos").insert({
    org_id: orgId,
    cliente_id: clienteId,
    competencia_id: competenciaId,
    tipo,
    origem: "manual",
    arquivo_path: path,
    nome_original: arquivo.name,
    tamanho_bytes: arquivo.size,
    hash_sha256: hash,
    status_processamento: "recebido",
  });
  if (error) throw error;
}

export async function baixarDocumento(path: string | null, nome: string | null) {
  if (!path) throw new Error("Arquivo indisponível.");
  const { data, error } = await supabase.storage.from("documentos").createSignedUrl(path, 60, {
    download: nome ?? true,
  });
  if (error || !data) throw error ?? new Error("Não foi possível gerar o link.");
  window.open(data.signedUrl, "_blank");
}
