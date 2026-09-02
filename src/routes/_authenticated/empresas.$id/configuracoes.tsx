import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Building2,
  CalendarRange,
  FileText,
  ImagePlus,
  Palette,
  Plus,
  Settings,
  ShieldCheck,
  Trash2,
  User,
  UserCog,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil, useEmpresa, temPermissao } from "@/hooks/use-perfil";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  EmptyState,
  InfoTip,
  PageHeader,
  SectionCard,
  StatusPill,
  SubTabs,
  type Column,
} from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/empresas/$id/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — ConcilIA" },
      {
        name: "description",
        content: "Identidade visual da empresa, módulos, plano de contas e perfil.",
      },
    ],
  }),
  component: ConfiguracoesPage,
});

const MODULOS_PADRAO = ["clientes", "documentos", "competencias", "configuracoes"];

const MODULOS_CONFIG = [
  {
    key: "clientes",
    nome: "Clientes",
    descricao: "Cadastro e saúde da carteira.",
    icone: Users,
    forcado: false,
  },
  {
    key: "documentos",
    nome: "Documentos",
    descricao: "Recebimento, fila e erros de leitura.",
    icone: FileText,
    forcado: false,
  },
  {
    key: "competencias",
    nome: "Competências",
    descricao: "Períodos contábeis e conciliação.",
    icone: CalendarRange,
    forcado: false,
  },
  {
    key: "configuracoes",
    nome: "Configurações",
    descricao: "Sempre ativo.",
    icone: Settings,
    forcado: true,
  },
] as const;

type Aba = "empresa" | "modulos" | "plano" | "perfil";
type Conta = { id: string; codigo: string; descricao: string; tipo: string | null; ativo: boolean };

