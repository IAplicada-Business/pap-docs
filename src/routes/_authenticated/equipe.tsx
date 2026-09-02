import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Pencil, Plus, Search, ShieldAlert, UserX, UsersRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil, temPermissao, type Permissoes } from "@/hooks/use-perfil";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/equipe")({
  head: () => ({
    meta: [
      { title: "Equipe — ConcilIA" },
      {
        name: "description",
        content: "Gerencie os membros da equipe, convites e permissoes.",
      },
      { property: "og:title", content: "Equipe — ConcilIA" },
      { property: "og:description", content: "Gerenciamento de equipe do escritorio." },
    ],
  }),
  component: EquipePage,
});

const MODULOS: { chave: keyof Permissoes; rotulo: string }[] = [
  { chave: "clientes", rotulo: "Clientes" },
  { chave: "documentos", rotulo: "Documentos" },
  { chave: "competencias", rotulo: "Competencias" },
  { chave: "relatorios", rotulo: "Relatorios" },
  { chave: "configuracoes", rotulo: "Configuracoes" },
];

function rotulopapel(papel: string) {
  switch (papel) {
    case "super_admin":
      return "Super Admin";
    case "admin":
      return "Admin";
    case "operador":
      return "Operador";
    default:
      return papel;
  }
}

function corPapel(papel: string) {
  switch (papel) {
    case "super_admin":
      return { dot: "bg-destructive", bg: "bg-destructive/10", text: "text-destructive" };
    case "admin":
      return { dot: "bg-primary", bg: "bg-primary/10", text: "text-primary" };
    default:
      return { dot: "bg-muted-foreground/50", bg: "bg-secondary", text: "text-secondary-foreground" };
  }
}

function formatarData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const PERMISSOES_PADRAO: Permissoes = {
  clientes: false,
  documentos: false,
  competencias: false,
  relatorios: false,
  configuracoes: false,
};

const PERMISSOES_ADMIN: Permissoes = {
  clientes: true,
  documentos: true,
  competencias: true,
  relatorios: true,
  configuracoes: true,
};

function EquipePage() {
  const { data: perfil } = usePerfil();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [conviteAberto, setConviteAberto] = useState(false);
  const [editandoMembro, setEditandoMembro] = useState<{
    id: string;
    nome: string | null;
    email: string | null;
    papel: string;
    permissoes: Permissoes;
  } | null>(null);
  const [desativandoId, setDesativandoId] = useState<string | null>(null);
  const [conviteForm, setConviteForm] = useState({
    email: "",
    papel: "operador" as "admin" | "operador",
    permissoes: { ...PERMISSOES_PADRAO } as Permissoes,
  });
  const [editForm, setEditForm] = useState({
    papel: "" as string,
    permissoes: { ...PERMISSOES_PADRAO } as Permissoes,
  });

  if (perfil && !temPermissao(perfil, "configuracoes")) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <ShieldAlert className="size-12 text-muted-foreground/30" />
        <h2 className="text-xl font-semibold">Acesso negado</h2>
        <p className="text-sm text-muted-foreground">
          Voce nao tem permissao para acessar o gerenciamento de equipe.
        </p>
      </div>
    );
  }

  const isAdmin =
    perfil?.papel === "admin" || perfil?.papel === "super_admin";

  if (perfil && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <ShieldAlert className="size-12 text-muted-foreground/30" />
        <h2 className="text-xl font-semibold">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground">
          Esta pagina e acessivel apenas para administradores.
        </p>
      </div>
    );
  }

  return perfil ? (
    <EquipeContent
      perfil={perfil}
      queryClient={queryClient}
      busca={busca}
      setBusca={setBusca}
      conviteAberto={conviteAberto}
      setConviteAberto={setConviteAberto}
      editandoMembro={editandoMembro}
      setEditandoMembro={setEditandoMembro}
      desativandoId={desativandoId}
      setDesativandoId={setDesativandoId}
      conviteForm={conviteForm}
      setConviteForm={setConviteForm}
      editForm={editForm}
      setEditForm={setEditForm}
    />
  ) : null;
}

