import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Brain,
  CalendarRange,
  CheckCircle2,
  FileBarChart2,
  FileText,
  Hourglass,
  MessageCircle,
  Scale,
  Upload,
  UserMinus,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil, useEmpresa } from "@/hooks/use-perfil";
import { Button } from "@/components/ui/button";
import {
  AreaTrend,
  Bars,
  CHART_COLORS,
  DataTable,
  Donut,
  EmptyState,
  KpiCard,
  KpiGrid,
  Legend,
  PageHeader,
  ProgressBar,
  SectionCard,
  Segmented,
  pillDocumento,
  type Column,
} from "@/components/ui-kit";
import { formatarCompetencia, formatarDataHora, mesAtual } from "@/lib/formatadores";
import { rotuloTipo } from "@/lib/dominio";
import { linkWhatsApp, mensagemCobranca } from "@/lib/cobranca";

export const Route = createFileRoute("/_authenticated/empresas/$id/")({
  head: () => ({
    meta: [
      { title: "Dashboard — ConcilIA" },
      {
        name: "description",
        content: "Visão operacional: documentos, fila, erros, conciliação e fechamento do mês.",
      },
    ],
  }),
  component: EmpresaDashboard,
});

type Periodo = "7" | "30" | "90";

type Doc = {
  id: string;
  nome_original: string | null;
  tipo: string | null;
  status_processamento: string;
  enviado_em: string;
  cliente_id: string;
  clientes: { nome_fantasia: string | null; nome: string | null } | null;
};

