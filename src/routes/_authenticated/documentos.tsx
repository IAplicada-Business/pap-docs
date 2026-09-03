import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  Download,
  FileImage,
  FileSpreadsheet,
  FileText,
  Hourglass,
  LayoutList,
  Loader2,
  Paperclip,
  RotateCcw,
  Trash2,
  Upload,
  Users,
  X,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  ActiveChips,
  DataTable,
  EmptyState,
  FilterBar,
  KpiCard,
  KpiGrid,
  PageHeader,
  ProgressBar,
  SearchInput,
  SectionCard,
  Segmented,
  SubTabs,
  pillDocumento,
  type Chip,
  type Column,
} from "@/components/ui-kit";
import {
  EXTENSOES_ACEITAS,
  ORIGENS_RECEBIMENTO,
  TAMANHO_MAXIMO_BYTES,
  TIPOS_DOCUMENTO,
  rotuloTipo,
} from "@/lib/dominio";
import {
  formatarCompetencia,
  formatarDataHora,
  formatarTamanho,
  mesAnterior,
} from "@/lib/formatadores";
import { baixarDocumento, enviarDocumentoEquipe } from "@/lib/documentos";

type Aba = "todos" | "fila" | "processado" | "erro";

type Search = { aba?: Aba | undefined; novo?: string | undefined; cliente?: string | undefined };

export const Route = createFileRoute("/_authenticated/documentos")({
  validateSearch: (s: Record<string, unknown>): Search => {
    const out: Search = {};
    if (
      s["aba"] === "fila" ||
      s["aba"] === "erro" ||
      s["aba"] === "processado" ||
      s["aba"] === "todos"
    )
      out.aba = s["aba"];
    if (typeof s["novo"] === "string") out.novo = s["novo"];
    if (typeof s["cliente"] === "string") out.cliente = s["cliente"];
    return out;
  },
  head: () => ({
    meta: [
      { title: "Documentos — P&A Contabilidade Digital" },
      {
        name: "description",
        content: "Documentos recebidos dos clientes, fila de processamento, erros e upload manual.",
      },
    ],
  }),
  component: DocumentosPage,
});

type Doc = {
  id: string;
  nome_original: string | null;
  tipo: string | null;
  origem: string | null;
  status_processamento: string;
  enviado_em: string;
  arquivo_path: string | null;
  cliente_id: string;
  tamanho_bytes: number | null;
  erro_motivo: string | null;
  competencias: { mes_ano: string } | null;
  clientes: { nome_fantasia: string | null; nome: string | null } | null;
};

function IconeArquivo({ nome }: { nome: string | null }) {
  const ext = (nome ?? "").split(".").pop()?.toLowerCase() ?? "";
  const cls = "size-3.5";
  if (["xlsx", "xls", "csv", "ofx"].includes(ext))
    return <FileSpreadsheet className={`${cls} text-success`} />;
  if (["jpg", "jpeg", "png"].includes(ext)) return <FileImage className={`${cls} text-chart-4`} />;
  return <FileText className={`${cls} text-primary`} />;
}

