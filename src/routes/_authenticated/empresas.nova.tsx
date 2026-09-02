import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Building2, ImagePlus, Palette } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil } from "@/hooks/use-perfil";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/empresas/nova")({
  head: () => ({
    meta: [
      { title: "Nova Empresa — ConcilIA" },
      { name: "description", content: "Cadastrar nova empresa na plataforma." },
    ],
  }),
  component: NovaEmpresaPage,
});

const MODULOS_DISPONIVEIS = [
  { value: "clientes", label: "Clientes" },
  { value: "documentos", label: "Documentos" },
  { value: "competencias", label: "Competencias" },
  { value: "configuracoes", label: "Configuracoes" },
] as const;

function NovaEmpresaPage() {
  const { data: perfil } = usePerfil();
  const navigate = useNavigate();

  const [nome, setNome] = useState("");
  const [corPrimaria, setCorPrimaria] = useState("#0072CE");
  const [corAcento, setCorAcento] = useState("#3A3A3A");
  const [modulos, setModulos] = useState<string[]>([
    "clientes",
    "documentos",
    "competencias",
    "configuracoes",
  ]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setLogoFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setLogoPreview(null);
    }
  }

  function toggleModulo(modulo: string) {
    if (modulo === "configuracoes") return;
    setModulos((prev) =>
      prev.includes(modulo)
        ? prev.filter((m) => m !== modulo)
        : [...prev, modulo],
    );
  }

  const criar = useMutation({
    mutationFn: async () => {
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .insert({
          nome,
          cor_primaria: corPrimaria,
          cor_acento: corAcento,
          modulos_habilitados: modulos,
          status: "ativa",
        })
        .select("id")
        .single();
      if (orgError) throw orgError;

      const newOrgId = org.id;

      if (logoFile) {
        const ext = logoFile.name.split(".").pop() ?? "png";
        const path = `${newOrgId}/logo-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("logos")
          .upload(path, logoFile, { upsert: true });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("logos")
          .getPublicUrl(path);

        const { error: updateError } = await supabase
          .from("organizations")
          .update({ logo_url: urlData.publicUrl })
          .eq("id", newOrgId);
        if (updateError) throw updateError;
      }

      return newOrgId;
    },
    onSuccess: (newOrgId) => {
      toast.success("Empresa criada com sucesso");
      navigate({ to: "/empresas/$id", params: { id: newOrgId } });
    },
    onError: (e: Error) =>
      toast.error("Nao foi possivel criar a empresa", {
        description: e.message,
      }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("Informe o nome da empresa");
      return;
    }
    criar.mutate();
  }

  const iniciais = nome.trim()
    ? nome
        .trim()
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join("")
    : "AB";

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 rounded-lg">
        <Link to="/empresas">
          <ArrowLeft className="size-4" /> Voltar as empresas
        </Link>
      </Button>

      <div className="page-header">
        <div>
          <h1 className="page-title">Nova Empresa</h1>
          <p className="page-subtitle">
            Cadastre uma nova empresa na plataforma ConcilIA.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Nome */}
          <div className="card-section">
            <div className="card-section-header">
              <div className="flex items-center gap-3">
                <div className="list-row-icon bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                  <Building2 className="size-4" />
                </div>
                <h2 className="text-sm font-semibold">Dados da empresa</h2>
              </div>
            </div>
            <div className="space-y-4 p-5">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome da empresa *</Label>
                <Input
                  className="rounded-xl"
                  placeholder="Ex: Contabilidade Silva & Associados"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                />
              </div>

              {/* Logo */}
              <div className="space-y-2">
                <Label className="text-xs">Logo</Label>
                <div className="flex items-center gap-4">
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="Preview"
                      className="size-16 rounded-xl border border-border bg-white object-contain p-1.5"
                    />
                  ) : (
                    <div className="flex size-16 items-center justify-center rounded-xl border-2 border-dashed border-border text-muted-foreground">
                      <ImagePlus className="size-6" />
                    </div>
                  )}
                  <div className="space-y-1.5 flex-1">
                    <Input
                      type="file"
                      accept="image/*"
                      className="rounded-xl text-xs"
                      onChange={handleLogoChange}
                    />
                    <p className="text-[0.6875rem] text-muted-foreground">
                      PNG, JPG ou SVG. O upload sera feito ao salvar.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Cores */}
          <div className="card-section">
            <div className="card-section-header">
              <div className="flex items-center gap-3">
                <div className="list-row-icon bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                  <Palette className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Identidade visual</h2>
                  <p className="text-xs text-muted-foreground">
                    Cores que serao aplicadas no ambiente da empresa.
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-5 p-5">
              <div className="space-y-2">
                <Label className="text-xs">Cor primaria</Label>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <input
                      type="color"
                      value={corPrimaria}
                      onChange={(e) => setCorPrimaria(e.target.value)}
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
                    value={corPrimaria}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCorPrimaria(v);
                      if (!/^#[0-9a-fA-F]{6}$/.test(v)) return;
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Usada no cabecalho e destaques.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Cor de acento</Label>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <input
                      type="color"
                      value={corAcento}
                      onChange={(e) => setCorAcento(e.target.value)}
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
                    value={corAcento}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCorAcento(v);
                      if (!/^#[0-9a-fA-F]{6}$/.test(v)) return;
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Usada em textos e elementos secundarios.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Modulos */}
          <div className="card-section">
            <div className="card-section-header">
              <h2 className="text-sm font-semibold">Modulos habilitados</h2>
            </div>
            <div className="space-y-2 p-5">
              {MODULOS_DISPONIVEIS.map((m) => {
                const forcado = m.value === "configuracoes";
                return (
                  <label
                    key={m.value}
                    className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm"
                  >
                    <Checkbox
                      checked={modulos.includes(m.value)}
                      disabled={forcado}
                      onCheckedChange={() => toggleModulo(m.value)}
                    />
                    {m.label}
                    {forcado && (
                      <span className="text-[0.6875rem] text-muted-foreground">
                        (obrigatorio)
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              type="submit"
              className="rounded-xl"
              disabled={criar.isPending}
            >
              {criar.isPending ? "Criando..." : "Criar empresa"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              asChild
            >
              <Link to="/empresas">Cancelar</Link>
            </Button>
          </div>
        </div>

        {/* Live branding preview */}
        <div className="lg:col-span-1">
          <div className="card-section sticky top-6">
            <div className="card-section-header">
              <p className="text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground">
                Pre-visualizacao
              </p>
            </div>
            <div className="p-5">
              <div
                className="overflow-hidden rounded-xl border border-border/60"
                style={{ backgroundColor: corAcento + "10" }}
              >
                {/* Mock sidebar header */}
                <div
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ backgroundColor: corPrimaria }}
                >
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt=""
                      className="size-8 rounded-lg bg-white object-contain p-0.5"
                    />
                  ) : (
                    <div
                      className="flex size-8 items-center justify-center rounded-lg text-xs font-bold"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.2)",
                        color: "#fff",
                      }}
                    >
                      {iniciais}
                    </div>
                  )}
                  <span
                    className="truncate text-sm font-semibold"
                    style={{ color: "#fff" }}
                  >
                    {nome.trim() || "Nome da empresa"}
                  </span>
                </div>

                {/* Mock nav items */}
                <div className="space-y-0.5 px-3 py-3">
                  {modulos
                    .filter((m) => m !== "configuracoes")
                    .map((m, i) => (
                      <div
                        key={m}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                        style={
                          i === 0
                            ? {
                                backgroundColor: corPrimaria + "18",
                                color: corPrimaria,
                                fontWeight: 600,
                              }
                            : { color: corAcento }
                        }
                      >
                        <div
                          className="size-1.5 rounded-full"
                          style={{
                            backgroundColor:
                              i === 0 ? corPrimaria : corAcento + "60",
                          }}
                        />
                        {m.charAt(0).toUpperCase() + m.slice(1)}
                      </div>
                    ))}
                  <div className="my-2 border-t border-border/40" />
                  <div
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                    style={{ color: corAcento }}
                  >
                    <div
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: corAcento + "60" }}
                    />
                    Configuracoes
                  </div>
                </div>
              </div>

              {/* Gradient preview */}
              <div
                className="mt-4 flex items-center gap-3 rounded-lg p-3"
                style={{
                  background: `linear-gradient(135deg, ${corPrimaria}20, ${corPrimaria}08)`,
                }}
              >
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt=""
                    className="size-8 rounded-lg bg-white object-contain p-0.5"
                  />
                ) : (
                  <div
                    className="flex size-8 items-center justify-center rounded-lg text-xs font-bold text-white"
                    style={{ backgroundColor: corPrimaria }}
                  >
                    {iniciais}
                  </div>
                )}
                <span className="text-sm font-semibold">
                  {nome.trim() || "Nome da empresa"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
