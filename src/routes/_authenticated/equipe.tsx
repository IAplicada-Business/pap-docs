import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Pencil, Plus, Search, ShieldAlert, UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil, temPermissao, type Permissoes } from "@/hooks/use-perfil";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/equipe")({
  head: () => ({
    meta: [
      { title: "Equipe — ConcilIA" },
      {
        name: "description",
        content: "Gerencie os membros da equipe, convites e permissões.",
      },
      { property: "og:title", content: "Equipe — ConcilIA" },
      { property: "og:description", content: "Gerenciamento de equipe do escritório." },
    ],
  }),
  component: EquipePage,
});

const MODULOS: { chave: keyof Permissoes; rotulo: string }[] = [
  { chave: "clientes", rotulo: "Clientes" },
  { chave: "documentos", rotulo: "Documentos" },
  { chave: "competencias", rotulo: "Competências" },
  { chave: "relatorios", rotulo: "Relatórios" },
  { chave: "configuracoes", rotulo: "Configurações" },
];

function rotulopapel(papel: string) {
  switch (papel) {
    case "super_admin":
      return "Super Admin";
    case "admin_escritorio":
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
      return "bg-destructive/15 text-destructive";
    case "admin_escritorio":
      return "bg-primary/15 text-primary";
    default:
      return "";
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

  // Dialogs
  const [conviteAberto, setConviteAberto] = useState(false);
  const [editandoMembro, setEditandoMembro] = useState<{
    id: string;
    nome: string | null;
    email: string | null;
    papel: string;
    permissoes: Permissoes;
  } | null>(null);
  const [desativandoId, setDesativandoId] = useState<string | null>(null);

  // Invite form
  const [conviteForm, setConviteForm] = useState({
    email: "",
    papel: "operador" as "admin_escritorio" | "operador",
    permissoes: { ...PERMISSOES_PADRAO } as Permissoes,
  });

  // Edit form
  const [editForm, setEditForm] = useState({
    papel: "" as string,
    permissoes: { ...PERMISSOES_PADRAO } as Permissoes,
  });

  // Access check
  if (perfil && !temPermissao(perfil, "configuracoes")) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <ShieldAlert className="size-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Acesso negado</h2>
        <p className="text-sm text-muted-foreground">
          Você não tem permissão para acessar o gerenciamento de equipe.
        </p>
      </div>
    );
  }

  // Restrict page to admin_escritorio or super_admin
  const isAdmin =
    perfil?.papel === "admin_escritorio" || perfil?.papel === "super_admin";

  if (perfil && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <ShieldAlert className="size-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground">
          Esta página é acessível apenas para administradores.
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

// Extracted into its own component to allow hooks to be called unconditionally
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
    papel: "admin_escritorio" | "operador";
    permissoes: Permissoes;
  };
  setConviteForm: (v: typeof conviteForm) => void;
  editForm: { papel: string; permissoes: Permissoes };
  setEditForm: (v: typeof editForm) => void;
}) {
  // Query team members
  const { data: membros, isLoading } = useQuery({
    queryKey: ["equipe", perfil.escritorio_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email, papel, permissoes, ativo, ultimo_acesso_em, created_at")
        .eq("escritorio_id", perfil.escritorio_id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((m) => ({
        ...m,
        permissoes: { ...PERMISSOES_PADRAO, ...(m.permissoes as Partial<Permissoes>) },
      }));
    },
  });

  // Query pending invites
  const { data: convites } = useQuery({
    queryKey: ["convites", perfil.escritorio_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("convites")
        .select("id, email, papel, permissoes, token, expira_em, created_at")
        .eq("escritorio_id", perfil.escritorio_id)
        .is("aceito_em", null)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (membros ?? []).filter((m) => {
      if (!termo) return true;
      return [m.nome, m.email].filter(Boolean).some((v) => String(v).toLowerCase().includes(termo));
    });
  }, [membros, busca]);

  // Invite mutation
  const enviarConvite = useMutation({
    mutationFn: async () => {
      if (!conviteForm.email.trim()) throw new Error("Informe o e-mail.");
      const permissoes =
        conviteForm.papel === "admin_escritorio" ? PERMISSOES_ADMIN : conviteForm.permissoes;
      const { data, error } = await supabase
        .from("convites")
        .insert({
          escritorio_id: perfil.escritorio_id,
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
      toast.success("Convite enviado", {
        description: link,
        duration: 10000,
      });
      setConviteAberto(false);
      setConviteForm({
        email: "",
        papel: "operador",
        permissoes: { ...PERMISSOES_PADRAO },
      });
      queryClient.invalidateQueries({ queryKey: ["convites", perfil.escritorio_id] });
    },
    onError: (e: Error) => toast.error("Erro ao enviar convite", { description: e.message }),
  });

  // Edit mutation
  const editarMembro = useMutation({
    mutationFn: async () => {
      if (!editandoMembro) throw new Error("Nenhum membro selecionado.");
      const permissoes =
        editForm.papel === "admin_escritorio" ? PERMISSOES_ADMIN : editForm.permissoes;
      const { error } = await supabase
        .from("profiles")
        .update({
          papel: editForm.papel,
          permissoes: permissoes as unknown as Record<string, unknown>,
        })
        .eq("id", editandoMembro.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Permissões atualizadas");
      setEditandoMembro(null);
      queryClient.invalidateQueries({ queryKey: ["equipe", perfil.escritorio_id] });
    },
    onError: (e: Error) => toast.error("Erro ao atualizar", { description: e.message }),
  });

  // Deactivate mutation
  const desativarMembro = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("profiles").update({ ativo: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Usuário desativado");
      setDesativandoId(null);
      queryClient.invalidateQueries({ queryKey: ["equipe", perfil.escritorio_id] });
    },
    onError: (e: Error) => toast.error("Erro ao desativar", { description: e.message }),
  });

  // Reactivate mutation
  const reativarMembro = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("profiles").update({ ativo: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Usuário reativado");
      queryClient.invalidateQueries({ queryKey: ["equipe", perfil.escritorio_id] });
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
    setEditForm({
      papel: membro.papel,
      permissoes: { ...membro.permissoes },
    });
  }

  function copiarLink(token: string) {
    const link = `${window.location.origin}/convite/${token}`;
    navigator.clipboard.writeText(link).then(
      () => toast.success("Link copiado"),
      () => toast.error("Não foi possível copiar"),
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Equipe</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie os membros do escritório, permissões e convites.
          </p>
        </div>
        <Button onClick={() => setConviteAberto(true)}>
          <Plus className="size-4" /> Convidar membro
        </Button>
      </div>

      {/* Team members */}
      <Card>
        <CardHeader>
          <CardTitle>Membros</CardTitle>
          <CardDescription>Usuários com acesso ao escritório.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome ou e-mail"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtrados.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhum membro encontrado.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Permissões</TableHead>
                  <TableHead>Último acesso</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((m) => (
                  <TableRow key={m.id} className={!m.ativo ? "opacity-50" : undefined}>
                    <TableCell className="font-medium">{m.nome ?? "—"}</TableCell>
                    <TableCell className="text-sm">{m.email ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={corPapel(m.papel)}>
                        {rotulopapel(m.papel)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {MODULOS.filter(
                          (mod) =>
                            m.papel === "super_admin" ||
                            m.papel === "admin_escritorio" ||
                            m.permissoes[mod.chave],
                        ).map((mod) => (
                          <Badge key={mod.chave} variant="outline" className="text-xs">
                            {mod.rotulo}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatarData(m.ultimo_acesso_em)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          m.ativo
                            ? "bg-success/15 text-success"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {m.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {m.id !== perfil.id && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Editar permissões"
                              onClick={() => abrirEdicao(m)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            {m.ativo ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Desativar usuário"
                                onClick={() => setDesativandoId(m.id)}
                              >
                                <UserX className="size-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Reativar usuário"
                                onClick={() => reativarMembro.mutate(m.id)}
                              >
                                Reativar
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pending invites */}
      {(convites ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Convites pendentes</CardTitle>
            <CardDescription>Convites enviados que ainda não foram aceitos.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Expira em</TableHead>
                  <TableHead>Enviado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(convites ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={corPapel(c.papel)}>
                        {rotulopapel(c.papel)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{formatarData(c.expira_em)}</TableCell>
                    <TableCell className="text-sm">{formatarData(c.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copiarLink(c.token)}
                      >
                        <Copy className="size-4" /> Copiar link
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Invite dialog */}
      <Dialog open={conviteAberto} onOpenChange={setConviteAberto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
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
                  const papel = v as "admin_escritorio" | "operador";
                  setConviteForm({
                    ...conviteForm,
                    papel,
                    permissoes: papel === "admin_escritorio" ? { ...PERMISSOES_ADMIN } : conviteForm.permissoes,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin_escritorio">Admin</SelectItem>
                  <SelectItem value="operador">Operador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label>Permissões por módulo</Label>
              {MODULOS.map((mod) => (
                <div key={mod.chave} className="flex items-center justify-between">
                  <span className="text-sm">{mod.rotulo}</span>
                  <Switch
                    checked={
                      conviteForm.papel === "admin_escritorio"
                        ? true
                        : conviteForm.permissoes[mod.chave]
                    }
                    disabled={conviteForm.papel === "admin_escritorio"}
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
            <Button variant="outline" onClick={() => setConviteAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={() => enviarConvite.mutate()} disabled={enviarConvite.isPending}>
              {enviarConvite.isPending ? "Enviando..." : "Enviar convite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit permissions dialog */}
      <Dialog open={!!editandoMembro} onOpenChange={(open) => !open && setEditandoMembro(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar permissões</DialogTitle>
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
                    permissoes: v === "admin_escritorio" ? { ...PERMISSOES_ADMIN } : editForm.permissoes,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin_escritorio">Admin</SelectItem>
                  <SelectItem value="operador">Operador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label>Permissões por módulo</Label>
              {MODULOS.map((mod) => (
                <div key={mod.chave} className="flex items-center justify-between">
                  <span className="text-sm">{mod.rotulo}</span>
                  <Switch
                    checked={
                      editForm.papel === "admin_escritorio"
                        ? true
                        : editForm.permissoes[mod.chave]
                    }
                    disabled={editForm.papel === "admin_escritorio"}
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
            <Button variant="outline" onClick={() => setEditandoMembro(null)}>
              Cancelar
            </Button>
            <Button onClick={() => editarMembro.mutate()} disabled={editarMembro.isPending}>
              {editarMembro.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivation confirmation */}
      <AlertDialog open={!!desativandoId} onOpenChange={(open) => !open && setDesativandoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar usuário</AlertDialogTitle>
            <AlertDialogDescription>
              O usuário perderá o acesso ao sistema. Essa ação pode ser revertida posteriormente.
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
