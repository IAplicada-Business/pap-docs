import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarRange,
  Copy,
  Download,
  FileText,
  LinkIcon,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
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
import { ORIGENS_DOCUMENTO, rotuloTipo, STATUS_COMPETENCIA } from "@/lib/dominio";
import {
  formatarCnpj,
  formatarCompetencia,
  formatarDataHora,
  formatarTelefone,
} from "@/lib/formatadores";
import { baixarDocumento } from "@/lib/documentos";
import { badgeStatus } from "@/components/status-badge";

type AtualizacaoCliente = Database["public"]["Tables"]["clientes"]["Update"];

export const Route = createFileRoute("/_authenticated/clientes/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe do cliente — ConcilIA" },
      {
        name: "description",
        content: "Dados cadastrais, documentos, competências e link de upload do cliente.",
      },
      { property: "og:title", content: "Detalhe do cliente — ConcilIA" },
      { property: "og:description", content: "Ficha completa do cliente na ConcilIA." },
    ],
  }),
  component: ClienteDetalhe,
});

function statusConfig(status: string) {
  if (status === "fechada")
    return { dot: "bg-muted-foreground/50", bg: "bg-muted", text: "text-muted-foreground" };
  if (status === "em_conciliacao")
    return { dot: "bg-warning animate-pulse", bg: "bg-warning/10", text: "text-warning-foreground" };
  return { dot: "bg-success", bg: "bg-success/10", text: "text-success" };
}

function ClienteDetalhe() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const [confirmarToken, setConfirmarToken] = useState(false);

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
        .select("id, nome_original, tipo, origem, status_processamento, enviado_em, arquivo_path")
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
        .select("id, mes_ano, status, fechada_em")
        .eq("cliente_id", id)
        .is("deleted_at", null)
        .order("mes_ano", { ascending: false });
      if (error) throw error;
      return data;
    },
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
    onError: (e: Error) => toast.error("Não foi possível salvar", { description: e.message }),
  });

  const rotacionarToken = useMutation({
    mutationFn: async () => {
      const novo = crypto.randomUUID();
      const { error } = await supabase.from("clientes").update({ upload_token: novo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Novo link gerado", { description: "O link anterior foi invalidado." });
      setConfirmarToken(false);
      queryClient.invalidateQueries({ queryKey: ["cliente", id] });
    },
    onError: (e: Error) => toast.error("Não foi possível gerar o link", { description: e.message }),
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

      <Tabs defaultValue="dados">
        <TabsList className="rounded-xl">
          <TabsTrigger value="dados" className="rounded-lg">Dados</TabsTrigger>
          <TabsTrigger value="documentos" className="rounded-lg">Documentos</TabsTrigger>
          <TabsTrigger value="competencias" className="rounded-lg">Competências</TabsTrigger>
          <TabsTrigger value="link" className="rounded-lg">Link de Upload</TabsTrigger>
        </TabsList>

        <TabsContent value="dados">
          <div className="rounded-2xl border border-border bg-card shadow-card">
            <div className="border-b border-border/60 p-5">
              <h2 className="text-sm font-semibold">Dados cadastrais</h2>
            </div>
            <div className="space-y-5 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Razão social</Label>
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

        <TabsContent value="documentos">
          <div className="rounded-2xl border border-border bg-card shadow-card">
            <div className="border-b border-border/60 p-5">
              <h2 className="text-sm font-semibold">Documentos do cliente</h2>
            </div>
            <div className="p-2">
              {!documentos || documentos.length === 0 ? (
                <div className="py-16 text-center">
                  <FileText className="mx-auto size-10 text-muted-foreground/30" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    Nenhum documento recebido deste cliente ainda.
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
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {badgeStatus(d.status_processamento)}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-lg"
                          title="Baixar"
                          onClick={() =>
                            baixarDocumento(d.arquivo_path, d.nome_original).catch(() =>
                              toast.error("Não foi possível baixar o arquivo"),
                            )
                          }
                        >
                          <Download className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="competencias">
          <div className="rounded-2xl border border-border bg-card shadow-card">
            <div className="flex items-center justify-between border-b border-border/60 p-5">
              <h2 className="text-sm font-semibold">Competências</h2>
              <Link
                to="/competencias"
                className="text-xs font-medium text-primary hover:underline"
              >
                Gerenciar competências
              </Link>
            </div>
            <div className="p-2">
              {!competencias || competencias.length === 0 ? (
                <div className="py-16 text-center">
                  <CalendarRange className="mx-auto size-10 text-muted-foreground/30" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    Nenhuma competência criada para este cliente.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {competencias.map((c) => {
                    const sc = statusConfig(c.status);
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

        <TabsContent value="link">
          <div className="rounded-2xl border border-border bg-card shadow-card">
            <div className="border-b border-border/60 p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
                  <LinkIcon className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Link público de upload</h2>
                  <p className="text-xs text-muted-foreground">
                    Compartilhe este link com o cliente. Não precisa de senha para enviar documentos.
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-4 p-5">
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
                  <RefreshCw className="size-4" /> Gerar novo link
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Ao gerar um novo link, o anterior deixa de funcionar imediatamente.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmarToken} onOpenChange={setConfirmarToken}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar novo link de upload?</AlertDialogTitle>
            <AlertDialogDescription>
              O link atual será invalidado e o cliente precisará receber o novo endereço.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => rotacionarToken.mutate()}>
              Gerar novo link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
