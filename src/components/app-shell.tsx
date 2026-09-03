import type { ComponentType, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useRouteContext, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bell,
  Building2,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  FileBarChart2,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Scale,
  Search,
  Settings,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  usePerfil,
  useEmpresa,
  temPermissao,
  moduloHabilitado,
  type Permissoes,
} from "@/hooks/use-perfil";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { formatarCompetencia } from "@/lib/formatadores";
import { AssistentePA } from "@/components/assistente-pa";

type Icon = ComponentType<{ className?: string }>;

type NavChild = { to: string; label: string; search?: Record<string, string> };

type NavItem = {
  to: string;
  label: string;
  icon: Icon;
  permissao: keyof Permissoes | null;
  modulo?: string;
  exact?: boolean;
  somenteAdmin?: boolean;
  children?: NavChild[];
};

type NavGroup = { label: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    label: "Visão geral",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permissao: null, exact: true },
    ],
  },
  {
    label: "Operação",
    items: [
      {
        to: "/documentos",
        label: "Documentos",
        icon: FileText,
        permissao: "documentos",
        modulo: "documentos",
        children: [
          { to: "/documentos", label: "Todos" },
          { to: "/documentos", label: "Fila de processamento", search: { aba: "fila" } },
          { to: "/documentos", label: "Com erro", search: { aba: "erro" } },
        ],
      },
      { to: "/conciliacao", label: "Conciliação", icon: Scale, permissao: "competencias" },
      {
        to: "/competencias",
        label: "Competências",
        icon: CalendarRange,
        permissao: "competencias",
        modulo: "competencias",
      },
      { to: "/relatorios", label: "Relatórios", icon: FileBarChart2, permissao: "relatorios" },
    ],
  },
  {
    label: "Cadastros",
    items: [
      {
        to: "/clientes",
        label: "Clientes",
        icon: Users,
        permissao: "clientes",
        modulo: "clientes",
      },
    ],
  },
  {
    label: "Sistema",
    items: [
      {
        to: "/configuracoes",
        label: "Configurações",
        icon: Settings,
        permissao: "configuracoes",
        modulo: "configuracoes",
      },
      { to: "/equipe", label: "Equipe", icon: UserCog, permissao: "configuracoes" },
      {
        to: "/empresa",
        label: "Minha empresa",
        icon: Building2,
        permissao: "configuracoes",
        somenteAdmin: true,
      },
    ],
  },
];

const PAGE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  documentos: "Documentos",
  conciliacao: "Conciliação",
  competencias: "Competências",
  relatorios: "Relatórios",
  clientes: "Clientes",
  configuracoes: "Configurações",
  equipe: "Equipe",
  empresa: "Minha empresa",
};

