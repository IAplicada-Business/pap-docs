import type { ReactNode } from "react";
import { useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  FileText,
  CalendarRange,
  Settings,
  LogOut,
  UsersRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil, useEscritorio, temPermissao } from "@/hooks/use-perfil";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permissao: null },
  { to: "/clientes", label: "Clientes", icon: Users, permissao: "clientes" as const },
  { to: "/documentos", label: "Documentos", icon: FileText, permissao: "documentos" as const },
  { to: "/competencias", label: "Competências", icon: CalendarRange, permissao: "competencias" as const },
  { to: "/equipe", label: "Equipe", icon: UsersRound, permissao: "configuracoes" as const },
  { to: "/configuracoes", label: "Configurações", icon: Settings, permissao: "configuracoes" as const },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { data: perfil } = usePerfil();
  const { data: escritorio } = useEscritorio();
  const navigate = useNavigate();

  useEffect(() => {
    if (!escritorio) return;
    const root = document.documentElement;
    if (escritorio.cor_primaria) {
      root.style.setProperty("--tenant-primary", escritorio.cor_primaria);
    }
    if (escritorio.cor_acento) {
      root.style.setProperty("--tenant-accent", escritorio.cor_acento);
    }
    return () => {
      root.style.removeProperty("--tenant-primary");
      root.style.removeProperty("--tenant-accent");
    };
  }, [escritorio]);

  async function sair() {
    await supabase.auth.signOut();
    toast.success("Sessão encerrada");
    navigate({ to: "/auth" });
  }

  const navFiltrada = NAV_ITEMS.filter(
    (item) => item.permissao === null || temPermissao(perfil, item.permissao),
  );

  const papelLabel =
    perfil?.papel === "admin_escritorio"
      ? "Administrador"
      : perfil?.papel === "super_admin"
        ? "Super Admin"
        : "Operador";

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="px-6 py-6">
          {escritorio?.logo_url ? (
            <img
              src={escritorio.logo_url}
              alt={escritorio.nome}
              className="mb-1 h-8 w-auto object-contain"
            />
          ) : (
            <div className="text-lg font-extrabold tracking-tight text-sidebar-accent-foreground">
              {escritorio?.nome ?? "ConcilIA"}
            </div>
          )}
          <p className="mt-1 text-xs text-sidebar-foreground/70">
            {escritorio ? "Powered by ConcilIA" : "Contabilidade inteligente"}
          </p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {navFiltrada.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{
                className:
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold bg-sidebar-accent text-sidebar-accent-foreground",
              }}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="px-6 py-4 text-xs text-sidebar-foreground/60">
          {escritorio?.plano === "pro" ? "Plano Pro" : escritorio?.plano === "enterprise" ? "Enterprise" : "Starter"}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-card px-4 md:px-8">
          <nav className="flex gap-1 overflow-x-auto md:hidden">
            {navFiltrada.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className="whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium text-muted-foreground"
                activeProps={{
                  className:
                    "whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold bg-secondary text-secondary-foreground",
                }}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="hidden md:block" />
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <div className="text-sm font-semibold">{perfil?.nome ?? "Equipe"}</div>
              <div className="text-xs capitalize text-muted-foreground">{papelLabel}</div>
            </div>
            <Button variant="outline" size="sm" onClick={sair}>
              <LogOut className="size-4" /> Sair
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
