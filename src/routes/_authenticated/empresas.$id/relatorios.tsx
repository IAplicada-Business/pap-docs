import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileBarChart2, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil } from "@/hooks/use-perfil";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  DataTable,
  FilterBar,
  InfoTip,
  PageHeader,
  SectionCard,
  Segmented,
  StatusPill,
  type Column,
} from "@/components/ui-kit";
import {
  MODELOS_RELATORIO,
  ROTULO_FORMATO,
  TIPOS_RELATORIO,
  type FormatoRelatorio,
  type ModeloRelatorio,
} from "@/lib/dominio";
import { formatarCompetencia, formatarDataHora, mesAnterior } from "@/lib/formatadores";
import { baixarDocumento, garantirCompetencia } from "@/lib/documentos";

export const Route = createFileRoute("/_authenticated/empresas/$id/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — ConcilIA" },
      {
        name: "description",
        content: "Modelos de relatório disponíveis para emissão e histórico de emissões.",
      },
    ],
  }),
  component: RelatoriosPage,
});

type Cliente = { id: string; nome_fantasia: string | null; nome: string | null };

type Emissao = {
  id: string;
  tipo: string;
  formato: string;
  arquivo_path: string | null;
  publicado_painel: boolean;
  enviado_em: string | null;
  created_at: string;
  parametros: Record<string, unknown> | null;
  competencias: {
    id: string;
    mes_ano: string;
    cliente_id: string;
    clientes: { nome_fantasia: string | null; nome: string | null } | null;
  } | null;
};

type StatusFiltro = "todas" | "pronto" | "gerando";

const TODOS = "todos";
const GRUPOS: ModeloRelatorio["grupo"][] = ["Contábeis", "Gerenciais", "Operacionais"];

function nomeCliente(c: { nome_fantasia: string | null; nome: string | null } | null | undefined) {
  return c?.nome_fantasia ?? c?.nome ?? "—";
}

