import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil } from "@/hooks/use-perfil";
import { Button } from "@/components/ui/button";
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

function EmpresasPage() {
  const { data: perfil } = usePerfil();
  const [busca, setBusca] = useState("");

  const { data: empresas, isLoading } = useQuery({
    queryKey: ["empresas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, nome, logo_url, cor_primaria, status")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const firstName = perfil?.nome?.split(" ")[0] ?? "equipe";
  const hora = new Date().getHours();
  const saudacao =
    hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  const filtradas = (empresas ?? []).filter((e) => {
    if (!busca.trim()) return true;
    return e.nome.toLowerCase().includes(busca.trim().toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {saudacao}, {firstName}
          </h1>
          <p className="page-subtitle">
            Gerencie as empresas atendidas pela ConcilIA.
          </p>
        </div>
        <Button asChild className="rounded-xl">
          <Link to="/empresas/nova">
            <Plus className="size-4" /> Nova Empresa
          </Link>
        </Button>
      </div>

      <div className="card-section">
        <div className="filter-bar">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="rounded-xl pl-9"
              placeholder="Buscar empresa"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>

        <div className="card-section-body">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : filtradas.length === 0 ? (
            <div className="empty-state">
              <Building2 className="empty-state-icon" />
              <p className="empty-state-text">
                Nenhuma empresa cadastrada ainda.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {filtradas.map((e) => (
                <Link
                  key={e.id}
                  to="/empresas/$id"
                  params={{ id: e.id }}
                  className="list-row"
                >
                  {e.logo_url ? (
                    <img
                      src={e.logo_url}
                      alt={e.nome}
                      className="size-10 shrink-0 rounded-xl border border-border bg-white object-contain p-1"
                    />
                  ) : (
                    <div
                      className="flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                      style={{ backgroundColor: e.cor_primaria || "#1B4B5A" }}
                    >
                      {e.nome
                        .split(" ")
                        .slice(0, 2)
                        .map((w) => w[0]?.toUpperCase())
                        .join("")}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {e.nome}
                    </span>
                  </div>
                  <span
                    className={`status-dot ${
                      e.status === "ativa"
                        ? "bg-success/10 text-success"
                        : e.status === "trial"
                          ? "bg-warning/10 text-warning-foreground"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        e.status === "ativa"
                          ? "bg-success"
                          : e.status === "trial"
                            ? "bg-warning"
                            : "bg-muted-foreground/50"
                      }`}
                    />
                    {e.status === "ativa"
                      ? "Ativa"
                      : e.status === "trial"
                        ? "Trial"
                        : "Suspensa"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
