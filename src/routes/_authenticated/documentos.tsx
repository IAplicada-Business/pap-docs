import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, RotateCcw, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil } from "@/hooks/use-perfil";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  EXTENSOES_ACEITAS,
  ORIGENS_RECEBIMENTO,
  STATUS_PROCESSAMENTO,
  TIPOS_DOCUMENTO,
  rotuloTipo,
} from "@/lib/dominio";
import { formatarDataHora, mesAnterior } from "@/lib/formatadores";
import { baixarDocumento, enviarDocumentoEquipe } from "@/lib/documentos";
import { badgeStatus } from "@/components/status-badge";

export const Route = createFileRoute("/_authenticated/documentos")({
  head: () => ({
    meta: [
      { title: "Documentos — P&A Consultoria" },
      {
        name: "description",
        content: "Documentos contábeis recebidos dos clientes, com filtros, download e reenvio.",
      },
      { property: "og:title", content: "Documentos — P&A Consultoria" },
      { property: "og:description", content: "Central de documentos recebidos." },
    ],
  }),
  component: DocumentosPage,
});

function DocumentosPage() {
  const { data: perfil } = usePerfil();
  const queryClient = useQueryClient();
  const [fCliente, setFCliente] = useState("todos");
  const [fTipo, setFTipo] = useState("todos");
  const [fStatus, setFStatus] = useState("todos");
  const [fPeriodo, setFPeriodo] = useState("");
  const [aberto, setAberto] = useState(false);
  const [envio, setEnvio] = useState({ cliente: "", tipo: "extrato", mes: mesAnterior() });
  const [arquivo, setArquivo] = useState<File | null>(null);

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
          "id, nome_original, tipo, origem, status_processamento, enviado_em, arquivo_path, cliente_id, clientes(nome_fantasia, nome)",
        )
        .is("deleted_at", null)
        .order("enviado_em", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtrados = useMemo(() => {
    return (documentos ?? []).filter((d) => {
      if (fCliente !== "todos" && d.cliente_id !== fCliente) return false;
      if (fTipo !== "todos" && d.tipo !== fTipo) return false;
      if (fStatus !== "todos" && d.status_processamento !== fStatus) return false;
      if (fPeriodo && !String(d.enviado_em).startsWith(fPeriodo)) return false;
      return true;
    });
  }, [documentos, fCliente, fTipo, fStatus, fPeriodo]);

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
      queryClient.invalidateQueries({ queryKey: ["documentos"] });
    },
    onError: (e: Error) => toast.error("Falha ao reprocessar", { description: e.message }),
  });

  const enviar = useMutation({
    mutationFn: async () => {
      if (!perfil) throw new Error("Perfil não carregado.");
      if (!envio.cliente) throw new Error("Selecione o cliente.");
      if (!arquivo) throw new Error("Selecione um arquivo.");
      await enviarDocumentoEquipe({
        orgId: perfil.org_id,
        clienteId: envio.cliente,
        tipo: envio.tipo,
        mesAno: envio.mes,
        arquivo,
      });
    },
    onSuccess: () => {
      toast.success("Documento enviado");
      setAberto(false);
      setArquivo(null);
      queryClient.invalidateQueries({ queryKey: ["documentos"] });
    },
    onError: (e: Error) => toast.error("Não foi possível enviar", { description: e.message }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documentos</h1>
          <p className="text-sm text-muted-foreground">Todos os arquivos recebidos dos clientes.</p>
        </div>
        <Button onClick={() => setAberto(true)}>
          <Upload className="size-4" /> Upload manual
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Select value={fCliente} onValueChange={setFCliente}>
              <SelectTrigger>
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
              <SelectTrigger>
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
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                {Object.entries(STATUS_PROCESSAMENTO).map(([valor, rotulo]) => (
                  <SelectItem key={valor} value={valor}>
                    {rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="month"
              value={fPeriodo}
              onChange={(e) => setFPeriodo(e.target.value)}
              aria-label="Período"
            />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtrados.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhum documento encontrado com esses filtros.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.clientes?.nome_fantasia ?? d.clientes?.nome ?? "—"}</TableCell>
                    <TableCell className="max-w-56 truncate font-medium">
                      {d.nome_original ?? "Arquivo"}
                    </TableCell>
                    <TableCell>{rotuloTipo(d.tipo)}</TableCell>
                    <TableCell>{ORIGENS_RECEBIMENTO[d.origem ?? ""] ?? "—"}</TableCell>
                    <TableCell>{badgeStatus(d.status_processamento)}</TableCell>
                    <TableCell>{formatarDataHora(d.enviado_em)}</TableCell>
                    <TableCell className="space-x-1 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Baixar"
                        onClick={() =>
                          baixarDocumento(d.arquivo_path, d.nome_original).catch(() =>
                            toast.error("Não foi possível baixar o arquivo"),
                          )
                        }
                      >
                        <Download className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Reprocessar"
                        onClick={() => reprocessar.mutate(d.id)}
                      >
                        <RotateCcw className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload manual</DialogTitle>
            <DialogDescription>
              Envie um documento em nome do cliente (ex.: recebido por e-mail).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select
                value={envio.cliente}
                onValueChange={(v) => setEnvio({ ...envio, cliente: v })}
              >
                <SelectTrigger>
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
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={envio.tipo} onValueChange={(v) => setEnvio({ ...envio, tipo: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_DOCUMENTO.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mês de referência</Label>
              <Input
                type="month"
                value={envio.mes}
                onChange={(e) => setEnvio({ ...envio, mes: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Arquivo</Label>
              <Input
                type="file"
                accept={EXTENSOES_ACEITAS}
                onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={() => enviar.mutate()} disabled={enviar.isPending}>
              {enviar.isPending ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