function ConfiguracoesPage() {
  const { id: empresaId } = Route.useParams();
  const { data: perfil } = usePerfil();
  const { data: empresa } = useEmpresa(empresaId);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [aba, setAba] = useState<Aba>("empresa");
  const [clienteSel, setClienteSel] = useState("");
  const [conta, setConta] = useState({ codigo: "", descricao: "", tipo: "" });

  const podeEditar = temPermissao(perfil, "configuracoes");

  const salvarEmpresa = useMutation({
    mutationFn: async (v: {
      nome?: string;
      cor_primaria?: string;
      cor_acento?: string;
      logo_url?: string | null;
    }) => {
      const { error } = await supabase.from("organizations").update(v).eq("id", empresaId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Salvo");
      queryClient.invalidateQueries({ queryKey: ["empresa", empresaId] });
    },
    onError: (e: Error) => toast.error("Não foi possível salvar", { description: e.message }),
  });

  async function handleLogoUpload(file: File) {
    if (!empresa) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${empresa.id}/logo-${Date.now()}.${ext}`;
      const { error: up } = await supabase.storage.from("logos").upload(path, file);
      if (up) throw up;
      const { data: url } = supabase.storage.from("logos").getPublicUrl(path);
      const { error } = await supabase
        .from("organizations")
        .update({ logo_url: url.publicUrl })
        .eq("id", empresaId);
      if (error) throw error;
      toast.success("Logo atualizada");
      queryClient.invalidateQueries({ queryKey: ["empresa", empresaId] });
    } catch (e) {
      toast.error("Não foi possível enviar a logo", {
        description: e instanceof Error ? e.message : "Erro desconhecido",
      });
    } finally {
      setUploading(false);
    }
  }

  const salvarModulos = useMutation({
    mutationFn: async (modulos: string[]) => {
      const { error } = await supabase
        .from("organizations")
        .update({ modulos_habilitados: modulos })
        .eq("id", empresaId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Módulos atualizados");
      queryClient.invalidateQueries({ queryKey: ["empresa", empresaId] });
    },
    onError: (e: Error) => toast.error("Não foi possível salvar", { description: e.message }),
  });

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

  const { data: contas, isLoading: carregandoContas } = useQuery({
    queryKey: ["plano-contas", clienteSel],
    enabled: !!clienteSel,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plano_contas")
        .select("id, codigo, descricao, tipo, ativo")
        .eq("cliente_id", clienteSel)
        .is("deleted_at", null)
        .order("codigo");
      if (error) throw error;
      return data as Conta[];
    },
  });

  const criarConta = useMutation({
    mutationFn: async () => {
      if (!perfil) throw new Error("Perfil não carregado.");
      if (!clienteSel) throw new Error("Selecione um cliente.");
      if (!conta.codigo.trim() || !conta.descricao.trim())
        throw new Error("Informe código e descrição.");
      const { error } = await supabase.from("plano_contas").insert({
        org_id: perfil.org_id,
        cliente_id: clienteSel,
        codigo: conta.codigo.trim(),
        descricao: conta.descricao.trim(),
        tipo: conta.tipo || null,
        ativo: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conta adicionada");
      setConta({ codigo: "", descricao: "", tipo: "" });
      queryClient.invalidateQueries({ queryKey: ["plano-contas", clienteSel] });
    },
    onError: (e: Error) => toast.error("Não foi possível salvar", { description: e.message }),
  });

  const removerConta = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("plano_contas")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conta removida");
      queryClient.invalidateQueries({ queryKey: ["plano-contas", clienteSel] });
    },
  });

  const corPrimaria = empresa?.cor_primaria || "#123B47";
  const corAcento = empresa?.cor_acento || "#1E8C80";
  const modulos = empresa?.modulos_habilitados ?? MODULOS_PADRAO;

  const ColorField = ({
    label,
    value,
    campo,
    hint,
  }: {
    label: string;
    value: string;
    campo: "cor_primaria" | "cor_acento";
    hint: string;
  }) => (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1 text-xs">
        {label} <InfoTip text={hint} />
      </Label>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="color"
            value={value}
            disabled={!podeEditar}
            onChange={(e) => salvarEmpresa.mutate({ [campo]: e.target.value })}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
          <div
            className="flex size-9 items-center justify-center rounded-lg border border-border shadow-sm"
            style={{ backgroundColor: value }}
          >
            <Palette className="size-3.5 text-white/80" />
          </div>
        </div>
        <Input
          className="h-9 w-28 rounded-lg font-mono text-xs uppercase"
          readOnly={!podeEditar}
          defaultValue={value}
          key={value}
          onBlur={(e) =>
            /^#[0-9a-fA-F]{6}$/.test(e.target.value) &&
            e.target.value !== value &&
            salvarEmpresa.mutate({ [campo]: e.target.value })
          }
        />
      </div>
    </div>
  );

  const colContas: Column<Conta>[] = [
    {
      key: "codigo",
      header: "Código",
      width: "120px",
      sortValue: (c) => c.codigo,
      cell: (c) => <span className="font-mono text-xs font-semibold text-primary">{c.codigo}</span>,
    },
    {
      key: "descricao",
      header: "Descrição",
      sortValue: (c) => c.descricao,
      cell: (c) => c.descricao,
    },
    {
      key: "tipo",
      header: "Tipo",
      hideBelow: "sm",
      cell: (c) => <span className="text-xs text-muted-foreground">{c.tipo ?? "—"}</span>,
    },
    {
      key: "acoes",
      header: "",
      align: "right",
      cell: (c) => (
        <Button
          variant="ghost"
          size="icon"
          className="size-7 rounded-md text-muted-foreground hover:text-destructive"
          onClick={() => removerConta.mutate(c.id)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Configurações"
        description="Identidade visual da empresa (vale para toda a equipe e para os links dos clientes), módulos ativos, plano de contas e seu perfil."
        actions={!podeEditar ? <StatusPill tone="neutral" label="Somente leitura" /> : undefined}
      />

      <SubTabs
        value={aba}
        onChange={setAba}
        items={[
          { value: "empresa", label: "Empresa e marca", icon: Building2 },
          { value: "modulos", label: "Módulos", icon: Settings },
          { value: "plano", label: "Plano de contas", icon: BookOpen },
          { value: "perfil", label: "Meu perfil", icon: User },
        ]}
      />

      {aba === "empresa" && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <SectionCard
            title="Identidade da empresa"
            description="Nome, logo e cores usados no sistema, nos links de upload/painel dos clientes e nos relatórios em PDF."
            icon={Building2}
          >
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome da empresa</Label>
                <Input
                  className="h-9 rounded-lg sm:max-w-md"
                  readOnly={!podeEditar}
                  defaultValue={empresa?.nome ?? ""}
                  onBlur={(e) =>
                    podeEditar &&
                    e.target.value !== empresa?.nome &&
                    salvarEmpresa.mutate({ nome: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Logo</Label>
                <div className="flex items-center gap-4">
                  {empresa?.logo_url ? (
                    <img
                      src={empresa.logo_url}
                      alt="Logo"
                      className="size-16 rounded-lg border border-border bg-white object-contain p-1.5"
                    />
                  ) : (
                    <div className="flex size-16 items-center justify-center rounded-lg border-2 border-dashed border-border text-muted-foreground">
                      <ImagePlus className="size-5" />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleLogoUpload(f);
                        e.target.value = "";
                      }}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg"
                        disabled={!podeEditar || uploading}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <ImagePlus className="size-3.5" />
                        {uploading ? "Enviando…" : "Enviar logo"}
                      </Button>
                      {empresa?.logo_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 rounded-lg text-destructive hover:text-destructive"
                          disabled={!podeEditar}
                          onClick={() => salvarEmpresa.mutate({ logo_url: null })}
                        >
                          <Trash2 className="size-3.5" /> Remover
                        </Button>
                      )}
                    </div>
                    <p className="text-[0.6875rem] text-muted-foreground">
                      PNG, JPG ou SVG · fundo transparente · ~256×256px
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <ColorField
                  label="Cor primária"
                  value={corPrimaria}
                  campo="cor_primaria"
                  hint="Menu lateral, cabeçalhos e gráficos."
                />
                <ColorField
                  label="Cor de acento"
                  value={corAcento}
                  campo="cor_acento"
                  hint="Botões e destaques secundários."
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Pré-visualização" icon={Palette} dense>
            <div className="overflow-hidden rounded-lg border border-border/60">
              <div
                className="flex items-center gap-2.5 px-3 py-2.5"
                style={{ backgroundColor: corPrimaria }}
              >
                {empresa?.logo_url ? (
                  <img
                    src={empresa.logo_url}
                    alt=""
                    className="size-7 rounded-md bg-white/90 object-contain p-0.5"
                  />
                ) : (
                  <span className="flex size-7 items-center justify-center rounded-md bg-white/20 text-[0.625rem] font-bold text-white">
                    {(empresa?.nome ?? "E").slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span className="truncate text-xs font-semibold text-white">
                  {empresa?.nome ?? "Empresa"}
                </span>
              </div>
              <div className="space-y-px bg-card p-1.5">
                {["Dashboard", "Documentos", "Conciliação"].map((it, i) => (
                  <div
                    key={it}
                    className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[0.6875rem] font-medium"
                    style={
                      i === 0
                        ? { backgroundColor: `${corAcento}18`, color: corAcento }
                        : { color: "var(--muted-foreground)" }
                    }
                  >
                    <span
                      className="size-1.5 rounded-full"
                      style={{
                        backgroundColor: i === 0 ? corAcento : "currentColor",
                        opacity: i === 0 ? 1 : 0.4,
                      }}
                    />
                    {it}
                  </div>
                ))}
              </div>
              <div className="border-t border-border/40 p-2.5">
                <div
                  className="rounded-md px-3 py-1.5 text-center text-[0.6875rem] font-semibold text-white"
                  style={{ backgroundColor: corAcento }}
                >
                  Gerar pacote
                </div>
              </div>
            </div>
            <p className="mt-3 text-[0.6875rem] text-muted-foreground">
              Os clientes veem esta identidade no link de upload e no painel.
            </p>
          </SectionCard>
        </div>
      )}

      {aba === "modulos" && (
        <SectionCard
          title="Módulos do sistema"
          description="Desligue módulos que esta empresa não usa; eles somem do menu para toda a equipe."
          icon={Settings}
        >
          <div className="grid gap-2.5 sm:grid-cols-2">
            {MODULOS_CONFIG.map(({ key, nome, descricao, icone: Icone, forcado }) => {
              const ativo = modulos.includes(key);
              return (
                <div
                  key={key}
                  className={`flex items-center gap-3 rounded-lg border px-3.5 py-3 transition-colors ${ativo ? "border-border/60" : "border-border/40 opacity-70"}`}
                >
                  <span
                    className={`flex size-8 items-center justify-center rounded-md ${ativo ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                  >
                    <Icone className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{nome}</div>
                    <div className="text-[0.6875rem] text-muted-foreground">{descricao}</div>
                  </div>
                  <Switch
                    checked={ativo}
                    disabled={!podeEditar || forcado}
                    onCheckedChange={(c) =>
                      !forcado &&
                      salvarModulos.mutate(c ? [...modulos, key] : modulos.filter((m) => m !== key))
                    }
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-[0.6875rem] text-muted-foreground">
            <UserCog className="size-3.5" /> Permissões por pessoa (quem vê o quê) ficam em{" "}
            <Link to="/equipe" className="font-medium text-primary hover:underline">
              Equipe
            </Link>
            .
          </div>
        </SectionCard>
      )}

      {aba === "plano" && (
        <SectionCard
          flush
          title="Plano de contas"
          description="Contas usadas na classificação dos lançamentos de cada cliente. A IA sugere; você confirma na Conciliação. Importação do layout IOB vem em uma próxima etapa."
          icon={BookOpen}
          actions={
            <Select value={clienteSel} onValueChange={setClienteSel}>
              <SelectTrigger className="h-8 w-56 rounded-lg text-xs">
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {(clientes ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome_fantasia ?? c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        >
          {!clienteSel ? (
            <EmptyState
              icon={BookOpen}
              title="Escolha um cliente"
              hint="Cada cliente tem seu próprio plano de contas."
            />
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-2 border-b border-border/50 px-4 py-3">
                <div className="space-y-1">
                  <Label className="text-[0.6875rem]">Código</Label>
                  <Input
                    className="h-8 w-28 rounded-lg font-mono text-xs"
                    placeholder="1.1.01"
                    value={conta.codigo}
                    onChange={(e) => setConta({ ...conta, codigo: e.target.value })}
                  />
                </div>
                <div className="min-w-48 flex-1 space-y-1">
                  <Label className="text-[0.6875rem]">Descrição</Label>
                  <Input
                    className="h-8 rounded-lg text-xs"
                    placeholder="Caixa geral"
                    value={conta.descricao}
                    onChange={(e) => setConta({ ...conta, descricao: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && criarConta.mutate()}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[0.6875rem]">Tipo</Label>
                  <Input
                    className="h-8 w-32 rounded-lg text-xs"
                    placeholder="ativo, receita…"
                    value={conta.tipo}
                    onChange={(e) => setConta({ ...conta, tipo: e.target.value })}
                  />
                </div>
                <Button
                  size="sm"
                  className="h-8 rounded-lg"
                  onClick={() => criarConta.mutate()}
                  disabled={criarConta.isPending}
                >
                  <Plus className="size-3.5" /> Adicionar
                </Button>
              </div>
              <DataTable
                rows={contas ?? []}
                columns={colContas}
                rowKey={(c) => c.id}
                loading={carregandoContas}
                dense
                defaultSort={{ key: "codigo", dir: "asc" }}
                emptyTitle="Nenhuma conta cadastrada"
                emptyHint="Adicione a primeira conta acima."
              />
            </>
          )}
        </SectionCard>
      )}

      {aba === "perfil" && (
        <SectionCard title="Meu perfil" icon={User} className="lg:max-w-2xl">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome</Label>
              <Input className="h-9 rounded-lg" readOnly value={perfil?.nome ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">E-mail</Label>
              <Input className="h-9 rounded-lg" readOnly value={perfil?.email ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Papel</Label>
              <div className="flex items-center gap-2 pt-1">
                <ShieldCheck className="size-4 text-primary" />
                <StatusPill
                  tone="primary"
                  label={
                    perfil?.papel === "super_admin"
                      ? "Super Admin"
                      : perfil?.papel === "admin"
                        ? "Administrador"
                        : "Operador"
                  }
                />
              </div>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
