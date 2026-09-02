import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  LayoutGrid,
  LayoutList,
  MessageCircle,
  Plus,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil, useEmpresa } from "@/hooks/use-perfil";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  ActiveChips,
  Avatar,
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
  StatusPill,
  pillCompetencia,
  type Chip,
  type Column,
} from "@/components/ui-kit";
import { ORIGENS_DOCUMENTO, rotuloOrigemDocumento } from "@/lib/dominio";
import {
  apenasDigitos,
  cnpjValido,
  formatarCnpj,
  formatarTelefone,
  mesAtual,
} from "@/lib/formatadores";
import { linkWhatsApp, mensagemCobranca } from "@/lib/cobranca";

type Filtro = "todos" | "ativos" | "inativos" | "pendentes";
type Search = { filtro?: Filtro };

export const Route = createFileRoute("/_authenticated/empresas/$id/clientes/")({
  validateSearch: (s: Record<string, unknown>): Search => {
    const f = s["filtro"];
    return f === "ativos" || f === "inativos" || f === "pendentes" || f === "todos"
      ? { filtro: f }
      : {};
  },
  head: () => ({
    meta: [
      { title: "Clientes — ConcilIA" },
      {
        name: "description",
        content: "Carteira de clientes com saúde do mês: envios, erros, competência e conciliação.",
      },
    ],
  }),
  component: ClientesPage,
});

type Cliente = {
  id: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  nome: string | null;
  cnpj: string;
  email_contato: string | null;
  telefone: string | null;
  ativo: boolean;
  origem_documentos: string[];
  logo_url: string | null;
  upload_token: string | null;
};

type Saude = Cliente & {
  docsMes: number;
  erros: number;
  comp: { status: string; taxa: number | null } | null;
};