function DocumentosPage() {
  const { orgId: empresaId } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: perfil } = usePerfil();
  const queryClient = useQueryClient();

  const aba: Aba = search.aba ?? "todos";
  const [busca, setBusca] = useState("");
  const [fCliente, setFCliente] = useState(search.cliente ?? "todos");
  const [fTipo, setFTipo] = useState("todos");
  const [fOrigem, setFOrigem] = useState("todos");
  const [fPeriodo, setFPeriodo] = useState("");
  const [visao, setVisao] = useState<"lista" | "clientes">("lista");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [uploadAberto, setUploadAberto] = useState(!!search.novo);

  useEffect(() => {
    if (search.novo) setUploadAberto(true);
  }, [search.novo]);

  const setAba = (a: Aba) =>
    navigate({ search: (prev: Search) => ({ ...prev, aba: a === "todos" ? undefined : a }) });

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

  const { data: documentos, isLoading } = useQuery({
    queryKey: ["documentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documentos")
        .select(
          "id, nome_original, tipo, origem, status_processamento, enviado_em, arquivo_path, cliente_id, tamanho_bytes, erro_motivo, competencias(mes_ano), clientes(nome_fantasia, nome)",
        )
        .is("deleted_at", null)
        .order("enviado_em", { ascending: false });
      if (error) throw error;
      return data as Doc[];
    },
  });

  const contagem = useMemo(() => {
    const all = documentos ?? [];
    return {
      todos: all.length,
      fila: all.filter(
        (d) => d.status_processamento === "recebido" || d.status_processamento === "processando",
      ).length,
      processado: all.filter((d) => d.status_processamento === "processado").length,
      erro: all.filter((d) => d.status_processamento === "erro").length,
    };
  }, [documentos]);

  const hoje = useMemo(() => {
    const ini = new Date();
    ini.setHours(0, 0, 0, 0);
    return (documentos ?? []).filter((d) => new Date(d.enviado_em) >= ini).length;
  }, [documentos]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (documentos ?? []).filter((d) => {
      if (
        aba === "fila" &&
        !(d.status_processamento === "recebido" || d.status_processamento === "processando")
      )
        return false;
      if (aba === "processado" && d.status_processamento !== "processado") return false;
      if (aba === "erro" && d.status_processamento !== "erro") return false;
      if (fCliente !== "todos" && d.cliente_id !== fCliente) return false;
      if (fTipo !== "todos" && d.tipo !== fTipo) return false;
      if (fOrigem !== "todos" && d.origem !== fOrigem) return false;
      if (fPeriodo && !(d.competencias?.mes_ano ?? d.enviado_em).startsWith(fPeriodo)) return false;
      if (termo) {
        const alvo =
          `${d.nome_original ?? ""} ${d.clientes?.nome_fantasia ?? ""} ${d.clientes?.nome ?? ""}`.toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [documentos, aba, fCliente, fTipo, fOrigem, fPeriodo, busca]);

  const porCliente = useMemo(() => {
    const map = new Map<string, { nome: string; docs: Doc[] }>();
    filtrados.forEach((d) => {
      const nome = d.clientes?.nome_fantasia ?? d.clientes?.nome ?? "—";
      const g = map.get(d.cliente_id) ?? { nome, docs: [] };
      g.docs.push(d);
      map.set(d.cliente_id, g);
    });
    return Array.from(map.entries())
      .map(([id, g]) => ({ id, ...g }))
      .sort((a, b) => b.docs.length - a.docs.length);
  }, [filtrados]);

  const reprocessar = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("documentos")
        .update({ status_processamento: "recebido", erro_motivo: null })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      toast.success(
        ids.length > 1
          ? `${ids.length} documentos enviados para reprocessamento`
          : "Documento enviado para reprocessamento",
      );
      setSelecionados(new Set());
      queryClient.invalidateQueries({ queryKey: ["documentos"] });
    },
    onError: (e: Error) => toast.error("Falha ao reprocessar", { description: e.message }),
  });

  const excluir = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("documentos")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      toast.success(`${ids.length} documento(s) removido(s)`);
      setSelecionados(new Set());
      queryClient.invalidateQueries({ queryKey: ["documentos"] });
    },
    onError: (e: Error) => toast.error("Falha ao remover", { description: e.message }),
  });

  const chips: Chip[] = [];
  if (fCliente !== "todos") {
    const c = clientes?.find((x) => x.id === fCliente);
    chips.push({
      key: "cliente",
      label: `Cliente: ${c?.nome_fantasia ?? c?.nome ?? "…"}`,
      onRemove: () => setFCliente("todos"),
    });
  }
  if (fTipo !== "todos")
    chips.push({
      key: "tipo",
      label: `Tipo: ${rotuloTipo(fTipo)}`,
      onRemove: () => setFTipo("todos"),
    });
  if (fOrigem !== "todos")
    chips.push({
      key: "origem",
      label: `Origem: ${ORIGENS_RECEBIMENTO[fOrigem] ?? fOrigem}`,
      onRemove: () => setFOrigem("todos"),
    });
  if (fPeriodo)
    chips.push({
      key: "periodo",
      label: `Competência: ${formatarCompetencia(`${fPeriodo}-01`)}`,
      onRemove: () => setFPeriodo(""),
    });
  const limpar = () => {
    setFCliente("todos");
    setFTipo("todos");
    setFOrigem("todos");
    setFPeriodo("");
  };

  const colunas: Column<Doc>[] = [
    {
      key: "arquivo",
      header: "Arquivo",
      sortValue: (d) => d.nome_original ?? "",
      cell: (d) => (
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
            <IconeArquivo nome={d.nome_original} />
          </span>
          <div className="min-w-0">
            <div className="max-w-[260px] truncate font-medium" title={d.nome_original ?? ""}>
              {d.nome_original ?? "Arquivo"}
            </div>
            <div className="text-[0.6875rem] text-muted-foreground">
              {formatarTamanho(d.tamanho_bytes)}
              {d.erro_motivo && <span className="ml-1.5 text-destructive">· {d.erro_motivo}</span>}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "cliente",
      header: "Cliente",
      hideBelow: "md",
      sortValue: (d) => d.clientes?.nome_fantasia ?? d.clientes?.nome ?? "",
      cell: (d) => (
        <Link
          to="/clientes/$clienteId"
          params={{ clienteId: d.cliente_id }}
          className="text-muted-foreground hover:text-foreground hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {d.clientes?.nome_fantasia ?? d.clientes?.nome ?? "—"}
        </Link>
      ),
    },
    {
      key: "tipo",
      header: "Tipo",
      hideBelow: "lg",
      sortValue: (d) => rotuloTipo(d.tipo),
      cell: (d) => <span className="text-muted-foreground">{rotuloTipo(d.tipo)}</span>,
    },
    {
      key: "competencia",
      header: "Competência",
      hideBelow: "xl",
      sortValue: (d) => d.competencias?.mes_ano ?? "",
      cell: (d) => (
        <span className="capitalize text-muted-foreground">
          {d.competencias ? formatarCompetencia(d.competencias.mes_ano) : "—"}
        </span>
      ),
    },
    {
      key: "origem",
      header: "Origem",
      hideBelow: "xl",
      cell: (d) => (
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[0.6875rem] text-muted-foreground">
          {d.origem ? (ORIGENS_RECEBIMENTO[d.origem] ?? d.origem) : "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (d) => d.status_processamento,
      cell: (d) => pillDocumento(d.status_processamento, "xs"),
    },
    {
      key: "enviado",
      header: "Recebido",
      hideBelow: "sm",
      sortValue: (d) => d.enviado_em,
      cell: (d) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
          {formatarDataHora(d.enviado_em)}
        </span>
      ),
    },
    {
      key: "acoes",
      header: "",
      align: "right",
      cell: (d) => (
        <div
          className="flex items-center justify-end gap-0.5 opacity-60 transition-opacity group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <AcaoIcone
            rotulo="Baixar"
            onClick={() =>
              baixarDocumento(d.arquivo_path, d.nome_original).catch(() =>
                toast.error("Não foi possível baixar o arquivo"),
              )
            }
          >
            <Download className="size-3.5" />
          </AcaoIcone>
          {(d.status_processamento === "erro" || d.status_processamento === "processado") && (
            <AcaoIcone rotulo="Reprocessar" onClick={() => reprocessar.mutate([d.id])}>
              <RotateCcw className="size-3.5" />
            </AcaoIcone>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Documentos"
        description="Tudo que os clientes enviaram pelo link, por e-mail ou manualmente. Acompanhe a fila de leitura automática e resolva erros."
        actions={
          <>
            <Segmented
              value={visao}
              onChange={setVisao}
              items={[
                { value: "lista", label: "Lista", icon: LayoutList },
                { value: "clientes", label: "Por cliente", icon: Users },
              ]}
            />
            <Button size="sm" className="h-8 rounded-lg" onClick={() => setUploadAberto(true)}>
              <Upload className="size-3.5" /> Upload manual
            </Button>
          </>
        }
      />

      <KpiGrid cols={4}>
        <KpiCard
          label="Recebidos hoje"
          value={hoje}
          icon={CloudUpload}
          tone="primary"
          loading={isLoading}
          hint="Documentos que chegaram hoje por qualquer canal."
        />
        <KpiCard
          label="Na fila"
          value={contagem.fila}
          icon={Hourglass}
          tone={contagem.fila ? "warning" : "neutral"}
          loading={isLoading}
          onClick={() => setAba("fila")}
          active={aba === "fila"}
          hint="Aguardando leitura automática ou em processamento. Clique para filtrar."
        />
        <KpiCard
          label="Com erro"
          value={contagem.erro}
          icon={AlertTriangle}
          tone={contagem.erro ? "danger" : "neutral"}
          loading={isLoading}
          onClick={() => setAba("erro")}
          active={aba === "erro"}
          hint="Falharam na leitura. Reprocesse ou peça um novo arquivo ao cliente. Clique para filtrar."
        />
        <KpiCard
          label="Taxa de sucesso"
          value={
            contagem.todos ? `${Math.round((contagem.processado / contagem.todos) * 100)}%` : "—"
          }
          icon={CheckCircle2}
          tone="success"
          loading={isLoading}
          progress={contagem.todos ? (contagem.processado / contagem.todos) * 100 : 0}
          footer={`${contagem.processado} de ${contagem.todos} processados`}
          hint="Percentual de documentos lidos com sucesso pela IA."
        />
      </KpiGrid>

      <SectionCard flush>
        <div className="px-4 pt-1">
          <SubTabs
            value={aba}
            onChange={setAba}
            items={[
              { value: "todos", label: "Todos", count: contagem.todos },
              {
                value: "fila",
                label: "Fila de processamento",
                count: contagem.fila,
                tone: "warning",
                icon: Hourglass,
              },
              {
                value: "processado",
                label: "Processados",
                count: contagem.processado,
                tone: "success",
              },
              {
                value: "erro",
                label: "Com erro",
                count: contagem.erro,
                tone: "danger",
                icon: AlertTriangle,
              },
            ]}
          />
        </div>

        <div className="space-y-2 border-b border-border/50 px-4 py-3">
          <FilterBar>
            <SearchInput
              value={busca}
              onChange={setBusca}
              placeholder="Buscar arquivo ou cliente"
              className="w-full sm:w-64"
            />
            <Select value={fCliente} onValueChange={setFCliente}>
              <SelectTrigger className="h-8 w-44 rounded-lg text-xs">
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
            <Select value={fTipo} onValueChange={setFTipo}>
              <SelectTrigger className="h-8 w-40 rounded-lg text-xs">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                {TIPOS_DOCUMENTO.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={fOrigem} onValueChange={setFOrigem}>
              <SelectTrigger className="h-8 w-36 rounded-lg text-xs">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as origens</SelectItem>
                {Object.entries(ORIGENS_RECEBIMENTO).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="month"
              className="h-8 w-40 rounded-lg text-xs"
              value={fPeriodo}
              onChange={(e) => setFPeriodo(e.target.value)}
              aria-label="Competência"
            />
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {filtrados.length} resultado(s)
            </span>
          </FilterBar>
          <ActiveChips chips={chips} onClear={limpar} />
        </div>

        {selecionados.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border/50 bg-primary/5 px-4 py-2">
            <span className="text-xs font-semibold text-primary">
              {selecionados.size} selecionado(s)
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 rounded-md text-xs"
              onClick={() => reprocessar.mutate(Array.from(selecionados))}
              disabled={reprocessar.isPending}
            >
              <RotateCcw className="size-3" /> Reprocessar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 rounded-md text-xs text-destructive hover:text-destructive"
              onClick={() => excluir.mutate(Array.from(selecionados))}
              disabled={excluir.isPending}
            >
              <Trash2 className="size-3" /> Remover
            </Button>
            <button
              className="ml-auto text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setSelecionados(new Set())}
            >
              Limpar seleção
            </button>
          </div>
        )}

        {visao === "lista" ? (
          <DataTable
            rows={filtrados}
            columns={colunas}
            rowKey={(d) => d.id}
            loading={isLoading}
            selectable
            selected={selecionados}
            onSelectedChange={setSelecionados}
            defaultSort={{ key: "enviado", dir: "desc" }}
            emptyTitle="Nenhum documento encontrado"
            emptyHint={
              chips.length || busca
                ? "Ajuste os filtros para ver mais resultados."
                : "Os arquivos enviados pelos clientes aparecem aqui."
            }
            {...(chips.length || busca
              ? {
                  emptyAction: (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg"
                      onClick={() => {
                        limpar();
                        setBusca("");
                      }}
                    >
                      Limpar filtros
                    </Button>
                  ),
                }
              : {})}
          />
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {porCliente.length === 0 && !isLoading && (
              <div className="sm:col-span-2 xl:col-span-3">
                <EmptyState icon={Users} title="Nenhum documento encontrado" compact />
              </div>
            )}
            {porCliente.map((g) => {
              const ok = g.docs.filter((d) => d.status_processamento === "processado").length;
              const err = g.docs.filter((d) => d.status_processamento === "erro").length;
              const fila = g.docs.length - ok - err;
              return (
                <div
                  key={g.id}
                  className="rounded-lg border border-border/60 p-3.5 transition-shadow hover:shadow-card"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to="/clientes/$clienteId"
                      params={{ clienteId: g.id }}
                      className="min-w-0 truncate text-sm font-semibold hover:underline"
                    >
                      {g.nome}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {g.docs.length} docs
                    </span>
                  </div>
                  <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="bg-success"
                      style={{ width: `${(ok / g.docs.length) * 100}%` }}
                    />
                    <div
                      className="bg-warning"
                      style={{ width: `${(fila / g.docs.length) * 100}%` }}
                    />
                    <div
                      className="bg-destructive"
                      style={{ width: `${(err / g.docs.length) * 100}%` }}
                    />
                  </div>
                  <div className="mt-2 flex gap-3 text-[0.6875rem] text-muted-foreground">
                    <span>
                      <b className="text-success">{ok}</b> ok
                    </span>
                    <span>
                      <b className="text-warning-foreground">{fila}</b> fila
                    </span>
                    <span>
                      <b className="text-destructive">{err}</b> erro
                    </span>
                  </div>
                  <ul className="mt-3 space-y-1">
                    {g.docs.slice(0, 3).map((d) => (
                      <li key={d.id} className="flex items-center gap-2 text-xs">
                        <IconeArquivo nome={d.nome_original} />
                        <span className="min-w-0 flex-1 truncate">{d.nome_original}</span>
                        {pillDocumento(d.status_processamento, "xs")}
                      </li>
                    ))}
                    {g.docs.length > 3 && (
                      <li>
                        <button
                          className="text-[0.6875rem] font-medium text-primary hover:underline"
                          onClick={() => {
                            setFCliente(g.id);
                            setVisao("lista");
                          }}
                        >
                          Ver todos os {g.docs.length}
                        </button>
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <UploadDialog
        open={uploadAberto}
        onOpenChange={(o) => {
          setUploadAberto(o);
          if (!o && search.novo)
            navigate({ search: (prev: Search) => ({ ...prev, novo: undefined }) });
        }}
        clientes={clientes ?? []}
        orgId={perfil?.org_id ?? null}
        clienteInicial={search.cliente ?? ""}
        onDone={() => queryClient.invalidateQueries({ queryKey: ["documentos"] })}
      />
    </div>
  );
}

function AcaoIcone({
  rotulo,
  onClick,
  children,
}: {
  rotulo: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={rotulo}
          >
            {children}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-foreground text-background">
          {rotulo}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

type ItemUpload = {
  arquivo: File;
  status: "pendente" | "enviando" | "ok" | "erro";
  mensagem?: string;
};

function UploadDialog({
  open,
  onOpenChange,
  clientes,
  orgId,
  clienteInicial,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientes: { id: string; nome_fantasia: string | null; nome: string | null }[];
  orgId: string | null;
  clienteInicial: string;
  onDone: () => void;
}) {
  const [cliente, setCliente] = useState(clienteInicial);
  const [tipo, setTipo] = useState("extrato");
  const [mes, setMes] = useState(mesAnterior());
  const [itens, setItens] = useState<ItemUpload[]>([]);
  const [arrastando, setArrastando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && clienteInicial) setCliente(clienteInicial);
  }, [open, clienteInicial]);

  function adicionar(files: FileList | null) {
    if (!files) return;
    const novos: ItemUpload[] = Array.from(files).map((f) =>
      f.size > TAMANHO_MAXIMO_BYTES
        ? { arquivo: f, status: "erro", mensagem: "Maior que 20 MB" }
        : { arquivo: f, status: "pendente" },
    );
    setItens((a) => [...a, ...novos]);
  }

  async function enviar() {
    if (!orgId) {
      toast.error("Perfil não carregado.");
      return;
    }
    if (!cliente) {
      toast.error("Selecione o cliente.");
      return;
    }
    if (itens.every((i) => i.status !== "pendente")) {
      toast.error("Adicione ao menos um arquivo.");
      return;
    }
    setEnviando(true);
    let ok = 0;
    for (let i = 0; i < itens.length; i++) {
      const it = itens[i];
      if (!it || it.status !== "pendente") continue;
      setItens((a) => a.map((x, j) => (j === i ? { ...x, status: "enviando" } : x)));
      try {
        await enviarDocumentoEquipe({
          orgId,
          clienteId: cliente,
          tipo,
          mesAno: mes,
          arquivo: it.arquivo,
        });
        ok++;
        setItens((a) => a.map((x, j) => (j === i ? { ...x, status: "ok" } : x)));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Falha ao enviar";
        setItens((a) => a.map((x, j) => (j === i ? { ...x, status: "erro", mensagem: msg } : x)));
      }
    }
    setEnviando(false);
    onDone();
    if (ok > 0) toast.success(`${ok} documento(s) enviado(s)`);
  }

  function fechar(o: boolean) {
    if (!o) {
      setItens([]);
    }
    onOpenChange(o);
  }

  const pendentes = itens.filter((i) => i.status === "pendente").length;
  const concluidos = itens.filter((i) => i.status === "ok").length;

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload manual</DialogTitle>
          <DialogDescription>
            Envie documentos em nome do cliente — por exemplo, recebidos por e-mail. Arquivos
            repetidos são bloqueados automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-[1fr_1.2fr]">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Cliente</Label>
              <Select value={cliente} onValueChange={setCliente}>
                <SelectTrigger className="h-9 rounded-lg">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome_fantasia ?? c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de documento</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {TIPOS_DOCUMENTO.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTipo(t.value)}
                    className={`rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-colors ${
                      tipo === t.value
                        ? "border-primary bg-primary/8 text-primary"
                        : "border-border/70 text-muted-foreground hover:border-border hover:text-foreground"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Competência</Label>
              <Input
                type="month"
                className="h-9 rounded-lg"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setArrastando(true);
              }}
              onDragLeave={() => setArrastando(false)}
              onDrop={(e) => {
                e.preventDefault();
                setArrastando(false);
                adicionar(e.dataTransfer.files);
              }}
              onClick={() => inputRef.current?.click()}
              className={`flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
                arrastando
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/40"
              }`}
            >
              <CloudUpload className="size-7 text-primary" />
              <p className="mt-2 text-sm font-medium">Arraste os arquivos aqui</p>
              <p className="text-[0.6875rem] text-muted-foreground">
                ou clique para escolher · PDF, OFX, XLSX, CSV, imagens · até 20 MB
              </p>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={EXTENSOES_ACEITAS}
                className="hidden"
                onChange={(e) => {
                  adicionar(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>

            {itens.length > 0 && (
              <div className="max-h-52 space-y-1 overflow-y-auto">
                {itens.map((it, i) => (
                  <div
                    key={`${it.arquivo.name}-${i}`}
                    className="flex items-center gap-2 rounded-md border border-border/60 px-2.5 py-1.5 text-xs"
                  >
                    <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{it.arquivo.name}</span>
                    <span className="shrink-0 text-[0.6875rem] text-muted-foreground">
                      {formatarTamanho(it.arquivo.size)}
                    </span>
                    {it.status === "enviando" && (
                      <Loader2 className="size-3.5 animate-spin text-primary" />
                    )}
                    {it.status === "ok" && <CheckCircle2 className="size-3.5 text-success" />}
                    {it.status === "erro" && (
                      <span
                        className="flex items-center gap-1 text-destructive"
                        title={it.mensagem}
                      >
                        <AlertTriangle className="size-3.5" />
                        <span className="max-w-[120px] truncate">{it.mensagem}</span>
                      </span>
                    )}
                    {it.status === "pendente" && (
                      <button
                        type="button"
                        onClick={() => setItens((a) => a.filter((_, j) => j !== i))}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Remover"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {itens.length > 0 && (
              <div>
                <ProgressBar value={(concluidos / itens.length) * 100} tone="success" />
                <div className="mt-1 text-[0.6875rem] text-muted-foreground">
                  {concluidos} de {itens.length} enviados
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => fechar(false)} className="rounded-lg">
            Fechar
          </Button>
          <Button onClick={enviar} disabled={enviando || pendentes === 0} className="rounded-lg">
            {enviando ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Enviando…
              </>
            ) : (
              `Enviar ${pendentes || ""} arquivo(s)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
