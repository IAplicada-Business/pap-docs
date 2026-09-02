import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  FileText,
  CalendarRange,
  Settings,
  LogOut,
  UsersRound,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil, useEscritorio, temPermissao } from "@/hooks/use-perfil";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permissao: null },
  { to: "/clientes", label: "Clientes", icon: Users, permissao: "clientes" as const },
  { to: "/documentos", label: "Documentos", icon: FileText, permissao: "documentos" as const },
  { to: "/competencias", label: "Competencias", icon: CalendarRange, permissao: "competencias" as const },
  { to: "/equipe", label: "Equipe", icon: UsersRound, permissao: "configuracoes" as const },
  { to: "/configuracoes", label: "Configuracoes", icon: Settings, permissao: "configuracoes" as const },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { data: perfil } = usePerfil();
  const { data: escritorio } = useEscritorio();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!escritorio) return;
    const root = document.documentElement;
    const props: string[] = [];

    function set(name: string, value: string) {
      root.style.setProperty(name, value);
      props.push(name);
    }

    if (escritorio.cor_primaria) {
      const p = escritorio.cor_primaria;
      set("--primary", p);
      set("--ring", p);
      set("--chart-1", p);
      set("--sidebar", `color-mix(in srgb, ${p}, #0a1520 60%)`);
      set("--sidebar-accent", `color-mix(in srgb, ${p}, #0a1520 45%)`);
      set("--sidebar-border", `color-mix(in srgb, ${p}, #0a1520 35%)`);
      set("--sidebar-ring", `color-mix(in srgb, ${p}, #fff 20%)`);
    }
    if (escritorio.cor_acento) {
      const a = escritorio.cor_acento;
      set("--accent", a);
      set("--accent-foreground", "#fff");
      set("--sidebar-primary", a);
      set("--chart-2", a);
    }

    return () => {
      props.forEach((name) => root.style.removeProperty(name));
    };
  }, [escritorio]);

  async function sair() {
    await supabase.auth.signOut();
    toast.success("Sessao encerrada");
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

  const iniciais = perfil?.nome
    ? perfil.nome
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0]?.toUpperCase())
        .join("")
    : "?";

  const sidebarContent = (
    <>
      <div className="px-5 pb-2 pt-6">
        {escritorio?.logo_url ? (
          <img
            src={escritorio.logo_url}
            alt={escritorio.nome}
            className="mb-1 h-8 w-auto object-contain"
          />
        ) : (
          <div className="text-base font-extrabold tracking-tight text-sidebar-accent-foreground">
            {escritorio?.nome ?? "ConcilIA"}
          </div>
        )}
        <p className="mt-0.5 text-[0.6875rem] font-medium text-sidebar-foreground/50">
          {escritorio ? "Powered by ConcilIA" : "Contabilidade inteligente"}
        </p>
      </div>

      <nav className="mt-4 flex flex-1 flex-col gap-0.5 px-3">
        {navFiltrada.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            onClick={() => setMobileOpen(false)}
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.8125rem] font-medium text-sidebar-foreground/70 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            activeProps={{
              className:
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.8125rem] font-semibold bg-sidebar-accent text-sidebar-accent-foreground shadow-sm",
            }}
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-sidebar-accent/50 transition-colors group-hover:bg-sidebar-accent">
              <Icon className="size-4" />
            </span>
            {label}
            <ChevronRight className="ml-auto size-3.5 opacity-0 transition-opacity group-hover:opacity-40" />
          </Link>
        ))}
      </nav>

      <div className="mt-auto border-t border-sidebar-border px-3 py-4">
        <div className="flex items-center gap-3 rounded-xl px-3 py-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
            {iniciais}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-sidebar-foreground">
              {perfil?.nome ?? "Equipe"}
            </div>
            <div className="truncate text-[0.6875rem] text-sidebar-foreground/50">
              {papelLabel}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            onClick={sair}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
        <div className="mt-2 px-3">
          <div className="rounded-lg bg-sidebar-accent/30 px-2.5 py-1 text-center text-[0.625rem] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
            {escritorio?.plano === "pro"
              ? "Plano Pro"
              : escritorio?.plano === "enterprise"
                ? "Enterprise"
                : "Starter"}
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-[260px] shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-[280px] flex-col bg-sidebar text-sidebar-foreground shadow-elevated">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 flex size-8 items-center justify-center rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent"
            >
              <X className="size-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b border-border/60 bg-card/80 px-4 backdrop-blur-md md:px-8">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted md:hidden"
          >
            <Menu className="size-5" />
          </button>
          <div className="hidden flex-1 md:block" />
          <div className="flex flex-1 items-center justify-end gap-3 md:flex-none">
            <div className="text-right leading-tight">
              <div className="text-sm font-semibold">{perfil?.nome ?? "Equipe"}</div>
              <div className="text-[0.6875rem] capitalize text-muted-foreground">{papelLabel}</div>
            </div>
            <div className="flex size-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {iniciais}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-x-hidden p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
