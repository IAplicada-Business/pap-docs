export const TIPOS_DOCUMENTO = [
  { value: "extrato", label: "Extrato bancário" },
  { value: "conta_azul", label: "Relatório Conta Azul" },
  { value: "aprisco", label: "Relatório Aprisco" },
  { value: "folha", label: "Folha de pagamento" },
  { value: "nota_fiscal", label: "Nota fiscal" },
  { value: "outro", label: "Outro" },
] as const;

export const ORIGENS_DOCUMENTO = [
  { value: "conta_azul", label: "Conta Azul" },
  { value: "aprisco", label: "Aprisco" },
  { value: "email", label: "E-mail" },
  { value: "extrato", label: "Extrato bancário" },
  { value: "folha_externa", label: "Folha externa" },
] as const;

export const ORIGENS_RECEBIMENTO: Record<string, string> = {
  upload_link: "Link de upload",
  email: "E-mail",
  manual: "Manual",
};

export const STATUS_PROCESSAMENTO: Record<string, string> = {
  recebido: "Recebido",
  processando: "Processando",
  processado: "Processado",
  erro: "Erro",
};

export const STATUS_COMPETENCIA: Record<string, string> = {
  aberta: "Aberta",
  em_conciliacao: "Em conciliação",
  fechada: "Fechada",
};

export function rotuloTipo(tipo: string | null) {
  return TIPOS_DOCUMENTO.find((t) => t.value === tipo)?.label ?? "Outro";
}

export function rotuloOrigemDocumento(origem: string) {
  return ORIGENS_DOCUMENTO.find((o) => o.value === origem)?.label ?? origem;
}

export const STATUS_LANCAMENTO: Record<string, string> = {
  pendente: "Pendente",
  classificado: "Classificado",
  conciliado: "Conciliado",
  revisado: "Revisado",
};

export const TIPOS_RELATORIO: Record<string, string> = {
  balancete: "Balancete",
  dre: "DRE",
  balanco: "Balanço patrimonial",
  dfc: "Fluxo de caixa (DFC)",
};

export const EXTENSOES_ACEITAS = ".pdf,.ofx,.xlsx,.xls,.csv,.jpg,.jpeg,.png";
export const TAMANHO_MAXIMO_BYTES = 20 * 1024 * 1024;
