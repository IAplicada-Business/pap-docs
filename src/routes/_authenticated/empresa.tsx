import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CalendarRange,
  FileText,
  ImagePlus,
  Palette,
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
import { toast } from "sonner";
import { EmptyState, InfoTip, PageHeader, SectionCard, SubTabs } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/empresa")({
  head: () => ({
    meta: [
      { title: "Minha empresa — P&A Contabilidade Digital" },
      {
        name: "description",
        content: "Marca, cores e módulos visíveis no sistema.",
      },
    ],
  }),
  component: MinhaEmpresaPage,
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

type Aba = "marca" | "modulos";

function MinhaEmpresaPage() {
  const { orgId: empresaId } = Route.useRouteContext();
  const { data: perfil } = usePerfil();
  const { data: empresa } = useEmpresa(empresaId);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [aba, setAba] = useState<Aba>("marca");

  const podeGerenciar = perfil?.papel === "super_admin" || perfil?.papel === "admin";

  const salvar = useMutation({
    mutationFn: async (v: {
      nome?: string;
      nome_curto?: string | null;
      cor_primaria?: string;
      cor_acento?: string;
      logo_url?: string | null;
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
      queryClient.invalidateQueries({ queryKey: ["empresa", empresaId] });
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

  const corPrimaria = empresa?.cor_primaria || "#0072CE";
  const corAcento = empresa?.cor_acento || "#3A3A3A";
  const modulos = empresa?.modulos_habilitados ?? MODULOS_PADRAO;

  if (perfil && !podeGerenciar) {
    return (
      <div className="space-y-5">
        <EmptyState
          icon={ShieldAlert}
          title="Acesso restrito"
          hint="Apenas administradores podem alterar marca, cores e módulos."
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
      <PageHeader
        title="Minha empresa"
        description="Identidade visual e módulos do sistema. O que você define aqui vale para toda a equipe e para os links enviados aos clientes."
      />

      <SubTabs
        value={aba}
        onChange={setAba}
        items={[
          { value: "marca", label: "Marca e cores", icon: Palette },
          { value: "modulos", label: "Módulos", icon: Settings },
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
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome da empresa</Label>
                  <Input
                    className="h-9 rounded-lg"
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
                  <Label className="flex items-center gap-1 text-xs">
                    Nome curto{" "}
                    <InfoTip text="Aparece no menu lateral e no cabeçalho, ao lado da logo. Ex.: P&A." />
                  </Label>
                  <Input
                    className="h-9 rounded-lg"
                    placeholder="P&A"
                    maxLength={16}
                    defaultValue={empresa?.nome_curto ?? ""}
                    key={empresa?.nome_curto ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (empresa?.nome_curto ?? ""))
                        salvar.mutate({ nome_curto: v || null });
                    }}
                  />
                </div>
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
              É assim que a equipe e os clientes verão o sistema.
            </p>
          </SectionCard>
        </div>
      )}

      {aba === "modulos" && (
        <SectionCard
          title="Módulos visíveis"
          description="Desligue o que não está em uso; o item some do menu de toda a equipe."
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
    </div>
  );
}
