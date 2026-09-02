import { useEffect, useMemo, useState } from "react";
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
  ImagePlus,
  LinkIcon,
  Palette,
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

export const Route = createFileRoute("/_authenticated/empresas/$id/clientes/$clienteId")({
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
  const { id: empresaId, clienteId } = Route.useParams();
  const { data: perfil } = usePerfil();
  const queryClient = useQueryClient();
  const [confirmarToken, setConfirmarToken] = useState(false);
  const [confirmarPainelToken, setConfirmarPainelToken] = useState(false);

  const { data: cliente, isLoading } = useQuery({
    queryKey: ["cliente", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("*").eq("id", clienteId).single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!cliente) return;
    const root = document.documentElement;
    const props: string[] = [];
    function set(name: string, value: string) {
      root.style.setProperty(name, value);
      props.push(name);
    }
    if (cliente.cor_primaria) {
      set("--client-primary", cliente.cor_primaria);
    }
    return () => {
      props.forEach((name) => root.style.removeProperty(name));
    };
  }, [cliente]);

  const { data: documentos } = useQuery({
    queryKey: ["cliente-documentos", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documentos")
        .select("id, nome_original, tipo, origem, status_processamento, enviado_em, arquivo_path, erro_motivo")
        .eq("cliente_id", clienteId)
        .is("deleted_at", null)
        .order("enviado_em", { ascending: false });
      if (error) throw error;
      return data;
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
      return data;
    },
  });

  const { data: lancamentos } = useQuery({
    queryKey: ["cliente-lancamentos", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lancamentos")
        .select("id, data, descricao, valor, status, confianca_ia, conta_debito, conta_credito, documento_id, competencia_id")
        .eq("cliente_id", clienteId)
        .is("deleted_at", null)
        .order("data", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const competenciaIds = useMemo(() => (competencias ?? []).map((c) => c.id), [competencias]);

  const { data: relatorios } = useQuery({
    queryKey: ["cliente-relatorios", clienteId, competenciaIds],
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
      queryClient.invalidateQueries({ queryKey: ["cliente-documentos", clienteId] });
    },
    onError: (e: Error) => toast.error("Falha ao reprocessar", { description: e.message }),
  });

  const salvar = useMutation({
    mutationFn: async (valores: AtualizacaoCliente) => {
      const { error } = await supabase.from("clientes").update(valores).eq("id", clienteId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dados atualizados");
      queryClient.invalidateQueries({ queryKey: ["cliente", clienteId] });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
    },
    onError: (e: Error) => toast.error("Nao foi possivel salvar", { description: e.message }),
  });

  const rotacionarToken = useMutation({
    mutationFn: async (campo: "upload_token" | "painel_token") => {
      const novo = crypto.randomUUID();
      const { error } = await supabase.from("clientes").update({ [campo]: novo }).eq("id", clienteId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Novo link gerado", { description: "O link anterior foi invalidado." });
      setConfirmarToken(false);
      setConfirmarPainelToken(false);
      queryClient.invalidateQueries({ queryKey: ["cliente", clienteId] });
    },
    onError: (e: Error) => toast.error("Nao foi possivel gerar o link", { description: e.message }),
  });

  if (isLoading || !cliente) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const corCliente = cliente.cor_primaria || "#123B47";
  const linkUpload =
    typeof window !== "undefined" ? `${window.location.origin}/upload/${cliente.upload_token}` : "";
  const linkPainel =
    typeof window !== "undefined" ? `${window.location.origin}/painel/${cliente.painel_token}` : "";

  const totalDocs = documentos?.length ?? 0;
  const docsErro = documentos?.filter((d) => d.status_processamento === "erro").length ?? 0;
  const totalLancamentos = lancamentos?.length ?? 0;
  const lancPendentes = lancamentos?.filter((l) => l.status === "pendente").length ?? 0;
  const compAbertas = competencias?.filter((c) => c.status !== "fechada").length ?? 0;
  const taxaMedia = competencias?.length
    ? competencias.reduce((acc, c) => acc + (c.taxa_conciliacao ?? 0), 0) / competencias.length
    : null;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 rounded-lg">
        <Link to="/empresas/$id/clientes" params={{ id: empresaId }}>
          <ArrowLeft className="size-4" /> Voltar aos clientes
        </Link>
      </Button>

      <div
        className="card-section relative"
        style={{
          background: `linear-gradient(135deg, ${corCliente}18 0%, ${corCliente}08 50%, transparent 100%)`,
        }}
      >
        <div
          className="absolute inset-x-0 top-0 h-1"
          style={{ backgroundColor: corCliente }}
        />
        <div className="flex flex-wrap items-center gap-5 p-6">
          {cliente.logo_url ? (
            <img
              src={cliente.logo_url}
              alt={cliente.nome_fantasia ?? cliente.nome ?? ""}
              className="size-16 shrink-0 rounded-2xl border border-border bg-white object-contain p-1.5 shadow-sm"
            />
          ) : (
            <div
              className="flex size-16 shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-white shadow-sm"
              style={{ backgroundColor: corCliente }}
            >
              {(cliente.nome_fantasia ?? cliente.nome ?? "?")
                .split(" ")
                .slice(0, 2)
                .map((w) => w[0]?.toUpperCase())
                .join("")}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                {cliente.nome_fantasia ?? cliente.nome}
              </h1>
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
            <p className="mt-0.5 text-sm text-muted-foreground">
              {cliente.razao_social}
              {cliente.cnpj ? ` · ${formatarCnpj(cliente.cnpj)}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            {cliente.painel_token && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl text-xs"
                onClick={() => window.open(linkPainel, "_blank")}
              >
                <ExternalLink className="size-3.5" /> Ver como cliente
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px border-t border-border/60 bg-border/30 sm:grid-cols-4">
          {[
            {
              icone: FileText,
              valor: totalDocs,
              label: "Documentos",
              extra: docsErro > 0 ? `${docsErro} com erro` : null,
              extraCor: "text-destructive",
            },
            {
              icone: BookOpen,
              valor: totalLancamentos,
              label: "Lancamentos",
              extra: lancPendentes > 0 ? `${lancPendentes} pendentes` : null,
              extraCor: "text-warning-foreground",
            },
            {
              icone: CalendarRange,
              valor: compAbertas,
              label: "Comp. abertas",
              extra: null,
              extraCor: "",
            },
            {
              icone: Scale,
              valor: formatarPorcentagem(taxaMedia),
              label: "Conciliacao",
              extra: null,
              extraCor: "",
            },
          ].map(({ icone: Icone, valor, label, extra, extraCor }) => (
            <div key={label} className="flex items-center gap-3 bg-card/80 px-4 py-3 backdrop-blur-sm">
              <Icone className="size-4 shrink-0 text-muted-foreground/60" />
              <div className="min-w-0">
                <div className="text-lg font-bold tabular-nums leading-tight">{valor}</div>
                <div className="text-[0.6875rem] text-muted-foreground">
                  {label}
                  {extra && <span className={`ml-1 ${extraCor}`}>({extra})</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Tabs defaultValue="documentos">
        <div className="overflow-x-auto -mx-4 px-4 md:-mx-6 md:px-6">
          <TabsList className="inline-flex w-auto rounded-xl">
            <TabsTrigger value="documentos" className="rounded-lg text-xs sm:text-sm">
              <FileText className="mr-1.5 size-3.5 hidden sm:block" /> Documentos
            </TabsTrigger>
            <TabsTrigger value="lancamentos" className="rounded-lg text-xs sm:text-sm">
              <BookOpen className="mr-1.5 size-3.5 hidden sm:block" /> Lancamentos
            </TabsTrigger>
            <TabsTrigger value="conciliacao" className="rounded-lg text-xs sm:text-sm">
              <Scale className="mr-1.5 size-3.5 hidden sm:block" /> Conciliacao
            </TabsTrigger>
            <TabsTrigger value="relatorios" className="rounded-lg text-xs sm:text-sm">
              <FileBarChart className="mr-1.5 size-3.5 hidden sm:block" /> Relatorios
            </TabsTrigger>
            <TabsTrigger value="competencias" className="rounded-lg text-xs sm:text-sm">
              <CalendarRange className="mr-1.5 size-3.5 hidden sm:block" /> Competencias
            </TabsTrigger>
            <TabsTrigger value="dados" className="rounded-lg text-xs sm:text-sm">
              <ClipboardList className="mr-1.5 size-3.5 hidden sm:block" /> Dados
            </TabsTrigger>
            <TabsTrigger value="links" className="rounded-lg text-xs sm:text-sm">
              <LinkIcon className="mr-1.5 size-3.5 hidden sm:block" /> Links
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="documentos">
          <div className="card-section">
            <div className="card-section-header">
              <div className="flex items-center gap-3">
                <div className="list-row-icon bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                  <FileText className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Documentos recebidos</h2>
                  <p className="text-xs text-muted-foreground">
                    Arquivos enviados pelo cliente via link de upload ou manualmente.
                  </p>
                </div>
              </div>
            </div>
            <div className="card-section-body">
              {!documentos || documentos.length === 0 ? (
                <div className="empty-state">
                  <FileText className="empty-state-icon" />
                  <p className="empty-state-text">
                    Nenhum documento recebido deste cliente ainda.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Compartilhe o link de upload na aba "Links".
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {documentos.map((d) => (
                    <div key={d.id} className="list-row">
                      <div className="list-row-icon bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
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

        <TabsContent value="lancamentos">
          <div className="card-section">
            <div className="card-section-header">
              <div className="flex items-center gap-3">
                <div className="list-row-icon bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                  <BookOpen className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Lancamentos contabeis</h2>
                  <p className="text-xs text-muted-foreground">
                    Movimentacoes extraidas dos documentos e classificadas pela IA.
                  </p>
                </div>
              </div>
            </div>
            <div className="card-section-body">
              {!lancamentos || lancamentos.length === 0 ? (
                <div className="empty-state">
                  <BookOpen className="empty-state-icon" />
                  <p className="empty-state-text">Nenhum lancamento ainda.</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Os lancamentos serao criados automaticamente ao processar os documentos.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {lancamentos.map((l) => {
                    const sc = lancamentoStatusConfig(l.status);
                    return (
                      <div key={l.id} className="list-row">
                        <div className="list-row-icon bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
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

        <TabsContent value="conciliacao">
          <div className="card-section">
            <div className="card-section-header">
              <div className="flex items-center gap-3">
                <div className="list-row-icon bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                  <Scale className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Conciliacao bancaria</h2>
                  <p className="text-xs text-muted-foreground">
                    Conferencia automatica entre extrato bancario e lancamentos contabeis.
                  </p>
                </div>
              </div>
            </div>
            <div className="card-section-body">
              {!competencias || competencias.length === 0 ? (
                <div className="empty-state">
                  <Scale className="empty-state-icon" />
                  <p className="empty-state-text">
                    Crie uma competencia para iniciar a conciliacao.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {competencias
                    .filter((c) => c.status !== "fechada")
                    .map((c) => {
                      const taxa = c.taxa_conciliacao ?? 0;
                      return (
                        <div key={c.id} className="list-row flex-col !items-stretch !gap-0">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="list-row-icon bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
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
                              <span className="text-2xl font-bold tracking-tight tabular-nums">
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
                    <div className="empty-state">
                      <CheckCircle2 className="mx-auto size-10 text-success/30" />
                      <p className="empty-state-text">
                        Todas as competencias estao fechadas.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="relatorios">
          <div className="card-section">
            <div className="card-section-header">
              <div className="flex items-center gap-3">
                <div className="list-row-icon bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                  <FileBarChart className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Relatorios</h2>
                  <p className="text-xs text-muted-foreground">
                    Balancete, DRE, Balanco patrimonial e DFC gerados para o cliente.
                  </p>
                </div>
              </div>
            </div>
            <div className="card-section-body">
              {!relatorios || relatorios.length === 0 ? (
                <div className="empty-state">
                  <FileBarChart className="empty-state-icon" />
                  <p className="empty-state-text">Nenhum relatorio gerado ainda.</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Os relatorios serao gerados apos o fechamento da competencia.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {relatorios.map((r) => (
                    <div key={r.id} className="list-row">
                      <div className="list-row-icon bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                        <FileBarChart className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">
                          {TIPOS_RELATORIO[r.tipo] ?? r.tipo}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {r.competencias ? formatarCompetencia(r.competencias.mes_ano) : "—"}
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

        <TabsContent value="competencias">
          <div className="card-section">
            <div className="card-section-header">
              <div className="flex items-center gap-3">
                <div className="list-row-icon bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                  <CalendarRange className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Competencias</h2>
                </div>
              </div>
              <Link
                to="/empresas/$id/competencias"
                params={{ id: empresaId }}
                className="text-xs font-medium text-primary hover:underline"
              >
                Gerenciar competencias
              </Link>
            </div>
            <div className="card-section-body">
              {!competencias || competencias.length === 0 ? (
                <div className="empty-state">
                  <CalendarRange className="empty-state-icon" />
                  <p className="empty-state-text">
                    Nenhuma competencia criada para este cliente.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {competencias.map((c) => {
                    const sc = competenciaStatusConfig(c.status);
                    return (
                      <div key={c.id} className="list-row">
                        <div className="list-row-icon bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                          <CalendarRange className="size-4" />
                        </div>
                        <span className="flex-1 text-sm font-medium capitalize">
                          {formatarCompetencia(c.mes_ano)}
                        </span>
                        {c.taxa_conciliacao != null && (
                          <span className="hidden text-xs tabular-nums text-muted-foreground lg:block">
                            {formatarPorcentagem(c.taxa_conciliacao)} conciliado
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

        <TabsContent value="dados">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card-section">
              <div className="card-section-header">
                <div className="flex items-center gap-3">
                  <div className="list-row-icon bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                    <ClipboardList className="size-4" />
                  </div>
                  <h2 className="text-sm font-semibold">Dados cadastrais</h2>
                </div>
              </div>
              <div className="space-y-4 p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Razao social</Label>
                    <Input
                      className="rounded-xl"
                      defaultValue={cliente.razao_social ?? ""}
                      onBlur={(e) => salvar.mutate({ razao_social: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nome fantasia</Label>
                    <Input
                      className="rounded-xl"
                      defaultValue={cliente.nome_fantasia ?? ""}
                      onBlur={(e) =>
                        salvar.mutate({ nome_fantasia: e.target.value, nome: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">E-mail de contato</Label>
                    <Input
                      className="rounded-xl"
                      defaultValue={cliente.email_contato ?? ""}
                      onBlur={(e) => salvar.mutate({ email_contato: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Telefone</Label>
                    <Input
                      className="rounded-xl"
                      defaultValue={formatarTelefone(cliente.telefone ?? "")}
                      onBlur={(e) => salvar.mutate({ telefone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Origens de documentos</Label>
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

            <div className="card-section">
              <div className="card-section-header">
                <div className="flex items-center gap-3">
                  <div className="list-row-icon bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                    <Palette className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold">Identidade visual</h2>
                    <p className="text-xs text-muted-foreground">
                      Logo e cor que aparecem no ambiente do cliente.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-5 p-5">
                <div className="space-y-2">
                  <Label className="text-xs">Logo do cliente</Label>
                  <div className="flex items-center gap-4">
                    {cliente.logo_url ? (
                      <img
                        src={cliente.logo_url}
                        alt="Logo"
                        className="size-16 rounded-xl border border-border bg-white object-contain p-1.5"
                      />
                    ) : (
                      <div className="flex size-16 items-center justify-center rounded-xl border-2 border-dashed border-border text-muted-foreground">
                        <ImagePlus className="size-6" />
                      </div>
                    )}
                    <div className="space-y-1.5 flex-1">
                      <Input
                        className="rounded-xl text-xs"
                        placeholder="URL da logo (ex: https://...)"
                        defaultValue={cliente.logo_url ?? ""}
                        onBlur={(e) => salvar.mutate({ logo_url: e.target.value || null })}
                      />
                      <p className="text-[0.6875rem] text-muted-foreground">
                        Cole a URL de uma imagem PNG ou SVG.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Cor primaria</Label>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <input
                        type="color"
                        value={corCliente}
                        onChange={(e) => salvar.mutate({ cor_primaria: e.target.value })}
                        className="absolute inset-0 cursor-pointer opacity-0"
                      />
                      <div
                        className="flex size-10 items-center justify-center rounded-xl border border-border shadow-sm"
                        style={{ backgroundColor: corCliente }}
                      >
                        <Palette className="size-4 text-white/80" />
                      </div>
                    </div>
                    <Input
                      className="w-28 rounded-xl font-mono text-xs uppercase"
                      value={corCliente}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (/^#[0-9a-fA-F]{6}$/.test(v)) salvar.mutate({ cor_primaria: v });
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Usada no cabecalho e destaques.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 p-4">
                  <p className="mb-2 text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground">
                    Pre-visualizacao
                  </p>
                  <div
                    className="flex items-center gap-3 rounded-lg p-3"
                    style={{
                      background: `linear-gradient(135deg, ${corCliente}20, ${corCliente}08)`,
                    }}
                  >
                    {cliente.logo_url ? (
                      <img
                        src={cliente.logo_url}
                        alt=""
                        className="size-8 rounded-lg bg-white object-contain p-0.5"
                      />
                    ) : (
                      <div
                        className="flex size-8 items-center justify-center rounded-lg text-xs font-bold text-white"
                        style={{ backgroundColor: corCliente }}
                      >
                        {(cliente.nome_fantasia ?? "?").slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm font-semibold">{cliente.nome_fantasia ?? cliente.nome}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="links">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card-section">
              <div className="card-section-header">
                <div className="flex items-center gap-3">
                  <div className="list-row-icon bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                    <LinkIcon className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold">Link de upload</h2>
                    <p className="text-xs text-muted-foreground">
                      O cliente usa este link para enviar documentos.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-3 p-5">
                <Input
                  readOnly
                  value={linkUpload}
                  className="rounded-xl font-mono text-xs"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => {
                      navigator.clipboard.writeText(linkUpload);
                      toast.success("Link copiado");
                    }}
                  >
                    <Copy className="size-3.5" /> Copiar
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setConfirmarToken(true)}
                  >
                    <RefreshCw className="size-3.5" /> Gerar novo
                  </Button>
                </div>
              </div>
            </div>

            <div className="card-section">
              <div className="card-section-header">
                <div className="flex items-center gap-3">
                  <div className="list-row-icon bg-gradient-to-br from-success/15 to-success/5 text-success">
                    <ExternalLink className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold">Painel do cliente</h2>
                    <p className="text-xs text-muted-foreground">
                      Link para consultar relatorios e status.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-3 p-5">
                <Input
                  readOnly
                  value={linkPainel}
                  className="rounded-xl font-mono text-xs"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => {
                      navigator.clipboard.writeText(linkPainel);
                      toast.success("Link copiado");
                    }}
                  >
                    <Copy className="size-3.5" /> Copiar
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setConfirmarPainelToken(true)}
                  >
                    <RefreshCw className="size-3.5" /> Gerar novo
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

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
