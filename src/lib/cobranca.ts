import { apenasDigitos } from "./formatadores";

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export function mensagemCobranca(
  nomeCliente: string,
  mesAno: string,
  nomeEscritorio: string,
  linkUpload?: string | null,
) {
  const [ano, mes] = mesAno.split("-");
  const rotulo = `${MESES[Number(mes) - 1] ?? mes}/${ano}`;
  const linhas = [
    `Olá, ${nomeCliente}! 🤓`,
    "",
    `Ainda não recebemos os documentos de ${rotulo}. Para fecharmos a contabilidade do mês, precisamos de:`,
    "",
    "• Extrato bancário completo do mês",
    "• Relatório do sistema de gestão (Conta Azul ou Aprisco)",
    "• Comprovantes e notas do período",
    "",
  ];
  if (linkUpload) {
    linhas.push("✱ É só arrastar os arquivos neste link, sem senha:", linkUpload, "");
  }
  linhas.push(`Qualquer dúvida, é só responder aqui. Obrigado!`, `Equipe ${nomeEscritorio}`);
  return linhas.join("\n");
}

export function linkWhatsApp(telefone: string | null | undefined, mensagem: string) {
  const d = telefone ? apenasDigitos(telefone) : "";
  const numero = d ? (d.startsWith("55") ? d : `55${d}`) : "";
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}