function RelatoriosPage() {
  const { id: empresaId } = Route.useParams();
  const { data: perfil } = usePerfil();
  const queryClient = useQueryClient();

  const [modeloSel, setModeloSel] = useState<ModeloRelatorio | null>(null);

  // filtros das emissões
  const [fCliente, setFCliente] = useState(TODOS);
  const [fModelo, setFModelo] = useState(TODOS);
  const [fMes, setFMes] = useState("");
  const [fStatus, setFStatus] = useState<StatusFiltro>("todas");

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
      return data as Cliente[];
    },
  });

  const { data: emissoes, isLoading } = useQuery({
    queryKey: ["relatorios", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("relatorios")
        .select(
          "id, tipo, formato, arquivo_path, publicado_painel, enviado_em, created_at, parametros, competencias(id, mes_ano, cliente_id, clientes(nome_fantasia, nome))",
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as unknown as Emissao[];
    },
  });

  const filtradas = useMemo(() => {
    let rows = emissoes ?? [];
    if (fCliente !== TODOS) rows = rows.filter((r) => r.competencias?.cliente_id === fCliente);
    if (fModelo !== TODOS) rows = rows.filter((r) => r.tipo === fModelo);
    if (fMes) rows = rows.filter((r) => r.competencias?.mes_ano === `${fMes}-01`);
    if (fStatus === "pronto") rows = rows.filter((r) => !!r.arquivo_path);
    if (fStatus === "gerando") rows = rows.filter((r) => !r.arquivo_path);
    return rows;
  }, [emissoes, fCliente, fModelo, fMes, fStatus]);

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ["relatorios", empresaId] });
  }

  const alternarPainel = useMutation({
    mutationFn: async ({ id, valor }: { id: string; valor: boolean }) => {
      const { error } = await supabase
        .from("relatorios")
        .update({ publicado_painel: valor })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: (e: Error) => toast.error("Não foi possível atualizar", { description: e.message }),
  });

  const marcarEnviado = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("relatorios")
        .update({ enviado_em: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marcado como enviado");
      invalidar();
    },
    onError: (e: Error) => toast.error("Não foi possível atualizar", { description: e.message }),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("relatorios")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Emissão removida");
      invalidar();
    },
    onError: (e: Error) => toast.error("Não foi possível remover", { description: e.message }),
  });

  const colunas: Column<Emissao>[] = [
    {
      key: "modelo",
      header: "Modelo",
      sortValue: (r) => TIPOS_RELATORIO[r.tipo] ?? r.tipo,
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{TIPOS_RELATORIO[r.tipo] ?? r.tipo}</div>
          <div className="text-[0.6875rem] text-muted-foreground">
            Solicitado {formatarDataHora(r.created_at)}
          </div>
        </div>
      ),
    },
    {
      key: "cliente",
      header: "Cliente",
      sortValue: (r) => nomeCliente(r.competencias?.clientes),
      cell: (r) => (
        <span className="text-muted-foreground">{nomeCliente(r.competencias?.clientes)}</span>
      ),
    },
    {
      key: "competencia",
      header: "Competência",
      hideBelow: "sm",
      sortValue: (r) => r.competencias?.mes_ano ?? "",
      cell: (r) => {
        const p = r.parametros as { de?: string; ate?: string } | null;
        if (p?.de && p?.ate && p.de !== p.ate)
          return (
            <span className="text-xs text-muted-foreground">
              {formatarCompetencia(`${p.de}-01`)} – {formatarCompetencia(`${p.ate}-01`)}
            </span>
          );
        return (
          <span className="text-xs text-muted-foreground">
            {r.competencias ? formatarCompetencia(r.competencias.mes_ano) : "—"}
          </span>
        );
      },
    },
    {
      key: "formato",
      header: "Formato",
      hideBelow: "md",
      width: "90px",
      cell: (r) => (
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[0.6875rem] font-semibold uppercase text-muted-foreground">
          {r.formato}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "120px",
      sortValue: (r) => (r.arquivo_path ? 1 : 0),
      cell: (r) =>
        r.arquivo_path ? (
          <StatusPill tone="success" label="Pronto" size="xs" />
        ) : (
          <StatusPill tone="warning" label="Em geração" size="xs" pulse />
        ),
    },
    {
      key: "painel",
      header: "Painel",
      hideBelow: "lg",
      width: "80px",
      cell: (r) => (
        <Switch
          checked={r.publicado_painel}
          onCheckedChange={(v) => alternarPainel.mutate({ id: r.id, valor: v })}
          aria-label="Publicar no painel do cliente"
        />
      ),
    },
    {
      key: "envio",
      header: "Envio",
      hideBelow: "lg",
      width: "150px",
      cell: (r) =>
        r.enviado_em ? (
          <span className="text-[0.6875rem] text-muted-foreground">
            Enviado {formatarDataHora(r.enviado_em)}
          </span>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 rounded-md px-2 text-[0.6875rem]"
            disabled={!r.arquivo_path}
            onClick={() => marcarEnviado.mutate(r.id)}
          >
            <Send className="size-3" /> Marcar enviado
          </Button>
        ),
    },
    {
      key: "acoes",
      header: "",
      align: "right",
      width: "80px",
      cell: (r) => (
        <div className="flex items-center justify-end gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded-md text-muted-foreground hover:text-foreground"
            disabled={!r.arquivo_path}
            title={r.arquivo_path ? "Baixar" : "Ainda em geração"}
            onClick={() =>
              baixarDocumento(
                r.arquivo_path,
                `${TIPOS_RELATORIO[r.tipo] ?? r.tipo} - ${nomeCliente(r.competencias?.clientes)}.${r.formato}`,
              )
            }
          >
            <Download className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded-md text-muted-foreground hover:text-destructive"
            title="Remover emissão"
            onClick={() => remover.mutate(r.id)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Relatórios"
        description="Escolha um modelo, informe cliente e competência e emita. As emissões ficam listadas abaixo para baixar, publicar no painel do cliente e marcar como enviadas."
      />

      {/* ───────────── Modelos disponíveis ───────────── */}
      <div className="space-y-4">
        {GRUPOS.map((grupo) => {
          const modelos = MODELOS_RELATORIO.filter((m) => m.grupo === grupo);
          if (modelos.length === 0) return null;
          return (
            <div key={grupo}>
              <div className="mb-2 flex items-center gap-2 px-0.5">
                <h2 className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                  {grupo}
                </h2>
                <span className="text-[0.6875rem] text-muted-foreground/60">{modelos.length}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {modelos.map((m) => (
                  <button
                    key={m.tipo}
                    type="button"
                    onClick={() => setModeloSel(m)}
                    className="section-card group flex flex-col items-start gap-3 px-4 py-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                  >
                    <div className="flex w-full items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-[0.875rem] font-semibold tracking-tight">
                          {m.nome}
                        </span>
                        <InfoTip text={m.descricao} />
                      </div>
                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[0.625rem] font-medium text-muted-foreground">
                        {m.periodo === "competencia" ? "Mensal" : "Período"}
                      </span>
                    </div>
                    <div className="flex w-full items-center justify-between gap-2">
                      <div className="flex gap-1">
                        {m.formatos.map((f) => (
                          <span
                            key={f}
                            className="rounded-md border border-border/70 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase text-muted-foreground"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                      <span className="text-xs font-semibold text-primary opacity-70 transition-opacity group-hover:opacity-100">
                        Emitir →
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ───────────── Emissões ───────────── */}
      <SectionCard
        title="Emissões"
        description="Todas as emissões solicitadas. Filtre por cliente, modelo, competência ou situação."
        flush
        actions={
          <span className="text-xs font-semibold text-muted-foreground">
            {filtradas.length} itens
          </span>
        }
      >
        <FilterBar className="border-b border-border/50 px-4 py-2.5">
          <Select value={fCliente} onValueChange={setFCliente}>
            <SelectTrigger className="h-8 w-52 rounded-lg text-xs" aria-label="Cliente">
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos os clientes</SelectItem>
              {(clientes ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {nomeCliente(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={fModelo} onValueChange={setFModelo}>
            <SelectTrigger className="h-8 w-48 rounded-lg text-xs" aria-label="Modelo">
              <SelectValue placeholder="Modelo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todos os modelos</SelectItem>
              {MODELOS_RELATORIO.map((m) => (
                <SelectItem key={m.tipo} value={m.tipo}>
                  {m.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="month"
            value={fMes}
            onChange={(e) => setFMes(e.target.value)}
            className="h-8 w-40 rounded-lg text-xs"
            aria-label="Competência"
          />
          <Segmented
            value={fStatus}
            onChange={setFStatus}
            items={[
              { value: "todas", label: "Todas" },
              { value: "pronto", label: "Prontas" },
              { value: "gerando", label: "Em geração" },
            ]}
          />
          {(fCliente !== TODOS || fModelo !== TODOS || fMes || fStatus !== "todas") && (
            <button
              type="button"
              onClick={() => {
                setFCliente(TODOS);
                setFModelo(TODOS);
                setFMes("");
                setFStatus("todas");
              }}
              className="ml-auto text-[0.6875rem] font-medium text-muted-foreground hover:text-foreground"
            >
              Limpar filtros
            </button>
          )}
        </FilterBar>
        <DataTable
          rows={filtradas}
          columns={colunas}
          rowKey={(r) => r.id}
          loading={isLoading}
          dense
          emptyTitle="Nenhuma emissão"
          emptyHint="Escolha um modelo acima para emitir o primeiro relatório."
        />
      </SectionCard>

      {modeloSel && perfil && (
        <DialogEmitir
          modelo={modeloSel}
          clientes={clientes ?? []}
          orgId={perfil.org_id}
          onClose={() => setModeloSel(null)}
          onDone={() => {
            setModeloSel(null);
            invalidar();
          }}
        />
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Diálogo de emissão                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

function DialogEmitir({
  modelo,
  clientes,
  orgId,
  onClose,
  onDone,
}: {
  modelo: ModeloRelatorio;
  clientes: Cliente[];
  orgId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [clienteId, setClienteId] = useState("");
  const [mes, setMes] = useState(mesAnterior());
  const [de, setDe] = useState(mesAnterior());
  const [ate, setAte] = useState(mesAnterior());
  const [formato, setFormato] = useState<FormatoRelatorio>(modelo.formatos[0] ?? "pdf");
  const [publicar, setPublicar] = useState(true);
  const [enviarEmail, setEnviarEmail] = useState(false);
  const [observacoes, setObservacoes] = useState("");

  const emitir = useMutation({
    mutationFn: async () => {
      if (!clienteId) throw new Error("Selecione o cliente.");
      const competenciaMes = modelo.periodo === "competencia" ? mes : ate;
      if (!/^\d{4}-\d{2}$/.test(competenciaMes)) throw new Error("Informe a competência.");
      if (modelo.periodo === "intervalo" && de > ate)
        throw new Error("O período inicial não pode ser depois do final.");
      const competenciaId = await garantirCompetencia(orgId, clienteId, competenciaMes);
      const parametros: Record<string, unknown> = {
        enviar_email: enviarEmail,
        observacoes: observacoes.trim() || null,
      };
      if (modelo.periodo === "intervalo") {
        parametros["de"] = de;
        parametros["ate"] = ate;
      }
      const { error } = await supabase.from("relatorios").insert({
        org_id: orgId,
        competencia_id: competenciaId,
        tipo: modelo.tipo,
        formato,
        parametros: parametros as never,
        publicado_painel: publicar,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${modelo.nome} solicitado`, {
        description: "Aparece em Emissões como 'Em geração' até o arquivo ficar pronto.",
      });
      onDone();
    },
    onError: (e: Error) => toast.error("Não foi possível emitir", { description: e.message }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileBarChart2 className="size-4 text-primary" /> Emitir {modelo.nome}
          </DialogTitle>
          <DialogDescription>{modelo.descricao}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs">Cliente</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger className="h-9 rounded-lg text-sm">
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {nomeCliente(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {modelo.periodo === "competencia" ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Competência</Label>
              <Input
                type="month"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                className="h-9 rounded-lg text-sm"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">De</Label>
                <Input
                  type="month"
                  value={de}
                  onChange={(e) => setDe(e.target.value)}
                  className="h-9 rounded-lg text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Até</Label>
                <Input
                  type="month"
                  value={ate}
                  onChange={(e) => setAte(e.target.value)}
                  className="h-9 rounded-lg text-sm"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Formato</Label>
            <Segmented
              value={formato}
              onChange={setFormato}
              items={modelo.formatos.map((f) => ({ value: f, label: ROTULO_FORMATO[f] }))}
            />
          </div>

          <div className="space-y-2 rounded-lg border border-border/60 p-3">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-1">
                Publicar no painel do cliente
                <InfoTip text="O cliente vê o relatório no painel dele assim que o arquivo ficar pronto." />
              </span>
              <Switch checked={publicar} onCheckedChange={setPublicar} />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-1">
                Enviar por e-mail ao ficar pronto
                <InfoTip text="Usa o e-mail de contato cadastrado no cliente." />
              </span>
              <Switch checked={enviarEmail} onCheckedChange={setEnviarEmail} />
            </label>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Observações (opcional)</Label>
            <Input
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex.: incluir nota sobre ajuste de abril"
              className="h-9 rounded-lg text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="rounded-lg" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            className="rounded-lg"
            onClick={() => emitir.mutate()}
            disabled={emitir.isPending}
          >
            {emitir.isPending ? "Emitindo…" : `Emitir ${ROTULO_FORMATO[formato]}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
