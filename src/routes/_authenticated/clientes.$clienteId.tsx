import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CalendarRange,
  ClipboardList,
  Copy,
  Download,
  ExternalLink,
  FileBarChart2,
  FileText,
  LayoutDashboard,
  LinkIcon,
  MessageCircle,
  RefreshCw,
  RotateCcw,
  Scale,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useEmpresa } from "@/hooks/use-perfil";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  AreaTrend,
  Avatar,
  CHART_COLORS,
  ConfidenceBar,
  DataTable,
  Donut,
  EmptyState,
  KpiCard,
  KpiGrid,
  Legend,
  PageHeader,
  ProgressBar,
  SectionCard,
  StatusPill,
  SubTabs,
  pillCompetencia,
  pillDocumento,
  pillLancamento,
  type Column,
} from "@/components/ui-kit";
import { ORIGENS_DOCUMENTO, TIPOS_RELATORIO, rotuloTipo } from "@/lib/dominio";
import {
  formatarCnpj,
  formatarCompetencia,
  formatarData,
  formatarDataHora,
  formatarMoeda,
  formatarTelefone,
  mesAtual,
} from "@/lib/formatadores";
import { baixarDocumento } from "@/lib/documentos";
import { linkWhatsApp, mensagemCobranca } from "@/lib/cobranca";

type AtualizacaoCliente = Database["public"]["Tables"]["clientes"]["Update"];

export const Route = createFileRoute("/_authenticated/clientes/$clienteId")({
  head: () => ({
    meta: [
      { title: "Cliente — P&A Contabilidade Digital" },
      {
        name: "description",
        content:
          "Ambiente completo do cliente: documentos, lançamentos, competências, relatórios e links.",
      },
    ],
  }),
  component: ClienteDetalhe,
});

type Aba =
  "visao" | "documentos" | "lancamentos" | "competencias" | "relatorios" | "dados" | "links";

type Doc = {
  id: string;
  nome_original: string | null;
  tipo: string | null;
  origem: string | null;
  status_processamento: string;
  enviado_em: string;
  arquivo_path: string | null;
  erro_motivo: string | null;
};
type Comp = {
  id: string;
  mes_ano: string;
  status: string;
  taxa_conciliacao: number | null;
  fechada_em: string | null;
};
type Lanc = {
  id: string;
  data: string;
  descricao: string | null;
  valor: number;
  status: string;
  confianca_ia: number | null;
  conta_debito: string | null;
  conta_credito: string | null;
  competencia_id: string;
};
type Rel = {
  id: string;
  tipo: string;
  arquivo_path: string | null;
  publicado_painel: boolean;
  enviado_em: string | null;
  created_at: string;
  competencias: { mes_ano: string } | null;
};

