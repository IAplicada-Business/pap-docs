import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpen,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  ExternalLink,
  FileBarChart,
  FileText,
  LinkIcon,
  RefreshCw,
  RotateCcw,
  Scale,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { usePerfil } from "@/hooks/use-perfil";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ORIGENS_DOCUMENTO,
  rotuloTipo,
  STATUS_COMPETENCIA,
  STATUS_LANCAMENTO,
  STATUS_PROCESSAMENTO,
  TIPOS_RELATORIO,
} from "@/lib/dominio";
import {
  formatarCnpj,
  formatarCompetencia,
  formatarDataHora,
  formatarMoeda,
  formatarPorcentagem,
  formatarTelefone,
} from "@/lib/formatadores";
import { baixarDocumento } from "@/lib/documentos";
import { badgeStatus } from "@/components/status-badge";

type AtualizacaoCliente = Database["public"]["Tables"]["clientes"]["Update"];

export const Route = createFileRoute("/_authenticated/clientes/$id")({
  head: () => ({
    meta: [
      { title: "Cliente — ConcilIA" },
      {
        name: "description",
        content: "Ambiente completo do cliente: documentos, lancamentos, conciliacao e relatorios.",
      },
    ],
  }),
  component: ClienteDetalhe,
});

function competenciaStatusConfig(status: string) {
  if (status === "fechada")
    return { dot: "bg-muted-foreground/50", bg: "bg-muted", text: "text-muted-foreground" };
  if (status === "em_conciliacao")
    return { dot: "bg-warning animate-pulse", bg: "bg-warning/10", text: "text-warning-foreground" };
  return { dot: "bg-success", bg: "bg-success/10", text: "text-success" };
}

function lancamentoStatusConfig(status: string) {
  if (status === "conciliado" || status === "revisado")
    return { dot: "bg-success", bg: "bg-success/10", text: "text-success" };
  if (status === "classificado")
    return { dot: "bg-primary", bg: "bg-primary/10", text: "text-primary" };
  return { dot: "bg-warning", bg: "bg-warning/10", text: "text-warning-foreground" };
}

