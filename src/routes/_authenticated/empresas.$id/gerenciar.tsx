import { useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  CalendarRange,
  ExternalLink,
  FileText,
  ImagePlus,
  Palette,
  Power,
  Settings,
  ShieldAlert,
  Trash2,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil, useEmpresa } from "@/hooks/use-perfil";
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
  EmptyState,
  InfoTip,
  PageHeader,
  SectionCard,
  StatusPill,
  SubTabs,
} from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/empresas/$id/gerenciar")({
  head: () => ({
    meta: [
      { title: "Gerenciar empresa — ConcilIA" },
      {
        name: "description",
        content: "Marca, cores, módulos visíveis e status da empresa (visão administrativa).",
      },
    ],
  }),
  component: GerenciarEmpresaPage,
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
    descricao: "Períodos contábeis, conciliação e relatórios.",
    icone: CalendarRange,
    forcado: false,
  },
  {
    key: "configuracoes",
    nome: "Configurações",
    descricao: "Plano de contas e perfil. Sempre ativo.",
    icone: Settings,
    forcado: true,
  },
] as const;

const STATUS_OPCOES = [
  { value: "ativa", label: "Ativa", tone: "success" as const },
  { value: "trial", label: "Trial", tone: "warning" as const },
  { value: "suspensa", label: "Suspensa", tone: "neutral" as const },
];

type Aba = "marca" | "modulos" | "acesso";

