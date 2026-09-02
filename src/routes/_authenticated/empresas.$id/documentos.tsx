import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, RotateCcw, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil } from "@/hooks/use-perfil";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export const Route = createFileRoute("/_authenticated/empresas/$id/documentos")({
  head: () => ({
    meta: [
      { title: "Documentos — ConcilIA" },
      {
        name: "description",
        content: "Documentos contabeis recebidos dos clientes, com filtros, download e reenvio.",
      },
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
      if (!perfil) throw new Error("Perfil nao carregado.");
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
    onError: (e: Error) => toast.error("Nao foi possivel enviar", { description: e.message }),
  });

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Documentos</h1>
          <p className="page-subtitle">Todos os arquivos recebidos dos clientes.</p>
        </div>
        <Button onClick={() => setAberto(true)} className="rounded-xl">
          <Upload className="size-4" /> Upload manual
        </Button>
      </div>

      <div className="card-section">
        <div className="filter-bar">
          <Select value={fCliente} onValueChange={setFCliente}>
            <SelectTrigger className="min-w-40 flex-1 rounded-xl sm:flex-none">
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
            <SelectTrigger className="min-w-36 flex-1 rounded-xl sm:flex-none">
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
            <SelectTrigger className="min-w-36 flex-1 rounded-xl sm:flex-none">
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
            className="min-w-36 flex-1 rounded-xl sm:flex-none"
            value={fPeriodo}
            onChange={(e) => setFPeriodo(e.target.value)}
            aria-label="Periodo"
          />
        </div>

        <div className="card-section-body">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : filtrados.length === 0 ? (
            <div className="empty-state">
              <FileText className="empty-state-icon" />
              <p className="empty-state-text">
                Nenhum documento encontrado com esses filtros.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {filtrados.map((d) => (
                <div key={d.id} className="list-row">
                  <div className="list-row-icon bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                    <FileText className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {d.nome_original ?? "Arquivo"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {d.clientes?.nome_fantasia ?? d.clientes?.nome ?? "—"}
                      {" · "}
                      {rotuloTipo(d.tipo)}
                      {d.origem ? ` · ${ORIGENS_RECEBIMENTO[d.origem] ?? ""}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {badgeStatus(d.status_processamento)}
                    <span className="hidden text-xs text-muted-foreground lg:block">
                      {formatarDataHora(d.enviado_em)}
                    </span>
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-lg"
                        title="Reprocessar"
                        onClick={() => reprocessar.mutate(d.id)}
                      >
                        <RotateCcw className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-lg">
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
                <SelectTrigger className="rounded-xl">
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
                <SelectTrigger className="rounded-xl">
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
              <Label>Mes de referencia</Label>
              <Input
                type="month"
                className="rounded-xl"
                value={envio.mes}
                onChange={(e) => setEnvio({ ...envio, mes: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Arquivo</Label>
              <Input
                type="file"
                className="rounded-xl"
                accept={EXTENSOES_ACEITAS}
                onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button onClick={() => enviar.mutate()} disabled={enviar.isPending} className="rounded-xl">
              {enviar.isPending ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
