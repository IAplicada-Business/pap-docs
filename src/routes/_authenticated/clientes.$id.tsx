import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, Download, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
      { title: "Detalhe do cliente — P&A Consultoria" },
      {
        name: "description",
        content: "Dados cadastrais, documentos, competências e link de upload do cliente.",
      },
      { property: "og:title", content: "Detalhe do cliente — P&A Consultoria" },
      { property: "og:description", content: "Ficha completa do cliente na P&A Consultoria." },
    ],
  }),
  component: ClienteDetalhe,
});

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
    return <Skeleton className="h-64 w-full" />;
  }

  const linkUpload =
    typeof window !== "undefined" ? `${window.location.origin}/upload/${cliente.upload_token}` : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
            <Link to="/clientes">
              <ArrowLeft className="size-4" /> Voltar
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            {cliente.nome_fantasia ?? cliente.nome}
          </h1>
          <p className="text-sm text-muted-foreground">
            {cliente.razao_social} · {formatarCnpj(cliente.cnpj ?? "")}
          </p>
        </div>
        <Badge
          variant="secondary"
          className={cliente.ativo ? "bg-success/15 text-success" : "bg-muted"}
        >
          {cliente.ativo ? "Ativo" : "Inativo"}
        </Badge>
      </div>

      <Tabs defaultValue="dados">
        <TabsList>
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="competencias">Competências</TabsTrigger>
          <TabsTrigger value="link">Link de Upload</TabsTrigger>
        </TabsList>

        <TabsContent value="dados">
          <Card>
            <CardHeader>
              <CardTitle>Dados cadastrais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Razão social</Label>
                  <Input
                    defaultValue={cliente.razao_social ?? ""}
                    onBlur={(e) => salvar.mutate({ razao_social: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nome fantasia</Label>
                  <Input
                    defaultValue={cliente.nome_fantasia ?? ""}
                    onBlur={(e) =>
                      salvar.mutate({ nome_fantasia: e.target.value, nome: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail de contato</Label>
                  <Input
                    defaultValue={cliente.email_contato ?? ""}
                    onBlur={(e) => salvar.mutate({ email_contato: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
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
                      <label key={o.value} className="flex items-center gap-2 text-sm">
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

              <div className="flex items-center gap-3 border-t pt-4">
                <Switch
                  checked={cliente.ativo}
                  onCheckedChange={(v) => salvar.mutate({ ativo: v })}
                />
                <span className="text-sm">Cliente ativo</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documentos">
          <Card>
            <CardHeader>
              <CardTitle>Documentos do cliente</CardTitle>
            </CardHeader>
            <CardContent>
              {!documentos || documentos.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum documento recebido deste cliente ainda.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Arquivo</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Recebido em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documentos.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">{d.nome_original ?? "Arquivo"}</TableCell>
                        <TableCell>{rotuloTipo(d.tipo)}</TableCell>
                        <TableCell>{badgeStatus(d.status_processamento)}</TableCell>
                        <TableCell>{formatarDataHora(d.enviado_em)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              baixarDocumento(d.arquivo_path, d.nome_original).catch(() =>
                                toast.error("Não foi possível baixar o arquivo"),
                              )
                            }
                          >
                            <Download className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="competencias">
          <Card>
            <CardHeader>
              <CardTitle>Competências</CardTitle>
              <CardDescription>
                Gerencie a criação e o fechamento em <Link to="/competencias" className="text-primary underline">Competências</Link>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!competencias || competencias.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenhuma competência criada para este cliente.
                </p>
              ) : (
                <ul className="divide-y">
                  {competencias.map((c) => (
                    <li key={c.id} className="flex items-center justify-between py-3 text-sm">
                      <span className="font-medium capitalize">
                        {formatarCompetencia(c.mes_ano)}
                      </span>
                      <Badge variant="secondary">
                        {STATUS_COMPETENCIA[c.status] ?? c.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="link">
          <Card>
            <CardHeader>
              <CardTitle>Link público de upload</CardTitle>
              <CardDescription>
                Compartilhe este link com o cliente. Ele não precisa de senha para enviar
                documentos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Input readOnly value={linkUpload} className="min-w-64 flex-1 font-mono text-xs" />
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(linkUpload);
                    toast.success("Link copiado");
                  }}
                >
                  <Copy className="size-4" /> Copiar
                </Button>
                <Button variant="secondary" onClick={() => setConfirmarToken(true)}>
                  <RefreshCw className="size-4" /> Gerar novo link
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Ao gerar um novo link, o anterior deixa de funcionar imediatamente.
              </p>
            </CardContent>
          </Card>
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
