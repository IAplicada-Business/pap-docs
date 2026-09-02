import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  CalendarRange,
  ClipboardList,
  FileText,
  Plus,
  Settings,
  TrendingUp,
  Upload,
  UserMinus,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatarDataHora } from "@/lib/formatadores";
import { rotuloTipo } from "@/lib/dominio";
import { badgeStatus } from "@/components/status-badge";
import { usePerfil } from "@/hooks/use-perfil";

export const Route = createFileRoute("/_authenticated/empresas/$id/")({
  head: () => ({
    meta: [
      { title: "Dashboard — ConcilIA" },
      {
        name: "description",
        content:
          "Painel administrativo com resumo de clientes, documentos, competencias e atividade recente.",
      },
    ],
  }),
  component: EmpresaDashboard,
});

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type AuditoriaRow = {
  id: string;
  evento: string;
  usuario: string | null;
  created_at: string;
  payload: Record<string, unknown> | null;
};

type DocumentoRow = {
  id: string;
  nome_original: string | null;
  tipo: string | null;
  status_processamento: string;
  enviado_em: string | null;
  clientes: { nome_fantasia: string | null; nome: string | null } | null;
};

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

function EmpresaDashboard() {
  const { id: empresaId } = Route.useParams();
  const { data: perfil } = usePerfil();

  const { data, isLoading } = useQuery({
    queryKey: ["empresa-dashboard", empresaId],
    queryFn: async () => {
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      const [
        clientes,
        clientesInativos,
        docsMes,
        docsErro,
        competencias,
        ultimos,
        auditoria,
        regras,
        relatoriosMes,
      ] = await Promise.all([
        supabase
          .from("clientes")
          .select("id", { count: "exact", head: true })
          .eq("ativo", true)
          .is("deleted_at", null),
        supabase
          .from("clientes")
          .select("id", { count: "exact", head: true })
          .eq("ativo", false)
          .is("deleted_at", null),
        supabase
          .from("documentos")
          .select("id", { count: "exact", head: true })
          .gte("enviado_em", inicioMes.toISOString())
          .is("deleted_at", null),
        supabase
          .from("documentos")
          .select("id", { count: "exact", head: true })
          .eq("status_processamento", "erro")
          .is("deleted_at", null),
        supabase
          .from("competencias")
          .select("id", { count: "exact", head: true })
          .neq("status", "fechada")
          .is("deleted_at", null),
        supabase
          .from("documentos")
          .select(
            "id, nome_original, tipo, status_processamento, enviado_em, clientes(nome_fantasia, nome)",
          )
          .is("deleted_at", null)
          .order("enviado_em", { ascending: false })
          .limit(10),
        supabase
          .from("auditoria")
          .select("id, evento, usuario, created_at, payload")
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("regras_aprendizado")
          .select("id", { count: "exact", head: true })
          .is("deleted_at", null),
        supabase
          .from("relatorios")
          .select("id", { count: "exact", head: true })
          .gte("created_at", inicioMes.toISOString())
          .is("deleted_at", null),
      ]);

      return {
        clientesAtivos: clientes.count ?? 0,
        clientesInativos: clientesInativos.count ?? 0,
        documentosMes: docsMes.count ?? 0,
        documentosErro: docsErro.count ?? 0,
        competenciasAbertas: competencias.count ?? 0,
        ultimos: (ultimos.data ?? []) as DocumentoRow[],
        auditoria: (auditoria.data ?? []) as AuditoriaRow[],
        regrasAprendizado: regras.count ?? 0,
        relatoriosMes: relatoriosMes.count ?? 0,
      };
    },
  });

  const firstName = perfil?.nome?.split(" ")[0] ?? "equipe";
  const hora = new Date().getHours();
  const saudacao =
    hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  /* ----- Stat cards -------------------------------------------------------- */

  const cards = [
    {
      label: "Clientes ativos",
      valor: data?.clientesAtivos,
      icone: Users,
      cor: "bg-primary/10 text-primary",
      gradiente: "from-primary/20 to-primary/5",
      destaque: false,
    },
    {
      label: "Documentos no mes",
      valor: data?.documentosMes,
      icone: FileText,
      cor: "bg-accent/10 text-accent",
      gradiente: "from-accent/20 to-accent/5",
      destaque: false,
    },
    {
      label: "Documentos com erro",
      valor: data?.documentosErro,
      icone: AlertTriangle,
      cor: "bg-destructive/10 text-destructive",
      gradiente: "from-destructive/20 to-destructive/5",
      destaque: (data?.documentosErro ?? 0) > 0,
    },
    {
      label: "Competencias abertas",
      valor: data?.competenciasAbertas,
      icone: CalendarRange,
      cor: "bg-warning/10 text-warning-foreground",
      gradiente: "from-warning/20 to-warning/5",
      destaque: false,
    },
  ];

  /* ----- Quick actions ----------------------------------------------------- */

  const acoes = [
    {
      label: "Novo cliente",
      icone: Plus,
      to: "/empresas/$id/clientes" as const,
    },
    {
      label: "Upload documento",
      icone: Upload,
      to: "/empresas/$id/documentos" as const,
    },
    {
      label: "Configurar empresa",
      icone: Settings,
      to: "/empresas/$id/configuracoes" as const,
    },
    {
      label: "Ver competencias",
      icone: CalendarRange,
      to: "/empresas/$id/competencias" as const,
    },
  ];

  /* ----- Render ------------------------------------------------------------ */

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="page-title">
          {saudacao}, {firstName}
        </h1>
        <p className="page-subtitle">
          Painel administrativo da empresa — resumo geral e acoes rapidas.
        </p>
      </div>

      {/* Row 1: Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, valor, icone: Icone, cor, gradiente, destaque }) => (
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
              {destaque && (data?.documentosErro ?? 0) > 0 && (
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

      {/* Row 2: Activity timeline + System health */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Atividade recente */}
        <div className="card-section">
          <div className="card-section-header">
            <div>
              <h2 className="text-base font-semibold">Atividade recente</h2>
              <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
                Ultimos eventos registrados na auditoria
              </p>
            </div>
            <Activity className="size-4 text-muted-foreground" />
          </div>
          <div className="card-section-body">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-xl" />
                ))}
              </div>
            ) : data && data.auditoria.length > 0 ? (
              <div className="divide-y divide-border/40">
                {data.auditoria.map((evt) => (
                  <div key={evt.id} className="list-row">
                    <div className="list-row-icon bg-gradient-to-br from-accent/15 to-accent/5 text-accent">
                      <ClipboardList className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {evt.evento}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {evt.usuario ?? "Sistema"}
                        {" · "}
                        {formatarDataHora(evt.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Activity className="empty-state-icon" />
                <p className="empty-state-text">
                  Nenhuma atividade registrada ainda.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Saude do sistema */}
        <div className="card-section">
          <div className="card-section-header">
            <div>
              <h2 className="text-base font-semibold">Saude do sistema</h2>
              <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
                Indicadores rapidos sobre a operacao
              </p>
            </div>
            <TrendingUp className="size-4 text-muted-foreground" />
          </div>
          <div className="card-section-body">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                <HealthRow
                  icone={UserMinus}
                  label="Clientes inativos"
                  valor={data?.clientesInativos ?? 0}
                  cor="text-muted-foreground"
                />
                <HealthRow
                  icone={BookOpen}
                  label="Regras de aprendizado"
                  valor={data?.regrasAprendizado ?? 0}
                  cor="text-primary"
                />
                <HealthRow
                  icone={FileText}
                  label="Relatorios gerados este mes"
                  valor={data?.relatoriosMes ?? 0}
                  cor="text-accent"
                />
                <div className="list-row">
                  <div className="list-row-icon bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                    <Settings className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      Gerenciar modulos
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Ativar ou desativar funcionalidades
                    </span>
                  </div>
                  <Link
                    to="/empresas/$id/configuracoes"
                    params={{ id: empresaId }}
                    className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    Abrir
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: Ultimos documentos */}
      <div className="card-section">
        <div className="card-section-header">
          <div>
            <h2 className="text-base font-semibold">
              Ultimos documentos recebidos
            </h2>
            <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
              Documentos mais recentes enviados pelos clientes
            </p>
          </div>
          <Link
            to="/empresas/$id/documentos"
            params={{ id: empresaId }}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
          >
            Ver todos
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
        <div className="card-section-body">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : data && data.ultimos.length > 0 ? (
            <div className="divide-y divide-border/40">
              {data.ultimos.map((doc) => {
                const clienteNome =
                  doc.clientes?.nome_fantasia ?? doc.clientes?.nome ?? "—";
                return (
                  <div key={doc.id} className="list-row">
                    <div className="list-row-icon bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                      <FileText className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {doc.nome_original ?? "Arquivo"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {rotuloTipo(doc.tipo)}
                      </span>
                    </div>
                    <div className="hidden items-center gap-2 sm:flex">
                      <span className="max-w-[10rem] truncate text-xs font-medium text-foreground/80">
                        {clienteNome}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {badgeStatus(doc.status_processamento)}
                      <span className="hidden text-xs text-muted-foreground md:block">
                        {formatarDataHora(doc.enviado_em)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <FileText className="empty-state-icon" />
              <p className="empty-state-text">
                Nenhum documento recebido ainda.
              </p>
              <Link
                to="/empresas/$id/clientes"
                params={{ id: empresaId }}
                className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
              >
                Cadastre um cliente e compartilhe o link de upload.
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Row 4: Acoes rapidas */}
      <div className="card-section">
        <div className="card-section-header">
          <div>
            <h2 className="text-base font-semibold">Acoes rapidas</h2>
            <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
              Atalhos para as areas mais usadas
            </p>
          </div>
        </div>
        <div className="card-section-body p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {acoes.map(({ label, icone: Icone, to }) => (
              <Button key={label} variant="outline" className="h-auto justify-start gap-3 px-4 py-3" asChild>
                <Link to={to} params={{ id: empresaId }}>
                  <Icone className="size-4 shrink-0 text-primary" />
                  <span className="text-sm font-medium">{label}</span>
                </Link>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  HealthRow helper                                                          */
/* -------------------------------------------------------------------------- */

function HealthRow({
  icone: Icone,
  label,
  valor,
  cor,
}: {
  icone: React.ComponentType<{ className?: string }>;
  label: string;
  valor: number;
  cor: string;
}) {
  return (
    <div className="list-row">
      <div className={`list-row-icon bg-gradient-to-br from-secondary to-secondary/50 ${cor}`}>
        <Icone className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
      </div>
      <span className="text-lg font-bold tabular-nums">{valor}</span>
    </div>
  );
}