export function AppShell({ children }: { children: ReactNode }) {
  const { orgId } = useRouteContext({ from: "/_authenticated" });
  const { data: perfil } = usePerfil();
  const { data: empresa } = useEmpresa(orgId);
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sidebar-collapsed") === "true";
  });
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Cores da marca aplicadas em todo o sistema (definidas em "Minha empresa").
  useEffect(() => {
    const root = document.documentElement;
    const names = [
      "--primary",
      "--ring",
      "--chart-1",
      "--sidebar",
      "--sidebar-accent",
      "--sidebar-border",
      "--sidebar-ring",
    ];
    if (!empresa?.cor_primaria) {
      names.forEach((n) => root.style.removeProperty(n));
      return;
    }
    const p = empresa.cor_primaria;
    root.style.setProperty("--primary", p);
    root.style.setProperty("--ring", p);
    root.style.setProperty("--chart-1", p);
    root.style.setProperty("--sidebar", `color-mix(in srgb, ${p}, #080e14 65%)`);
    root.style.setProperty("--sidebar-accent", `color-mix(in srgb, ${p}, #080e14 48%)`);
    root.style.setProperty("--sidebar-border", `color-mix(in srgb, ${p}, #080e14 38%)`);
    root.style.setProperty("--sidebar-ring", `color-mix(in srgb, ${p}, #fff 20%)`);
    return () => names.forEach((n) => root.style.removeProperty(n));
  }, [empresa]);

  async function sair() {
    await supabase.auth.signOut();
    toast.success("Sessão encerrada");
    navigate({ to: "/auth" });
  }

  const isAdmin = perfil?.papel === "admin" || perfil?.papel === "super_admin";

  const groups = useMemo(() => {
    return NAV.map((g) => ({
      ...g,
      items: g.items.filter((item) => {
        if (item.somenteAdmin && !isAdmin) return false;
        if (item.permissao !== null && !temPermissao(perfil, item.permissao)) return false;
        if (item.modulo && !moduloHabilitado(empresa, item.modulo)) return false;
        return true;
      }),
    })).filter((g) => g.items.length > 0);
  }, [perfil, empresa, isAdmin]);

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

  const brandName = empresa?.nome_curto || empresa?.nome || "P&A";
  const brandLogo = empresa?.logo_url || "/logo-pa-icon.svg";

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.to : pathname.startsWith(item.to);
  const childActive = (c: NavChild) => {
    if (pathname !== c.to) return false;
    const want = c.search?.["aba"];
    const has = new URLSearchParams(searchStr).get("aba");
    return (want ?? null) === has;
  };

  const crumbs = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    const out: { label: string; to?: string }[] = [{ label: brandName, to: "/dashboard" }];
    const seg = parts[0] ?? "dashboard";
    if (seg === "dashboard" && parts.length <= 1) {
      out.push({ label: "Dashboard" });
      return out;
    }
    out.push({
      label: PAGE_LABELS[seg] ?? seg,
      ...(parts.length > 1 ? { to: `/${seg}` } : {}),
    });
    if (parts.length > 1) out.push({ label: "Detalhe" });
    return out;
  }, [pathname, brandName]);

  const sidebarContent = (mobile: boolean) => {
    const mini = collapsed && !mobile;
    return (
      <>
        <div
          className={`flex items-center gap-2.5 ${mini ? "justify-center px-2 pt-5" : "px-4 pt-5"}`}
        >
          <img
            src={brandLogo}
            alt={brandName}
            className="size-9 shrink-0 rounded-xl object-contain"
          />
          {!mini && (
            <span
              className="truncate text-[0.9375rem] font-bold tracking-tight text-sidebar-accent-foreground"
              title={empresa?.nome ?? undefined}
            >
              {brandName}
            </span>
          )}
        </div>

        <nav
          className={`mt-5 flex flex-1 flex-col gap-4 overflow-y-auto ${mini ? "px-2" : "px-3"}`}
        >
          {groups.map((g) => (
            <div key={g.label}>
              {!mini && (
                <p className="mb-1 px-2 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/35">
                  {g.label}
                </p>
              )}
              {mini && <div className="mx-auto mb-2 h-px w-6 bg-sidebar-border" />}
              <div className="flex flex-col gap-0.5">
                {g.items.map((item) => {
                  const active = isActive(item);
                  const hasChildren = !!item.children?.length && !mini;
                  const open = openGroups[item.to] ?? active;
                  return (
                    <div key={item.to}>
                      <div className="flex items-center">
                        <Link
                          to={item.to}
                          onClick={() => setMobileOpen(false)}
                          title={mini ? item.label : undefined}
                          className={`flex flex-1 items-center gap-2.5 rounded-lg text-[0.8125rem] transition-all duration-200 ${
                            mini ? "justify-center px-0 py-2" : "px-2.5 py-2"
                          } ${
                            active
                              ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground shadow-[inset_3px_0_0_var(--color-sidebar-primary),0_0_12px_color-mix(in_srgb,var(--color-sidebar-primary)_10%,transparent)]"
                              : "font-medium text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                          }`}
                        >
                          <item.icon
                            className={`size-4 shrink-0 ${active ? "text-sidebar-primary" : ""}`}
                          />
                          {!mini && <span className="truncate">{item.label}</span>}
                        </Link>
                        {hasChildren && (
                          <button
                            type="button"
                            onClick={() => setOpenGroups((o) => ({ ...o, [item.to]: !open }))}
                            className="mr-1 flex size-7 items-center justify-center rounded-md text-sidebar-foreground/45 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                            aria-label={open ? "Recolher" : "Expandir"}
                          >
                            <ChevronDown
                              className={`size-3.5 transition-transform ${open ? "" : "-rotate-90"}`}
                            />
                          </button>
                        )}
                      </div>
                      {hasChildren && open && (
                        <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-sidebar-border pl-3">
                          {item.children!.map((c) => {
                            const ca = childActive(c);
                            return (
                              <Link
                                key={c.label}
                                to={c.to}
                                search={c.search ?? {}}
                                onClick={() => setMobileOpen(false)}
                                className={`rounded-md px-2 py-1.5 text-[0.75rem] transition-colors ${
                                  ca
                                    ? "font-semibold text-sidebar-accent-foreground"
                                    : "text-sidebar-foreground/55 hover:text-sidebar-accent-foreground"
                                }`}
                              >
                                {c.label}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className={`mt-auto border-t border-sidebar-border py-3 ${mini ? "px-2" : "px-3"}`}>
          <div
            className={`flex items-center gap-2.5 rounded-lg ${mini ? "flex-col" : "px-2 py-1.5"}`}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sidebar-primary to-sidebar-primary/70 text-[0.6875rem] font-bold text-sidebar-primary-foreground ring-2 ring-sidebar-primary/20 ring-offset-1 ring-offset-sidebar">
              {iniciais}
            </span>
            {!mini && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-[0.8125rem] font-semibold text-sidebar-foreground">
                  {perfil?.nome ?? "Equipe"}
                </div>
                <div className="truncate text-[0.6875rem] text-sidebar-foreground/45">
                  {papelLabel}
                </div>
              </div>
            )}
            <button
              onClick={sair}
              title="Sair"
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/45 transition-all hover:bg-sidebar-accent hover:text-sidebar-foreground hover:shadow-[0_0_8px_color-mix(in_srgb,var(--color-destructive)_15%,transparent)]"
            >
              <LogOut className="size-3.5" />
            </button>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col sidebar-glass text-sidebar-foreground transition-[width] duration-200 ease-in-out md:flex ${
          collapsed ? "w-[64px]" : "w-[240px]"
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
          <aside className="relative flex h-full w-[270px] flex-col sidebar-glass text-sidebar-foreground shadow-elevated animate-in slide-in-from-left duration-200">
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
        <header className="sticky top-0 z-30 flex h-13 items-center gap-2 glass-header px-3 md:px-5">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted md:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="size-4.5" />
          </button>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted md:flex"
            title={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </button>

          <nav
            className="hidden min-w-0 items-center gap-1 text-[0.8125rem] sm:flex"
            aria-label="Breadcrumb"
          >
            {crumbs.map((c, i) => {
              const last = i === crumbs.length - 1;
              return (
                <span key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1">
                  {i > 0 && <ChevronRight className="size-3 shrink-0 text-muted-foreground/50" />}
                  {c.to && !last ? (
                    <Link
                      to={c.to}
                      className="truncate text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {c.label}
                    </Link>
                  ) : (
                    <span
                      className={`truncate ${last ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                    >
                      {c.label}
                    </span>
                  )}
                </span>
              );
            })}
          </nav>

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-8 items-center gap-2 rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm px-2.5 text-xs text-muted-foreground transition-all hover:border-primary/20 hover:bg-card/80 hover:shadow-sm sm:w-56"
          >
            <Search className="size-3.5" />
            <span className="hidden flex-1 text-left sm:block">Buscar…</span>
            <kbd className="hidden rounded border border-border bg-muted px-1 font-mono text-[0.625rem] sm:block">
              ⌘K
            </kbd>
          </button>

          <AlertsBell orgId={orgId} />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-lg p-1 pr-2 transition-colors hover:bg-muted">
                <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-[0.6875rem] font-bold text-primary-foreground ring-2 ring-primary/15">
                  {iniciais}
                </span>
                <ChevronDown className="hidden size-3.5 text-muted-foreground sm:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="text-sm font-semibold">{perfil?.nome ?? "Equipe"}</div>
                <div className="text-xs font-normal text-muted-foreground">{perfil?.email}</div>
                <div className="mt-1 text-[0.6875rem] font-medium text-primary">{papelLabel}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/configuracoes">
                  <Settings className="size-4" /> Configurações
                </Link>
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem asChild>
                  <Link to="/empresa">
                    <Building2 className="size-4" /> Minha empresa
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={sair} className="text-destructive focus:text-destructive">
                <LogOut className="size-4" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 overflow-x-hidden p-4 md:p-6 mesh-gradient">{children}</main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} groups={groups} />

      {empresa && (
        <AssistentePA
          empresaId={orgId}
          nomeCurto={empresa.nome_curto || empresa.nome}
          nomeCompleto={empresa.nome}
          logoUrl={empresa.logo_url || "/logo-pa-icon.svg"}
          corPrimaria={empresa.cor_primaria || "#0072CE"}
        />
      )}
    </div>
  );
}

function AlertsBell({ orgId }: { orgId: string }) {
  const { data } = useQuery({
    queryKey: ["alertas", orgId],
    refetchInterval: 60_000,
    queryFn: async () => {
      const [erros, conc] = await Promise.all([
        supabase
          .from("documentos")
          .select("id, nome_original, erro_motivo, clientes(nome_fantasia, nome)")
          .eq("status_processamento", "erro")
          .is("deleted_at", null)
          .order("enviado_em", { ascending: false })
          .limit(5),
        supabase
          .from("competencias")
          .select("id, mes_ano, clientes(nome_fantasia, nome)")
          .eq("status", "em_conciliacao")
          .is("deleted_at", null)
          .order("mes_ano", { ascending: false })
          .limit(5),
      ]);
      return { erros: erros.data ?? [], conc: conc.data ?? [] };
    },
  });
  const total = (data?.erros.length ?? 0) + (data?.conc.length ?? 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Alertas"
        >
          <Bell className="size-4" />
          {total > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[0.625rem] font-bold text-white">
              {total > 9 ? "9+" : total}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
          <span className="text-sm font-semibold">Pendências</span>
          <span className="text-xs text-muted-foreground">{total} itens</span>
        </div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          {total === 0 && (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              Tudo em dia por aqui.
            </p>
          )}
          {data?.erros.map((d) => (
            <Link
              key={d.id}
              to="/documentos"
              search={{ aba: "erro" }}
              className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 hover:bg-muted"
            >
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                <AlertTriangle className="size-3.5" />
              </span>
              <div className="min-w-0">
                <div className="truncate text-xs font-medium">{d.nome_original ?? "Documento"}</div>
                <div className="truncate text-[0.6875rem] text-muted-foreground">
                  {d.clientes?.nome_fantasia ?? d.clientes?.nome} ·{" "}
                  {d.erro_motivo ?? "Erro no processamento"}
                </div>
              </div>
            </Link>
          ))}
          {data?.conc.map((c) => (
            <Link
              key={c.id}
              to="/conciliacao"
              className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 hover:bg-muted"
            >
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-warning/15 text-warning-foreground">
                <Scale className="size-3.5" />
              </span>
              <div className="min-w-0">
                <div className="truncate text-xs font-medium">
                  {c.clientes?.nome_fantasia ?? c.clientes?.nome}
                </div>
                <div className="truncate text-[0.6875rem] text-muted-foreground">
                  Conciliação em andamento · {formatarCompetencia(c.mes_ano)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CommandPalette({
  open,
  onOpenChange,
  groups,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  groups: NavGroup[];
}) {
  const navigate = useNavigate();
  const { data: clientes } = useQuery({
    queryKey: ["clientes-select"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("clientes")
        .select("id, nome_fantasia, nome, cnpj")
        .is("deleted_at", null)
        .order("nome_fantasia");
      return data ?? [];
    },
  });

  function go(to: string, search?: Record<string, string>) {
    onOpenChange(false);
    navigate({ to, search: search ?? {} } as never);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Ir para página ou buscar cliente…" />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        {groups.map((g) => (
          <CommandGroup key={g.label} heading={g.label}>
            {g.items.map((item) => (
              <CommandItem
                key={item.to}
                value={`${g.label} ${item.label}`}
                onSelect={() => go(item.to)}
              >
                <item.icon className="size-4 text-muted-foreground" />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        {clientes && clientes.length > 0 && (
          <CommandGroup heading="Clientes">
            {clientes.map((c) => (
              <CommandItem
                key={c.id}
                value={`cliente ${c.nome_fantasia ?? c.nome ?? ""} ${c.cnpj}`}
                onSelect={() => go(`/clientes/${c.id}`)}
              >
                <Users className="size-4 text-muted-foreground" />
                <span className="truncate">{c.nome_fantasia ?? c.nome}</span>
                <span className="ml-auto font-mono text-[0.6875rem] text-muted-foreground">
                  {c.cnpj}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
