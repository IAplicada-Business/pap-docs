import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Plus, Settings2, ShieldCheck, Trash2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil } from "@/hooks/use-perfil";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  DataTable,
  EmptyState,
  PageHeader,
  SectionCard,
  StatusPill,
  SubTabs,
  type Column,
} from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/empresas/$id/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — ConcilIA" },
      {
        name: "description",
        content: "Plano de contas dos clientes e perfil do usuário.",
      },
    ],
  }),
  component: ConfiguracoesPage,
});

type Aba = "plano" | "perfil";
type Conta = { id: string; codigo: string; descricao: string; tipo: string | null; ativo: boolean };

function ConfiguracoesPage() {
  const { id: empresaId } = Route.useParams();
  const { data: perfil } = usePerfil();
  const queryClient = useQueryClient();
  const [aba, setAba] = useState<Aba>("plano");
  const [clienteSel, setClienteSel] = useState("");
  const [conta, setConta] = useState({ codigo: "", descricao: "", tipo: "" });

  const { data: clientes } = useQuery({
    queryKey: ["clientes-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome_fantasia, nome")
        .is("deleted_at", null)
        .order("nome_fantasia");
      if (error) throw error;
      return data;
    },
  });

  const { data: contas, isLoading: carregandoContas } = useQuery({
    queryKey: ["plano-contas", clienteSel],
    enabled: !!clienteSel,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plano_contas")
        .select("id, codigo, descricao, tipo, ativo")
        .eq("cliente_id", clienteSel)
        .is("deleted_at", null)
        .order("codigo");
      if (error) throw error;
      return data as Conta[];
    },
  });

  const criarConta = useMutation({
    mutationFn: async () => {
      if (!perfil) throw new Error("Perfil não carregado.");
      if (!clienteSel) throw new Error("Selecione um cliente.");
      if (!conta.codigo.trim() || !conta.descricao.trim())
        throw new Error("Informe código e descrição.");
      const { error } = await supabase.from("plano_contas").insert({
        org_id: perfil.org_id,
        cliente_id: clienteSel,
        codigo: conta.codigo.trim(),
        descricao: conta.descricao.trim(),
        tipo: conta.tipo || null,
        ativo: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conta adicionada");
      setConta({ codigo: "", descricao: "", tipo: "" });
      queryClient.invalidateQueries({ queryKey: ["plano-contas", clienteSel] });
    },
    onError: (e: Error) => toast.error("Não foi possível salvar", { description: e.message }),
  });

  const removerConta = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("plano_contas")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conta removida");
      queryClient.invalidateQueries({ queryKey: ["plano-contas", clienteSel] });
    },
  });

  const colContas: Column<Conta>[] = [
    {
      key: "codigo",
      header: "Código",
      width: "120px",
      sortValue: (c) => c.codigo,
      cell: (c) => <span className="font-mono text-xs font-semibold text-primary">{c.codigo}</span>,
    },
    {
      key: "descricao",
      header: "Descrição",
      sortValue: (c) => c.descricao,
      cell: (c) => c.descricao,
    },
    {
      key: "tipo",
      header: "Tipo",
      hideBelow: "sm",
      cell: (c) => <span className="text-xs text-muted-foreground">{c.tipo ?? "—"}</span>,
    },
    {
      key: "acoes",
      header: "",
      align: "right",
      cell: (c) => (
        <Button
          variant="ghost"
          size="icon"
          className="size-7 rounded-md text-muted-foreground hover:text-destructive"
          onClick={() => removerConta.mutate(c.id)}
        >
          <Trash2 className="size-3.5" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Configurações"
        description="Plano de contas de cada cliente e o seu perfil de acesso."
        actions={
          perfil?.papel === "super_admin" ? (
            <Button asChild size="sm" variant="outline" className="h-8 rounded-lg text-xs">
              <Link to="/empresas/$id/gerenciar" params={{ id: empresaId }}>
                <Settings2 className="size-3.5" /> Marca e módulos (admin)
              </Link>
            </Button>
          ) : undefined
        }
      />

      <SubTabs
        value={aba}
        onChange={setAba}
        items={[
          { value: "plano", label: "Plano de contas", icon: BookOpen },
          { value: "perfil", label: "Meu perfil", icon: User },
        ]}
      />

      {aba === "plano" && (
        <SectionCard
          flush
          title="Plano de contas"
          description="Contas usadas na classificação dos lançamentos de cada cliente. A IA sugere; você confirma na Conciliação. Importação do layout IOB vem em uma próxima etapa."
          icon={BookOpen}
          actions={
            <Select value={clienteSel} onValueChange={setClienteSel}>
              <SelectTrigger className="h-8 w-56 rounded-lg text-xs">
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {(clientes ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome_fantasia ?? c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        >
          {!clienteSel ? (
            <EmptyState
              icon={BookOpen}
              title="Escolha um cliente"
              hint="Cada cliente tem seu próprio plano de contas."
            />
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-2 border-b border-border/30 bg-muted/20 px-4 py-3 backdrop-blur-sm">
                <div className="space-y-1">
                  <Label className="text-[0.6875rem]">Código</Label>
                  <Input
                    className="h-8 w-28 rounded-lg font-mono text-xs"
                    placeholder="1.1.01"
                    value={conta.codigo}
                    onChange={(e) => setConta({ ...conta, codigo: e.target.value })}
                  />
                </div>
                <div className="min-w-48 flex-1 space-y-1">
                  <Label className="text-[0.6875rem]">Descrição</Label>
                  <Input
                    className="h-8 rounded-lg text-xs"
                    placeholder="Caixa geral"
                    value={conta.descricao}
                    onChange={(e) => setConta({ ...conta, descricao: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && criarConta.mutate()}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[0.6875rem]">Tipo</Label>
                  <Input
                    className="h-8 w-32 rounded-lg text-xs"
                    placeholder="ativo, receita…"
                    value={conta.tipo}
                    onChange={(e) => setConta({ ...conta, tipo: e.target.value })}
                  />
                </div>
                <Button
                  size="sm"
                  className="h-8 rounded-lg"
                  onClick={() => criarConta.mutate()}
                  disabled={criarConta.isPending}
                >
                  <Plus className="size-3.5" /> Adicionar
                </Button>
              </div>
              <DataTable
                rows={contas ?? []}
                columns={colContas}
                rowKey={(c) => c.id}
                loading={carregandoContas}
                dense
                defaultSort={{ key: "codigo", dir: "asc" }}
                emptyTitle="Nenhuma conta cadastrada"
                emptyHint="Adicione a primeira conta acima."
              />
            </>
          )}
        </SectionCard>
      )}

      {aba === "perfil" && (
        <SectionCard title="Meu perfil" icon={User} className="lg:max-w-2xl">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome</Label>
              <Input className="h-9 rounded-lg" readOnly value={perfil?.nome ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">E-mail</Label>
              <Input className="h-9 rounded-lg" readOnly value={perfil?.email ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Papel</Label>
              <div className="flex items-center gap-2 pt-1">
                <ShieldCheck className="size-4 text-primary" />
                <StatusPill
                  tone="primary"
                  label={
                    perfil?.papel === "super_admin"
                      ? "Super Admin"
                      : perfil?.papel === "admin"
                        ? "Administrador"
                        : "Operador"
                  }
                />
              </div>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