function ClienteDetalhe() {
  const { clienteId } = Route.useParams();
  const { orgId: empresaId } = Route.useRouteContext();
  const { data: empresa } = useEmpresa(empresaId);
  const queryClient = useQueryClient();
  const [aba, setAba] = useState<Aba>("visao");
  const [confirmar, setConfirmar] = useState<"upload_token" | "painel_token" | null>(null);

  const { data: cliente, isLoading } = useQuery({
    queryKey: ["cliente", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .eq("id", clienteId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: documentos } = useQuery({
    queryKey: ["cliente-documentos", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documentos")
        .select(
          "id, nome_original, tipo, origem, status_processamento, enviado_em, arquivo_path, erro_motivo",
        )
        .eq("cliente_id", clienteId)
        .is("deleted_at", null)
        .order("enviado_em", { ascending: false });
      if (error) throw error;
      return data as Doc[];
    },
  });

  const { data: competencias } = useQuery({
    queryKey: ["cliente-competencias", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competencias")
        .select("id, mes_ano, status, taxa_conciliacao, fechada_em")
        .eq("cliente_id", clienteId)
        .is("deleted_at", null)
        .order("mes_ano", { ascending: false });
      if (error) throw error;
      return data as Comp[];
    },
  });

  const { data: lancamentos } = useQuery({
    queryKey: ["cliente-lancamentos", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lancamentos")
        .select(
          "id, data, descricao, valor, status, confianca_ia, conta_debito, conta_credito, competencia_id",
        )
        .eq("cliente_id", clienteId)
        .is("deleted_at", null)
        .order("data", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as Lanc[];
    },
  });

  const compIds = useMemo(() => (competencias ?? []).map((c) => c.id), [competencias]);
  const { data: relatorios } = useQuery({
    queryKey: ["cliente-relatorios", clienteId, compIds],
    enabled: !!competencias,
    queryFn: async () => {
      if (compIds.length === 0) return [] as Rel[];
      const { data } = await supabase
        .from("relatorios")
        .select(
          "id, tipo, arquivo_path, publicado_painel, enviado_em, created_at, competencias(mes_ano)",
        )
        .in("competencia_id", compIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      return (data ?? []) as Rel[];
    },
  });

  const reprocessar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("documentos")
        .update({ status_processamento: "recebido", erro_motivo: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento enviado para reprocessamento");
      queryClient.invalidateQueries({ queryKey: ["cliente-documentos", clienteId] });
    },
    onError: (e: Error) => toast.error("Falha ao reprocessar", { description: e.message }),
  });

  const salvar = useMutation({
    mutationFn: async (v: AtualizacaoCliente) => {
      const { error } = await supabase.from("clientes").update(v).eq("id", clienteId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dados atualizados");
      queryClient.invalidateQueries({ queryKey: ["cliente", clienteId] });
      queryClient.invalidateQueries({ queryKey: ["clientes-saude"] });
    },
    onError: (e: Error) => toast.error("Não foi possível salvar", { description: e.message }),
  });

  const rotacionar = useMutation({
    mutationFn: async (campo: "upload_token" | "painel_token") => {
      const novo = crypto.randomUUID();
      const patch: AtualizacaoCliente =
        campo === "upload_token" ? { upload_token: novo } : { painel_token: novo };
      const { error } = await supabase.from("clientes").update(patch).eq("id", clienteId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Novo link gerado", { description: "O link anterior foi invalidado." });
      setConfirmar(null);
      queryClient.invalidateQueries({ queryKey: ["cliente", clienteId] });
    },
    onError: (e: Error) => toast.error("Não foi possível gerar o link", { description: e.message }),
  });

  const m = useMemo(() => {
    const docs = documentos ?? [];
    const comps = competencias ?? [];
    const lancs = lancamentos ?? [];
    const erros = docs.filter((d) => d.status_processamento === "erro").length;
    const pend = lancs.filter((l) => l.status === "pendente").length;
    const abertas = comps.filter((c) => c.status !== "fechada").length;
    const comTaxa = comps.filter((c) => c.taxa_conciliacao != null);
    const taxa = comTaxa.length
      ? comTaxa.reduce((a, c) => a + (c.taxa_conciliacao ?? 0), 0) / comTaxa.length
      : null;
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const docsMes = docs.filter((d) => new Date(d.enviado_em) >= inicioMes).length;

    const meses: { mes: string; recebidos: number; erros: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const doMes = docs.filter((x) => x.enviado_em.startsWith(k));
      meses.push({
        mes: d.toLocaleDateString("pt-BR", { month: "short" }),
        recebidos: doMes.length,
        erros: doMes.filter((x) => x.status_processamento === "erro").length,
      });
    }
    const status = {
      processado: docs.filter((d) => d.status_processamento === "processado").length,
      fila: docs.filter(
        (d) => d.status_processamento === "recebido" || d.status_processamento === "processando",
      ).length,
      erro: erros,
    };
    const relProntos = (relatorios ?? []).filter((r) => r.arquivo_path).length;
    return {
      erros,
      pend,
      abertas,
      taxa,
      docsMes,
      meses,
      status,
      relProntos,
      totalDocs: docs.length,
      totalLanc: lancs.length,
    };
  }, [documentos, competencias, lancamentos, relatorios]);

  if (isLoading || !cliente) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  const nome = cliente.nome_fantasia ?? cliente.nome ?? cliente.razao_social ?? "Cliente";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const linkUpload = `${origin}/upload/${cliente.upload_token}`;
  const linkPainel = `${origin}/painel/${cliente.painel_token}`;
  const waLink = linkWhatsApp(
    cliente.telefone,
    mensagemCobranca(nome, mesAtual(), empresa?.nome ?? "P&A Contabilidade Digital", linkUpload),
  );
  const copiar = (t: string) => {
    navigator.clipboard.writeText(t);
    toast.success("Link copiado");
  };

  const colDocs: Column<Doc>[] = [
    {
      key: "arquivo",
      header: "Arquivo",
      sortValue: (d) => d.nome_original ?? "",
      cell: (d) => (
        <div className="min-w-0">
          <div className="max-w-[300px] truncate font-medium">{d.nome_original ?? "Arquivo"}</div>
          <div className="text-[0.6875rem] text-muted-foreground">
            {rotuloTipo(d.tipo)}
            {d.erro_motivo && <span className="ml-1.5 text-destructive">· {d.erro_motivo}</span>}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (d) => d.status_processamento,
      cell: (d) => pillDocumento(d.status_processamento, "xs"),
    },
    {
      key: "quando",
      header: "Recebido",
      hideBelow: "md",
      sortValue: (d) => d.enviado_em,
      cell: (d) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {formatarDataHora(d.enviado_em)}
        </span>
      ),
    },
    {
      key: "acoes",
      header: "",
      align: "right",
      cell: (d) => (
        <div className="flex justify-end gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded-md"
            title="Baixar"
            onClick={() =>
              baixarDocumento(d.arquivo_path, d.nome_original).catch(() =>
                toast.error("Não foi possível baixar"),
              )
            }
          >
            <Download className="size-3.5" />
          </Button>
          {d.status_processamento === "erro" && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-md"
              title="Reprocessar"
              onClick={() => reprocessar.mutate(d.id)}
            >
              <RotateCcw className="size-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const colLanc: Column<Lanc>[] = [
    {
      key: "data",
      header: "Data",
      width: "92px",
      sortValue: (l) => l.data,
      cell: (l) => (
        <span className="text-xs tabular-nums text-muted-foreground">{formatarData(l.data)}</span>
      ),
    },
    {
      key: "desc",
      header: "Descrição",
      sortValue: (l) => l.descricao ?? "",
      cell: (l) => (
        <span className="block max-w-[320px] truncate font-medium">
          {l.descricao ?? "Lançamento"}
        </span>
      ),
    },
    {
      key: "valor",
      header: "Valor",
      align: "right",
      sortValue: (l) => l.valor,
      cell: (l) => (
        <span
          className={`font-semibold tabular-nums ${l.valor < 0 ? "text-destructive" : "text-success"}`}
        >
          {formatarMoeda(l.valor)}
        </span>
      ),
    },
    {
      key: "contas",
      header: "D / C",
      hideBelow: "lg",
      cell: (l) => (
        <span className="font-mono text-[0.6875rem] text-muted-foreground">
          {l.conta_debito ?? "—"} / {l.conta_credito ?? "—"}
        </span>
      ),
    },
    {
      key: "ia",
      header: "IA",
      hideBelow: "md",
      sortValue: (l) => l.confianca_ia ?? -1,
      cell: (l) => <ConfidenceBar value={l.confianca_ia} />,
    },
    { key: "status", header: "Status", cell: (l) => pillLancamento(l.status, "xs") },
  ];

  const colComp: Column<Comp>[] = [
    {
      key: "mes",
      header: "Competência",
      sortValue: (c) => c.mes_ano,
      cell: (c) => <span className="font-medium capitalize">{formatarCompetencia(c.mes_ano)}</span>,
    },
    { key: "status", header: "Status", cell: (c) => pillCompetencia(c.status, "xs") },
    {
      key: "taxa",
      header: "Conciliação",
      hideBelow: "md",
      sortValue: (c) => c.taxa_conciliacao ?? -1,
      cell: (c) => (
        <div className="flex items-center gap-2">
          <div className="w-24">
            <ProgressBar value={c.taxa_conciliacao ?? 0} />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">
            {Math.round(c.taxa_conciliacao ?? 0)}%
          </span>
        </div>
      ),
    },
    {
      key: "fechada",
      header: "Fechada em",
      hideBelow: "lg",
      cell: (c) => (
        <span className="text-xs text-muted-foreground">
          {c.fechada_em ? formatarDataHora(c.fechada_em) : "—"}
        </span>
      ),
    },
    {
      key: "acoes",
      header: "",
      align: "right",
      cell: (c) => (
        <Link
          to="/conciliacao"
          search={{ cliente: clienteId, competencia: c.id }}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <Scale className="size-3" /> Conciliar
        </Link>
      ),
    },
  ];

  const colRel: Column<Rel>[] = [
    {
      key: "tipo",
      header: "Relatório",
      cell: (r) => <span className="font-medium">{TIPOS_RELATORIO[r.tipo] ?? r.tipo}</span>,
    },
    {
      key: "comp",
      header: "Competência",
      sortValue: (r) => r.competencias?.mes_ano ?? "",
      cell: (r) => (
        <span className="capitalize text-muted-foreground">
          {r.competencias ? formatarCompetencia(r.competencias.mes_ano) : "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.arquivo_path ? (
            <StatusPill tone="success" label="Pronto" size="xs" />
          ) : (
            <StatusPill tone="warning" label="Em geração" size="xs" pulse />
          )}
          {r.publicado_painel && <StatusPill tone="primary" label="No painel" size="xs" />}
          {r.enviado_em && <StatusPill tone="info" label="Enviado" size="xs" />}
        </div>
      ),
    },
    {
      key: "acoes",
      header: "",
      align: "right",
      cell: (r) =>
        r.arquivo_path ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded-md"
            onClick={() =>
              baixarDocumento(r.arquivo_path, `${TIPOS_RELATORIO[r.tipo] ?? r.tipo}.pdf`).catch(
                () => toast.error("Não foi possível baixar"),
              )
            }
          >
            <Download className="size-3.5" />
          </Button>
        ) : null,
    },
  ];

  const donut = [
    { name: "Processados", value: m.status.processado, color: CHART_COLORS.success },
    { name: "Na fila", value: m.status.fila, color: CHART_COLORS.warning },
    { name: "Com erro", value: m.status.erro, color: CHART_COLORS.danger },
  ];

  return (
    <div className="space-y-5">
      <Link
        to="/clientes"
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Clientes
      </Link>

      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Avatar name={nome} src={cliente.logo_url} size="lg" />
            <span>
              <span className="block">{nome}</span>
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                {cliente.razao_social} · {formatarCnpj(cliente.cnpj)}
                {cliente.email_contato ? ` · ${cliente.email_contato}` : ""}
              </span>
            </span>
          </span>
        }
        actions={
          <>
            {cliente.ativo ? (
              <StatusPill tone="success" label="Ativo" />
            ) : (
              <StatusPill tone="neutral" label="Inativo" />
            )}
            <Button asChild variant="outline" size="sm" className="h-8 rounded-lg">
              <a href={waLink} target="_blank" rel="noreferrer">
                <MessageCircle className="size-3.5" /> WhatsApp
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-lg"
              onClick={() => copiar(linkUpload)}
            >
              <Copy className="size-3.5" /> Link de upload
            </Button>
            {cliente.painel_token && (
              <Button
                size="sm"
                className="h-8 rounded-lg"
                onClick={() => window.open(linkPainel, "_blank")}
              >
                <ExternalLink className="size-3.5" /> Ver como cliente
              </Button>
            )}
          </>
        }
      />

      <KpiGrid cols={5}>
        <KpiCard
          label="Documentos"
          value={m.totalDocs}
          icon={FileText}
          tone="primary"
          footer={
            m.erros ? (
              <span className="text-destructive">{m.erros} com erro</span>
            ) : (
              `${m.docsMes} neste mês`
            )
          }
          onClick={() => setAba("documentos")}
          active={aba === "documentos"}
        />
        <KpiCard
          label="Lançamentos"
          value={m.totalLanc}
          icon={BookOpen}
          tone="accent"
          footer={
            m.pend ? (
              <span className="text-warning-foreground">{m.pend} pendentes</span>
            ) : (
              "tudo classificado"
            )
          }
          onClick={() => setAba("lancamentos")}
          active={aba === "lancamentos"}
        />
        <KpiCard
          label="Competências abertas"
          value={m.abertas}
          icon={CalendarRange}
          tone="primary"
          footer={`${(competencias ?? []).length} no total`}
          onClick={() => setAba("competencias")}
          active={aba === "competencias"}
        />
        <KpiCard
          label="Conciliação média"
          value={m.taxa == null ? "—" : `${Math.round(m.taxa)}%`}
          icon={Scale}
          tone={m.taxa != null && m.taxa >= 80 ? "success" : "warning"}
          progress={m.taxa ?? 0}
        />
        <KpiCard
          label="Relatórios prontos"
          value={m.relProntos}
          icon={FileBarChart2}
          tone="success"
          footer={`${(relatorios ?? []).length - m.relProntos} em geração`}
          onClick={() => setAba("relatorios")}
          active={aba === "relatorios"}
        />
      </KpiGrid>

      <SubTabs
        value={aba}
        onChange={setAba}
        items={[
          { value: "visao", label: "Visão geral", icon: LayoutDashboard },
          {
            value: "documentos",
            label: "Documentos",
            count: m.totalDocs,
            icon: FileText,
            ...(m.erros ? { tone: "danger" as const } : {}),
          },
          { value: "lancamentos", label: "Lançamentos", count: m.totalLanc, icon: BookOpen },
          {
            value: "competencias",
            label: "Competências",
            count: (competencias ?? []).length,
            icon: CalendarRange,
          },
          {
            value: "relatorios",
            label: "Relatórios",
            count: (relatorios ?? []).length,
            icon: FileBarChart2,
          },
          { value: "dados", label: "Dados", icon: ClipboardList },
          { value: "links", label: "Links", icon: LinkIcon },
        ]}
      />

      {aba === "visao" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <SectionCard
            className="lg:col-span-2"
            title="Documentos por mês"
            description="Últimos 6 meses de recebimento deste cliente."
            icon={FileText}
          >
            <AreaTrend
              data={m.meses}
              xKey="mes"
              height={200}
              series={[
                { key: "recebidos", label: "Recebidos", color: CHART_COLORS.primary },
                { key: "erros", label: "Com erro", color: CHART_COLORS.danger },
              ]}
            />
          </SectionCard>
          <SectionCard title="Status dos documentos" icon={Scale}>
            <div className="flex items-center gap-4">
              <Donut
                data={donut}
                size={120}
                thickness={14}
                center={{ value: String(m.totalDocs), label: "docs" }}
              />
              <div className="flex-1">
                <Legend items={donut} />
              </div>
            </div>
          </SectionCard>
          <SectionCard
            className="lg:col-span-2"
            title="Competências"
            icon={CalendarRange}
            actions={
              <button
                className="text-xs font-medium text-primary hover:underline"
                onClick={() => setAba("competencias")}
              >
                Ver todas
              </button>
            }
          >
            {(competencias ?? []).length === 0 ? (
              <EmptyState
                icon={CalendarRange}
                title="Nenhuma competência"
                hint="Criada automaticamente quando o primeiro documento do mês chegar."
                compact
              />
            ) : (
              <div className="divide-y divide-border/40">
                {(competencias ?? []).slice(0, 5).map((c) => (
                  <Link
                    key={c.id}
                    to="/conciliacao"
                    search={{ cliente: clienteId, competencia: c.id }}
                    className="flex items-center gap-3 py-2 hover:bg-muted/40"
                  >
                    <span className="w-32 text-xs font-medium capitalize">
                      {formatarCompetencia(c.mes_ano)}
                    </span>
                    {pillCompetencia(c.status, "xs")}
                    <div className="flex-1">
                      <ProgressBar
                        value={c.taxa_conciliacao ?? 0}
                        tone={
                          c.status === "em_conciliacao"
                            ? "warning"
                            : c.status === "fechada"
                              ? "neutral"
                              : "success"
                        }
                      />
                    </div>
                    <span className="w-10 text-right text-xs font-semibold tabular-nums">
                      {Math.round(c.taxa_conciliacao ?? 0)}%
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
          <SectionCard title="Atenção" icon={AlertTriangle}>
            <ul className="space-y-2 text-xs">
              {m.erros > 0 && (
                <li className="flex items-start gap-2 rounded-md bg-destructive/8 px-2.5 py-2 text-destructive">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    <b>{m.erros}</b> documento(s) com erro de leitura.{" "}
                    <button className="underline" onClick={() => setAba("documentos")}>
                      Ver
                    </button>
                  </span>
                </li>
              )}
              {m.pend > 0 && (
                <li className="flex items-start gap-2 rounded-md bg-warning/10 px-2.5 py-2 text-warning-foreground">
                  <Scale className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    <b>{m.pend}</b> lançamento(s) aguardando classificação.
                  </span>
                </li>
              )}
              {m.docsMes === 0 && cliente.ativo && (
                <li className="flex items-start gap-2 rounded-md bg-warning/10 px-2.5 py-2 text-warning-foreground">
                  <MessageCircle className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    Nenhum documento recebido este mês.{" "}
                    <a href={waLink} target="_blank" rel="noreferrer" className="underline">
                      Cobrar no WhatsApp
                    </a>
                  </span>
                </li>
              )}
              {m.erros === 0 && m.pend === 0 && (m.docsMes > 0 || !cliente.ativo) && (
                <li className="rounded-md bg-success/10 px-2.5 py-2 text-success">
                  Tudo em dia com este cliente.
                </li>
              )}
            </ul>
          </SectionCard>
        </div>
      )}

      {aba === "documentos" && (
        <SectionCard
          flush
          title="Documentos recebidos"
          icon={FileText}
          actions={
            <Link
              to="/documentos"
              search={{ cliente: clienteId, novo: "1" }}
              className="text-xs font-medium text-primary hover:underline"
            >
              Upload manual
            </Link>
          }
        >
          <DataTable
            rows={documentos ?? []}
            columns={colDocs}
            rowKey={(d) => d.id}
            defaultSort={{ key: "quando", dir: "desc" }}
            dense
            emptyTitle="Nenhum documento"
            emptyHint="Compartilhe o link de upload na aba Links."
          />
        </SectionCard>
      )}

      {aba === "lancamentos" && (
        <SectionCard
          flush
          title="Lançamentos contábeis"
          description="Movimentações extraídas dos documentos e classificadas pela IA. Para conferir e corrigir, use a tela de Conciliação."
          icon={BookOpen}
          actions={
            <Link
              to="/conciliacao"
              search={{ cliente: clienteId }}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <Scale className="size-3" /> Abrir conciliação
            </Link>
          }
        >
          <DataTable
            rows={lancamentos ?? []}
            columns={colLanc}
            rowKey={(l) => l.id}
            defaultSort={{ key: "data", dir: "desc" }}
            dense
            emptyTitle="Nenhum lançamento"
            emptyHint="São criados automaticamente ao processar os documentos."
          />
        </SectionCard>
      )}

      {aba === "competencias" && (
        <SectionCard
          flush
          title="Competências"
          icon={CalendarRange}
          actions={
            <Link to="/competencias" className="text-xs font-medium text-primary hover:underline">
              Gerenciar
            </Link>
          }
        >
          <DataTable
            rows={competencias ?? []}
            columns={colComp}
            rowKey={(c) => c.id}
            defaultSort={{ key: "mes", dir: "desc" }}
            dense
            emptyTitle="Nenhuma competência"
          />
        </SectionCard>
      )}

      {aba === "relatorios" && (
        <SectionCard
          flush
          title="Relatórios"
          icon={FileBarChart2}
          actions={
            <Link to="/relatorios" className="text-xs font-medium text-primary hover:underline">
              Pacotes mensais
            </Link>
          }
        >
          <DataTable
            rows={relatorios ?? []}
            columns={colRel}
            rowKey={(r) => r.id}
            dense
            emptyTitle="Nenhum relatório"
            emptyHint="Gerados após o fechamento da competência."
          />
        </SectionCard>
      )}

      {aba === "dados" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <SectionCard
            className="lg:col-span-2"
            title="Dados cadastrais"
            description="Alterações são salvas ao sair do campo."
            icon={ClipboardList}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Razão social</Label>
                <Input
                  className="h-9 rounded-lg"
                  defaultValue={cliente.razao_social ?? ""}
                  onBlur={(e) =>
                    e.target.value !== (cliente.razao_social ?? "") &&
                    salvar.mutate({ razao_social: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nome fantasia</Label>
                <Input
                  className="h-9 rounded-lg"
                  defaultValue={cliente.nome_fantasia ?? ""}
                  onBlur={(e) =>
                    e.target.value !== (cliente.nome_fantasia ?? "") &&
                    salvar.mutate({ nome_fantasia: e.target.value, nome: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">CNPJ</Label>
                <Input
                  className="h-9 rounded-lg font-mono"
                  readOnly
                  value={formatarCnpj(cliente.cnpj)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Segmento</Label>
                <Input
                  className="h-9 rounded-lg"
                  placeholder="ex.: igreja, comércio"
                  defaultValue={cliente.segmento ?? ""}
                  onBlur={(e) =>
                    e.target.value !== (cliente.segmento ?? "") &&
                    salvar.mutate({ segmento: e.target.value || null })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">E-mail de contato</Label>
                <Input
                  className="h-9 rounded-lg"
                  type="email"
                  defaultValue={cliente.email_contato ?? ""}
                  onBlur={(e) =>
                    e.target.value !== (cliente.email_contato ?? "") &&
                    salvar.mutate({ email_contato: e.target.value || null })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">WhatsApp / Telefone</Label>
                <Input
                  className="h-9 rounded-lg"
                  defaultValue={formatarTelefone(cliente.telefone ?? "")}
                  onBlur={(e) => salvar.mutate({ telefone: e.target.value || null })}
                />
              </div>
            </div>
            <div className="mt-4 space-y-1.5">
              <Label className="text-xs">Origens de documentos</Label>
              <div className="grid gap-1.5 sm:grid-cols-3">
                {ORIGENS_DOCUMENTO.map((o) => {
                  const atuais = cliente.origem_documentos ?? [];
                  return (
                    <label
                      key={o.value}
                      className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-xs has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                    >
                      <Checkbox
                        checked={atuais.includes(o.value)}
                        onCheckedChange={(m) =>
                          salvar.mutate({
                            origem_documentos: m
                              ? [...atuais, o.value]
                              : atuais.filter((v: string) => v !== o.value),
                          })
                        }
                      />
                      {o.label}
                    </label>
                  );
                })}
              </div>
            </div>
          </SectionCard>
          <SectionCard title="Situação" icon={ClipboardList}>
            <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5">
              <div>
                <div className="text-sm font-medium">Cliente ativo</div>
                <div className="text-[0.6875rem] text-muted-foreground">
                  Inativos não recebem cobrança nem entram nos indicadores.
                </div>
              </div>
              <Switch
                checked={cliente.ativo}
                onCheckedChange={(v) => salvar.mutate({ ativo: v })}
              />
            </div>
            <p className="mt-4 text-[0.6875rem] text-muted-foreground">
              A identidade visual (logo e cores) é configurada no nível da empresa, em{" "}
              <Link to="/configuracoes" className="font-medium text-primary hover:underline">
                Configurações
              </Link>
              , e vale para todos os clientes.
            </p>
          </SectionCard>
        </div>
      )}

      {aba === "links" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard
            title="Link de upload"
            description="O cliente abre, arrasta os arquivos e pronto — sem senha. Compartilhe por WhatsApp ou e-mail."
            icon={LinkIcon}
          >
            <Input readOnly value={linkUpload} className="h-9 rounded-lg font-mono text-xs" />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg"
                onClick={() => copiar(linkUpload)}
              >
                <Copy className="size-3.5" /> Copiar
              </Button>
              <Button asChild variant="outline" size="sm" className="h-8 rounded-lg">
                <a href={waLink} target="_blank" rel="noreferrer">
                  <MessageCircle className="size-3.5" /> Enviar no WhatsApp
                </a>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-lg text-muted-foreground"
                onClick={() => setConfirmar("upload_token")}
              >
                <RefreshCw className="size-3.5" /> Gerar novo
              </Button>
            </div>
          </SectionCard>
          <SectionCard
            title="Painel do cliente"
            description="Onde o cliente vê relatórios do mês, histórico e indicadores simples — pelo mesmo esquema de link sem senha."
            icon={ExternalLink}
          >
            <Input readOnly value={linkPainel} className="h-9 rounded-lg font-mono text-xs" />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg"
                onClick={() => copiar(linkPainel)}
              >
                <Copy className="size-3.5" /> Copiar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg"
                onClick={() => window.open(linkPainel, "_blank")}
              >
                <ExternalLink className="size-3.5" /> Abrir
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-lg text-muted-foreground"
                onClick={() => setConfirmar("painel_token")}
              >
                <RefreshCw className="size-3.5" /> Gerar novo
              </Button>
            </div>
          </SectionCard>
        </div>
      )}

      <AlertDialog open={!!confirmar} onOpenChange={(v) => !v && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar novo link?</AlertDialogTitle>
            <AlertDialogDescription>
              O link atual será invalidado e o cliente precisará receber o novo endereço.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmar && rotacionar.mutate(confirmar)}>
              Gerar novo link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
