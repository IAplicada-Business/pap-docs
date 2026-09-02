import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  FileText,
  Plus,
  Search,
  Settings,
  TrendingUp,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil } from "@/hooks/use-perfil";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/empresas/")({
  head: () => ({
    meta: [
      { title: "Painel ConcilIA" },
      {
        name: "description",
        content: "Painel administrativo — gerencie as empresas atendidas.",
      },
    ],
  }),
  component: EmpresasPage,
});

/* ── helpers ──────────────────────────────────────────────── */

function inicioMesAtual(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function iniciais(nome: string): string {
  return nome
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

const ROTULO_MODULO: Record<string, string> = {
  clientes: "Clientes",
  documentos: "Documentos",
  competencias: "Competencias",
  configuracoes: "Config",
  relatorios: "Relatorios",
};

/* ── component ────────────────────────────────────────────── */

function EmpresasPage() {
  const { data: perfil } = usePerfil();
  const [busca, setBusca] = useState("");

  /* ── data fetching (parallel) ────────────────────────── */

  const { data, isLoading } = useQuery({
    queryKey: ["painel-empresas"],
    queryFn: async () => {
      const inicio = inicioMesAtual();

      const [empresasRes, clientesRes, docsMesRes, docsErroRes] =
        await Promise.all([
          supabase
            .from("organizations")
            .select(
              "id, nome, logo_url, cor_primaria, status, modulos_habilitados",
            )
            .is("deleted_at", null)
            .order("nome"),
          supabase
            .from("clientes")
            .select("id, org_id")
            .eq("ativo", true)
            .is("deleted_at", null),
          supabase
            .from("documentos")
            .select("id, org_id")
            .gte("enviado_em", inicio)
            .is("deleted_at", null),
          supabase
            .from("documentos")
            .select("id, org_id")
            .eq("status_processamento", "erro")
            .is("deleted_at", null),
        ]);

      if (empresasRes.error) throw empresasRes.error;

      const empresas = empresasRes.data ?? [];
      const clientes = clientesRes.data ?? [];
      const docsMes = docsMesRes.data ?? [];
      const docsErro = docsErroRes.data ?? [];

      /* group counts by org_id */
      const clientesPorOrg = new Map<string, number>();
      for (const c of clientes) {
        clientesPorOrg.set(c.org_id, (clientesPorOrg.get(c.org_id) ?? 0) + 1);
      }

      const docsMesPorOrg = new Map<string, number>();
      for (const d of docsMes) {
        docsMesPorOrg.set(d.org_id, (docsMesPorOrg.get(d.org_id) ?? 0) + 1);
      }

      const docsErroPorOrg = new Map<string, number>();
      for (const d of docsErro) {
        docsErroPorOrg.set(d.org_id, (docsErroPorOrg.get(d.org_id) ?? 0) + 1);
      }

      return {
        empresas,
        totalClientes: clientes.length,
        totalDocsMes: docsMes.length,
        totalDocsErro: docsErro.length,
        clientesPorOrg,
        docsMesPorOrg,
        docsErroPorOrg,
      };
    },
  });

  /* ── derived ─────────────────────────────────────────── */

  const firstName = perfil?.nome?.split(" ")[0] ?? "equipe";
  const hora = new Date().getHours();
  const saudacao =
    hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  const filtradas = useMemo(() => {
    const todas = data?.empresas ?? [];
    if (!busca.trim()) return todas;
    const termo = busca.trim().toLowerCase();
    return todas.filter((e) => e.nome.toLowerCase().includes(termo));
  }, [data?.empresas, busca]);

  /* ── stat cards config ───────────────────────────────── */

  const stats = [
    {
      label: "Total empresas",
      valor: data?.empresas.length,
      icone: Building2,
      cor: "bg-primary/10 text-primary",
      gradiente: "from-primary/20 to-primary/5",
      destaque: false,
    },
    {
      label: "Total clientes",
      valor: data?.totalClientes,
      icone: Users,
      cor: "bg-accent/10 text-accent",
      gradiente: "from-accent/20 to-accent/5",
      destaque: false,
    },
    {
      label: "Documentos no mes",
      valor: data?.totalDocsMes,
      icone: FileText,
      cor: "bg-warning/10 text-warning-foreground",
      gradiente: "from-warning/20 to-warning/5",
      destaque: false,
    },
    {
      label: "Documentos com erro",
      valor: data?.totalDocsErro,
      icone: AlertTriangle,
      cor: "bg-destructive/10 text-destructive",
      gradiente: "from-destructive/20 to-destructive/5",
      destaque: (data?.totalDocsErro ?? 0) > 0,
    },
  ];

  /* ── render ──────────────────────────────────────────── */

  return (
    <div className="space-y-8">
      {/* header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {saudacao}, {firstName}
          </h1>
          <p className="page-subtitle">
            Visao geral de todas as empresas e seus indicadores.
          </p>
        </div>
        <Button asChild className="rounded-xl">
          <Link to="/empresas/nova">
            <Plus className="size-4" /> Nova Empresa
          </Link>
        </Button>
      </div>

      {/* top-level stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, valor, icone: Icone, gradiente, cor, destaque }) => (
          <div key={label} className="stat-card group">
            {destaque && (
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-destructive to-destructive/50" />
            )}
            <div className="flex items-start justify-between">
              <div className={`stat-card-icon bg-gradient-to-br ${gradiente}`}>
                <Icone className={`size-[1.125rem] ${cor.split(" ").pop()}`} />
              </div>
              {!destaque && (
                <TrendingUp className="size-4 text-success opacity-60 transition-opacity group-hover:opacity-100" />
              )}
              {destaque && (data?.totalDocsErro ?? 0) > 0 && (
                <span className="text-xs font-semibold text-destructive">
                  Atencao
                </span>
              )}
            </div>
            <div className="mt-4">
              {isLoading ? (
                <Skeleton className="h-9 w-16" />
              ) : (
                <div className="text-3xl font-bold tracking-tight">
                  {valor ?? 0}
                </div>
              )}
              <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
                {label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* search / filter */}
      <div className="filter-bar">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="rounded-xl pl-9"
            placeholder="Buscar empresa por nome..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      </div>

      {/* empresa cards grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card-section">
              <div className="card-section-body space-y-3 p-5">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-12 rounded-xl" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-8 w-full rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : filtradas.length === 0 ? (
        <div className="card-section">
          <div className="card-section-body">
            <div className="empty-state">
              <Building2 className="empty-state-icon" />
              <p className="empty-state-text">
                {busca.trim()
                  ? "Nenhuma empresa encontrada com esse nome."
                  : "Nenhuma empresa cadastrada ainda."}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtradas.map((empresa) => {
            const nClientes = data?.clientesPorOrg.get(empresa.id) ?? 0;
            const nDocsMes = data?.docsMesPorOrg.get(empresa.id) ?? 0;
            const nDocsErro = data?.docsErroPorOrg.get(empresa.id) ?? 0;
            const modulos = empresa.modulos_habilitados ?? [];

            return (
              <div key={empresa.id} className="card-section group">
                <div className="card-section-body space-y-4 p-5">
                  {/* top: avatar + name + status */}
                  <div className="flex items-center gap-3">
                    {empresa.logo_url ? (
                      <img
                        src={empresa.logo_url}
                        alt={empresa.nome}
                        className="size-12 shrink-0 rounded-xl border border-border bg-white object-contain p-1"
                      />
                    ) : (
                      <div
                        className="flex size-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                        style={{
                          backgroundColor: empresa.cor_primaria || "#1B4B5A",
                        }}
                      >
                        {iniciais(empresa.nome)}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {empresa.nome}
                      </span>
                      <span
                        className={`status-dot mt-0.5 ${
                          empresa.status === "ativa"
                            ? "bg-success/10 text-success"
                            : empresa.status === "trial"
                              ? "bg-warning/10 text-warning-foreground"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${
                            empresa.status === "ativa"
                              ? "bg-success"
                              : empresa.status === "trial"
                                ? "bg-warning"
                                : "bg-muted-foreground/50"
                          }`}
                        />
                        {empresa.status === "ativa"
                          ? "Ativa"
                          : empresa.status === "trial"
                            ? "Trial"
                            : "Suspensa"}
                      </span>
                    </div>
                  </div>

                  {/* quick stats row */}
                  <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 px-3 py-2 text-center text-xs">
                    <div>
                      <div className="font-bold text-foreground">
                        {nClientes}
                      </div>
                      <div className="text-muted-foreground">Clientes</div>
                    </div>
                    <div>
                      <div className="font-bold text-foreground">
                        {nDocsMes}
                      </div>
                      <div className="text-muted-foreground">Docs/mes</div>
                    </div>
                    <div>
                      <div
                        className={`font-bold ${nDocsErro > 0 ? "text-destructive" : "text-foreground"}`}
                      >
                        {nDocsErro}
                      </div>
                      <div className="text-muted-foreground">Erros</div>
                    </div>
                  </div>

                  {/* module badges */}
                  {modulos.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {modulos.map((m) => (
                        <Badge
                          key={m}
                          variant="secondary"
                          className="rounded-md text-[0.6875rem] font-medium"
                        >
                          {ROTULO_MODULO[m] ?? m}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* action buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      asChild
                      size="sm"
                      className="flex-1 rounded-xl text-xs"
                    >
                      <Link
                        to="/empresas/$id"
                        params={{ id: empresa.id }}
                      >
                        Acessar
                      </Link>
                    </Button>
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="rounded-xl text-xs"
                    >
                      <Link
                        to="/empresas/$id/configuracoes"
                        params={{ id: empresa.id }}
                      >
                        <Settings className="size-3.5" />
                        Configurar
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
