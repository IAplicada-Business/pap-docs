import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  ChevronRight,
  Lock,
  PlayCircle,
  Scale,
  ShieldAlert,
  Sparkles,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil } from "@/hooks/use-perfil";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  CHART_COLORS,
  ConfidenceBar,
  DataTable,
  Donut,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  Legend,
  PageHeader,
  SearchInput,
  SectionCard,
  SubTabs,
  pillCompetencia,
  pillLancamento,
  type Column,
} from "@/components/ui-kit";
import { formatarCompetencia, formatarData, formatarMoeda } from "@/lib/formatadores";

type Search = { cliente?: string | undefined; competencia?: string | undefined };

export const Route = createFileRoute("/_authenticated/conciliacao")({
  validateSearch: (s: Record<string, unknown>): Search => {
    const out: Search = {};
    if (typeof s["cliente"] === "string") out.cliente = s["cliente"];
    if (typeof s["competencia"] === "string") out.competencia = s["competencia"];
    return out;
  },
  head: () => ({
    meta: [
      { title: "Conciliação — P&A Contabilidade Digital" },
      {
        name: "description",
        content:
          "Tela única de conferência entre extrato bancário e lançamentos contábeis, com aprendizado das correções.",
      },
    ],
  }),
  component: ConciliacaoPage,
});

type Aba = "pendente" | "classificado" | "conciliado" | "todos";

type Lanc = {
  id: string;
  data: string;
  descricao: string | null;
  valor: number;
  status: string;
  confianca_ia: number | null;
  conta_debito: string | null;
  conta_credito: string | null;
  documento_id: string | null;
};

type Conta = { id: string; codigo: string; descricao: string; tipo: string | null };

