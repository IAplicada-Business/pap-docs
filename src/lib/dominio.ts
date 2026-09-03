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
  razao: "Razão analítico",
  diario: "Livro Diário",
  livro_caixa: "Livro Caixa",
  conciliacao: "Conciliação bancária",
  pendencias: "Pendências de documentos",
  extrato_lancamentos: "Extrato de lançamentos",
};

export type FormatoRelatorio = "pdf" | "xlsx";

export type ModeloRelatorio = {
  tipo: keyof typeof TIPOS_RELATORIO & string;
  nome: string;
  grupo: "Contábeis" | "Gerenciais" | "Operacionais";
  descricao: string;
  formatos: FormatoRelatorio[];
  /** Emissão por competência (mês) ou por período livre. */
  periodo: "competencia" | "intervalo";
};

export const MODELOS_RELATORIO: ModeloRelatorio[] = [
  {
    tipo: "balancete",
    nome: "Balancete",
    grupo: "Contábeis",
    descricao: "Saldos de todas as contas no mês, com débitos, créditos e saldo final.",
    formatos: ["pdf", "xlsx"],
    periodo: "competencia",
  },
  {
    tipo: "dre",
    nome: "DRE",
    grupo: "Contábeis",
    descricao: "Demonstração do resultado: receitas, despesas e resultado do período.",
    formatos: ["pdf", "xlsx"],
    periodo: "competencia",
  },
  {
    tipo: "balanco",
    nome: "Balanço patrimonial",
    grupo: "Contábeis",
    descricao: "Ativo, passivo e patrimônio líquido na data de fechamento.",
    formatos: ["pdf"],
    periodo: "competencia",
  },
  {
    tipo: "dfc",
    nome: "Fluxo de caixa (DFC)",
    grupo: "Contábeis",
    descricao:
      "Entradas e saídas de caixa por atividade operacional, de investimento e financiamento.",
    formatos: ["pdf", "xlsx"],
    periodo: "competencia",
  },
  {
    tipo: "razao",
    nome: "Razão analítico",
    grupo: "Contábeis",
    descricao: "Movimentação detalhada conta a conta, lançamento por lançamento.",
    formatos: ["pdf", "xlsx"],
    periodo: "intervalo",
  },
  {
    tipo: "diario",
    nome: "Livro Diário",
    grupo: "Contábeis",
    descricao: "Todos os lançamentos em ordem cronológica, com contrapartidas.",
    formatos: ["pdf"],
    periodo: "intervalo",
  },
  {
    tipo: "livro_caixa",
    nome: "Livro Caixa",
    grupo: "Gerenciais",
    descricao: "Entradas e saídas em linguagem simples, ideal para o tesoureiro da igreja.",
    formatos: ["pdf", "xlsx"],
    periodo: "competencia",
  },
  {
    tipo: "extrato_lancamentos",
    nome: "Extrato de lançamentos",
    grupo: "Gerenciais",
    descricao: "Lista dos lançamentos classificados pela IA, com conta e confiança.",
    formatos: ["xlsx", "pdf"],
    periodo: "intervalo",
  },
  {
    tipo: "conciliacao",
    nome: "Conciliação bancária",
    grupo: "Operacionais",
    descricao: "O que bateu e o que ficou pendente entre extrato e contabilidade.",
    formatos: ["pdf", "xlsx"],
    periodo: "competencia",
  },
  {
    tipo: "pendencias",
    nome: "Pendências de documentos",
    grupo: "Operacionais",
    descricao: "Documentos faltantes ou com erro por cliente no mês.",
    formatos: ["pdf"],
    periodo: "competencia",
  },
];

export const ROTULO_FORMATO: Record<FormatoRelatorio, string> = { pdf: "PDF", xlsx: "Excel" };

export const EXTENSOES_ACEITAS = ".pdf,.ofx,.xlsx,.xls,.csv,.jpg,.jpeg,.png";
export const TAMANHO_MAXIMO_BYTES = 20 * 1024 * 1024;
