import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarRange,
  FileText,
  TrendingUp,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { formatarDataHora } from "@/lib/formatadores";
import { rotuloTipo } from "@/lib/dominio";
import { badgeStatus } from "@/components/status-badge";
import { usePerfil } from "@/hooks/use-perfil";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — ConcilIA" },
      {
        name: "description",
        content: "Resumo de clientes, documentos recebidos e competencias abertas.",
      },
      { property: "og:title", content: "Dashboard — ConcilIA" },
      { property: "og:description", content: "Visao geral da operacao do escritorio." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: perfil } = usePerfil();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      const [clientes, docsMes, docsErro, competencias, ultimos] = await Promise.all([
        supabase
          .from("clientes")
          .select("id", { count: "exact", head: true })
          .eq("ativo", true)
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
          .select("id, nome_original, tipo, status_processamento, enviado_em, clientes(nome_fantasia, nome)")
          .is("deleted_at", null)
          .order("enviado_em", { ascending: false })
          .limit(10),
      ]);

      return {
        clientesAtivos: clientes.count ?? 0,
        documentosMes: docsMes.count ?? 0,
        documentosErro: docsErro.count ?? 0,
        competenciasAbertas: competencias.count ?? 0,
        ultimos: ultimos.data ?? [],
      };
    },
  });

  const firstName = perfil?.nome?.split(" ")[0] ?? "equipe";
  const hora = new Date().getHours();
  const saudacao =
    hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">
          {saudacao}, {firstName}
        </h1>
        <p className="page-subtitle">
          Aqui esta o resumo da operacao do escritorio.
        </p>
      </div>

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
            to="/documentos"
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
              {data.ultimos.map((doc) => (
                <div key={doc.id} className="list-row">
                  <div className="list-row-icon bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                    <FileText className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {doc.nome_original ?? "Arquivo"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {doc.clientes?.nome_fantasia ?? doc.clientes?.nome ?? "—"}
                      {" · "}
                      {rotuloTipo(doc.tipo)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {badgeStatus(doc.status_processamento)}
                    <span className="hidden text-xs text-muted-foreground sm:block">
                      {formatarDataHora(doc.enviado_em)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <FileText className="empty-state-icon" />
              <p className="empty-state-text">
                Nenhum documento recebido ainda.
              </p>
              <Link
                to="/clientes"
                className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
              >
                Cadastre um cliente e compartilhe o link de upload.
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
