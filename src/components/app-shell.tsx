import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeft,
  Building2,
  CalendarRange,
  ChevronRight,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil, useEmpresa, temPermissao } from "@/hooks/use-perfil";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type NavItem = {
  to: string;
  params?: Record<string, string>;
  label: string;
  icon: typeof LayoutDashboard;
  permissao: "clientes" | "documentos" | "competencias" | "relatorios" | "configuracoes" | null;
};

function buildEmpresaNav(empresaId: string): NavItem[] {
  return [
    { to: "/empresas/$id", params: { id: empresaId }, label: "Dashboard", icon: LayoutDashboard, permissao: null },
    { to: "/empresas/$id/clientes", params: { id: empresaId }, label: "Clientes", icon: Users, permissao: "clientes" },
    { to: "/empresas/$id/documentos", params: { id: empresaId }, label: "Documentos", icon: FileText, permissao: "documentos" },
    { to: "/empresas/$id/competencias", params: { id: empresaId }, label: "Competencias", icon: CalendarRange, permissao: "competencias" },
    { to: "/empresas/$id/configuracoes", params: { id: empresaId }, label: "Configuracoes", icon: Settings, permissao: "configuracoes" },
  ];
}

const ADMIN_NAV: NavItem[] = [
  { to: "/empresas", label: "Empresas", icon: Building2, permissao: null },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { data: perfil } = usePerfil();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sidebar-collapsed") === "true";
  });

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const empresaMatch = pathname.match(/^\/empresas\/([^/]+)/);
  const empresaId = empresaMatch?.[1] ?? null;
  const modoEmpresa = !!empresaId;

  const { data: empresa } = useEmpresa(empresaId ?? undefined);

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    if (!modoEmpresa || !empresa) {
      const root = document.documentElement;
      root.style.removeProperty("--primary");
      root.style.removeProperty("--ring");
      root.style.removeProperty("--chart-1");
      root.style.removeProperty("--sidebar");
      root.style.removeProperty("--sidebar-accent");
      root.style.removeProperty("--sidebar-border");
      root.style.removeProperty("--sidebar-ring");
      return;
    }

    const root = document.documentElement;
    const props: string[] = [];

    function set(name: string, value: string) {
      root.style.setProperty(name, value);
      props.push(name);
    }

    if (empresa.cor_primaria) {
      const p = empresa.cor_primaria;
      set("--primary", p);
      set("--ring", p);
      set("--chart-1", p);
      set("--sidebar", `color-mix(in srgb, ${p}, #080e14 65%)`);
      set("--sidebar-accent", `color-mix(in srgb, ${p}, #080e14 48%)`);
      set("--sidebar-border", `color-mix(in srgb, ${p}, #080e14 38%)`);
      set("--sidebar-ring", `color-mix(in srgb, ${p}, #fff 20%)`);
    }

    return () => {
      props.forEach((name) => root.style.removeProperty(name));
    };
  }, [modoEmpresa, empresa]);

  async function sair() {
    await supabase.auth.signOut();
    toast.success("Sessao encerrada");
    navigate({ to: "/auth" });
  }

  const navItems = modoEmpresa && empresaId
    ? buildEmpresaNav(empresaId)
    : ADMIN_NAV;

  const navFiltrada = navItems.filter(
    (item) => item.permissao === null || temPermissao(perfil, item.permissao),
  );

  const papelLabel =
    perfil?.papel === "admin"
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

  const brandName = modoEmpresa ? (empresa?.nome ?? "Empresa") : "ConcilIA";
  const brandLogo = modoEmpresa ? empresa?.logo_url : null;

  const sidebarContent = (mobile: boolean) => (
    <>
      <div className={`pb-2 pt-6 ${collapsed && !mobile ? "px-3 text-center" : "px-5"}`}>
        {modoEmpresa && (!collapsed || mobile) && (
          <Link
            to="/empresas"
            className="mb-3 flex items-center gap-1.5 rounded-lg px-1 py-1 text-[0.6875rem] font-medium text-sidebar-foreground/40 transition-colors hover:text-sidebar-foreground/70"
            onClick={() => setMobileOpen(false)}
          >
            <ArrowLeft className="size-3" />
            Voltar a ConcilIA
          </Link>
        )}
        {modoEmpresa && collapsed && !mobile && (
          <Link
            to="/empresas"
            className="mx-auto mb-3 flex size-8 items-center justify-center rounded-lg text-sidebar-foreground/40 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground/70"
            title="Voltar a ConcilIA"
            onClick={() => setMobileOpen(false)}
          >
            <ArrowLeft className="size-4" />
          </Link>
        )}
        {brandLogo ? (
          <img
            src={brandLogo}
            alt={brandName}
            className={`mb-1 w-auto object-contain ${collapsed && !mobile ? "mx-auto h-6" : "h-8"}`}
          />
        ) : (
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center justify-center rounded-xl bg-sidebar-primary/20 ${
                collapsed && !mobile ? "mx-auto size-9" : "size-8"
              }`}
            >
              {modoEmpresa ? (
                <Building2 className="size-4 text-sidebar-primary" />
              ) : (
                <Sparkles className="size-4 text-sidebar-primary" />
              )}
            </div>
            {(!collapsed || mobile) && (
              <span className="text-base font-bold tracking-tight text-sidebar-accent-foreground">
                {brandName}
              </span>
            )}
          </div>
        )}
        {(!collapsed || mobile) && (
          <p className="mt-1.5 text-[0.6875rem] font-medium text-sidebar-foreground/40">
            {modoEmpresa ? "Powered by ConcilIA" : "Contabilidade inteligente"}
          </p>
        )}
      </div>

      <nav className={`mt-6 flex flex-1 flex-col gap-1 ${collapsed && !mobile ? "px-2" : "px-3"}`}>
        <p className={`mb-2 text-[0.625rem] font-semibold uppercase tracking-widest text-sidebar-foreground/30 ${collapsed && !mobile ? "text-center" : "px-3"}`}>
          {collapsed && !mobile ? "·" : "Menu"}
        </p>
        {navFiltrada.map(({ to, params, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            params={params ?? {}}
            onClick={() => setMobileOpen(false)}
            className={`group flex items-center rounded-xl text-[0.8125rem] font-medium text-sidebar-foreground/60 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
              collapsed && !mobile
                ? "justify-center px-2 py-2.5"
                : "gap-3 px-3 py-2.5"
            }`}
            activeProps={{
              className: `group flex items-center rounded-xl text-[0.8125rem] font-semibold bg-sidebar-accent text-sidebar-accent-foreground ${
                collapsed && !mobile
                  ? "justify-center px-2 py-2.5"
                  : "gap-3 px-3 py-2.5"
              }`,
            }}
            activeOptions={{ exact: to === "/empresas/$id" || to === "/empresas" }}
            title={collapsed && !mobile ? label : undefined}
          >
            <span
              className={`flex shrink-0 items-center justify-center rounded-xl transition-colors ${
                collapsed && !mobile ? "size-9" : "size-8"
              }`}
            >
              <Icon className="size-[1.125rem]" />
            </span>
            {(!collapsed || mobile) && (
              <>
                {label}
                <ChevronRight className="ml-auto size-3.5 opacity-0 transition-opacity group-hover:opacity-40" />
              </>
            )}
          </Link>
        ))}
      </nav>

      <div className={`mt-auto border-t border-sidebar-border py-4 ${collapsed && !mobile ? "px-2" : "px-3"}`}>
        {collapsed && !mobile ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sidebar-primary to-sidebar-primary/70 text-xs font-bold text-sidebar-primary-foreground">
              {iniciais}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              onClick={sair}
              title="Sair"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sidebar-primary to-sidebar-primary/70 text-xs font-bold text-sidebar-primary-foreground">
              {iniciais}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-sidebar-foreground">
                {perfil?.nome ?? "Equipe"}
              </div>
              <div className="truncate text-[0.6875rem] text-sidebar-foreground/40">
                {papelLabel}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              onClick={sair}
              title="Sair"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={`hidden shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-in-out md:flex ${
          collapsed ? "w-[72px]" : "w-[260px]"
        }`}
      >
        {sidebarContent(false)}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-[280px] flex-col bg-sidebar text-sidebar-foreground shadow-elevated animate-in slide-in-from-left duration-200">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 flex size-8 items-center justify-center rounded-lg text-sidebar-foreground/50 hover:bg-sidebar-accent"
            >
              <X className="size-5" />
            </button>
            {sidebarContent(true)}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/50 bg-background/80 px-4 backdrop-blur-xl md:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex size-9 items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-muted md:hidden"
          >
            <Menu className="size-5" />
          </button>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden size-9 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted md:flex"
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
          <div className="hidden flex-1 md:block" />
          <div className="flex flex-1 items-center justify-end gap-3 md:flex-none">
            <div className="text-right leading-tight">
              <div className="text-sm font-semibold">{perfil?.nome ?? "Equipe"}</div>
              <div className="text-[0.6875rem] capitalize text-muted-foreground">{papelLabel}</div>
            </div>
            <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-xs font-bold text-primary-foreground">
              {iniciais}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-x-hidden p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
