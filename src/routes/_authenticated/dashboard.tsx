import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarRange,
  CheckCircle2,
  FileText,
  MessageCircle,
  Scale,
  Upload,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil, useEmpresa } from "@/hooks/use-perfil";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AreaTrend,
  Bars,
  CHART_COLORS,
  DataTable,
  Donut,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  Legend,
  PageHeader,
  ProgressBar,
  SectionCard,
  Segmented,
  SubTabs,
  pillCompetencia,
  pillDocumento,
  type Column,
} from "@/components/ui-kit";
import { formatarCompetencia, formatarDataHora, mesAtual } from "@/lib/formatadores";
import { rotuloTipo } from "@/lib/dominio";
import { linkWhatsApp, mensagemCobranca } from "@/lib/cobranca";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — P&A Contabilidade Digital" },
      {
        name: "description",
        content: "Visão operacional por tema: clientes, conciliação e pendências.",
      },
    ],
  }),
  component: EmpresaDashboard,
});

/* ────────────────────────────────────────────────────────────────────────── */
/* Tipos                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

type Aba = "clientes" | "conciliacao" | "pendencias";
type Periodo = "7" | "30" | "90";
type TipoPendencia = "todas" | "envio" | "erro" | "atrasadas";

type Doc = {
  id: string;
  nome_original: string | null;
  tipo: string | null;
  status_processamento: string;
  erro_motivo: string | null;
  enviado_em: string;
  cliente_id: string;
  clientes: { nome_fantasia: string | null; nome: string | null } | null;
};

type Cliente = {
  id: string;
  nome_fantasia: string | null;
  nome: string | null;
  telefone: string | null;
  upload_token: string | null;
  ativo: boolean;
};

type Comp = {
  id: string;
  status: string;
  mes_ano: string;
  taxa_conciliacao: number | null;
  cliente_id: string;
  clientes: { nome_fantasia: string | null; nome: string | null } | null;
};

const TODOS = "todos";

/* ────────────────────────────────────────────────────────────────────────── */
/* Helpers                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

function diasAtras(n: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

function chaveDia(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function inicioDoMes() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function nomeCliente(c: { nome_fantasia: string | null; nome: string | null } | null | undefined) {
  return c?.nome_fantasia ?? c?.nome ?? "—";
}

function FiltroSelect({
  value,
  onChange,
  placeholder,
  todosLabel,
  items,
  width = "w-44",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  todosLabel: string;
  items: { value: string; label: string }[];
  width?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`h-8 ${width} rounded-lg text-xs`} aria-label={placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={TODOS}>{todosLabel}</SelectItem>
        {items.map((it) => (
          <SelectItem key={it.value} value={it.value}>
            {it.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Página                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

function EmpresaDashboard() {
  const { orgId: empresaId } = Route.useRouteContext();
  const { data: perfil } = usePerfil();
  const { data: empresa } = useEmpresa(empresaId);

  const [aba, setAba] = useState<Aba>("clientes");
  // Filtros (cada aba usa os que fazem sentido para ela)
  const [periodo, setPeriodo] = useState<Periodo>("30");
  const [clienteSel, setClienteSel] = useState<string>(TODOS);
  const [competenciaSel, setCompetenciaSel] = useState<string>(`${mesAtual()}-01`);
  const [tipoPend, setTipoPend] = useState<TipoPendencia>("todas");

  const { data, isLoading } = useQuery({
    queryKey: ["empresa-dashboard", empresaId],
    queryFn: async () => {
      const desde = diasAtras(180).toISOString();
      const [docs, clientes, comps] = await Promise.all([
        supabase
          .from("documentos")
          .select(
            "id, nome_original, tipo, status_processamento, erro_motivo, enviado_em, cliente_id, clientes(nome_fantasia, nome)",
          )
          .is("deleted_at", null)
          .gte("enviado_em", desde)
          .order("enviado_em", { ascending: false }),
        supabase
          .from("clientes")
          .select("id, nome_fantasia, nome, telefone, upload_token, ativo")
          .eq("ativo", true)
          .is("deleted_at", null)
          .order("nome_fantasia"),
        supabase
          .from("competencias")
          .select(
            "id, status, mes_ano, taxa_conciliacao, cliente_id, clientes(nome_fantasia, nome)",
          )
          .is("deleted_at", null)
          .order("mes_ano", { ascending: false }),
      ]);
      return {
        docs: (docs.data ?? []) as Doc[],
        clientes: (clientes.data ?? []) as Cliente[],
        comps: (comps.data ?? []) as Comp[],
      };
    },
  });

  const clientes = useMemo(() => data?.clientes ?? [], [data]);
  const docsTodos = useMemo(() => data?.docs ?? [], [data]);
  const compsTodas = useMemo(() => data?.comps ?? [], [data]);

  const opcoesClientes = useMemo(
    () => clientes.map((c) => ({ value: c.id, label: nomeCliente(c) })),
    [clientes],
  );

  const opcoesCompetencias = useMemo(() => {
    const set = new Set<string>(compsTodas.map((c) => c.mes_ano));
    set.add(`${mesAtual()}-01`);
    return Array.from(set)
      .sort((a, b) => (a < b ? 1 : -1))
      .map((m) => ({ value: m, label: formatarCompetencia(m) }));
  }, [compsTodas]);

  /* ── Aba Clientes ─────────────────────────────────────────────────────── */
  const mc = useMemo(() => {
    const docs =
      clienteSel === TODOS ? docsTodos : docsTodos.filter((d) => d.cliente_id === clienteSel);
    const cls = clienteSel === TODOS ? clientes : clientes.filter((c) => c.id === clienteSel);
    const dias = Number(periodo);
    const inicio = diasAtras(dias - 1);
    const inicioAnterior = diasAtras(dias * 2 - 1);

    const noPeriodo = docs.filter((d) => new Date(d.enviado_em) >= inicio);
    const anterior = docs.filter((d) => {
      const t = new Date(d.enviado_em);
      return t >= inicioAnterior && t < inicio;
    });
    const delta =
      anterior.length === 0
        ? noPeriodo.length > 0
          ? 100
          : 0
        : ((noPeriodo.length - anterior.length) / anterior.length) * 100;

    const porDia = new Map<string, { recebidos: number; processados: number; erros: number }>();
    for (let i = dias - 1; i >= 0; i--)
      porDia.set(chaveDia(diasAtras(i)), { recebidos: 0, processados: 0, erros: 0 });
    noPeriodo.forEach((d) => {
      const row = porDia.get(chaveDia(new Date(d.enviado_em)));
      if (!row) return;
      row.recebidos++;
      if (d.status_processamento === "processado") row.processados++;
      if (d.status_processamento === "erro") row.erros++;
    });
    const trend = Array.from(porDia.entries()).map(([k, v]) => {
      const [, mm, dd] = k.split("-");
      return { dia: `${dd}/${mm}`, ...v };
    });

    const status = { recebido: 0, processando: 0, processado: 0, erro: 0 };
    noPeriodo.forEach((d) => {
      const s = d.status_processamento as keyof typeof status;
      if (s in status) status[s]++;
    });

    const ini = inicioDoMes();
    const comDocMes = new Set(
      docs.filter((d) => new Date(d.enviado_em) >= ini).map((d) => d.cliente_id),
    );
    const cobertura = cls.length
      ? (cls.filter((c) => comDocMes.has(c.id)).length / cls.length) * 100
      : 0;

    const porCliente = new Map<string, number>();
    noPeriodo.forEach((d) => {
      const n = nomeCliente(d.clientes);
      porCliente.set(n, (porCliente.get(n) ?? 0) + 1);
    });
    const topClientes = Array.from(porCliente.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([cliente, total]) => ({ cliente, total }));

    return {
      clientesAtivos: cls.length,
      cobertura,
      noPeriodo: noPeriodo.length,
      delta,
      sparkline: trend.map((t) => t.recebidos),
      trend,
      status,
      fila: status.recebido + status.processando,
      topClientes,
      ultimos: docs.slice(0, 8),
    };
  }, [docsTodos, clientes, clienteSel, periodo]);

  /* ── Aba Conciliação ──────────────────────────────────────────────────── */
  const mr = useMemo(() => {
    let comps = compsTodas;
    if (clienteSel !== TODOS) comps = comps.filter((c) => c.cliente_id === clienteSel);
    if (competenciaSel !== TODOS) comps = comps.filter((c) => c.mes_ano === competenciaSel);

    const abertas = comps.filter((c) => c.status === "aberta");
    const emConc = comps.filter((c) => c.status === "em_conciliacao");
    const fechadas = comps.filter((c) => c.status === "fechada");
    const comTaxa = comps.filter((c) => c.taxa_conciliacao != null);
    const taxaMedia = comTaxa.length
      ? comTaxa.reduce((a, c) => a + (c.taxa_conciliacao ?? 0), 0) / comTaxa.length
      : null;

    // Clientes sem competência no mês selecionado (só faz sentido com uma competência específica)
    const cls = clienteSel === TODOS ? clientes : clientes.filter((c) => c.id === clienteSel);
    const comComp = new Set(comps.map((c) => c.cliente_id));
    const semCompetencia = competenciaSel === TODOS ? [] : cls.filter((c) => !comComp.has(c.id));

    const faixas = [
      {
        name: "≥ 80%",
        value: comTaxa.filter((c) => (c.taxa_conciliacao ?? 0) >= 80).length,
        color: CHART_COLORS.success,
      },
      {
        name: "50–79%",
        value: comTaxa.filter(
          (c) => (c.taxa_conciliacao ?? 0) >= 50 && (c.taxa_conciliacao ?? 0) < 80,
        ).length,
        color: CHART_COLORS.warning,
      },
      {
        name: "< 50%",
        value: comTaxa.filter((c) => (c.taxa_conciliacao ?? 0) < 50).length,
        color: CHART_COLORS.danger,
      },
    ];

    return { comps, abertas, emConc, fechadas, taxaMedia, semCompetencia, faixas };
  }, [compsTodas, clientes, clienteSel, competenciaSel]);

  /* ── Aba Pendências ───────────────────────────────────────────────────── */
  const mp = useMemo(() => {
    const cls = clienteSel === TODOS ? clientes : clientes.filter((c) => c.id === clienteSel);
    const docs =
      clienteSel === TODOS ? docsTodos : docsTodos.filter((d) => d.cliente_id === clienteSel);
    const comps =
      clienteSel === TODOS ? compsTodas : compsTodas.filter((c) => c.cliente_id === clienteSel);

    const ini = inicioDoMes();
    const comDocMes = new Set(
      docs.filter((d) => new Date(d.enviado_em) >= ini).map((d) => d.cliente_id),
    );
    const semEnvio = cls.filter((c) => !comDocMes.has(c.id));
    const erros = docs.filter((d) => d.status_processamento === "erro");
    const mesCorrente = `${mesAtual()}-01`;
    const atrasadas = comps.filter((c) => c.status !== "fechada" && c.mes_ano < mesCorrente);

    return { semEnvio, erros, atrasadas, total: semEnvio.length + erros.length + atrasadas.length };
  }, [docsTodos, clientes, compsTodas, clienteSel]);

  /* ── Cabeçalho ────────────────────────────────────────────────────────── */
  const firstName = perfil?.nome?.split(" ")[0] ?? "equipe";
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const nomeEmpresa = empresa?.nome_curto || empresa?.nome || "P&A";

  const colunasDocs: Column<Doc>[] = [
    {
      key: "arquivo",
      header: "Arquivo",
      cell: (d) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{d.nome_original ?? "Arquivo"}</div>
          <div className="truncate text-[0.6875rem] text-muted-foreground">
            {rotuloTipo(d.tipo)}
          </div>
        </div>
      ),
    },
    {
      key: "cliente",
      header: "Cliente",
      hideBelow: "md",
      cell: (d) => <span className="text-muted-foreground">{nomeCliente(d.clientes)}</span>,
    },
    { key: "status", header: "Status", cell: (d) => pillDocumento(d.status_processamento, "xs") },
    {
      key: "quando",
      header: "Recebido",
      hideBelow: "lg",
      align: "right",
      cell: (d) => (
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatarDataHora(d.enviado_em)}
        </span>
      ),
    },
  ];

  const colunasComps: Column<Comp>[] = [
    {
      key: "cliente",
      header: "Cliente",
      sortValue: (c) => nomeCliente(c.clientes),
      cell: (c) => <span className="font-medium">{nomeCliente(c.clientes)}</span>,
    },
    {
      key: "competencia",
      header: "Competência",
      hideBelow: "sm",
      sortValue: (c) => c.mes_ano,
      cell: (c) => <span className="text-muted-foreground">{formatarCompetencia(c.mes_ano)}</span>,
    },
    { key: "status", header: "Status", cell: (c) => pillCompetencia(c.status, "xs") },
    {
      key: "taxa",
      header: "Conciliado",
      width: "180px",
      sortValue: (c) => c.taxa_conciliacao ?? -1,
      cell: (c) => (
        <div className="flex items-center gap-2">
          <div className="w-24">
            <ProgressBar
              value={c.taxa_conciliacao ?? 0}
              tone={(c.taxa_conciliacao ?? 0) >= 80 ? "success" : "warning"}
            />
          </div>
          <span className="w-10 text-right text-xs font-semibold tabular-nums">
            {c.taxa_conciliacao == null ? "—" : `${Math.round(c.taxa_conciliacao)}%`}
          </span>
        </div>
      ),
    },
    {
      key: "acao",
      header: "",
      align: "right",
      cell: (c) => (
        <Link
          to="/conciliacao"
          search={{ cliente: c.cliente_id, competencia: c.id }}
          className="text-xs font-medium text-primary hover:underline"
        >
          Abrir
        </Link>
      ),
    },
  ];

  const filtroCliente = (
    <FiltroSelect
      value={clienteSel}
      onChange={setClienteSel}
      placeholder="Cliente"
      todosLabel="Todos os clientes"
      items={opcoesClientes}
      width="w-52"
    />
  );

  const limparFiltros = (
    <button
      type="button"
      onClick={() => {
        setClienteSel(TODOS);
        setPeriodo("30");
        setCompetenciaSel(`${mesAtual()}-01`);
        setTipoPend("todas");
      }}
      className="ml-auto text-[0.6875rem] font-medium text-muted-foreground hover:text-foreground"
    >
      Limpar filtros
    </button>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={nomeEmpresa}
        title={`${saudacao}, ${firstName}`}
        description="O dashboard é dividido por tema. Cada aba tem seus indicadores e filtros próprios."
        actions={
          <Button asChild size="sm" className="h-8 rounded-lg">
            <Link to="/documentos" search={{ novo: "1" }}>
              <Upload className="size-3.5" /> Upload manual
            </Link>
          </Button>
        }
      />

      <SubTabs
        value={aba}
        onChange={setAba}
        items={[
          { value: "clientes", label: "Clientes", icon: Users, count: mc.clientesAtivos },
          {
            value: "conciliacao",
            label: "Conciliação",
            icon: Scale,
            count: mr.emConc.length,
            tone: "warning",
          },
          {
            value: "pendencias",
            label: "Pendências",
            icon: AlertTriangle,
            count: mp.total,
            tone: mp.total > 0 ? "danger" : "success",
          },
        ]}
      />

      {/* ═══════════════════════════ CLIENTES ═══════════════════════════ */}
      {aba === "clientes" && (
        <>
          <FilterBar className="rounded-lg border border-border/60 bg-card px-3 py-2">
            <Segmented
              value={periodo}
              onChange={setPeriodo}
              items={[
                { value: "7", label: "7 dias" },
                { value: "30", label: "30 dias" },
                { value: "90", label: "90 dias" },
              ]}
            />
            {filtroCliente}
            {limparFiltros}
          </FilterBar>

          <KpiGrid cols={5}>
            <KpiCard
              label="Clientes ativos"
              value={mc.clientesAtivos}
              tone="primary"
              loading={isLoading}
              progress={mc.cobertura}
              footer={`${Math.round(mc.cobertura)}% já enviaram este mês`}
              hint="Clientes ativos e o percentual que já enviou ao menos um documento no mês corrente."
            />
            <KpiCard
              label={`Documentos · ${periodo} dias`}
              value={mc.noPeriodo}
              tone="accent"
              loading={isLoading}
              delta={mc.delta}
              deltaLabel="vs. período anterior"
              sparkline={mc.sparkline}
              hint="Documentos recebidos no período selecionado, comparados ao período imediatamente anterior."
            />
            <KpiCard
              label="Processados"
              value={mc.status.processado}
              tone="success"
              loading={isLoading}
              footer={
                mc.noPeriodo
                  ? `${Math.round((mc.status.processado / mc.noPeriodo) * 100)}% do período`
                  : "—"
              }
              hint="Documentos lidos com sucesso pela IA no período."
            />
            <KpiCard
              label="Na fila"
              value={mc.fila}
              tone={mc.fila > 0 ? "warning" : "neutral"}
              loading={isLoading}
              footer="recebidos + processando"
              hint="Documentos aguardando leitura automática ou em processamento."
            />
            <KpiCard
              label="Com erro"
              value={mc.status.erro}
              tone={mc.status.erro > 0 ? "danger" : "neutral"}
              loading={isLoading}
              footer={mc.status.erro > 0 ? "precisam de atenção" : "nenhum erro"}
              hint="Documentos que a leitura automática não conseguiu processar."
              onClick={() => {
                setTipoPend("erro");
                setAba("pendencias");
              }}
            />
          </KpiGrid>

          <div className="grid gap-4 lg:grid-cols-3">
            <SectionCard
              className="lg:col-span-2"
              title="Recebimento de documentos"
              description="Volume diário recebido no período, com quantos foram processados e quantos deram erro."
              actions={
                <Link
                  to="/documentos"
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Ver documentos <ArrowUpRight className="size-3" />
                </Link>
              }
            >
              {mc.noPeriodo === 0 && !isLoading ? (
                <EmptyState
                  icon={FileText}
                  title="Nenhum documento no período"
                  hint="Quando os clientes enviarem arquivos, o gráfico aparece aqui."
                  compact
                />
              ) : (
                <AreaTrend
                  data={mc.trend}
                  xKey="dia"
                  height={220}
                  series={[
                    { key: "recebidos", label: "Recebidos", color: CHART_COLORS.primary },
                    { key: "processados", label: "Processados", color: CHART_COLORS.success },
                    { key: "erros", label: "Com erro", color: CHART_COLORS.danger },
                  ]}
                />
              )}
            </SectionCard>

            <SectionCard
              title="Status do processamento"
              description="Distribuição dos documentos do período por situação."
            >
              {(() => {
                const donut = [
                  { name: "Processados", value: mc.status.processado, color: CHART_COLORS.success },
                  { name: "Na fila", value: mc.fila, color: CHART_COLORS.warning },
                  { name: "Com erro", value: mc.status.erro, color: CHART_COLORS.danger },
                ];
                const total = donut.reduce((a, d) => a + d.value, 0);
                return (
                  <div className="flex items-center gap-5">
                    <Donut
                      data={donut}
                      size={140}
                      center={{ value: String(total), label: "documentos" }}
                    />
                    <div className="flex-1">
                      <Legend
                        items={donut.map((d) => ({
                          ...d,
                          value: total
                            ? `${d.value} · ${Math.round((d.value / total) * 100)}%`
                            : "0",
                        }))}
                      />
                    </div>
                  </div>
                );
              })()}
            </SectionCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <SectionCard
              className="lg:col-span-2"
              title="Últimos documentos recebidos"
              flush
              actions={
                <Link
                  to="/documentos"
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Ver todos <ArrowUpRight className="size-3" />
                </Link>
              }
            >
              <DataTable
                rows={mc.ultimos}
                columns={colunasDocs}
                rowKey={(d) => d.id}
                loading={isLoading}
                dense
                emptyTitle="Nenhum documento recebido ainda"
                emptyHint="Cadastre um cliente e compartilhe o link de upload."
              />
            </SectionCard>

            <SectionCard
              title="Documentos por cliente"
              description="Clientes que mais enviaram no período selecionado."
            >
              {mc.topClientes.length === 0 ? (
                <EmptyState icon={Users} title="Sem envios no período" compact />
              ) : (
                <Bars
                  data={mc.topClientes}
                  xKey="cliente"
                  horizontal
                  height={Math.max(160, mc.topClientes.length * 32)}
                  series={[{ key: "total", label: "Documentos", color: CHART_COLORS.primary }]}
                />
              )}
            </SectionCard>
          </div>
        </>
      )}

      {/* ═══════════════════════════ CONCILIAÇÃO ═══════════════════════════ */}
      {aba === "conciliacao" && (
        <>
          <FilterBar className="rounded-lg border border-border/60 bg-card px-3 py-2">
            <FiltroSelect
              value={competenciaSel}
              onChange={setCompetenciaSel}
              placeholder="Competência"
              todosLabel="Todas as competências"
              items={opcoesCompetencias}
            />
            {filtroCliente}
            {limparFiltros}
          </FilterBar>

          <KpiGrid cols={4}>
            <KpiCard
              label="Abertas"
              value={mr.abertas.length}
              tone="primary"
              loading={isLoading}
              footer="aguardando início"
              hint="Competências criadas que ainda não entraram em conciliação."
            />
            <KpiCard
              label="Em conciliação"
              value={mr.emConc.length}
              tone={mr.emConc.length > 0 ? "warning" : "neutral"}
              loading={isLoading}
              footer="em andamento"
              hint="Competências em que a equipe está conferindo banco × contabilidade."
            />
            <KpiCard
              label="Fechadas"
              value={mr.fechadas.length}
              tone="success"
              loading={isLoading}
              progress={mr.comps.length ? (mr.fechadas.length / mr.comps.length) * 100 : 0}
              footer={`${mr.fechadas.length} de ${mr.comps.length} no filtro`}
              hint="Competências concluídas; o pacote de relatórios pode ser gerado."
            />
            <KpiCard
              label="Conciliação média"
              value={mr.taxaMedia == null ? "—" : `${Math.round(mr.taxaMedia)}%`}
              tone={mr.taxaMedia != null && mr.taxaMedia >= 80 ? "success" : "warning"}
              loading={isLoading}
              progress={mr.taxaMedia ?? 0}
              hint="Percentual médio de lançamentos conciliados automaticamente."
            />
          </KpiGrid>

          <div className="grid gap-4 lg:grid-cols-3">
            <SectionCard
              className="lg:col-span-2"
              title="Competências no filtro"
              description="Uma linha por cliente e competência. Abra para conferir os lançamentos."
              flush
              actions={
                <Link
                  to="/competencias"
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Gerenciar competências <ArrowUpRight className="size-3" />
                </Link>
              }
            >
              <DataTable
                rows={mr.comps}
                columns={colunasComps}
                rowKey={(c) => c.id}
                loading={isLoading}
                dense
                defaultSort={{ key: "taxa", dir: "asc" }}
                emptyTitle="Nenhuma competência no filtro"
                emptyHint="Crie a competência do mês em Competências ou ajuste os filtros."
              />
            </SectionCard>

            <div className="space-y-4">
              <SectionCard
                title="Qualidade da conciliação"
                description="Quantas competências estão em cada faixa de conciliação automática."
              >
                {(() => {
                  const total = mr.faixas.reduce((a, d) => a + d.value, 0);
                  return (
                    <div className="flex items-center gap-5">
                      <Donut
                        data={mr.faixas}
                        size={130}
                        center={{ value: String(total), label: "com taxa" }}
                      />
                      <div className="flex-1">
                        <Legend items={mr.faixas.map((f) => ({ ...f, value: f.value }))} />
                      </div>
                    </div>
                  );
                })()}
              </SectionCard>

              <SectionCard
                title="Sem competência criada"
                description="Clientes ativos que ainda não têm a competência selecionada. Crie em Competências para começar a conciliar."
                actions={
                  <span className="text-xs font-semibold text-muted-foreground">
                    {mr.semCompetencia.length}
                  </span>
                }
              >
                {competenciaSel === TODOS ? (
                  <p className="py-2 text-center text-xs text-muted-foreground">
                    Selecione uma competência para ver quem ainda não tem período criado.
                  </p>
                ) : mr.semCompetencia.length === 0 ? (
                  <EmptyState icon={CheckCircle2} title="Todos têm competência" compact />
                ) : (
                  <div className="divide-y divide-border/40">
                    {mr.semCompetencia.slice(0, 6).map((c) => (
                      <Link
                        key={c.id}
                        to="/clientes/$clienteId"
                        params={{ clienteId: c.id }}
                        className="flex items-center gap-2 py-2 text-xs font-medium hover:underline"
                      >
                        <CalendarRange className="size-3.5 text-muted-foreground" />
                        <span className="truncate">{nomeCliente(c)}</span>
                      </Link>
                    ))}
                    {mr.semCompetencia.length > 6 && (
                      <p className="pt-2 text-center text-[0.6875rem] text-muted-foreground">
                        + {mr.semCompetencia.length - 6} clientes
                      </p>
                    )}
                  </div>
                )}
              </SectionCard>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════ PENDÊNCIAS ═══════════════════════════ */}
      {aba === "pendencias" && (
        <>
          <FilterBar className="rounded-lg border border-border/60 bg-card px-3 py-2">
            <Segmented
              value={tipoPend}
              onChange={setTipoPend}
              items={[
                { value: "todas", label: "Todas" },
                { value: "envio", label: "Sem envio" },
                { value: "erro", label: "Com erro" },
                { value: "atrasadas", label: "Atrasadas" },
              ]}
            />
            {filtroCliente}
            {limparFiltros}
          </FilterBar>

          <KpiGrid cols={4}>
            <KpiCard
              label="Total de pendências"
              value={mp.total}
              tone={mp.total > 0 ? "danger" : "success"}
              loading={isLoading}
              footer={mp.total === 0 ? "tudo em dia" : "itens que precisam de ação"}
              hint="Soma de clientes sem envio no mês, documentos com erro e competências atrasadas."
              onClick={() => setTipoPend("todas")}
              active={tipoPend === "todas"}
            />
            <KpiCard
              label="Sem envio no mês"
              value={mp.semEnvio.length}
              tone={mp.semEnvio.length > 0 ? "warning" : "neutral"}
              loading={isLoading}
              footer={`competência ${formatarCompetencia(`${mesAtual()}-01`)}`}
              hint="Clientes ativos que ainda não enviaram nenhum documento neste mês."
              onClick={() => setTipoPend("envio")}
              active={tipoPend === "envio"}
            />
            <KpiCard
              label="Documentos com erro"
              value={mp.erros.length}
              tone={mp.erros.length > 0 ? "danger" : "neutral"}
              loading={isLoading}
              footer="reprocessar ou substituir"
              hint="Arquivos que a leitura automática não conseguiu processar."
              onClick={() => setTipoPend("erro")}
              active={tipoPend === "erro"}
            />
            <KpiCard
              label="Competências atrasadas"
              value={mp.atrasadas.length}
              tone={mp.atrasadas.length > 0 ? "warning" : "neutral"}
              loading={isLoading}
              footer="de meses anteriores, não fechadas"
              hint="Competências de meses passados que ainda não foram fechadas."
              onClick={() => setTipoPend("atrasadas")}
              active={tipoPend === "atrasadas"}
            />
          </KpiGrid>

          <div className="grid gap-4 lg:grid-cols-3">
            {(tipoPend === "todas" || tipoPend === "envio") && (
              <SectionCard
                title="Clientes sem envio no mês"
                description="Use 'Cobrar' para abrir o WhatsApp com a mensagem e o link de upload prontos."
                actions={
                  <span
                    className={`text-xs font-semibold ${mp.semEnvio.length ? "text-warning-foreground" : "text-success"}`}
                  >
                    {mp.semEnvio.length} clientes
                  </span>
                }
              >
                {mp.semEnvio.length === 0 && !isLoading ? (
                  <EmptyState
                    icon={CheckCircle2}
                    title="Todos enviaram"
                    hint="Cada cliente ativo já mandou ao menos um documento este mês."
                    compact
                  />
                ) : (
                  <div className="divide-y divide-border/40">
                    {mp.semEnvio.slice(0, 10).map((c) => {
                      const nome = nomeCliente(c);
                      const link =
                        c.upload_token && typeof window !== "undefined"
                          ? `${window.location.origin}/upload/${c.upload_token}`
                          : null;
                      const msg = mensagemCobranca(
                        nome,
                        mesAtual(),
                        empresa?.nome ?? "P&A Contabilidade Digital",
                        link,
                      );
                      return (
                        <div key={c.id} className="flex items-center gap-3 py-2">
                          <span className="size-1.5 shrink-0 rounded-full bg-warning" />
                          <Link
                            to="/clientes/$clienteId"
                            params={{ clienteId: c.id }}
                            className="min-w-0 flex-1 truncate text-xs font-medium hover:underline"
                          >
                            {nome}
                          </Link>
                          <a
                            href={linkWhatsApp(c.telefone, msg)}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 rounded-md bg-success/10 px-2 py-1 text-[0.6875rem] font-semibold text-success hover:bg-success/20"
                          >
                            <MessageCircle className="size-3" /> Cobrar
                          </a>
                        </div>
                      );
                    })}
                    {mp.semEnvio.length > 10 && (
                      <Link
                        to="/clientes"
                        search={{ filtro: "pendentes" }}
                        className="block pt-2 text-center text-xs font-medium text-primary hover:underline"
                      >
                        Ver todos os {mp.semEnvio.length} pendentes
                      </Link>
                    )}
                  </div>
                )}
              </SectionCard>
            )}

            {(tipoPend === "todas" || tipoPend === "erro") && (
              <SectionCard
                title="Documentos com erro"
                description="A leitura automática falhou. Reprocesse ou peça um novo arquivo ao cliente."
                actions={
                  <Link
                    to="/documentos"
                    search={{ aba: "erro" }}
                    className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    Resolver <ArrowUpRight className="size-3" />
                  </Link>
                }
              >
                {mp.erros.length === 0 && !isLoading ? (
                  <EmptyState icon={CheckCircle2} title="Nenhum documento com erro" compact />
                ) : (
                  <div className="divide-y divide-border/40">
                    {mp.erros.slice(0, 10).map((d) => (
                      <div key={d.id} className="flex items-start gap-2.5 py-2">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-destructive" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-medium">
                            {d.nome_original ?? "Documento"}
                          </div>
                          <div className="truncate text-[0.6875rem] text-muted-foreground">
                            {nomeCliente(d.clientes)} · {d.erro_motivo ?? "Erro no processamento"}
                          </div>
                        </div>
                      </div>
                    ))}
                    {mp.erros.length > 10 && (
                      <p className="pt-2 text-center text-[0.6875rem] text-muted-foreground">
                        + {mp.erros.length - 10} documentos
                      </p>
                    )}
                  </div>
                )}
              </SectionCard>
            )}

            {(tipoPend === "todas" || tipoPend === "atrasadas") && (
              <SectionCard
                title="Competências atrasadas"
                description="Meses anteriores ainda abertos ou em conciliação. Feche para liberar os relatórios."
                actions={
                  <Link
                    to="/competencias"
                    className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    Competências <ArrowUpRight className="size-3" />
                  </Link>
                }
              >
                {mp.atrasadas.length === 0 && !isLoading ? (
                  <EmptyState icon={CheckCircle2} title="Nenhuma competência atrasada" compact />
                ) : (
                  <div className="divide-y divide-border/40">
                    {mp.atrasadas.slice(0, 10).map((c) => (
                      <Link
                        key={c.id}
                        to="/conciliacao"
                        search={{ cliente: c.cliente_id, competencia: c.id }}
                        className="flex items-center gap-3 py-2 hover:bg-muted/40"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-medium">
                            {nomeCliente(c.clientes)}
                          </div>
                          <div className="text-[0.6875rem] text-muted-foreground">
                            {formatarCompetencia(c.mes_ano)}
                          </div>
                        </div>
                        {pillCompetencia(c.status, "xs")}
                        <span className="w-9 text-right text-xs font-semibold tabular-nums">
                          {c.taxa_conciliacao == null ? "—" : `${Math.round(c.taxa_conciliacao)}%`}
                        </span>
                      </Link>
                    ))}
                    {mp.atrasadas.length > 10 && (
                      <p className="pt-2 text-center text-[0.6875rem] text-muted-foreground">
                        + {mp.atrasadas.length - 10} competências
                      </p>
                    )}
                  </div>
                )}
              </SectionCard>
            )}
          </div>
        </>
      )}
    </div>
  );
}