function ClienteDetalhe() {
  const { id } = Route.useParams();
  const { data: perfil } = usePerfil();
  const queryClient = useQueryClient();
  const [confirmarToken, setConfirmarToken] = useState(false);
  const [confirmarPainelToken, setConfirmarPainelToken] = useState(false);

  const { data: cliente, isLoading } = useQuery({
    queryKey: ["cliente", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: documentos } = useQuery({
    queryKey: ["cliente-documentos", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documentos")
        .select("id, nome_original, tipo, origem, status_processamento, enviado_em, arquivo_path, erro_motivo")
        .eq("cliente_id", id)
        .is("deleted_at", null)
        .order("enviado_em", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: competencias } = useQuery({
    queryKey: ["cliente-competencias", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competencias")
        .select("id, mes_ano, status, taxa_conciliacao, fechada_em")
        .eq("cliente_id", id)
        .is("deleted_at", null)
        .order("mes_ano", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: lancamentos } = useQuery({
    queryKey: ["cliente-lancamentos", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lancamentos")
        .select("id, data, descricao, valor, status, confianca_ia, conta_debito, conta_credito, documento_id, competencia_id")
        .eq("cliente_id", id)
        .is("deleted_at", null)
        .order("data", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const competenciaIds = useMemo(() => (competencias ?? []).map((c) => c.id), [competencias]);

  const { data: relatorios } = useQuery({
    queryKey: ["cliente-relatorios", id, competenciaIds],
    queryFn: async () => {
      if (competenciaIds.length === 0) return [];
      const { data, error } = await supabase
        .from("relatorios")
        .select("id, tipo, arquivo_path, publicado_painel, enviado_em, created_at, competencia_id, competencias(mes_ano)")
        .in("competencia_id", competenciaIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) return [];
      return data;
    },
    enabled: !!competencias,
  });

  const reprocessar = useMutation({
    mutationFn: async (documentoId: string) => {
      const { error } = await supabase
        .from("documentos")
        .update({ status_processamento: "recebido", erro_motivo: null })
        .eq("id", documentoId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento marcado para reprocessamento");
      queryClient.invalidateQueries({ queryKey: ["cliente-documentos", id] });
    },
    onError: (e: Error) => toast.error("Falha ao reprocessar", { description: e.message }),
  });

  const salvar = useMutation({
    mutationFn: async (valores: AtualizacaoCliente) => {
      const { error } = await supabase.from("clientes").update(valores).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dados atualizados");
      queryClient.invalidateQueries({ queryKey: ["cliente", id] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
    },
    onError: (e: Error) => toast.error("Nao foi possivel salvar", { description: e.message }),
  });

  const rotacionarToken = useMutation({
    mutationFn: async (campo: "upload_token" | "painel_token") => {
      const novo = crypto.randomUUID();
      const { error } = await supabase.from("clientes").update({ [campo]: novo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Novo link gerado", { description: "O link anterior foi invalidado." });
      setConfirmarToken(false);
      setConfirmarPainelToken(false);
      queryClient.invalidateQueries({ queryKey: ["cliente", id] });
    },
    onError: (e: Error) => toast.error("Nao foi possivel gerar o link", { description: e.message }),
  });

  if (isLoading || !cliente) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const linkUpload =
    typeof window !== "undefined" ? `${window.location.origin}/upload/${cliente.upload_token}` : "";
  const linkPainel =
    typeof window !== "undefined" ? `${window.location.origin}/painel/${cliente.painel_token}` : "";

  const totalDocs = documentos?.length ?? 0;
  const docsErro = documentos?.filter((d) => d.status_processamento === "erro").length ?? 0;
  const totalLancamentos = lancamentos?.length ?? 0;
  const lancPendentes = lancamentos?.filter((l) => l.status === "pendente").length ?? 0;
  const compAbertas = competencias?.filter((c) => c.status !== "fechada").length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1 rounded-lg">
            <Link to="/clientes">
              <ArrowLeft className="size-4" /> Voltar
            </Link>
          </Button>
          <h1 className="page-title">{cliente.nome_fantasia ?? cliente.nome}</h1>
          <p className="page-subtitle">
            {cliente.razao_social} · {formatarCnpj(cliente.cnpj ?? "")}
          </p>
        </div>
        <span
          className={`status-dot ${
            cliente.ativo ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
          }`}
        >
          <span
            className={`size-1.5 rounded-full ${
              cliente.ativo ? "bg-success" : "bg-muted-foreground/50"
            }`}
          />
          {cliente.ativo ? "Ativo" : "Inativo"}
        </span>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div className="stat-card-icon bg-primary/10 text-primary">
              <FileText className="size-[1.125rem]" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold tracking-tight">{totalDocs}</div>
            <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
              Documentos recebidos
              {docsErro > 0 && (
                <span className="ml-1 text-destructive">({docsErro} com erro)</span>
              )}
            </p>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div className="stat-card-icon bg-accent/10 text-accent">
              <BookOpen className="size-[1.125rem]" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold tracking-tight">{totalLancamentos}</div>
            <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
              Lancamentos
              {lancPendentes > 0 && (
                <span className="ml-1 text-warning-foreground">({lancPendentes} pendentes)</span>
              )}
            </p>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div className="stat-card-icon bg-warning/10 text-warning-foreground">
              <CalendarRange className="size-[1.125rem]" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold tracking-tight">{compAbertas}</div>
            <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">Competencias abertas</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-start justify-between">
            <div className="stat-card-icon bg-success/10 text-success">
              <Scale className="size-[1.125rem]" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold tracking-tight">
              {formatarPorcentagem(
                competencias?.length
                  ? competencias.reduce((acc, c) => acc + (c.taxa_conciliacao ?? 0), 0) / competencias.length
                  : null
              )}
            </div>
            <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">Taxa de conciliacao</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="documentos">
        <div className="overflow-x-auto">
          <TabsList className="rounded-xl">
            <TabsTrigger value="documentos" className="rounded-lg">
              <FileText className="mr-1.5 size-3.5" /> Documentos
            </TabsTrigger>
            <TabsTrigger value="lancamentos" className="rounded-lg">
              <BookOpen className="mr-1.5 size-3.5" /> Lancamentos
            </TabsTrigger>
            <TabsTrigger value="conciliacao" className="rounded-lg">
              <Scale className="mr-1.5 size-3.5" /> Conciliacao
            </TabsTrigger>
            <TabsTrigger value="relatorios" className="rounded-lg">
              <FileBarChart className="mr-1.5 size-3.5" /> Relatorios
            </TabsTrigger>
            <TabsTrigger value="competencias" className="rounded-lg">
              <CalendarRange className="mr-1.5 size-3.5" /> Competencias
            </TabsTrigger>
            <TabsTrigger value="dados" className="rounded-lg">
              <ClipboardList className="mr-1.5 size-3.5" /> Dados
            </TabsTrigger>
            <TabsTrigger value="links" className="rounded-lg">
              <LinkIcon className="mr-1.5 size-3.5" /> Links
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab: Documentos (Module 1) */}
        <TabsContent value="documentos">
          <div className="rounded-2xl border border-border bg-card shadow-card">
            <div className="border-b border-border/60 p-5">
              <h2 className="text-sm font-semibold">Documentos recebidos</h2>
              <p className="text-xs text-muted-foreground">
                Arquivos enviados pelo cliente via link de upload ou manualmente pela equipe.
              </p>
            </div>
            <div className="p-2">
              {!documentos || documentos.length === 0 ? (
                <div className="py-16 text-center">
                  <FileText className="mx-auto size-10 text-muted-foreground/30" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    Nenhum documento recebido deste cliente ainda.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Compartilhe o link de upload na aba "Links".
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {documentos.map((d) => (
                    <div
                      key={d.id}
                      className="flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                        <FileText className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {d.nome_original ?? "Arquivo"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {rotuloTipo(d.tipo)}
                          {" · "}
                          {formatarDataHora(d.enviado_em)}
                          {d.erro_motivo ? ` · ${d.erro_motivo}` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {badgeStatus(d.status_processamento)}
                        <div className="flex items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 rounded-lg"
                            title="Baixar"
                            onClick={() =>
                              baixarDocumento(d.arquivo_path, d.nome_original).catch(() =>
                                toast.error("Nao foi possivel baixar o arquivo"),
                              )
                            }
                          >
                            <Download className="size-3.5" />
                          </Button>
                          {d.status_processamento === "erro" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 rounded-lg"
                              title="Reprocessar"
                              onClick={() => reprocessar.mutate(d.id)}
                            >
                              <RotateCcw className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab: Lancamentos (Module 2) */}
        <TabsContent value="lancamentos">
          <div className="rounded-2xl border border-border bg-card shadow-card">
            <div className="border-b border-border/60 p-5">
              <h2 className="text-sm font-semibold">Lancamentos contabeis</h2>
              <p className="text-xs text-muted-foreground">
                Movimentacoes extraidas dos documentos e classificadas pela IA.
              </p>
            </div>
            <div className="p-2">
              {!lancamentos || lancamentos.length === 0 ? (
                <div className="py-16 text-center">
                  <BookOpen className="mx-auto size-10 text-muted-foreground/30" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    Nenhum lancamento ainda.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Os lancamentos serao criados automaticamente ao processar os documentos.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {lancamentos.map((l) => {
                    const sc = lancamentoStatusConfig(l.status);
                    return (
                      <div
                        key={l.id}
                        className="flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-muted/50"
                      >
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                          <BookOpen className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {l.descricao ?? "Lancamento"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatarDataHora(l.data)}
                            {l.confianca_ia != null && (
                              <span className="ml-1">
                                · IA {formatarPorcentagem(l.confianca_ia * 100)}
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold tabular-nums">
                            {formatarMoeda(l.valor)}
                          </span>
                          <span className={`status-dot ${sc.bg} ${sc.text}`}>
                            <span className={`size-1.5 rounded-full ${sc.dot}`} />
                            {STATUS_LANCAMENTO[l.status] ?? l.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab: Conciliacao (Module 3) */}
        <TabsContent value="conciliacao">
          <div className="rounded-2xl border border-border bg-card shadow-card">
            <div className="border-b border-border/60 p-5">
              <h2 className="text-sm font-semibold">Conciliacao bancaria</h2>
              <p className="text-xs text-muted-foreground">
                Conferencia automatica entre extrato bancario e lancamentos contabeis.
              </p>
            </div>
            <div className="p-2">
              {!competencias || competencias.length === 0 ? (
                <div className="py-16 text-center">
                  <Scale className="mx-auto size-10 text-muted-foreground/30" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    Crie uma competencia para iniciar a conciliacao.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {competencias
                    .filter((c) => c.status !== "fechada")
                    .map((c) => {
                      const taxa = c.taxa_conciliacao ?? 0;
                      return (
                        <div
                          key={c.id}
                          className="rounded-xl px-4 py-4 transition-colors hover:bg-muted/50"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                                <Scale className="size-4" />
                              </div>
                              <div>
                                <span className="block text-sm font-semibold capitalize">
                                  {formatarCompetencia(c.mes_ano)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {STATUS_COMPETENCIA[c.status] ?? c.status}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-2xl font-bold tracking-tight">
                                {formatarPorcentagem(taxa)}
                              </span>
                              <p className="text-xs text-muted-foreground">conciliado</p>
                            </div>
                          </div>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${Math.min(taxa, 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  {competencias.filter((c) => c.status !== "fechada").length === 0 && (
                    <div className="py-16 text-center">
                      <CheckCircle2 className="mx-auto size-10 text-success/30" />
                      <p className="mt-3 text-sm text-muted-foreground">
                        Todas as competencias estao fechadas.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab: Relatorios (Module 4) */}
        <TabsContent value="relatorios">
          <div className="rounded-2xl border border-border bg-card shadow-card">
            <div className="border-b border-border/60 p-5">
              <h2 className="text-sm font-semibold">Relatorios</h2>
              <p className="text-xs text-muted-foreground">
                Balancete, DRE, Balanco patrimonial e DFC gerados para o cliente.
              </p>
            </div>
            <div className="p-2">
              {!relatorios || relatorios.length === 0 ? (
                <div className="py-16 text-center">
                  <FileBarChart className="mx-auto size-10 text-muted-foreground/30" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    Nenhum relatorio gerado ainda.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Os relatorios serao gerados apos o fechamento da competencia.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {relatorios.map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                        <FileBarChart className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">
                          {TIPOS_RELATORIO[r.tipo] ?? r.tipo}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {r.competencias
                            ? formatarCompetencia(r.competencias.mes_ano)
                            : "—"}
                          {" · "}
                          {formatarDataHora(r.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.publicado_painel && (
                          <span className="status-dot bg-success/10 text-success">
                            <span className="size-1.5 rounded-full bg-success" />
                            No painel
                          </span>
                        )}
                        {r.enviado_em && (
                          <span className="status-dot bg-primary/10 text-primary">
                            <span className="size-1.5 rounded-full bg-primary" />
                            Enviado
                          </span>
                        )}
                        {r.arquivo_path && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 rounded-lg"
                            title="Baixar"
                            onClick={() =>
                              baixarDocumento(r.arquivo_path, `${TIPOS_RELATORIO[r.tipo] ?? r.tipo}.pdf`).catch(
                                () => toast.error("Nao foi possivel baixar"),
                              )
                            }
                          >
                            <Download className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab: Competencias */}
        <TabsContent value="competencias">
          <div className="rounded-2xl border border-border bg-card shadow-card">
            <div className="flex items-center justify-between border-b border-border/60 p-5">
              <h2 className="text-sm font-semibold">Competencias</h2>
              <Link
                to="/competencias"
                className="text-xs font-medium text-primary hover:underline"
              >
                Gerenciar competencias
              </Link>
            </div>
            <div className="p-2">
              {!competencias || competencias.length === 0 ? (
                <div className="py-16 text-center">
                  <CalendarRange className="mx-auto size-10 text-muted-foreground/30" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    Nenhuma competencia criada para este cliente.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {competencias.map((c) => {
                    const sc = competenciaStatusConfig(c.status);
                    return (
                      <div
                        key={c.id}
                        className="flex items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-muted/50"
                      >
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                          <CalendarRange className="size-4" />
                        </div>
                        <span className="flex-1 text-sm font-medium capitalize">
                          {formatarCompetencia(c.mes_ano)}
                        </span>
                        {c.taxa_conciliacao != null && (
                          <span className="hidden text-xs text-muted-foreground lg:block">
                            {formatarPorcentagem(c.taxa_conciliacao)}% conciliado
                          </span>
                        )}
                        {c.fechada_em && (
                          <span className="hidden text-xs text-muted-foreground lg:block">
                            Fechada em {formatarDataHora(c.fechada_em)}
                          </span>
                        )}
                        <span className={`status-dot ${sc.bg} ${sc.text}`}>
                          <span className={`size-1.5 rounded-full ${sc.dot}`} />
                          {STATUS_COMPETENCIA[c.status] ?? c.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab: Dados cadastrais */}
        <TabsContent value="dados">
          <div className="rounded-2xl border border-border bg-card shadow-card">
            <div className="border-b border-border/60 p-5">
              <h2 className="text-sm font-semibold">Dados cadastrais</h2>
            </div>
            <div className="space-y-5 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Razao social</Label>
                  <Input
                    className="rounded-xl"
                    defaultValue={cliente.razao_social ?? ""}
                    onBlur={(e) => salvar.mutate({ razao_social: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nome fantasia</Label>
                  <Input
                    className="rounded-xl"
                    defaultValue={cliente.nome_fantasia ?? ""}
                    onBlur={(e) =>
                      salvar.mutate({ nome_fantasia: e.target.value, nome: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail de contato</Label>
                  <Input
                    className="rounded-xl"
                    defaultValue={cliente.email_contato ?? ""}
                    onBlur={(e) => salvar.mutate({ email_contato: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    className="rounded-xl"
                    defaultValue={formatarTelefone(cliente.telefone ?? "")}
                    onBlur={(e) => salvar.mutate({ telefone: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Origens de documentos</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {ORIGENS_DOCUMENTO.map((o) => {
                    const atuais = cliente.origem_documentos ?? [];
                    return (
                      <label
                        key={o.value}
                        className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm"
                      >
                        <Checkbox
                          checked={atuais.includes(o.value)}
                          onCheckedChange={(marcado) =>
                            salvar.mutate({
                              origem_documentos: marcado
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

              <div className="flex items-center gap-3 rounded-xl border border-border/60 px-4 py-3">
                <Switch
                  checked={cliente.ativo}
                  onCheckedChange={(v) => salvar.mutate({ ativo: v })}
                />
                <span className="text-sm font-medium">Cliente ativo</span>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab: Links */}
        <TabsContent value="links">
          <div className="space-y-4">
            {/* Upload link */}
            <div className="rounded-2xl border border-border bg-card shadow-card">
              <div className="border-b border-border/60 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
                    <LinkIcon className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold">Link de upload</h2>
                    <p className="text-xs text-muted-foreground">
                      O cliente usa este link para enviar documentos. Nao precisa de senha.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-3 p-5">
                <div className="flex flex-wrap gap-2">
                  <Input
                    readOnly
                    value={linkUpload}
                    className="min-w-64 flex-1 rounded-xl font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => {
                      navigator.clipboard.writeText(linkUpload);
                      toast.success("Link copiado");
                    }}
                  >
                    <Copy className="size-4" /> Copiar
                  </Button>
                  <Button
                    variant="secondary"
                    className="rounded-xl"
                    onClick={() => setConfirmarToken(true)}
                  >
                    <RefreshCw className="size-4" /> Gerar novo
                  </Button>
                </div>
              </div>
            </div>

            {/* Panel link */}
            <div className="rounded-2xl border border-border bg-card shadow-card">
              <div className="border-b border-border/60 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
                    <ExternalLink className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold">Painel do cliente</h2>
                    <p className="text-xs text-muted-foreground">
                      Link onde o cliente consulta relatorios e status das competencias.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-3 p-5">
                <div className="flex flex-wrap gap-2">
                  <Input
                    readOnly
                    value={linkPainel}
                    className="min-w-64 flex-1 rounded-xl font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => {
                      navigator.clipboard.writeText(linkPainel);
                      toast.success("Link copiado");
                    }}
                  >
                    <Copy className="size-4" /> Copiar
                  </Button>
                  <Button
                    variant="secondary"
                    className="rounded-xl"
                    onClick={() => setConfirmarPainelToken(true)}
                  >
                    <RefreshCw className="size-4" /> Gerar novo
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Confirm: rotate upload token */}
      <AlertDialog open={confirmarToken} onOpenChange={setConfirmarToken}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar novo link de upload?</AlertDialogTitle>
            <AlertDialogDescription>
              O link atual sera invalidado e o cliente precisara receber o novo endereco.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => rotacionarToken.mutate("upload_token")}>
              Gerar novo link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm: rotate panel token */}
      <AlertDialog open={confirmarPainelToken} onOpenChange={setConfirmarPainelToken}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar novo link do painel?</AlertDialogTitle>
            <AlertDialogDescription>
              O link atual sera invalidado e o cliente precisara receber o novo endereco.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => rotacionarToken.mutate("painel_token")}>
              Gerar novo link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
