import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Building2, Palette, Plus, Settings, Trash2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil, useEscritorio, temPermissao } from "@/hooks/use-perfil";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configuracoes — ConcilIA" },
      {
        name: "description",
        content: "Dados do escritorio, perfil do usuario e plano de contas por cliente.",
      },
      { property: "og:title", content: "Configuracoes — ConcilIA" },
      { property: "og:description", content: "Ajustes do escritorio e plano de contas." },
    ],
  }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const { data: perfil } = usePerfil();
  const queryClient = useQueryClient();
  const [clienteSel, setClienteSel] = useState("");
  const [conta, setConta] = useState({ codigo: "", descricao: "", tipo: "" });

  const { data: escritorio } = useEscritorio();
  const podeEditar = temPermissao(perfil, "configuracoes");

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

  const { data: contas } = useQuery({
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
      return data;
    },
  });

  const criarConta = useMutation({
    mutationFn: async () => {
      if (!perfil) throw new Error("Perfil nao carregado.");
      if (!clienteSel) throw new Error("Selecione um cliente.");
      if (!conta.codigo.trim() || !conta.descricao.trim())
        throw new Error("Informe codigo e descricao.");
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
    onError: (e: Error) => toast.error("Nao foi possivel salvar", { description: e.message }),
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
    onError: (e: Error) => toast.error("Nao foi possivel remover", { description: e.message }),
  });

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Configuracoes</h1>
          <p className="page-subtitle">Escritorio, perfil e plano de contas.</p>
        </div>
      </div>

      <Tabs defaultValue="escritorio">
        <TabsList className="rounded-xl">
          <TabsTrigger value="escritorio" className="rounded-lg">
            <Building2 className="mr-1.5 size-3.5" /> Escritorio
          </TabsTrigger>
          <TabsTrigger value="perfil" className="rounded-lg">
            <User className="mr-1.5 size-3.5" /> Meu perfil
          </TabsTrigger>
          <TabsTrigger value="plano" className="rounded-lg">
            <BookOpen className="mr-1.5 size-3.5" /> Plano de contas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="escritorio">
          <div className="card-section">
            <div className="card-section-header">
              <div className="flex items-center gap-3">
                <div className="list-row-icon bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                  <Settings className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Dados do escritorio</h2>
                  <p className="text-xs text-muted-foreground">
                    {podeEditar
                      ? "Identidade visual e dados cadastrais."
                      : "Somente administradores podem editar."}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    className="rounded-xl"
                    readOnly={!podeEditar}
                    defaultValue={escritorio?.nome ?? ""}
                    onBlur={(e) => {
                      if (!podeEditar || !escritorio) return;
                      supabase
                        .from("organizations")
                        .update({ nome: e.target.value })
                        .eq("id", escritorio.id)
                        .then(({ error }) => {
                          if (error) toast.error("Nao foi possivel salvar", { description: error.message });
                          else {
                            toast.success("Nome atualizado");
                            queryClient.invalidateQueries({ queryKey: ["escritorio"] });
                          }
                        });
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Palette className="size-3.5" /> Cor primaria
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      className="flex-1 rounded-xl"
                      readOnly={!podeEditar}
                      defaultValue={escritorio?.cor_primaria ?? ""}
                      onBlur={(e) => {
                        if (!podeEditar || !escritorio) return;
                        supabase
                          .from("organizations")
                          .update({ cor_primaria: e.target.value })
                          .eq("id", escritorio.id)
                          .then(({ error }) => {
                            if (error) toast.error("Nao foi possivel salvar", { description: error.message });
                            else {
                              toast.success("Cor atualizada");
                              queryClient.invalidateQueries({ queryKey: ["escritorio"] });
                            }
                          });
                      }}
                    />
                    {escritorio?.cor_primaria && (
                      <span
                        className="size-8 shrink-0 rounded-lg border border-border"
                        style={{ backgroundColor: escritorio.cor_primaria }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="perfil">
          <div className="card-section">
            <div className="card-section-header">
              <div className="flex items-center gap-3">
                <div className="list-row-icon bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                  <User className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Meu perfil</h2>
                  <p className="text-xs text-muted-foreground">Dados da sua conta no sistema.</p>
                </div>
              </div>
            </div>
            <div className="p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input className="rounded-xl" readOnly value={perfil?.nome ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input className="rounded-xl" readOnly value={perfil?.email ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label>Papel</Label>
                  <div>
                    <span className="status-dot bg-primary/10 text-primary">
                      <span className="size-1.5 rounded-full bg-primary" />
                      {perfil?.papel ?? "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="plano">
          <div className="card-section">
            <div className="card-section-header">
              <div className="flex items-center gap-3">
                <div className="list-row-icon bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                  <BookOpen className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Plano de contas</h2>
                  <p className="text-xs text-muted-foreground">
                    Cadastro simples por cliente. A importacao do layout IOB vira em uma proxima etapa.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <Select value={clienteSel} onValueChange={setClienteSel}>
                <SelectTrigger className="w-full rounded-xl sm:w-72">
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

              {clienteSel && (
                <>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <Input
                      className="rounded-xl"
                      placeholder="Codigo"
                      value={conta.codigo}
                      onChange={(e) => setConta({ ...conta, codigo: e.target.value })}
                    />
                    <Input
                      className="sm:col-span-2 rounded-xl"
                      placeholder="Descricao"
                      value={conta.descricao}
                      onChange={(e) => setConta({ ...conta, descricao: e.target.value })}
                    />
                    <div className="flex gap-2">
                      <Input
                        className="rounded-xl"
                        placeholder="Tipo"
                        value={conta.tipo}
                        onChange={(e) => setConta({ ...conta, tipo: e.target.value })}
                      />
                      <Button
                        onClick={() => criarConta.mutate()}
                        disabled={criarConta.isPending}
                        className="rounded-xl"
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  </div>

                  {!contas || contas.length === 0 ? (
                    <div className="empty-state">
                      <BookOpen className="empty-state-icon" />
                      <p className="empty-state-text">
                        Nenhuma conta cadastrada — adicione a primeira acima.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/40">
                      {contas.map((c) => (
                        <div key={c.id} className="list-row">
                          <span className="min-w-16 font-mono text-xs font-semibold text-primary">
                            {c.codigo}
                          </span>
                          <span className="min-w-0 flex-1 text-sm">{c.descricao}</span>
                          <span className="text-xs text-muted-foreground">{c.tipo ?? "—"}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 rounded-lg"
                            onClick={() => removerConta.mutate(c.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