function normalizarPadrao(descricao: string) {
  return descricao
    .toUpperCase()
    .replace(/\d{2}\/\d{2}(\/\d{2,4})?/g, "")
    .replace(/[\d.,-]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function ConciliacaoPage() {
  const { orgId: empresaId } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: perfil } = usePerfil();
  const queryClient = useQueryClient();

  const [aba, setAba] = useState<Aba>("pendente");
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const clienteId = search.cliente ?? "";
  const competenciaId = search.competencia ?? "";
  const setSel = (patch: Partial<Search>) =>
    navigate({ search: (prev: Search) => ({ ...prev, ...patch }) });

  const { data: clientes } = useQuery({
    queryKey: ["clientes-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome_fantasia, nome")
        .is("deleted_at", null)
        .order("nome_fantasia");
      if (error) throw error;
      return data;
    },
  });

  const { data: competencias } = useQuery({
    queryKey: ["cliente-competencias", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competencias")
        .select("id, mes_ano, status, taxa_conciliacao")
        .eq("cliente_id", clienteId)
        .is("deleted_at", null)
        .order("mes_ano", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!clienteId && clientes && clientes.length > 0 && clientes[0])
      setSel({ cliente: clientes[0].id });
  }, [clienteId, clientes]);

  useEffect(() => {
    if (!competencias || competencias.length === 0) return;
    if (competenciaId && competencias.some((c) => c.id === competenciaId)) return;
    const alvo = competencias.find((c) => c.status !== "fechada") ?? competencias[0];
    if (alvo) setSel({ competencia: alvo.id });
  }, [competencias, competenciaId]);

  const competencia = competencias?.find((c) => c.id === competenciaId) ?? null;

  const { data: lancamentos, isLoading } = useQuery({
    queryKey: ["lancamentos", competenciaId],
    enabled: !!competenciaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lancamentos")
        .select(
          "id, data, descricao, valor, status, confianca_ia, conta_debito, conta_credito, documento_id",
        )
        .eq("competencia_id", competenciaId)
        .is("deleted_at", null)
        .order("data", { ascending: false });
      if (error) throw error;
      return data as Lanc[];
    },
  });

  const { data: contas } = useQuery({
    queryKey: ["plano-contas", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plano_contas")
        .select("id, codigo, descricao, tipo")
        .eq("cliente_id", clienteId)
        .is("deleted_at", null)
        .eq("ativo", true)
        .order("codigo");
      if (error) throw error;
      return data as Conta[];
    },
  });

  const { data: regras } = useQuery({
    queryKey: ["regras", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("regras_aprendizado")
        .select("id, padrao_descricao, conta_destino, aplicacoes, origem_regra, created_at")
        .eq("cliente_id", clienteId)
        .is("deleted_at", null)
        .order("aplicacoes", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const m = useMemo(() => {
    const all = lancamentos ?? [];
    const conc = all.filter((l) => l.status === "conciliado" || l.status === "revisado").length;
    const pend = all.filter((l) => l.status === "pendente").length;
    const clas = all.filter((l) => l.status === "classificado").length;
    const baixa = all.filter(
      (l) =>
        l.confianca_ia != null &&
        (l.confianca_ia <= 1 ? l.confianca_ia * 100 : l.confianca_ia) < 60 &&
        l.status !== "conciliado" &&
        l.status !== "revisado",
    ).length;
    const taxa = all.length ? (conc / all.length) * 100 : 0;
    const entradas = all.filter((l) => l.valor > 0).reduce((a, l) => a + l.valor, 0);
    const saidas = all.filter((l) => l.valor < 0).reduce((a, l) => a + Math.abs(l.valor), 0);
    return { total: all.length, conc, pend, clas, baixa, taxa, entradas, saidas };
  }, [lancamentos]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (lancamentos ?? []).filter((l) => {
      if (aba === "pendente" && l.status !== "pendente") return false;
      if (aba === "classificado" && l.status !== "classificado") return false;
      if (aba === "conciliado" && !(l.status === "conciliado" || l.status === "revisado"))
        return false;
      if (
        termo &&
        !`${l.descricao ?? ""} ${l.conta_debito ?? ""} ${l.conta_credito ?? ""}`
          .toLowerCase()
          .includes(termo)
      )
        return false;
      return true;
    });
  }, [lancamentos, aba, busca]);

  async function atualizarTaxa() {
    if (!competenciaId) return;
    const { data } = await supabase
      .from("lancamentos")
      .select("status")
      .eq("competencia_id", competenciaId)
      .is("deleted_at", null);
    const all = data ?? [];
    const conc = all.filter((l) => l.status === "conciliado" || l.status === "revisado").length;
    const taxa = all.length ? Math.round((conc / all.length) * 100) : 0;
    await supabase.from("competencias").update({ taxa_conciliacao: taxa }).eq("id", competenciaId);
    queryClient.invalidateQueries({ queryKey: ["cliente-competencias", clienteId] });
    queryClient.invalidateQueries({ queryKey: ["competencias"] });
  }

  const confirmar = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("lancamentos")
        .update({ status: "conciliado" })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: async (_, ids) => {
      toast.success(
        ids.length > 1 ? `${ids.length} lançamentos conciliados` : "Lançamento conciliado",
      );
      setSelecionados(new Set());
      queryClient.invalidateQueries({ queryKey: ["lancamentos", competenciaId] });
      await atualizarTaxa();
    },
    onError: (e: Error) => toast.error("Não foi possível conciliar", { description: e.message }),
  });

  const corrigirConta = useMutation({
    mutationFn: async ({
      lanc,
      campo,
      conta,
    }: {
      lanc: Lanc;
      campo: "conta_debito" | "conta_credito";
      conta: string;
    }) => {
      if (!perfil) throw new Error("Perfil não carregado.");
      const patch =
        campo === "conta_debito"
          ? { conta_debito: conta, status: "revisado" }
          : { conta_credito: conta, status: "revisado" };
      const { error } = await supabase.from("lancamentos").update(patch).eq("id", lanc.id);
      if (error) throw error;
      const padrao = normalizarPadrao(lanc.descricao ?? "");
      if (padrao.length < 3) return { padrao: null };
      const { data: existente } = await supabase
        .from("regras_aprendizado")
        .select("id, aplicacoes")
        .eq("cliente_id", clienteId)
        .eq("padrao_descricao", padrao)
        .is("deleted_at", null)
        .maybeSingle();
      if (existente) {
        await supabase
          .from("regras_aprendizado")
          .update({ conta_destino: conta, aplicacoes: existente.aplicacoes + 1 })
          .eq("id", existente.id);
      } else {
        await supabase.from("regras_aprendizado").insert({
          org_id: perfil.org_id,
          cliente_id: clienteId,
          padrao_descricao: padrao,
          conta_destino: conta,
          origem_regra: "manual",
          aplicacoes: 1,
        });
      }
      return { padrao };
    },
    onSuccess: async (r) => {
      toast.success("Conta corrigida", {
        description: r.padrao ? `Regra aprendida para "${r.padrao}"` : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["lancamentos", competenciaId] });
      queryClient.invalidateQueries({ queryKey: ["regras", clienteId] });
      await atualizarTaxa();
    },
    onError: (e: Error) => toast.error("Não foi possível corrigir", { description: e.message }),
  });

  const removerRegra = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("regras_aprendizado")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Regra removida");
      queryClient.invalidateQueries({ queryKey: ["regras", clienteId] });
    },
  });

  const mudarStatusComp = useMutation({
    mutationFn: async (status: "em_conciliacao" | "fechada" | "aberta") => {
      const fechando = status === "fechada";
      const { error } = await supabase
        .from("competencias")
        .update({
          status,
          fechada_em: fechando ? new Date().toISOString() : null,
          fechada_por: fechando ? (perfil?.id ?? null) : null,
        })
        .eq("id", competenciaId);
      if (error) throw error;
    },
    onSuccess: (_, s) => {
      toast.success(
        s === "fechada"
          ? "Competência fechada"
          : s === "em_conciliacao"
            ? "Conciliação iniciada"
            : "Competência reaberta",
      );
      queryClient.invalidateQueries({ queryKey: ["cliente-competencias", clienteId] });
      queryClient.invalidateQueries({ queryKey: ["competencias"] });
    },
    onError: (e: Error) => toast.error("Não foi possível alterar", { description: e.message }),
  });

  const fechada = competencia?.status === "fechada";

  const SelectConta = ({
    lanc,
    campo,
  }: {
    lanc: Lanc;
    campo: "conta_debito" | "conta_credito";
  }) => {
    const atual = lanc[campo] ?? "";
    return (
      <Select
        value={atual}
        onValueChange={(v) => corrigirConta.mutate({ lanc, campo, conta: v })}
        disabled={fechada}
      >
        <SelectTrigger
          className={`h-7 w-full min-w-[140px] rounded-md border-transparent bg-transparent px-1.5 text-xs hover:border-border ${!atual ? "text-muted-foreground" : ""}`}
        >
          <SelectValue placeholder="Definir conta" />
        </SelectTrigger>
        <SelectContent>
          {(contas ?? []).length === 0 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              Nenhuma conta no plano do cliente.
            </div>
          )}
          {(contas ?? []).map((c) => (
            <SelectItem key={c.id} value={c.codigo}>
              <span className="font-mono text-[0.6875rem] text-primary">{c.codigo}</span>{" "}
              <span className="ml-1.5">{c.descricao}</span>
            </SelectItem>
          ))}
          {atual && !(contas ?? []).some((c) => c.codigo === atual) && (
            <SelectItem value={atual}>{atual}</SelectItem>
          )}
        </SelectContent>
      </Select>
    );
  };

  const colunas: Column<Lanc>[] = [
    {
      key: "data",
      header: "Data",
      width: "92px",
      sortValue: (l) => l.data,
      cell: (l) => (
        <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
          {formatarData(l.data)}
        </span>
      ),
    },
    {
      key: "descricao",
      header: "Descrição",
      sortValue: (l) => l.descricao ?? "",
      cell: (l) => (
        <div className="min-w-0">
          <div className="max-w-[320px] truncate font-medium" title={l.descricao ?? ""}>
            {l.descricao ?? "Lançamento"}
          </div>
          {l.documento_id && (
            <div className="text-[0.6875rem] text-muted-foreground">origem: documento</div>
          )}
        </div>
      ),
    },
    {
      key: "valor",
      header: "Valor",
      align: "right",
      sortValue: (l) => l.valor,
      cell: (l) => (
        <span
          className={`whitespace-nowrap font-semibold tabular-nums ${l.valor < 0 ? "text-destructive" : "text-success"}`}
        >
          {formatarMoeda(l.valor)}
        </span>
      ),
    },
    {
      key: "debito",
      header: "Débito",
      hideBelow: "lg",
      cell: (l) => <SelectConta lanc={l} campo="conta_debito" />,
    },
    {
      key: "credito",
      header: "Crédito",
      hideBelow: "lg",
      cell: (l) => <SelectConta lanc={l} campo="conta_credito" />,
    },
    {
      key: "ia",
      header: "Confiança IA",
      hideBelow: "md",
      sortValue: (l) => l.confianca_ia ?? -1,
      cell: (l) => <ConfidenceBar value={l.confianca_ia} />,
    },
    {
      key: "status",
      header: "Status",
      sortValue: (l) => l.status,
      cell: (l) => pillLancamento(l.status, "xs"),
    },
    {
      key: "acoes",
      header: "",
      align: "right",
      cell: (l) =>
        l.status === "conciliado" || l.status === "revisado" || fechada ? null : (
          <Button
            size="sm"
            variant="outline"
            className="h-7 rounded-md px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              confirmar.mutate([l.id]);
            }}
          >
            <Check className="size-3" /> Confirmar
          </Button>
        ),
    },
  ];

  const donut = [
    { name: "Conciliados", value: m.conc, color: CHART_COLORS.success },
    { name: "Classificados", value: m.clas, color: CHART_COLORS.primary },
    { name: "Pendentes", value: m.pend, color: CHART_COLORS.warning },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Conciliação"
        description="Conferência linha a linha entre o extrato do banco e a contabilidade. A IA classifica; você confirma ou corrige — e cada correção vira regra para os próximos meses."
        actions={
          <>
            <Select
              value={clienteId}
              onValueChange={(v) => setSel({ cliente: v, competencia: undefined })}
            >
              <SelectTrigger className="h-8 w-52 rounded-lg text-xs">
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                {(clientes ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome_fantasia ?? c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={competenciaId}
              onValueChange={(v) => setSel({ competencia: v })}
              disabled={!competencias?.length}
            >
              <SelectTrigger className="h-8 w-44 rounded-lg text-xs capitalize">
                <SelectValue placeholder="Competência" />
              </SelectTrigger>
              <SelectContent>
                {(competencias ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id} className="capitalize">
                    {formatarCompetencia(c.mes_ano)} ·{" "}
                    {c.status === "fechada"
                      ? "fechada"
                      : c.status === "em_conciliacao"
                        ? "conciliando"
                        : "aberta"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {competencia?.status === "aberta" && (
              <Button
                size="sm"
                className="h-8 rounded-lg"
                onClick={() => mudarStatusComp.mutate("em_conciliacao")}
              >
                <PlayCircle className="size-3.5" /> Iniciar conciliação
              </Button>
            )}
            {competencia?.status === "em_conciliacao" && (
              <Button
                size="sm"
                className="h-8 rounded-lg"
                onClick={() => mudarStatusComp.mutate("fechada")}
                disabled={m.pend > 0}
              >
                <Lock className="size-3.5" /> Fechar competência
              </Button>
            )}
            {fechada && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-lg"
                onClick={() => mudarStatusComp.mutate("aberta")}
              >
                Reabrir
              </Button>
            )}
          </>
        }
      />

      {!clienteId || !competenciaId ? (
        <SectionCard>
          <EmptyState
            icon={Scale}
            title={!clienteId ? "Selecione um cliente" : "Este cliente ainda não tem competências"}
            hint={
              !clienteId
                ? "Escolha o cliente e a competência para começar a conferência."
                : "As competências são criadas automaticamente quando documentos chegam, ou manualmente em Competências."
            }
            {...(clienteId
              ? {
                  action: (
                    <Button asChild size="sm" variant="outline" className="rounded-lg">
                      <Link to="/competencias">Ir para competências</Link>
                    </Button>
                  ),
                }
              : {})}
          />
        </SectionCard>
      ) : (
        <>
          <KpiGrid cols={5}>
            <KpiCard
              label="Lançamentos"
              value={m.total}
              icon={BookOpen}
              tone="primary"
              loading={isLoading}
              footer={
                <span className="capitalize">
                  {competencia ? formatarCompetencia(competencia.mes_ano) : ""}
                </span>
              }
              hint="Movimentações extraídas dos documentos desta competência."
            />
            <KpiCard
              label="Taxa de conciliação"
              value={`${Math.round(m.taxa)}%`}
              icon={Scale}
              tone={m.taxa >= 80 ? "success" : m.taxa >= 50 ? "warning" : "danger"}
              loading={isLoading}
              progress={m.taxa}
              footer={`${m.conc} de ${m.total} conciliados`}
              hint="Percentual de lançamentos já conferidos e confirmados."
            />
            <KpiCard
              label="Pendentes"
              value={m.pend}
              icon={ShieldAlert}
              tone={m.pend ? "warning" : "neutral"}
              loading={isLoading}
              onClick={() => setAba("pendente")}
              active={aba === "pendente"}
              hint="Ainda sem conta definida ou sem confirmação. Clique para filtrar."
            />
            <KpiCard
              label="Baixa confiança"
              value={m.baixa}
              icon={Sparkles}
              tone={m.baixa ? "danger" : "neutral"}
              loading={isLoading}
              footer="IA abaixo de 60%"
              hint="Lançamentos em que a IA não teve certeza da classificação. Comece a revisão por aqui."
            />
            <KpiCard
              label="Entradas / Saídas"
              value={<span className="text-base">{formatarMoeda(m.entradas)}</span>}
              icon={CheckCircle2}
              tone="accent"
              loading={isLoading}
              footer={`Saídas: ${formatarMoeda(m.saidas)}`}
              hint="Soma dos valores positivos e negativos da competência."
            />
          </KpiGrid>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <SectionCard flush>
              <div className="px-4 pt-1">
                <SubTabs
                  value={aba}
                  onChange={setAba}
                  items={[
                    { value: "pendente", label: "Pendentes", count: m.pend, tone: "warning" },
                    { value: "classificado", label: "Classificados pela IA", count: m.clas },
                    { value: "conciliado", label: "Conciliados", count: m.conc, tone: "success" },
                    { value: "todos", label: "Todos", count: m.total },
                  ]}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 border-b border-border/50 px-4 py-3">
                <FilterBar>
                  <SearchInput
                    value={busca}
                    onChange={setBusca}
                    placeholder="Buscar descrição ou conta"
                    className="w-full sm:w-72"
                  />
                </FilterBar>
                <div className="ml-auto flex items-center gap-2">
                  {competencia && pillCompetencia(competencia.status, "xs")}
                  {selecionados.size > 0 && !fechada && (
                    <Button
                      size="sm"
                      className="h-7 rounded-md text-xs"
                      onClick={() => confirmar.mutate(Array.from(selecionados))}
                      disabled={confirmar.isPending}
                    >
                      <Check className="size-3" /> Confirmar {selecionados.size}
                    </Button>
                  )}
                </div>
              </div>
              <DataTable
                rows={filtrados}
                columns={colunas}
                rowKey={(l) => l.id}
                loading={isLoading}
                selectable={!fechada}
                selected={selecionados}
                onSelectedChange={setSelecionados}
                defaultSort={{ key: "ia", dir: "asc" }}
                dense
                emptyTitle={aba === "pendente" ? "Nenhum lançamento pendente" : "Nenhum lançamento"}
                emptyHint={
                  aba === "pendente" && m.total > 0
                    ? "Tudo desta competência já foi classificado. Confira os classificados pela IA e feche o mês."
                    : "Os lançamentos aparecem aqui quando os documentos são processados."
                }
              />
            </SectionCard>

            <div className="space-y-4">
              <SectionCard title="Situação" icon={Scale} dense>
                <div className="flex items-center gap-4">
                  <Donut
                    data={donut}
                    size={110}
                    thickness={14}
                    center={{ value: `${Math.round(m.taxa)}%`, label: "conciliado" }}
                  />
                  <div className="flex-1">
                    <Legend items={donut} />
                  </div>
                </div>
                {m.pend > 0 && competencia?.status === "em_conciliacao" && (
                  <p className="mt-3 rounded-md bg-warning/10 px-2.5 py-1.5 text-[0.6875rem] text-warning-foreground">
                    Resolva os {m.pend} pendentes para liberar o fechamento.
                  </p>
                )}
              </SectionCard>

              <SectionCard
                title="Regras aprendidas"
                description="Cada correção manual de conta vira uma regra: quando a mesma descrição aparecer de novo, a IA já classifica certo."
                icon={Brain}
                dense
                actions={
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {regras?.length ?? 0}
                  </span>
                }
              >
                {(regras ?? []).length === 0 ? (
                  <EmptyState
                    icon={Brain}
                    title="Nenhuma regra ainda"
                    hint="Corrija a conta de um lançamento e a regra é criada automaticamente."
                    compact
                  />
                ) : (
                  <ul className="divide-y divide-border/40">
                    {(regras ?? []).slice(0, 8).map((r) => (
                      <li key={r.id} className="group flex items-start gap-2 py-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-medium" title={r.padrao_descricao}>
                            {r.padrao_descricao}
                          </div>
                          <div className="flex items-center gap-1 text-[0.6875rem] text-muted-foreground">
                            <ChevronRight className="size-3" />
                            <span className="font-mono text-primary">{r.conta_destino ?? "—"}</span>
                            <span>· {r.aplicacoes}x</span>
                          </div>
                        </div>
                        <button
                          onClick={() => removerRegra.mutate(r.id)}
                          className="text-muted-foreground/40 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                          aria-label="Remover regra"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>

              {(contas ?? []).length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-3 text-[0.6875rem] text-muted-foreground">
                  Este cliente não tem plano de contas cadastrado.{" "}
                  <Link to="/configuracoes" className="font-medium text-primary hover:underline">
                    Cadastrar em Configurações →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
