import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Building2,
  FileText,
  ImagePlus,
  Palette,
  Plus,
  Settings,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil, useEmpresa, temPermissao } from "@/hooks/use-perfil";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/empresas/$id/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configuracoes — ConcilIA" },
      {
        name: "description",
        content: "Identidade visual, modulos, perfil e plano de contas da empresa.",
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
    descricao: "Cadastro e gestao de clientes do escritorio.",
    icone: Users,
    forcado: false,
  },
  {
    key: "documentos",
    nome: "Documentos",
    descricao: "Recebimento e processamento de documentos contabeis.",
    icone: FileText,
    forcado: false,
  },
  {
    key: "competencias",
    nome: "Competencias",
    descricao: "Controle de periodos contabeis e conciliacao.",
    icone: BookOpen,
    forcado: false,
  },
  {
    key: "configuracoes",
    nome: "Configuracoes",
    descricao: "Identidade visual, modulos e plano de contas.",
    icone: Settings,
    forcado: true,
  },
] as const;

function ConfiguracoesPage() {
  const { id: empresaId } = Route.useParams();
  const { data: perfil } = usePerfil();
  const { data: empresa } = useEmpresa(empresaId);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const [clienteSel, setClienteSel] = useState("");
  const [conta, setConta] = useState({ codigo: "", descricao: "", tipo: "" });

  const podeEditar = temPermissao(perfil, "configuracoes");

  // --- Identidade visual mutations ---

  const salvarEmpresa = useMutation({
    mutationFn: async (valores: { nome?: string; cor_primaria?: string; cor_acento?: string; logo_url?: string | null }) => {
      const { error } = await supabase
        .from("organizations")
        .update(valores)
        .eq("id", empresaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresa", empresaId] });
    },
    onError: (e: Error) =>
      toast.error("Nao foi possivel salvar", { description: e.message }),
  });

  async function handleLogoUpload(file: File) {
    if (!empresa) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${empresa.id}/logo-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("logos")
        .getPublicUrl(path);

      const { error: updateError } = await supabase
        .from("organizations")
        .update({ logo_url: urlData.publicUrl })
        .eq("id", empresaId);
      if (updateError) throw updateError;

      toast.success("Logo atualizada");
      queryClient.invalidateQueries({ queryKey: ["empresa", empresaId] });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      toast.error("Nao foi possivel enviar a logo", { description: msg });
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoverLogo() {
    const { error } = await supabase
      .from("organizations")
      .update({ logo_url: null })
      .eq("id", empresaId);
    if (error) {
      toast.error("Nao foi possivel remover a logo", { description: error.message });
    } else {
      toast.success("Logo removida");
      queryClient.invalidateQueries({ queryKey: ["empresa", empresaId] });
    }
  }

  // --- Modulos mutation ---

  const salvarModulos = useMutation({
    mutationFn: async (modulos: string[]) => {
      const { error } = await supabase
        .from("organizations")
        .update({ modulos_habilitados: modulos })
        .eq("id", empresaId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Modulos atualizados");
      queryClient.invalidateQueries({ queryKey: ["empresa", empresaId] });
    },
    onError: (e: Error) =>
      toast.error("Nao foi possivel salvar", { description: e.message }),
  });

  // --- Plano de contas ---

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

  const { data: contas } = useQuery({
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
      return data;
    },
  });

  const criarConta = useMutation({
    mutationFn: async () => {
      if (!perfil) throw new Error("Perfil nao carregado.");
      if (!clienteSel) throw new Error("Selecione um cliente.");
      if (!conta.codigo.trim() || !conta.descricao.trim())
        throw new Error("Informe codigo e descricao.");
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
    onError: (e: Error) =>
      toast.error("Nao foi possivel salvar", { description: e.message }),
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
    onError: (e: Error) =>
      toast.error("Nao foi possivel remover", { description: e.message }),
  });

  // --- Derived values ---

  const corPrimaria = empresa?.cor_primaria || "#123B47";
  const corAcento = empresa?.cor_acento || "#2563eb";
  const modulosHabilitados = empresa?.modulos_habilitados ?? MODULOS_PADRAO;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Configuracoes</h1>
          <p className="page-subtitle">
            Identidade visual, modulos, perfil e plano de contas.
          </p>
        </div>
      </div>

      <Tabs defaultValue="identidade">
        <div className="overflow-x-auto -mx-4 px-4 md:-mx-6 md:px-6">
          <TabsList className="inline-flex w-auto rounded-xl">
            <TabsTrigger value="identidade" className="rounded-lg text-xs sm:text-sm">
              <Building2 className="mr-1.5 size-3.5" /> Identidade visual
            </TabsTrigger>
            <TabsTrigger value="modulos" className="rounded-lg text-xs sm:text-sm">
              <Settings className="mr-1.5 size-3.5" /> Modulos
            </TabsTrigger>
            <TabsTrigger value="perfil" className="rounded-lg text-xs sm:text-sm">
              <User className="mr-1.5 size-3.5" /> Meu perfil
            </TabsTrigger>
            <TabsTrigger value="plano" className="rounded-lg text-xs sm:text-sm">
              <BookOpen className="mr-1.5 size-3.5" /> Plano de contas
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ───── Identidade visual ───── */}
        <TabsContent value="identidade">
          <div className="card-section">
            <div className="card-section-header">
              <div className="flex items-center gap-3">
                <div className="list-row-icon bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                  <Building2 className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Identidade visual</h2>
                  <p className="text-xs text-muted-foreground">
                    {podeEditar
                      ? "Logo, cores e nome da empresa."
                      : "Somente administradores podem editar."}
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-6 p-5">
              {/* Nome da empresa */}
              <div className="space-y-2">
                <Label className="text-xs">Nome da empresa</Label>
                <Input
                  className="rounded-xl sm:w-96"
                  readOnly={!podeEditar}
                  defaultValue={empresa?.nome ?? ""}
                  onBlur={(e) => {
                    if (!podeEditar || !empresa) return;
                    salvarEmpresa.mutate(
                      { nome: e.target.value },
                      { onSuccess: () => toast.success("Nome atualizado") },
                    );
                  }}
                />
              </div>

              {/* Logo upload */}
              <div className="space-y-2">
                <Label className="text-xs">Logo da empresa</Label>
                <div className="flex items-center gap-4">
                  {empresa?.logo_url ? (
                    <img
                      src={empresa.logo_url}
                      alt="Logo"
                      className="size-16 rounded-xl border border-border bg-white object-contain p-1.5"
                    />
                  ) : (
                    <div className="flex size-16 items-center justify-center rounded-xl border-2 border-dashed border-border text-muted-foreground">
                      <ImagePlus className="size-6" />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleLogoUpload(file);
                        e.target.value = "";
                      }}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        disabled={!podeEditar || uploading}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <ImagePlus className="size-3.5" />
                        {uploading ? "Enviando..." : "Enviar logo"}
                      </Button>
                      {empresa?.logo_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-xl text-destructive hover:text-destructive"
                          disabled={!podeEditar}
                          onClick={handleRemoverLogo}
                        >
                          <Trash2 className="size-3.5" /> Remover logo
                        </Button>
                      )}
                    </div>
                    <p className="text-[0.6875rem] text-muted-foreground">
                      PNG, JPG ou SVG. Recomendado 256x256px.
                    </p>
                  </div>
                </div>
              </div>

              {/* Cores */}
              <div className="grid gap-6 sm:grid-cols-2">
                {/* Cor primaria */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-xs">
                    <Palette className="size-3.5" /> Cor primaria
                  </Label>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <input
                        type="color"
                        value={corPrimaria}
                        disabled={!podeEditar}
                        onChange={(e) =>
                          salvarEmpresa.mutate(
                            { cor_primaria: e.target.value },
                            { onSuccess: () => toast.success("Cor primaria atualizada") },
                          )
                        }
                        className="absolute inset-0 cursor-pointer opacity-0"
                      />
                      <div
                        className="flex size-10 items-center justify-center rounded-xl border border-border shadow-sm"
                        style={{ backgroundColor: corPrimaria }}
                      >
                        <Palette className="size-4 text-white/80" />
                      </div>
                    </div>
                    <Input
                      className="w-28 rounded-xl font-mono text-xs uppercase"
                      readOnly={!podeEditar}
                      value={corPrimaria}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (/^#[0-9a-fA-F]{6}$/.test(v))
                          salvarEmpresa.mutate(
                            { cor_primaria: v },
                            {
                              onSuccess: () =>
                                toast.success("Cor primaria atualizada"),
                            },
                          );
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Usada no cabecalho e menus.
                    </p>
                  </div>
                </div>

                {/* Cor de acento */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-xs">
                    <Palette className="size-3.5" /> Cor de acento
                  </Label>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <input
                        type="color"
                        value={corAcento}
                        disabled={!podeEditar}
                        onChange={(e) =>
                          salvarEmpresa.mutate(
                            { cor_acento: e.target.value },
                            { onSuccess: () => toast.success("Cor de acento atualizada") },
                          )
                        }
                        className="absolute inset-0 cursor-pointer opacity-0"
                      />
                      <div
                        className="flex size-10 items-center justify-center rounded-xl border border-border shadow-sm"
                        style={{ backgroundColor: corAcento }}
                      >
                        <Palette className="size-4 text-white/80" />
                      </div>
                    </div>
                    <Input
                      className="w-28 rounded-xl font-mono text-xs uppercase"
                      readOnly={!podeEditar}
                      value={corAcento}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (/^#[0-9a-fA-F]{6}$/.test(v))
                          salvarEmpresa.mutate(
                            { cor_acento: v },
                            {
                              onSuccess: () =>
                                toast.success("Cor de acento atualizada"),
                            },
                          );
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Usada em botoes e destaques.
                    </p>
                  </div>
                </div>
              </div>

              {/* Pre-visualizacao */}
              <div className="rounded-xl border border-border/60 p-4">
                <p className="mb-3 text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground">
                  Pre-visualizacao
                </p>
                <div
                  className="overflow-hidden rounded-xl border border-border/40"
                  style={{ maxWidth: 280 }}
                >
                  {/* Mock sidebar header */}
                  <div
                    className="flex items-center gap-3 px-4 py-3"
                    style={{ backgroundColor: corPrimaria }}
                  >
                    {empresa?.logo_url ? (
                      <img
                        src={empresa.logo_url}
                        alt=""
                        className="size-8 rounded-lg bg-white/90 object-contain p-0.5"
                      />
                    ) : (
                      <div
                        className="flex size-8 items-center justify-center rounded-lg text-xs font-bold"
                        style={{
                          backgroundColor: "rgba(255,255,255,0.2)",
                          color: "#fff",
                        }}
                      >
                        {(empresa?.nome ?? "E").slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm font-semibold text-white truncate">
                      {empresa?.nome ?? "Empresa"}
                    </span>
                  </div>
                  {/* Mock sidebar items */}
                  <div className="space-y-px bg-card p-2">
                    {["Clientes", "Documentos", "Competencias"].map((item, i) => (
                      <div
                        key={item}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium"
                        style={
                          i === 0
                            ? {
                                backgroundColor: `${corAcento}15`,
                                color: corAcento,
                              }
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
                        {item}
                      </div>
                    ))}
                  </div>
                  {/* Mock accent button */}
                  <div className="border-t border-border/40 p-3">
                    <div
                      className="rounded-lg px-3 py-1.5 text-center text-xs font-semibold text-white"
                      style={{ backgroundColor: corAcento }}
                    >
                      Novo documento
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ───── Modulos ───── */}
        <TabsContent value="modulos">
          <div className="card-section">
            <div className="card-section-header">
              <div className="flex items-center gap-3">
                <div className="list-row-icon bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                  <Settings className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Modulos do sistema</h2>
                  <p className="text-xs text-muted-foreground">
                    {podeEditar
                      ? "Ative ou desative modulos para esta empresa."
                      : "Somente administradores podem alterar modulos."}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                {MODULOS_CONFIG.map(({ key, nome, descricao, icone: Icone, forcado }) => {
                  const ativo = modulosHabilitados.includes(key);
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-4 rounded-xl border border-border/60 px-4 py-3"
                    >
                      <div className="list-row-icon bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                        <Icone className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{nome}</span>
                        <span className="text-xs text-muted-foreground">
                          {descricao}
                        </span>
                      </div>
                      <Switch
                        checked={ativo}
                        disabled={!podeEditar || forcado}
                        onCheckedChange={(checked) => {
                          if (forcado) return;
                          const novos = checked
                            ? [...modulosHabilitados, key]
                            : modulosHabilitados.filter((m) => m !== key);
                          salvarModulos.mutate(novos);
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                O modulo "Configuracoes" esta sempre ativo e nao pode ser desabilitado.
              </p>
            </div>
          </div>
        </TabsContent>

        {/* ───── Meu perfil ───── */}
        <TabsContent value="perfil">
          <div className="card-section">
            <div className="card-section-header">
              <div className="flex items-center gap-3">
                <div className="list-row-icon bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                  <User className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Meu perfil</h2>
                  <p className="text-xs text-muted-foreground">
                    Dados da sua conta no sistema.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input className="rounded-xl" readOnly value={perfil?.nome ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input className="rounded-xl" readOnly value={perfil?.email ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label>Papel</Label>
                  <div>
                    <span className="status-dot bg-primary/10 text-primary">
                      <span className="size-1.5 rounded-full bg-primary" />
                      {perfil?.papel ?? "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ───── Plano de contas ───── */}
        <TabsContent value="plano">
          <div className="card-section">
            <div className="card-section-header">
              <div className="flex items-center gap-3">
                <div className="list-row-icon bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                  <BookOpen className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Plano de contas</h2>
                  <p className="text-xs text-muted-foreground">
                    Cadastro simples por cliente. A importacao do layout IOB vira em uma
                    proxima etapa.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <Select value={clienteSel} onValueChange={setClienteSel}>
                <SelectTrigger className="w-full rounded-xl sm:w-72">
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

              {clienteSel && (
                <>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <Input
                      className="rounded-xl"
                      placeholder="Codigo"
                      value={conta.codigo}
                      onChange={(e) =>
                        setConta({ ...conta, codigo: e.target.value })
                      }
                    />
                    <Input
                      className="sm:col-span-2 rounded-xl"
                      placeholder="Descricao"
                      value={conta.descricao}
                      onChange={(e) =>
                        setConta({ ...conta, descricao: e.target.value })
                      }
                    />
                    <div className="flex gap-2">
                      <Input
                        className="rounded-xl"
                        placeholder="Tipo"
                        value={conta.tipo}
                        onChange={(e) =>
                          setConta({ ...conta, tipo: e.target.value })
                        }
                      />
                      <Button
                        onClick={() => criarConta.mutate()}
                        disabled={criarConta.isPending}
                        className="rounded-xl"
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  </div>

                  {!contas || contas.length === 0 ? (
                    <div className="empty-state">
                      <BookOpen className="empty-state-icon" />
                      <p className="empty-state-text">
                        Nenhuma conta cadastrada — adicione a primeira acima.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/40">
                      {contas.map((c) => (
                        <div key={c.id} className="list-row">
                          <span className="min-w-16 font-mono text-xs font-semibold text-primary">
                            {c.codigo}
                          </span>
                          <span className="min-w-0 flex-1 text-sm">
                            {c.descricao}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {c.tipo ?? "—"}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 rounded-lg"
                            onClick={() => removerConta.mutate(c.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