function ClientesPage() {
  const { id: empresaId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: perfil } = usePerfil();
  const { data: empresa } = useEmpresa(empresaId);
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [fOrigem, setFOrigem] = useState("todas");
  const [visao, setVisao] = useState<"cards" | "tabela">("cards");
  const [aberto, setAberto] = useState(false);
  const filtro: Filtro = search.filtro ?? "todos";
  const setFiltro = (f: Filtro) => navigate({ search: f === "todos" ? {} : { filtro: f } });

  const [form, setForm] = useState({
    razao_social: "",
    nome_fantasia: "",
    cnpj: "",
    email_contato: "",
    telefone: "",
    origem_documentos: [] as string[],
  });

  const { data, isLoading } = useQuery({
    queryKey: ["clientes-saude"],
    queryFn: async () => {
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);
      const [cl, docs, comps] = await Promise.all([
        supabase
          .from("clientes")
          .select(
            "id, razao_social, nome_fantasia, nome, cnpj, email_contato, telefone, ativo, origem_documentos, logo_url, upload_token",
          )
          .is("deleted_at", null)
          .order("nome_fantasia"),
        supabase
          .from("documentos")
          .select("cliente_id, status_processamento, enviado_em")
          .is("deleted_at", null)
          .gte("enviado_em", inicioMes.toISOString()),
        supabase
          .from("competencias")
          .select("cliente_id, status, taxa_conciliacao, mes_ano")
          .is("deleted_at", null)
          .order("mes_ano", { ascending: false }),
      ]);
      if (cl.error) throw cl.error;
      return {
        clientes: (cl.data ?? []) as Cliente[],
        docs: docs.data ?? [],
        comps: comps.data ?? [],
      };
    },
  });

  const { data: errosTotais } = useQuery({
    queryKey: ["clientes-erros"],
    queryFn: async () => {
      const { data: d } = await supabase
        .from("documentos")
        .select("cliente_id")
        .eq("status_processamento", "erro")
        .is("deleted_at", null);
      const m = new Map<string, number>();
      (d ?? []).forEach((x) => m.set(x.cliente_id, (m.get(x.cliente_id) ?? 0) + 1));
      return m;
    },
  });

  const saude = useMemo<Saude[]>(() => {
    const docsPor = new Map<string, number>();
    (data?.docs ?? []).forEach((d) =>
      docsPor.set(d.cliente_id, (docsPor.get(d.cliente_id) ?? 0) + 1),
    );
    const compPor = new Map<string, { status: string; taxa: number | null }>();
    (data?.comps ?? []).forEach((c) => {
      if (!compPor.has(c.cliente_id))
        compPor.set(c.cliente_id, { status: c.status, taxa: c.taxa_conciliacao });
    });
    return (data?.clientes ?? []).map((c) => ({
      ...c,
      docsMes: docsPor.get(c.id) ?? 0,
      erros: errosTotais?.get(c.id) ?? 0,
      comp: compPor.get(c.id) ?? null,
    }));
  }, [data, errosTotais]);

  const k = useMemo(() => {
    const ativos = saude.filter((c) => c.ativo);
    const enviaram = ativos.filter((c) => c.docsMes > 0).length;
    const pendentes = ativos.length - enviaram;
    const comErro = saude.filter((c) => c.erros > 0).length;
    return { ativos: ativos.length, enviaram, pendentes, comErro, total: saude.length };
  }, [saude]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return saude.filter((c) => {
      if (filtro === "ativos" && !c.ativo) return false;
      if (filtro === "inativos" && c.ativo) return false;
      if (filtro === "pendentes" && !(c.ativo && c.docsMes === 0)) return false;
      if (fOrigem !== "todas" && !(c.origem_documentos ?? []).includes(fOrigem)) return false;
      if (!termo) return true;
      return [c.razao_social, c.nome_fantasia, c.nome, c.cnpj]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(termo));
    });
  }, [saude, busca, filtro, fOrigem]);

  const criar = useMutation({
    mutationFn: async () => {
      if (!perfil) throw new Error("Perfil não carregado.");
      if (!form.razao_social.trim()) throw new Error("Informe a razão social.");
      if (!cnpjValido(form.cnpj)) throw new Error("CNPJ inválido.");
      const { error } = await supabase.from("clientes").insert({
        org_id: perfil.org_id,
        nome: form.nome_fantasia || form.razao_social,
        razao_social: form.razao_social,
        nome_fantasia: form.nome_fantasia || form.razao_social,
        cnpj: apenasDigitos(form.cnpj),
        email_contato: form.email_contato || null,
        telefone: form.telefone || null,
        origem_documentos: form.origem_documentos,
        ativo: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente cadastrado");
      setAberto(false);
      setForm({
        razao_social: "",
        nome_fantasia: "",
        cnpj: "",
        email_contato: "",
        telefone: "",
        origem_documentos: [],
      });
      queryClient.invalidateQueries({ queryKey: ["clientes-saude"] });
      queryClient.invalidateQueries({ queryKey: ["clientes-select"] });
    },
    onError: (e: Error) => toast.error("Não foi possível cadastrar", { description: e.message }),
  });

  const chips: Chip[] = [];
  if (filtro !== "todos")
    chips.push({
      key: "filtro",
      label: {
        ativos: "Somente ativos",
        inativos: "Somente inativos",
        pendentes: "Pendentes de envio",
        todos: "",
      }[filtro],
      onRemove: () => setFiltro("todos"),
    });
  if (fOrigem !== "todas")
    chips.push({
      key: "origem",
      label: `Origem: ${rotuloOrigemDocumento(fOrigem)}`,
      onRemove: () => setFOrigem("todas"),
    });

  const nome = (c: Cliente) => c.nome_fantasia ?? c.nome ?? c.razao_social ?? "Cliente";
  const abrir = (c: Cliente) =>
    navigate({
      to: "/empresas/$id/clientes/$clienteId",
      params: { id: empresaId, clienteId: c.id },
    });
  const cobranca = (c: Saude) => {
    const link =
      c.upload_token && typeof window !== "undefined"
        ? `${window.location.origin}/upload/${c.upload_token}`
        : null;
    return linkWhatsApp(
      c.telefone,
      mensagemCobranca(nome(c), mesAtual(), empresa?.nome ?? "ConcilIA", link),
    );
  };

  const EnvioMes = ({ c }: { c: Saude }) =>
    !c.ativo ? (
      <StatusPill tone="neutral" label="Inativo" size="xs" />
    ) : c.docsMes > 0 ? (
      <StatusPill tone="success" label={`${c.docsMes} doc(s) no mês`} size="xs" />
    ) : (
      <StatusPill tone="warning" label="Sem envio no mês" size="xs" />
    );

  const colunas: Column<Saude>[] = [
    {
      key: "nome",
      header: "Cliente",
      sortValue: nome,
      cell: (c) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={nome(c)} src={c.logo_url} size="sm" />
          <div className="min-w-0">
            <div className="truncate font-semibold">{nome(c)}</div>
            <div className="truncate text-[0.6875rem] text-muted-foreground">
              {c.razao_social} · {formatarCnpj(c.cnpj)}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "origens",
      header: "Origens",
      hideBelow: "lg",
      cell: (c) => (
        <div className="flex flex-wrap gap-1">
          {(c.origem_documentos ?? []).slice(0, 3).map((o) => (
            <span
              key={o}
              className="rounded-md bg-muted px-1.5 py-0.5 text-[0.6875rem] text-muted-foreground"
            >
              {rotuloOrigemDocumento(o)}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: "envio",
      header: "Envio do mês",
      sortValue: (c) => c.docsMes,
      cell: (c) => <EnvioMes c={c} />,
    },
    {
      key: "comp",
      header: "Competência atual",
      hideBelow: "md",
      cell: (c) =>
        c.comp ? (
          pillCompetencia(c.comp.status, "xs")
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "taxa",
      header: "Conciliação",
      hideBelow: "md",
      sortValue: (c) => c.comp?.taxa ?? -1,
      cell: (c) => (
        <div className="flex items-center gap-2">
          <div className="w-16">
            <ProgressBar value={c.comp?.taxa ?? 0} />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">
            {c.comp?.taxa != null ? `${Math.round(c.comp.taxa)}%` : "—"}
          </span>
        </div>
      ),
    },
    {
      key: "erros",
      header: "Erros",
      align: "center",
      hideBelow: "sm",
      sortValue: (c) => c.erros,
      cell: (c) =>
        c.erros ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive">
            <AlertTriangle className="size-3" />
            {c.erros}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">0</span>
        ),
    },
    {
      key: "acoes",
      header: "",
      align: "right",
      cell: (c) =>
        c.ativo && c.docsMes === 0 ? (
          <a
            href={cobranca(c)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 rounded-md bg-success/10 px-2 py-1 text-[0.6875rem] font-semibold text-success hover:bg-success/20"
          >
            <MessageCircle className="size-3" /> Cobrar
          </a>
        ) : null,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Clientes"
        description="Carteira do escritório com a saúde de cada cliente no mês: quem já enviou documentos, quem está pendente e como anda a conciliação."
        actions={
          <>
            <Segmented
              value={visao}
              onChange={setVisao}
              items={[
                { value: "cards", label: "Cards", icon: LayoutGrid },
                { value: "tabela", label: "Tabela", icon: LayoutList },
              ]}
            />
            <Button size="sm" className="h-8 rounded-lg" onClick={() => setAberto(true)}>
              <Plus className="size-3.5" /> Novo cliente
            </Button>
          </>
        }
      />

      <KpiGrid cols={4}>
        <KpiCard
          label="Clientes ativos"
          value={k.ativos}
          icon={Users}
          tone="primary"
          loading={isLoading}
          footer={`${k.total - k.ativos} inativos`}
          onClick={() => setFiltro("ativos")}
          active={filtro === "ativos"}
          hint="Clientes atendidos atualmente. Clique para filtrar."
        />
        <KpiCard
          label="Enviaram este mês"
          value={k.enviaram}
          icon={CheckCircle2}
          tone="success"
          loading={isLoading}
          progress={k.ativos ? (k.enviaram / k.ativos) * 100 : 0}
          footer={`${k.ativos ? Math.round((k.enviaram / k.ativos) * 100) : 0}% da carteira`}
          hint="Clientes ativos com ao menos um documento recebido no mês corrente."
        />
        <KpiCard
          label="Pendentes de envio"
          value={k.pendentes}
          icon={MessageCircle}
          tone={k.pendentes ? "warning" : "neutral"}
          loading={isLoading}
          onClick={() => setFiltro("pendentes")}
          active={filtro === "pendentes"}
          hint="Ainda não mandaram nada este mês. Clique para filtrar e cobrar pelo WhatsApp."
        />
        <KpiCard
          label="Com documentos em erro"
          value={k.comErro}
          icon={AlertTriangle}
          tone={k.comErro ? "danger" : "neutral"}
          loading={isLoading}
          hint="Clientes com ao menos um documento que falhou na leitura automática."
        />
      </KpiGrid>

      <SectionCard flush>
        <div className="space-y-2 border-b border-border/50 px-4 py-3">
          <FilterBar>
            <SearchInput
              value={busca}
              onChange={setBusca}
              placeholder="Buscar por nome ou CNPJ"
              className="w-full sm:w-72"
            />
            <Select value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
              <SelectTrigger className="h-8 w-44 rounded-lg text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativos">Somente ativos</SelectItem>
                <SelectItem value="pendentes">Pendentes de envio</SelectItem>
                <SelectItem value="inativos">Somente inativos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fOrigem} onValueChange={setFOrigem}>
              <SelectTrigger className="h-8 w-44 rounded-lg text-xs">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as origens</SelectItem>
                {ORIGENS_DOCUMENTO.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {filtrados.length} cliente(s)
            </span>
          </FilterBar>
          <ActiveChips chips={chips} />
        </div>

        {visao === "tabela" ? (
          <DataTable
            rows={filtrados}
            columns={colunas}
            rowKey={(c) => c.id}
            loading={isLoading}
            onRowClick={abrir}
            defaultSort={{ key: "nome", dir: "asc" }}
            emptyTitle="Nenhum cliente encontrado"
            emptyHint="Ajuste os filtros ou cadastre o primeiro cliente."
          />
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-40 animate-pulse rounded-lg bg-muted/60" />
              ))}
            {!isLoading && filtrados.length === 0 && (
              <div className="sm:col-span-2 xl:col-span-3 2xl:col-span-4">
                <EmptyState
                  icon={Building2}
                  title="Nenhum cliente encontrado"
                  hint="Ajuste os filtros ou cadastre o primeiro cliente."
                  action={
                    <Button size="sm" className="rounded-lg" onClick={() => setAberto(true)}>
                      <Plus className="size-3.5" /> Novo cliente
                    </Button>
                  }
                />
              </div>
            )}
            {filtrados.map((c) => (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => abrir(c)}
                onKeyDown={(e) => e.key === "Enter" && abrir(c)}
                className="group cursor-pointer rounded-lg border border-border/60 bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card-hover"
              >
                <div className="flex items-start gap-3">
                  <Avatar name={nome(c)} src={c.logo_url} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{nome(c)}</div>
                    <div className="truncate text-[0.6875rem] text-muted-foreground">
                      {formatarCnpj(c.cnpj)}
                    </div>
                  </div>
                  {c.erros > 0 && (
                    <span
                      className="flex items-center gap-1 rounded-md bg-destructive/10 px-1.5 py-0.5 text-[0.6875rem] font-semibold text-destructive"
                      title="Documentos com erro"
                    >
                      <AlertTriangle className="size-3" />
                      {c.erros}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <EnvioMes c={c} />
                  {c.comp && pillCompetencia(c.comp.status, "xs")}
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-[0.6875rem] text-muted-foreground">
                    <span>Conciliação</span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {c.comp?.taxa != null ? `${Math.round(c.comp.taxa)}%` : "—"}
                    </span>
                  </div>
                  <ProgressBar
                    value={c.comp?.taxa ?? 0}
                    tone={c.comp?.status === "em_conciliacao" ? "warning" : "primary"}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {(c.origem_documentos ?? []).slice(0, 2).map((o) => (
                      <span
                        key={o}
                        className="rounded bg-muted px-1.5 py-0.5 text-[0.625rem] text-muted-foreground"
                      >
                        {rotuloOrigemDocumento(o)}
                      </span>
                    ))}
                  </div>
                  {c.ativo && c.docsMes === 0 ? (
                    <a
                      href={cobranca(c)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 rounded-md bg-success/10 px-2 py-1 text-[0.6875rem] font-semibold text-success hover:bg-success/20"
                    >
                      <MessageCircle className="size-3" /> Cobrar
                    </a>
                  ) : (
                    <Link
                      to="/empresas/$id/clientes/$clienteId"
                      params={{ id: empresaId, clienteId: c.id }}
                      onClick={(e) => e.stopPropagation()}
                      className="text-[0.6875rem] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      Abrir →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo cliente</DialogTitle>
            <DialogDescription>
              Cadastre a organização atendida. O link de upload é gerado automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Razão social</Label>
                <Input
                  className="h-9 rounded-lg"
                  value={form.razao_social}
                  onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nome fantasia</Label>
                <Input
                  className="h-9 rounded-lg"
                  value={form.nome_fantasia}
                  onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">CNPJ</Label>
                <Input
                  className="h-9 rounded-lg"
                  value={form.cnpj}
                  placeholder="00.000.000/0000-00"
                  onChange={(e) => setForm({ ...form, cnpj: formatarCnpj(e.target.value) })}
                />
                {form.cnpj && !cnpjValido(form.cnpj) && (
                  <p className="text-[0.6875rem] text-destructive">CNPJ inválido</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">E-mail de contato</Label>
                <Input
                  className="h-9 rounded-lg"
                  type="email"
                  value={form.email_contato}
                  onChange={(e) => setForm({ ...form, email_contato: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">WhatsApp / Telefone</Label>
                <Input
                  className="h-9 rounded-lg"
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: formatarTelefone(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">De onde vêm os documentos deste cliente?</Label>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {ORIGENS_DOCUMENTO.map((o) => (
                  <label
                    key={o.value}
                    className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-xs has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                  >
                    <Checkbox
                      checked={form.origem_documentos.includes(o.value)}
                      onCheckedChange={(m) =>
                        setForm({
                          ...form,
                          origem_documentos: m
                            ? [...form.origem_documentos, o.value]
                            : form.origem_documentos.filter((v) => v !== o.value),
                        })
                      }
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)} className="rounded-lg">
              Cancelar
            </Button>
            <Button
              onClick={() => criar.mutate()}
              disabled={criar.isPending}
              className="rounded-lg"
            >
              {criar.isPending ? "Salvando…" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