function GerenciarEmpresaPage() {
  const { id: empresaId } = Route.useParams();
  const navigate = useNavigate();
  const { data: perfil } = usePerfil();
  const { data: empresa } = useEmpresa(empresaId);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [aba, setAba] = useState<Aba>("marca");

  const podeGerenciar =
    perfil?.papel === "super_admin" || (perfil?.papel === "admin" && perfil.org_id === empresaId);

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ["empresa", empresaId] });
    queryClient.invalidateQueries({ queryKey: ["painel-empresas"] });
  }

  const salvar = useMutation({
    mutationFn: async (v: {
      nome?: string;
      cor_primaria?: string;
      cor_acento?: string;
      logo_url?: string | null;
      status?: string;
      modulos_habilitados?: string[];
    }) => {
      const { data, error } = await supabase
        .from("organizations")
        .update(v)
        .eq("id", empresaId)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0)
        throw new Error("Nenhuma linha alterada. Verifique suas permissões (RLS).");
    },
    onSuccess: () => {
      toast.success("Salvo");
      invalidar();
    },
    onError: (e: Error) => toast.error("Não foi possível salvar", { description: e.message }),
  });

  async function handleLogoUpload(file: File) {
    if (!empresa) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo muito grande", { description: "Envie uma imagem de até 2 MB." });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const path = `${empresa.id}/logo-${Date.now()}.${ext}`;
      const { error: up } = await supabase.storage
        .from("logos")
        .upload(path, file, { upsert: true, ...(file.type ? { contentType: file.type } : {}) });
      if (up) throw up;
      const { data: url } = supabase.storage.from("logos").getPublicUrl(path);
      await salvar.mutateAsync({ logo_url: url.publicUrl });
    } catch (e) {
      toast.error("Não foi possível enviar a logo", {
        description: e instanceof Error ? e.message : "Erro desconhecido",
      });
    } finally {
      setUploading(false);
    }
  }

  const desativar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", empresaId)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Sem permissão para desativar.");
    },
    onSuccess: () => {
      toast.success("Empresa desativada");
      queryClient.invalidateQueries({ queryKey: ["painel-empresas"] });
      navigate({ to: "/empresas" });
    },
    onError: (e: Error) => toast.error("Não foi possível desativar", { description: e.message }),
  });

  const corPrimaria = empresa?.cor_primaria || "#123B47";
  const corAcento = empresa?.cor_acento || "#1E8C80";
  const modulos = empresa?.modulos_habilitados ?? MODULOS_PADRAO;
  const statusAtual = STATUS_OPCOES.find((s) => s.value === empresa?.status) ?? {
    value: "ativa",
    label: "Ativa",
    tone: "success" as const,
  };

  if (perfil && !podeGerenciar) {
    return (
      <div className="space-y-5">
        <Voltar />
        <EmptyState
          icon={ShieldAlert}
          title="Acesso restrito"
          hint="Apenas a administração da plataforma pode gerenciar marca, módulos e status das empresas."
        />
      </div>
    );
  }

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
            onChange={(e) => salvar.mutate({ [campo]: e.target.value })}
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
          defaultValue={value}
          key={value}
          onBlur={(e) =>
            /^#[0-9a-fA-F]{6}$/.test(e.target.value) &&
            e.target.value !== value &&
            salvar.mutate({ [campo]: e.target.value })
          }
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <Voltar />
      <PageHeader
        title={empresa?.nome ?? "Empresa"}
        description="Visão administrativa da ConcilIA. O que você define aqui vale para toda a equipe da empresa e para os links dos clientes dela. A empresa não vê esta tela."
        actions={
          <div className="flex items-center gap-2">
            <StatusPill tone={statusAtual.tone} label={statusAtual.label} />
            <Button asChild size="sm" variant="outline" className="h-8 rounded-lg text-xs">
              <Link to="/empresas/$id" params={{ id: empresaId }}>
                <ExternalLink className="size-3.5" /> Abrir painel
              </Link>
            </Button>
          </div>
        }
      />

      <SubTabs
        value={aba}
        onChange={setAba}
        items={[
          { value: "marca", label: "Marca e cores", icon: Palette },
          { value: "modulos", label: "O que a empresa vê", icon: Settings },
          { value: "acesso", label: "Status e acesso", icon: Power },
        ]}
      />

      {aba === "marca" && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <SectionCard
            title="Identidade da empresa"
            description="Nome, logo e cores aplicados no menu lateral, gráficos, links de upload/painel dos clientes e relatórios em PDF."
            icon={Building2}
          >
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome da empresa</Label>
                <Input
                  className="h-9 rounded-lg sm:max-w-md"
                  defaultValue={empresa?.nome ?? ""}
                  key={empresa?.nome ?? ""}
                  onBlur={(e) =>
                    e.target.value.trim() &&
                    e.target.value !== empresa?.nome &&
                    salvar.mutate({ nome: e.target.value.trim() })
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
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
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
                        disabled={uploading}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <ImagePlus className="size-3.5" />
                        {uploading
                          ? "Enviando…"
                          : empresa?.logo_url
                            ? "Trocar logo"
                            : "Enviar logo"}
                      </Button>
                      {empresa?.logo_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 rounded-lg text-destructive hover:text-destructive"
                          onClick={() => salvar.mutate({ logo_url: null })}
                        >
                          <Trash2 className="size-3.5" /> Remover
                        </Button>
                      )}
                    </div>
                    <p className="text-[0.6875rem] text-muted-foreground">
                      PNG, JPG, SVG ou WEBP · até 2 MB · fundo transparente · ~256×256px
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
                {MODULOS_CONFIG.filter((m) => modulos.includes(m.key) && !m.forcado).map((m, i) => (
                  <div
                    key={m.key}
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
                    {m.nome}
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
              É assim que a equipe da empresa e os clientes dela verão o sistema.
            </p>
          </SectionCard>
        </div>
      )}

      {aba === "modulos" && (
        <SectionCard
          title="Módulos visíveis para a empresa"
          description="Desligue o que esta empresa não contratou; o item some do menu de toda a equipe dela."
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
                    disabled={forcado || salvar.isPending}
                    onCheckedChange={(c) =>
                      !forcado &&
                      salvar.mutate({
                        modulos_habilitados: c
                          ? [...modulos, key]
                          : modulos.filter((m) => m !== key),
                      })
                    }
                  />
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {aba === "acesso" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard
            title="Status da empresa"
            description="Trial e Suspensa aparecem como aviso na lista de empresas."
            icon={Power}
          >
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select
                value={empresa?.status ?? "ativa"}
                onValueChange={(v) => salvar.mutate({ status: v })}
              >
                <SelectTrigger className="h-9 w-56 rounded-lg text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPCOES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </SectionCard>

          <SectionCard
            title="Desativar empresa"
            description="A empresa deixa de aparecer na lista e a equipe dela perde o acesso. Os dados são mantidos."
            icon={ShieldAlert}
          >
            <Button
              variant="outline"
              className="h-9 rounded-lg border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
              disabled={desativar.isPending || perfil?.papel !== "super_admin"}
              onClick={() => {
                if (window.confirm(`Desativar "${empresa?.nome ?? "esta empresa"}"?`))
                  desativar.mutate();
              }}
            >
              <Trash2 className="size-4" /> Desativar empresa
            </Button>
            {perfil?.papel !== "super_admin" && (
              <p className="mt-2 text-[0.6875rem] text-muted-foreground">
                Somente a administração da plataforma pode desativar.
              </p>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  );
}

function Voltar() {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 rounded-lg text-xs">
      <Link to="/empresas">
        <ArrowLeft className="size-3.5" /> Empresas
      </Link>
    </Button>
  );
}