function EquipeContent({
  perfil,
  queryClient,
  busca,
  setBusca,
  conviteAberto,
  setConviteAberto,
  editandoMembro,
  setEditandoMembro,
  desativandoId,
  setDesativandoId,
  conviteForm,
  setConviteForm,
  editForm,
  setEditForm,
}: {
  perfil: NonNullable<ReturnType<typeof usePerfil>["data"]>;
  queryClient: ReturnType<typeof useQueryClient>;
  busca: string;
  setBusca: (v: string) => void;
  conviteAberto: boolean;
  setConviteAberto: (v: boolean) => void;
  editandoMembro: {
    id: string;
    nome: string | null;
    email: string | null;
    papel: string;
    permissoes: Permissoes;
  } | null;
  setEditandoMembro: (v: typeof editandoMembro) => void;
  desativandoId: string | null;
  setDesativandoId: (v: string | null) => void;
  conviteForm: {
    email: string;
    papel: "admin" | "operador";
    permissoes: Permissoes;
  };
  setConviteForm: (v: typeof conviteForm) => void;
  editForm: { papel: string; permissoes: Permissoes };
  setEditForm: (v: typeof editForm) => void;
}) {
  const { data: membros, isLoading } = useQuery({
    queryKey: ["equipe", perfil.org_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email, papel, created_at")
        .eq("org_id", perfil.org_id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((m) => ({
        ...m,
        ativo: true,
        permissoes:
          m.papel === "super_admin" || m.papel === "admin"
            ? { ...PERMISSOES_ADMIN }
            : { ...PERMISSOES_PADRAO },
      }));
    },
  });

  const { data: convites } = useQuery({
    queryKey: ["convites", perfil.org_id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("convites")
          .select("id, email, papel, permissoes, token, expira_em, created_at")
          .eq("org_id", perfil.org_id)
          .is("aceito_em", null)
          .is("deleted_at", null)
          .order("created_at", { ascending: false });
        if (error) return [];
        return data;
      } catch {
        return [];
      }
    },
  });

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (membros ?? []).filter((m) => {
      if (!termo) return true;
      return [m.nome, m.email].filter(Boolean).some((v) => String(v).toLowerCase().includes(termo));
    });
  }, [membros, busca]);

  const enviarConvite = useMutation({
    mutationFn: async () => {
      if (!conviteForm.email.trim()) throw new Error("Informe o e-mail.");
      const permissoes =
        conviteForm.papel === "admin" ? PERMISSOES_ADMIN : conviteForm.permissoes;
      const { data, error } = await supabase
        .from("convites")
        .insert({
          org_id: perfil.org_id,
          email: conviteForm.email.trim().toLowerCase(),
          papel: conviteForm.papel,
          permissoes: permissoes as unknown as Record<string, unknown>,
          criado_por: perfil.id,
        })
        .select("token")
        .single();
      if (error) throw error;
      return data.token;
    },
    onSuccess: (token) => {
      const link = `${window.location.origin}/convite/${token}`;
      toast.success("Convite enviado", { description: link, duration: 10000 });
      setConviteAberto(false);
      setConviteForm({ email: "", papel: "operador", permissoes: { ...PERMISSOES_PADRAO } });
      queryClient.invalidateQueries({ queryKey: ["convites", perfil.org_id] });
    },
    onError: (e: Error) => toast.error("Erro ao enviar convite", { description: e.message }),
  });

  const editarMembro = useMutation({
    mutationFn: async () => {
      if (!editandoMembro) throw new Error("Nenhum membro selecionado.");
      const permissoes =
        editForm.papel === "admin" ? PERMISSOES_ADMIN : editForm.permissoes;
      const { error } = await supabase
        .from("profiles")
        .update({ papel: editForm.papel })
        .eq("id", editandoMembro.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Permissoes atualizadas");
      setEditandoMembro(null);
      queryClient.invalidateQueries({ queryKey: ["equipe", perfil.org_id] });
    },
    onError: (e: Error) => toast.error("Erro ao atualizar", { description: e.message }),
  });

  const desativarMembro = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("profiles").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Usuario desativado");
      setDesativandoId(null);
      queryClient.invalidateQueries({ queryKey: ["equipe", perfil.org_id] });
    },
    onError: (e: Error) => toast.error("Erro ao desativar", { description: e.message }),
  });

  const reativarMembro = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("profiles").update({ deleted_at: null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Usuario reativado");
      queryClient.invalidateQueries({ queryKey: ["equipe", perfil.org_id] });
    },
    onError: (e: Error) => toast.error("Erro ao reativar", { description: e.message }),
  });

  function abrirEdicao(membro: (typeof filtrados)[number]) {
    setEditandoMembro({
      id: membro.id,
      nome: membro.nome,
      email: membro.email,
      papel: membro.papel,
      permissoes: membro.permissoes,
    });
    setEditForm({ papel: membro.papel, permissoes: { ...membro.permissoes } });
  }

  function copiarLink(token: string) {
    const link = `${window.location.origin}/convite/${token}`;
    navigator.clipboard.writeText(link).then(
      () => toast.success("Link copiado"),
      () => toast.error("Nao foi possivel copiar"),
    );
  }

  function iniciais(nome: string | null) {
    if (!nome) return "?";
    return nome
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase())
      .join("");
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Equipe</h1>
          <p className="page-subtitle">
            Gerencie os membros do escritorio, permissoes e convites.
          </p>
        </div>
        <Button onClick={() => setConviteAberto(true)} className="rounded-xl">
          <Plus className="size-4" /> Convidar membro
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-card">
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold">Membros</h2>
            <p className="text-[0.8125rem] text-muted-foreground">
              Usuarios com acesso ao escritorio.
            </p>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="rounded-xl pl-9"
              placeholder="Buscar por nome ou e-mail"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>

        <div className="p-2">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : filtrados.length === 0 ? (
            <div className="py-16 text-center">
              <UsersRound className="mx-auto size-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm text-muted-foreground">Nenhum membro encontrado.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filtrados.map((m) => {
                const cp = corPapel(m.papel);
                return (
                  <div
                    key={m.id}
                    className={`flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-muted/50 ${!m.ativo ? "opacity-50" : ""}`}
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {iniciais(m.nome)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {m.nome ?? "—"}
                      </span>
                      <span className="text-xs text-muted-foreground">{m.email ?? "—"}</span>
                    </div>
                    <span className={`status-dot ${cp.bg} ${cp.text}`}>
                      <span className={`size-1.5 rounded-full ${cp.dot}`} />
                      {rotulopapel(m.papel)}
                    </span>
                    <div className="hidden flex-wrap gap-1 lg:flex">
                      {MODULOS.filter(
                        (mod) =>
                          m.papel === "super_admin" ||
                          m.papel === "admin" ||
                          m.permissoes[mod.chave],
                      ).map((mod) => (
                        <Badge key={mod.chave} variant="outline" className="rounded-md text-[0.625rem]">
                          {mod.rotulo}
                        </Badge>
                      ))}
                    </div>
                    <span className="hidden text-xs text-muted-foreground xl:block">
                      {formatarData(m.created_at)}
                    </span>
                    <span
                      className={`status-dot ${
                        m.ativo
                          ? "bg-success/10 text-success"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          m.ativo ? "bg-success" : "bg-muted-foreground/50"
                        }`}
                      />
                      {m.ativo ? "Ativo" : "Inativo"}
                    </span>
                    {m.id !== perfil.id && (
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-lg"
                          title="Editar permissoes"
                          onClick={() => abrirEdicao(m)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        {m.ativo ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 rounded-lg"
                            title="Desativar usuario"
                            onClick={() => setDesativandoId(m.id)}
                          >
                            <UserX className="size-3.5" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-lg text-xs"
                            onClick={() => reativarMembro.mutate(m.id)}
                          >
                            Reativar
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {(convites ?? []).length > 0 && (
        <div className="rounded-2xl border border-border bg-card shadow-card">
          <div className="border-b border-border/60 px-6 py-4">
            <h2 className="text-base font-semibold">Convites pendentes</h2>
            <p className="text-[0.8125rem] text-muted-foreground">
              Convites enviados que ainda nao foram aceitos.
            </p>
          </div>
          <div className="divide-y divide-border/50 p-2">
            {(convites ?? []).map((c) => {
              const cp = corPapel(c.papel);
              return (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                    ?
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.email}</span>
                    <span className="text-xs text-muted-foreground">
                      Enviado em {formatarData(c.created_at)} · Expira em{" "}
                      {formatarData(c.expira_em)}
                    </span>
                  </div>
                  <span className={`status-dot ${cp.bg} ${cp.text}`}>
                    <span className={`size-1.5 rounded-full ${cp.dot}`} />
                    {rotulopapel(c.papel)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    onClick={() => copiarLink(c.token)}
                  >
                    <Copy className="size-3.5" /> Copiar link
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={conviteAberto} onOpenChange={setConviteAberto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Convidar membro</DialogTitle>
            <DialogDescription>
              Envie um convite para um novo membro da equipe.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input
                className="rounded-xl"
                type="email"
                placeholder="usuario@exemplo.com"
                value={conviteForm.email}
                onChange={(e) => setConviteForm({ ...conviteForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Papel</Label>
              <Select
                value={conviteForm.papel}
                onValueChange={(v) => {
                  const papel = v as "admin" | "operador";
                  setConviteForm({
                    ...conviteForm,
                    papel,
                    permissoes: papel === "admin" ? { ...PERMISSOES_ADMIN } : conviteForm.permissoes,
                  });
                }}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="operador">Operador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label>Permissoes por modulo</Label>
              {MODULOS.map((mod) => (
                <div key={mod.chave} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                  <span className="text-sm">{mod.rotulo}</span>
                  <Switch
                    checked={
                      conviteForm.papel === "admin"
                        ? true
                        : conviteForm.permissoes[mod.chave]
                    }
                    disabled={conviteForm.papel === "admin"}
                    onCheckedChange={(checked) =>
                      setConviteForm({
                        ...conviteForm,
                        permissoes: { ...conviteForm.permissoes, [mod.chave]: checked },
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConviteAberto(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button onClick={() => enviarConvite.mutate()} disabled={enviarConvite.isPending} className="rounded-xl">
              {enviarConvite.isPending ? "Enviando..." : "Enviar convite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editandoMembro} onOpenChange={(open) => !open && setEditandoMembro(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar permissoes</DialogTitle>
            <DialogDescription>
              {editandoMembro?.nome ?? editandoMembro?.email ?? "Membro"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Papel</Label>
              <Select
                value={editForm.papel}
                onValueChange={(v) => {
                  setEditForm({
                    ...editForm,
                    papel: v,
                    permissoes: v === "admin" ? { ...PERMISSOES_ADMIN } : editForm.permissoes,
                  });
                }}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="operador">Operador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label>Permissoes por modulo</Label>
              {MODULOS.map((mod) => (
                <div key={mod.chave} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                  <span className="text-sm">{mod.rotulo}</span>
                  <Switch
                    checked={
                      editForm.papel === "admin"
                        ? true
                        : editForm.permissoes[mod.chave]
                    }
                    disabled={editForm.papel === "admin"}
                    onCheckedChange={(checked) =>
                      setEditForm({
                        ...editForm,
                        permissoes: { ...editForm.permissoes, [mod.chave]: checked },
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditandoMembro(null)} className="rounded-xl">
              Cancelar
            </Button>
            <Button onClick={() => editarMembro.mutate()} disabled={editarMembro.isPending} className="rounded-xl">
              {editarMembro.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!desativandoId} onOpenChange={(open) => !open && setDesativandoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar usuario</AlertDialogTitle>
            <AlertDialogDescription>
              O usuario perdera o acesso ao sistema. Essa acao pode ser revertida posteriormente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => desativandoId && desativarMembro.mutate(desativandoId)}
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
