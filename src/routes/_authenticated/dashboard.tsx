import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarRange, FileText, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatarDataHora } from "@/lib/formatadores";
import { rotuloTipo } from "@/lib/dominio";
import { badgeStatus } from "@/components/status-badge";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — P&A Consultoria" },
      {
        name: "description",
        content: "Resumo de clientes, documentos recebidos e competências abertas da P&A.",
      },
      { property: "og:title", content: "Dashboard — P&A Consultoria" },
      { property: "og:description", content: "Visão geral da operação contábil da P&A." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
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

  const cards = [
    { label: "Clientes ativos", valor: data?.clientesAtivos, icone: Users },
    { label: "Documentos no mês", valor: data?.documentosMes, icone: FileText },
    { label: "Documentos com erro", valor: data?.documentosErro, icone: AlertTriangle },
    { label: "Competências abertas", valor: data?.competenciasAbertas, icone: CalendarRange },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral da operação do escritório.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, valor, icone: Icone }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icone className="size-4 text-primary" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-3xl font-bold">{valor ?? 0}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimos documentos recebidos</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : data && data.ultimos.length > 0 ? (
            <ul className="divide-y">
              {data.ultimos.map((doc) => (
                <li key={doc.id} className="flex flex-wrap items-center gap-2 py-3 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {doc.nome_original ?? "Arquivo"}
                  </span>
                  <span className="text-muted-foreground">
                    {doc.clientes?.nome_fantasia ?? doc.clientes?.nome ?? "—"}
                  </span>
                  <span className="text-muted-foreground">{rotuloTipo(doc.tipo)}</span>
                  {badgeStatus(doc.status_processamento)}
                  <span className="text-xs text-muted-foreground">
                    {formatarDataHora(doc.enviado_em)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhum documento recebido ainda.{" "}
              <Link to="/clientes" className="font-medium text-primary underline">
                Cadastre um cliente e compartilhe o link de upload.
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