function diasAtras(n: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

function chaveDia(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function EmpresaDashboard() {
  const { id: empresaId } = Route.useParams();
  const { data: perfil } = usePerfil();
  const { data: empresa } = useEmpresa(empresaId);
  const [periodo, setPeriodo] = useState<Periodo>("30");

  const { data, isLoading } = useQuery({
    queryKey: ["empresa-dashboard", empresaId],
    queryFn: async () => {
      const desde = diasAtras(180).toISOString();
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);
      const [docs, clientes, comps, auditoria, inativos, regras, relatoriosMes] = await Promise.all(
        [
          supabase
            .from("documentos")
            .select(
              "id, nome_original, tipo, status_processamento, enviado_em, cliente_id, clientes(nome_fantasia, nome)",
            )
            .is("deleted_at", null)
            .gte("enviado_em", desde)
            .order("enviado_em", { ascending: false }),
          supabase
            .from("clientes")
            .select("id, nome_fantasia, nome, telefone, upload_token, ativo")
            .eq("ativo", true)
            .is("deleted_at", null),
          supabase
            .from("competencias")
            .select(
              "id, status, mes_ano, taxa_conciliacao, cliente_id, clientes(nome_fantasia, nome)",
            )
            .is("deleted_at", null)
            .order("mes_ano", { ascending: false }),
          supabase
            .from("auditoria")
            .select("id, evento, usuario, created_at")
            .order("created_at", { ascending: false })
            .limit(8),
          supabase
            .from("clientes")
            .select("id", { count: "exact", head: true })
            .eq("ativo", false)
            .is("deleted_at", null),
          supabase
            .from("regras_aprendizado")
            .select("id", { count: "exact", head: true })
            .is("deleted_at", null),
          supabase
            .from("relatorios")
            .select("id", { count: "exact", head: true })
            .gte("created_at", inicioMes.toISOString())
            .is("deleted_at", null),
        ],
      );
      return {
        docs: (docs.data ?? []) as Doc[],
        auditoria: auditoria.data ?? [],
        clientesInativos: inativos.count ?? 0,
        regrasAprendidas: regras.count ?? 0,
        relatoriosMes: relatoriosMes.count ?? 0,
        clientes: clientes.data ?? [],
        comps: comps.data ?? [],
      };
    },
  });

  const m = useMemo(() => {
    const docs = data?.docs ?? [];
    const clientes = data?.clientes ?? [];
    const comps = data?.comps ?? [];
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
      const k = chaveDia(new Date(d.enviado_em));
      const row = porDia.get(k);
      if (!row) return;
      row.recebidos++;
      if (d.status_processamento === "processado") row.processados++;
      if (d.status_processamento === "erro") row.erros++;
    });
    const trend = Array.from(porDia.entries()).map(([k, v]) => {
      const [, mm, dd] = k.split("-");
      return { dia: `${dd}/${mm}`, ...v };
    });
    const sparkline = trend.map((t) => t.recebidos);

    const status = { recebido: 0, processando: 0, processado: 0, erro: 0 };
    docs.forEach((d) => {
      const s = d.status_processamento as keyof typeof status;
      if (s in status) status[s]++;
    });
    const fila = status.recebido + status.processando;

    const mesCorrente = `${mesAtual()}-01`;
    const compsMes = comps.filter((c) => c.mes_ano === mesCorrente);
    const abertas = comps.filter((c) => c.status === "aberta").length;
    const emConc = comps.filter((c) => c.status === "em_conciliacao");
    const fechadasMes = compsMes.filter((c) => c.status === "fechada").length;
    const comTaxa = comps.filter((c) => c.taxa_conciliacao != null);
    const taxaMedia = comTaxa.length
      ? comTaxa.reduce((a, c) => a + (c.taxa_conciliacao ?? 0), 0) / comTaxa.length
      : null;

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const clientesComDocMes = new Set(
      docs.filter((d) => new Date(d.enviado_em) >= inicioMes).map((d) => d.cliente_id),
    );
    const pendentes = clientes.filter((c) => !clientesComDocMes.has(c.id));
    const coberturaPct = clientes.length ? (clientesComDocMes.size / clientes.length) * 100 : 0;

    const porCliente = new Map<string, number>();
    noPeriodo.forEach((d) => {
      const nome = d.clientes?.nome_fantasia ?? d.clientes?.nome ?? "—";
      porCliente.set(nome, (porCliente.get(nome) ?? 0) + 1);
    });
    const topClientes = Array.from(porCliente.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([cliente, total]) => ({ cliente, total }));

    return {
      noPeriodo: noPeriodo.length,
      delta,
      trend,
      sparkline,
      status,
      fila,
      abertas,
      emConc,
      fechadasMes,
      compsMes,
      taxaMedia,
      pendentes,
      coberturaPct,
      clientesAtivos: clientes.length,
      topClientes,
      ultimos: docs.slice(0, 8),
    };
  }, [data, periodo]);

  const firstName = perfil?.nome?.split(" ")[0] ?? "equipe";
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  const donut = [
    { name: "Processados", value: m.status.processado, color: CHART_COLORS.success },
    { name: "Na fila", value: m.fila, color: CHART_COLORS.warning },
    { name: "Com erro", value: m.status.erro, color: CHART_COLORS.danger },
  ];
  const totalDocs = donut.reduce((a, d) => a + d.value, 0);

  const colunas: Column<Doc>[] = [
    {
      key: "arquivo",
      header: "Arquivo",
      cell: (d) => (
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary">
            <FileText className="size-3.5" />
          </span>
          <div className="min-w-0">
            <div className="truncate font-medium">{d.nome_original ?? "Arquivo"}</div>
            <div className="truncate text-[0.6875rem] text-muted-foreground">
              {rotuloTipo(d.tipo)}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "cliente",
      header: "Cliente",
      hideBelow: "md",
      cell: (d) => (
        <span className="text-muted-foreground">
          {d.clientes?.nome_fantasia ?? d.clientes?.nome ?? "—"}
        </span>
      ),
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

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={empresa?.nome}
        title={`${saudacao}, ${firstName}`}
        description="Visão operacional da empresa: recebimento, processamento, conciliação e fechamento do mês."
        actions={
          <>
            <Segmented
              value={periodo}
              onChange={setPeriodo}
              items={[
                { value: "7", label: "7 dias" },
                { value: "30", label: "30 dias" },
                { value: "90", label: "90 dias" },
              ]}
            />
            <Button asChild size="sm" className="h-8 rounded-lg">
              <Link to="/empresas/$id/documentos" params={{ id: empresaId }} search={{ novo: "1" }}>
                <Upload className="size-3.5" /> Upload manual
              </Link>
            </Button>
          </>
        }
      />

      <KpiGrid cols={6}>
        <KpiCard
          label="Clientes ativos"
          value={m.clientesAtivos}
          icon={Users}
          tone="primary"
          loading={isLoading}
          progress={m.coberturaPct}
          footer={`${Math.round(m.coberturaPct)}% já enviaram este mês`}
          hint="Clientes ativos e o percentual que já enviou ao menos um documento no mês corrente."
        />
        <KpiCard
          label={`Documentos · ${periodo}d`}
          value={m.noPeriodo}
          icon={FileText}
          tone="accent"
          loading={isLoading}
          delta={m.delta}
          deltaLabel="vs. período anterior"
          sparkline={m.sparkline}
          hint="Documentos recebidos no período selecionado, comparados ao período imediatamente anterior."
        />
        <KpiCard
          label="Na fila"
          value={m.fila}
          icon={Hourglass}
          tone={m.fila > 0 ? "warning" : "neutral"}
          loading={isLoading}
          footer="recebidos + processando"
          hint="Documentos aguardando leitura automática ou em processamento pela IA."
        />
        <KpiCard
          label="Com erro"
          value={m.status.erro}
          icon={AlertTriangle}
          tone={m.status.erro > 0 ? "danger" : "neutral"}
          loading={isLoading}
          footer={m.status.erro > 0 ? "precisam de atenção" : "nenhum erro"}
          hint="Documentos que a leitura automática não conseguiu processar. Reprocesse ou substitua o arquivo."
        />
        <KpiCard
          label="Competências abertas"
          value={m.abertas}
          icon={CalendarRange}
          tone="primary"
          loading={isLoading}
          footer={`${m.emConc.length} em conciliação`}
          hint="Períodos contábeis ainda não fechados em todos os clientes."
        />
        <KpiCard
          label="Conciliação média"
          value={m.taxaMedia == null ? "—" : `${Math.round(m.taxaMedia)}%`}
          icon={Scale}
          tone={m.taxaMedia != null && m.taxaMedia >= 80 ? "success" : "warning"}
          loading={isLoading}
          progress={m.taxaMedia ?? 0}
          hint="Percentual médio de lançamentos conciliados automaticamente entre banco e contabilidade."
        />
      </KpiGrid>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Recebimento de documentos"
          description="Volume diário recebido no período. As faixas mostram quantos foram processados com sucesso e quantos deram erro."
          icon={FileText}
          actions={
            <Link
              to="/empresas/$id/documentos"
              params={{ id: empresaId }}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Ver documentos <ArrowUpRight className="size-3" />
            </Link>
          }
        >
          {m.noPeriodo === 0 && !isLoading ? (
            <EmptyState
              icon={FileText}
              title="Nenhum documento no período"
              hint="Quando os clientes enviarem arquivos, o gráfico aparece aqui."
              compact
            />
          ) : (
            <AreaTrend
              data={m.trend}
              xKey="dia"
              height={230}
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
          description="Distribuição de todos os documentos dos últimos 6 meses por situação."
          icon={Scale}
        >
          <div className="flex items-center gap-5">
            <Donut
              data={donut}
              size={150}
              center={{ value: String(totalDocs), label: "documentos" }}
            />
            <div className="flex-1">
              <Legend
                items={donut.map((d) => ({
                  ...d,
                  value: totalDocs
                    ? `${d.value} · ${Math.round((d.value / totalDocs) * 100)}%`
                    : "0",
                }))}
              />
              <div className="mt-4 rounded-lg bg-muted/60 px-3 py-2 text-[0.6875rem] text-muted-foreground">
                {m.status.erro > 0 ? (
                  <Link
                    to="/empresas/$id/documentos"
                    params={{ id: empresaId }}
                    search={{ aba: "erro" }}
                    className="font-medium text-destructive hover:underline"
                  >
                    Resolver {m.status.erro} com erro →
                  </Link>
                ) : (
                  "Sem documentos com erro."
                )}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          title={`Fechamento · ${formatarCompetencia(`${mesAtual()}-01`)}`}
          description="Andamento das competências do mês corrente. Cada cliente precisa chegar a 'fechada' para o pacote de relatórios sair."
          icon={CalendarRange}
          actions={
            <Link
              to="/empresas/$id/competencias"
              params={{ id: empresaId }}
              className="text-xs font-medium text-primary hover:underline"
            >
              Gerenciar
            </Link>
          }
        >
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                label: "Abertas",
                v: m.compsMes.filter((c) => c.status === "aberta").length,
                cls: "text-success",
              },
              {
                label: "Conciliando",
                v: m.compsMes.filter((c) => c.status === "em_conciliacao").length,
                cls: "text-warning-foreground",
              },
              { label: "Fechadas", v: m.fechadasMes, cls: "text-muted-foreground" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg bg-muted/50 px-3 py-2">
                <div className={`text-lg font-bold tabular-nums ${s.cls}`}>{s.v}</div>
                <div className="text-[0.6875rem] text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <ProgressBar
              value={m.compsMes.length ? (m.fechadasMes / m.compsMes.length) * 100 : 0}
              tone="success"
            />
            <div className="mt-1 text-[0.6875rem] text-muted-foreground">
              {m.fechadasMes} de {m.compsMes.length} competências fechadas
            </div>
          </div>
          <div className="mt-4 divide-y divide-border/40">
            {m.emConc.slice(0, 4).map((c) => (
              <Link
                key={c.id}
                to="/empresas/$id/conciliacao"
                params={{ id: empresaId }}
                search={{ cliente: c.cliente_id, competencia: c.id }}
                className="flex items-center gap-3 py-2 hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">
                    {c.clientes?.nome_fantasia ?? c.clientes?.nome}
                  </div>
                  <div className="text-[0.6875rem] text-muted-foreground">
                    {formatarCompetencia(c.mes_ano)}
                  </div>
                </div>
                <div className="w-20">
                  <ProgressBar value={c.taxa_conciliacao ?? 0} tone="warning" />
                </div>
                <span className="w-9 text-right text-xs font-semibold tabular-nums">
                  {Math.round(c.taxa_conciliacao ?? 0)}%
                </span>
              </Link>
            ))}
            {m.emConc.length === 0 && !isLoading && (
              <p className="py-3 text-center text-xs text-muted-foreground">
                Nenhuma competência em conciliação.
              </p>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Pendências de envio"
          description="Clientes ativos que ainda não enviaram nenhum documento no mês corrente. Use 'Cobrar' para abrir o WhatsApp com a mensagem pronta."
          icon={MessageCircle}
          actions={
            <span
              className={`text-xs font-semibold ${m.pendentes.length ? "text-warning-foreground" : "text-success"}`}
            >
              {m.pendentes.length} clientes
            </span>
          }
        >
          {m.pendentes.length === 0 && !isLoading ? (
            <EmptyState
              icon={CheckCircle2}
              title="Todos enviaram"
              hint="Cada cliente ativo já mandou ao menos um documento este mês."
              compact
            />
          ) : (
            <div className="divide-y divide-border/40">
              {m.pendentes.slice(0, 6).map((c) => {
                const nome = c.nome_fantasia ?? c.nome ?? "Cliente";
                const link =
                  c.upload_token && typeof window !== "undefined"
                    ? `${window.location.origin}/upload/${c.upload_token}`
                    : null;
                const msg = mensagemCobranca(nome, mesAtual(), empresa?.nome ?? "ConcilIA", link);
                return (
                  <div key={c.id} className="flex items-center gap-3 py-2">
                    <span className="size-1.5 shrink-0 rounded-full bg-warning" />
                    <Link
                      to="/empresas/$id/clientes/$clienteId"
                      params={{ id: empresaId, clienteId: c.id }}
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
              {m.pendentes.length > 6 && (
                <Link
                  to="/empresas/$id/clientes"
                  params={{ id: empresaId }}
                  search={{ filtro: "pendentes" }}
                  className="block pt-2 text-center text-xs font-medium text-primary hover:underline"
                >
                  Ver todos os {m.pendentes.length} pendentes
                </Link>
              )}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Documentos por cliente"
          description="Clientes que mais enviaram no período selecionado."
          icon={Users}
        >
          {m.topClientes.length === 0 ? (
            <EmptyState icon={Users} title="Sem envios no período" compact />
          ) : (
            <Bars
              data={m.topClientes}
              xKey="cliente"
              horizontal
              height={Math.max(160, m.topClientes.length * 34)}
              series={[{ key: "total", label: "Documentos", color: CHART_COLORS.primary }]}
            />
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Últimos documentos recebidos"
          icon={FileText}
          flush
          actions={
            <Link
              to="/empresas/$id/documentos"
              params={{ id: empresaId }}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Ver todos <ArrowUpRight className="size-3" />
            </Link>
          }
        >
          <DataTable
            rows={m.ultimos}
            columns={colunas}
            rowKey={(d) => d.id}
            loading={isLoading}
            dense
            emptyTitle="Nenhum documento recebido ainda"
            emptyHint="Cadastre um cliente e compartilhe o link de upload."
          />
        </SectionCard>

        <SectionCard
          title="Atividade recente"
          description="Últimos eventos registrados na auditoria e indicadores rápidos da operação."
          icon={Activity}
        >
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                icone: Brain,
                v: data?.regrasAprendidas ?? 0,
                l: "regras aprendidas",
                cls: "text-primary",
              },
              {
                icone: FileBarChart2,
                v: data?.relatoriosMes ?? 0,
                l: "relatórios no mês",
                cls: "text-accent",
              },
              {
                icone: UserMinus,
                v: data?.clientesInativos ?? 0,
                l: "clientes inativos",
                cls: "text-muted-foreground",
              },
            ].map(({ icone: Icone, v, l, cls }) => (
              <div key={l} className="rounded-lg bg-muted/50 px-2.5 py-2">
                <Icone className={`size-3.5 ${cls}`} />
                <div className={`mt-1 text-lg font-bold leading-none tabular-nums ${cls}`}>{v}</div>
                <div className="mt-1 text-[0.625rem] leading-tight text-muted-foreground">{l}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 divide-y divide-border/40">
            {(data?.auditoria ?? []).length === 0 && !isLoading && (
              <p className="py-3 text-center text-xs text-muted-foreground">
                Nenhuma atividade registrada ainda.
              </p>
            )}
            {(data?.auditoria ?? []).map((evt) => (
              <div key={evt.id} className="flex items-start gap-2.5 py-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{evt.evento}</div>
                  <div className="text-[0.6875rem] text-muted-foreground">
                    {evt.usuario ?? "Sistema"} · {formatarDataHora(evt.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
