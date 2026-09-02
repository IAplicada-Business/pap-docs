import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarRange,
  Grid3X3,
  Kanban,
  LayoutList,
  Lock,
  LockOpen,
  PlayCircle,
  Plus,
  Scale,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil } from "@/hooks/use-perfil";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  DataTable,
  EmptyState,
  KpiCard,
  KpiGrid,
  PageHeader,
  ProgressBar,
  SectionCard,
  Segmented,
  pillCompetencia,
  type Column,
} from "@/components/ui-kit";
import { formatarCompetencia, formatarDataHora, mesAtual } from "@/lib/formatadores";

export const Route = createFileRoute("/_authenticated/empresas/$id/competencias")({
  head: () => ({
    meta: [
      { title: "Competências — ConcilIA" },
      {
        name: "description",
        content: "Controle dos períodos contábeis por cliente: abertos, em conciliação e fechados.",
      },
    ],
  }),
  component: CompetenciasPage,
});

type Comp = {
  id: string;
  mes_ano: string;
  status: string;
  fechada_em: string | null;
  taxa_conciliacao: number | null;
  cliente_id: string;
  clientes: { nome_fantasia: string | null; nome: string | null } | null;
};

const MESES_CURTOS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function CompetenciasPage() {
  const { id: empresaId } = Route.useParams();
  const { data: perfil } = usePerfil();
  const queryClient = useQueryClient();
  const [visao, setVisao] = useState<"quadro" | "matriz" | "lista">("quadro");
  const [fCliente, setFCliente] = useState("todos");
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [aberto, setAberto] = useState(false);
  const [nova, setNova] = useState({ cliente: "", mes: mesAtual() });
  const [fechar, setFechar] = useState<Comp | null>(null);

  const { data: clientes } = useQuery({
    queryKey: ["clientes-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome_fantasia, nome")
        .is("deleted_at", null)
        .eq("ativo", true)
        .order("nome_fantasia");
      if (error) throw error;
      return data;
    },
  });

  const { data: competencias, isLoading } = useQuery({
    queryKey: ["competencias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competencias")
        .select(
          "id, mes_ano, status, fechada_em, taxa_conciliacao, cliente_id, clientes(nome_fantasia, nome)",
        )
        .is("deleted_at", null)
        .order("mes_ano", { ascending: false });
      if (error) throw error;
      return data as Comp[];
    },
  });

  const filtradas = useMemo(
    () => (competencias ?? []).filter((c) => fCliente === "todos" || c.cliente_id === fCliente),
    [competencias, fCliente],
  );

  const k = useMemo(() => {
    const mesC = `${mesAtual()}-01`;
    const abertas = filtradas.filter((c) => c.status === "aberta").length;
    const conc = filtradas.filter((c) => c.status === "em_conciliacao").length;
    const fechadasMes = filtradas.filter(
      (c) => c.status === "fechada" && c.mes_ano === mesC,
    ).length;
    const doMes = filtradas.filter((c) => c.mes_ano === mesC).length;
    const comTaxa = filtradas.filter((c) => c.taxa_conciliacao != null);
    const taxa = comTaxa.length
      ? comTaxa.reduce((a, c) => a + (c.taxa_conciliacao ?? 0), 0) / comTaxa.length
      : null;
    return { abertas, conc, fechadasMes, doMes, taxa };
  }, [filtradas]);

  const anos = useMemo(() => {
    const s = new Set<string>([String(new Date().getFullYear())]);
    (competencias ?? []).forEach((c) => s.add(c.mes_ano.slice(0, 4)));
    return Array.from(s).sort().reverse();
  }, [competencias]);

  const nomeCliente = (c: Comp) => c.clientes?.nome_fantasia ?? c.clientes?.nome ?? "—";

  const criar = useMutation({
    mutationFn: async (p: { cliente: string; mes: string }) => {
      if (!perfil) throw new Error("Perfil não carregado.");
      if (!p.cliente) throw new Error("Selecione o cliente.");
      const { error } = await supabase.from("competencias").insert({
        org_id: perfil.org_id,
        cliente_id: p.cliente,
        mes_ano: `${p.mes}-01`,
        status: "aberta",
      });
      if (error)
        throw new Error(
          error.code === "23505"
            ? "Já existe uma competência deste cliente para o mês escolhido."
            : error.message,
        );
    },
    onSuccess: () => {
      toast.success("Competência criada");
      setAberto(false);
      queryClient.invalidateQueries({ queryKey: ["competencias"] });
    },
    onError: (e: Error) => toast.error("Não foi possível criar", { description: e.message }),
  });

  const mudarStatus = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: "aberta" | "em_conciliacao" | "fechada";
    }) => {
      const fechando = status === "fechada";
      const { error } = await supabase
        .from("competencias")
        .update({
          status,
          fechada_em: fechando ? new Date().toISOString() : null,
          fechada_por: fechando ? (perfil?.id ?? null) : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      toast.success(
        v.status === "fechada"
          ? "Competência fechada"
          : v.status === "em_conciliacao"
            ? "Conciliação iniciada"
            : "Competência reaberta",
      );
      setFechar(null);
      queryClient.invalidateQueries({ queryKey: ["competencias"] });
    },
    onError: (e: Error) => toast.error("Não foi possível alterar", { description: e.message }),
  });

  const Acoes = ({ c, compact }: { c: Comp; compact?: boolean }) => (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/empresas/$id/conciliacao"
              params={{ id: empresaId }}
              search={{ cliente: c.cliente_id, competencia: c.id }}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Scale className="size-3.5" />
            </Link>
          </TooltipTrigger>
          <TooltipContent className="bg-foreground text-background">
            Abrir conciliação
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {c.status === "aberta" && (
        <Button
          size="sm"
          variant="outline"
          className={`h-7 rounded-md text-xs ${compact ? "px-2" : ""}`}
          onClick={() => mudarStatus.mutate({ id: c.id, status: "em_conciliacao" })}
        >
          <PlayCircle className="size-3" /> {!compact && "Iniciar"}
        </Button>
      )}
      {c.status === "em_conciliacao" && (
        <Button
          size="sm"
          className={`h-7 rounded-md text-xs ${compact ? "px-2" : ""}`}
          onClick={() => setFechar(c)}
        >
          <Lock className="size-3" /> {!compact && "Fechar"}
        </Button>
      )}
      {c.status === "fechada" && (
        <Button
          size="sm"
          variant="ghost"
          className={`h-7 rounded-md text-xs ${compact ? "px-2" : ""}`}
          onClick={() => mudarStatus.mutate({ id: c.id, status: "aberta" })}
        >
          <LockOpen className="size-3" /> {!compact && "Reabrir"}
        </Button>
      )}
    </div>
  );

  const CardComp = ({ c }: { c: Comp }) => (
    <div className="rounded-lg border border-border/60 bg-card p-3 transition-shadow hover:shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            to="/empresas/$id/clientes/$clienteId"
            params={{ id: empresaId, clienteId: c.cliente_id }}
            className="block truncate text-sm font-semibold hover:underline"
          >
            {nomeCliente(c)}
          </Link>
          <div className="text-[0.6875rem] capitalize text-muted-foreground">
            {formatarCompetencia(c.mes_ano)}
          </div>
        </div>
        <span className="text-sm font-bold tabular-nums">
          {Math.round(c.taxa_conciliacao ?? 0)}%
        </span>
      </div>
      <div className="mt-2.5">
        <ProgressBar
          value={c.taxa_conciliacao ?? 0}
          tone={
            c.status === "fechada"
              ? "neutral"
              : c.status === "em_conciliacao"
                ? "warning"
                : "success"
          }
        />
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-[0.6875rem] text-muted-foreground">
          {c.fechada_em ? `Fechada ${formatarDataHora(c.fechada_em)}` : "conciliado"}
        </span>
        <Acoes c={c} compact />
      </div>
    </div>
  );

  const colunas: Column<Comp>[] = [
    {
      key: "cliente",
      header: "Cliente",
      sortValue: nomeCliente,
      cell: (c) => <span className="font-medium">{nomeCliente(c)}</span>,
    },
    {
      key: "mes",
      header: "Competência",
      sortValue: (c) => c.mes_ano,
      cell: (c) => (
        <span className="capitalize text-muted-foreground">{formatarCompetencia(c.mes_ano)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (c) => c.status,
      cell: (c) => pillCompetencia(c.status, "xs"),
    },
    {
      key: "taxa",
      header: "Conciliação",
      hideBelow: "md",
      sortValue: (c) => c.taxa_conciliacao ?? -1,
      cell: (c) => (
        <div className="flex items-center gap-2">
          <div className="w-20">
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
      sortValue: (c) => c.fechada_em ?? "",
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
        <div className="flex justify-end">
          <Acoes c={c} />
        </div>
      ),
    },
  ];

  const matriz = useMemo(() => {
    const doAno = filtradas.filter((c) => c.mes_ano.startsWith(ano));
    const porCliente = new Map<string, { nome: string; meses: Map<number, Comp> }>();
    (clientes ?? [])
      .filter((cl) => fCliente === "todos" || cl.id === fCliente)
      .forEach((cl) =>
        porCliente.set(cl.id, { nome: cl.nome_fantasia ?? cl.nome ?? "—", meses: new Map() }),
      );
    doAno.forEach((c) => {
      const g = porCliente.get(c.cliente_id) ?? {
        nome: nomeCliente(c),
        meses: new Map<number, Comp>(),
      };
      g.meses.set(Number(c.mes_ano.slice(5, 7)) - 1, c);
      porCliente.set(c.cliente_id, g);
    });
    return Array.from(porCliente.entries())
      .map(([id, g]) => ({ id, ...g }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [filtradas, clientes, ano, fCliente]);

  const colunasQuadro: { status: string; titulo: string; tom: string }[] = [
    { status: "aberta", titulo: "Abertas", tom: "bg-success" },
    { status: "em_conciliacao", titulo: "Em conciliação", tom: "bg-warning" },
    { status: "fechada", titulo: "Fechadas", tom: "bg-muted-foreground/50" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Competências"
        description="Cada cliente tem um período por mês. Ele nasce 'aberto' quando chegam documentos, passa a 'em conciliação' durante a conferência e é 'fechado' para gerar os relatórios."
        actions={
          <>
            <Segmented
              value={visao}
              onChange={setVisao}
              items={[
                { value: "quadro", label: "Quadro", icon: Kanban },
                { value: "matriz", label: "Matriz", icon: Grid3X3 },
                { value: "lista", label: "Lista", icon: LayoutList },
              ]}
            />
            <Select value={fCliente} onValueChange={setFCliente}>
              <SelectTrigger className="h-8 w-48 rounded-lg text-xs">
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os clientes</SelectItem>
                {(clientes ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome_fantasia ?? c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" className="h-8 rounded-lg" onClick={() => setAberto(true)}>
              <Plus className="size-3.5" /> Nova competência
            </Button>
          </>
        }
      />

      <KpiGrid cols={4}>
        <KpiCard
          label="Abertas"
          value={k.abertas}
          icon={CalendarRange}
          tone="success"
          loading={isLoading}
          hint="Recebendo documentos; ainda sem conferência iniciada."
        />
        <KpiCard
          label="Em conciliação"
          value={k.conc}
          icon={Scale}
          tone={k.conc ? "warning" : "neutral"}
          loading={isLoading}
          hint="Conferência em andamento na tela de Conciliação."
        />
        <KpiCard
          label={`Fechadas · ${MESES_CURTOS[new Date().getMonth()]}`}
          value={k.fechadasMes}
          icon={Lock}
          tone="primary"
          loading={isLoading}
          progress={k.doMes ? (k.fechadasMes / k.doMes) * 100 : 0}
          footer={`${k.fechadasMes} de ${k.doMes} do mês corrente`}
          hint="Competências do mês atual já fechadas."
        />
        <KpiCard
          label="Conciliação média"
          value={k.taxa == null ? "—" : `${Math.round(k.taxa)}%`}
          icon={Scale}
          tone={k.taxa != null && k.taxa >= 80 ? "success" : "warning"}
          loading={isLoading}
          progress={k.taxa ?? 0}
          hint="Média da taxa de conciliação nas competências filtradas."
        />
      </KpiGrid>

      {visao === "quadro" && (
        <div className="grid gap-4 lg:grid-cols-3">
          {colunasQuadro.map((col) => {
            const itens = filtradas.filter((c) => c.status === col.status);
            return (
              <SectionCard
                key={col.status}
                dense
                title={
                  <span className="flex items-center gap-2">
                    <span className={`size-2 rounded-full ${col.tom}`} />
                    {col.titulo}
                  </span>
                }
                actions={
                  <span className="text-xs text-muted-foreground tabular-nums">{itens.length}</span>
                }
              >
                <div className="space-y-2">
                  {itens.length === 0 && !isLoading && (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      Nenhuma competência.
                    </p>
                  )}
                  {itens.slice(0, 20).map((c) => (
                    <CardComp key={c.id} c={c} />
                  ))}
                  {itens.length > 20 && (
                    <button
                      className="w-full text-xs font-medium text-primary hover:underline"
                      onClick={() => setVisao("lista")}
                    >
                      Ver todas as {itens.length}
                    </button>
                  )}
                </div>
              </SectionCard>
            );
          })}
        </div>
      )}

      {visao === "matriz" && (
        <SectionCard
          flush
          title={`Matriz ${ano}`}
          description="Cada célula é a competência de um cliente em um mês. Verde = aberta, amarelo = em conciliação, cinza = fechada. Clique para abrir a conciliação ou em '+' para criar."
          icon={Grid3X3}
          actions={
            <Select value={ano} onValueChange={setAno}>
              <SelectTrigger className="h-7 w-24 rounded-md text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {anos.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="sticky left-0 z-10 bg-card px-4 py-2 text-left text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    Cliente
                  </th>
                  {MESES_CURTOS.map((m) => (
                    <th
                      key={m}
                      className="px-1 py-2 text-center text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matriz.length === 0 && (
                  <tr>
                    <td colSpan={13}>
                      <EmptyState icon={Grid3X3} title="Nenhum cliente ativo" compact />
                    </td>
                  </tr>
                )}
                {matriz.map((row) => (
                  <tr key={row.id} className="border-b border-border/40 hover:bg-muted/40">
                    <td className="sticky left-0 z-10 bg-card px-4 py-1.5 font-medium">
                      <Link
                        to="/empresas/$id/clientes/$clienteId"
                        params={{ id: empresaId, clienteId: row.id }}
                        className="hover:underline"
                      >
                        {row.nome}
                      </Link>
                    </td>
                    {MESES_CURTOS.map((_, i) => {
                      const c = row.meses.get(i);
                      const mes = `${ano}-${String(i + 1).padStart(2, "0")}`;
                      const futuro = mes > mesAtual();
                      return (
                        <td key={i} className="px-1 py-1.5 text-center">
                          {c ? (
                            <TooltipProvider delayDuration={100}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Link
                                    to="/empresas/$id/conciliacao"
                                    params={{ id: empresaId }}
                                    search={{ cliente: c.cliente_id, competencia: c.id }}
                                    className={`mx-auto flex h-7 w-9 items-center justify-center rounded-md text-[0.625rem] font-bold text-white ${
                                      c.status === "fechada"
                                        ? "bg-muted-foreground/40"
                                        : c.status === "em_conciliacao"
                                          ? "bg-warning text-warning-foreground"
                                          : "bg-success"
                                    }`}
                                  >
                                    {Math.round(c.taxa_conciliacao ?? 0)}%
                                  </Link>
                                </TooltipTrigger>
                                <TooltipContent className="bg-foreground text-background capitalize">
                                  {formatarCompetencia(c.mes_ano)} · {c.status.replace("_", " ")} ·{" "}
                                  {Math.round(c.taxa_conciliacao ?? 0)}% conciliado
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : futuro ? (
                            <span className="mx-auto block h-7 w-9 rounded-md bg-muted/40" />
                          ) : (
                            <button
                              className="mx-auto flex h-7 w-9 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground/50 hover:border-primary hover:text-primary"
                              onClick={() => criar.mutate({ cliente: row.id, mes })}
                              aria-label={`Criar competência ${mes}`}
                            >
                              <Plus className="size-3" />
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {visao === "lista" && (
        <SectionCard flush>
          <DataTable
            rows={filtradas}
            columns={colunas}
            rowKey={(c) => c.id}
            loading={isLoading}
            defaultSort={{ key: "mes", dir: "desc" }}
            emptyTitle="Nenhuma competência"
            emptyHint="Crie a competência do mês para começar."
          />
        </SectionCard>
      )}

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova competência</DialogTitle>
            <DialogDescription>Escolha o cliente e o mês de referência.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Cliente</Label>
              <Select value={nova.cliente} onValueChange={(v) => setNova({ ...nova, cliente: v })}>
                <SelectTrigger className="h-9 rounded-lg">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(clientes ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome_fantasia ?? c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mês</Label>
              <Input
                type="month"
                className="h-9 rounded-lg"
                value={nova.mes}
                onChange={(e) => setNova({ ...nova, mes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)} className="rounded-lg">
              Cancelar
            </Button>
            <Button
              onClick={() => criar.mutate(nova)}
              disabled={criar.isPending}
              className="rounded-lg"
            >
              {criar.isPending ? "Criando…" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!fechar} onOpenChange={(v) => !v && setFechar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fechar competência?</AlertDialogTitle>
            <AlertDialogDescription>
              {fechar ? `${nomeCliente(fechar)} · ${formatarCompetencia(fechar.mes_ano)}` : ""}{" "}
              ficará somente leitura e liberará a geração do pacote de relatórios.
              {fechar && (fechar.taxa_conciliacao ?? 0) < 100 && (
                <span className="mt-2 block text-warning-foreground">
                  Atenção: a conciliação está em {Math.round(fechar.taxa_conciliacao ?? 0)}%.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => fechar && mudarStatus.mutate({ id: fechar.id, status: "fechada" })}
            >
              Fechar competência
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
