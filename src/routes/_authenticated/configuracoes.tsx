import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil } from "@/hooks/use-perfil";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — P&A Consultoria" },
      {
        name: "description",
        content: "Dados do escritório, perfil do usuário e plano de contas por cliente.",
      },
      { property: "og:title", content: "Configurações — P&A Consultoria" },
      { property: "og:description", content: "Ajustes do escritório e plano de contas." },
    ],
  }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const { data: perfil } = usePerfil();
  const queryClient = useQueryClient();
  const [clienteSel, setClienteSel] = useState("");
  const [conta, setConta] = useState({ codigo: "", descricao: "", tipo: "" });

  const { data: organizacao } = useQuery({
    queryKey: ["organizacao"],
    queryFn: async () => {
      const { data, error } = await supabase.from("organizations").select("*").limit(1).single();
      if (error) throw error;
      return data;
    },
  });

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
    onError: (e: Error) => toast.error("Não foi possível remover", { description: e.message }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">Escritório, perfil e plano de contas.</p>
      </div>

      <Tabs defaultValue="escritorio">
        <TabsList>
          <TabsTrigger value="escritorio">Escritório</TabsTrigger>
          <TabsTrigger value="perfil">Meu perfil</TabsTrigger>
          <TabsTrigger value="plano">Plano de contas</TabsTrigger>
        </TabsList>

        <TabsContent value="escritorio">
          <Card>
            <CardHeader>
              <CardTitle>Dados do escritório</CardTitle>
              <CardDescription>Identidade visual e nome do tenant.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input readOnly value={organizacao?.nome ?? ""} />
              </div>
              <div className="space-y-2">
                <Label>Cor primária</Label>
                <Input readOnly value={organizacao?.cor_primaria ?? ""} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="perfil">
          <Card>
            <CardHeader>
              <CardTitle>Meu perfil</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input readOnly value={perfil?.nome ?? ""} />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input readOnly value={perfil?.email ?? ""} />
              </div>
              <div className="space-y-2">
                <Label>Papel</Label>
                <div>
                  <Badge variant="secondary" className="capitalize">
                    {perfil?.papel ?? "—"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plano">
          <Card>
            <CardHeader>
              <CardTitle>Plano de contas</CardTitle>
              <CardDescription>
                Cadastro simples por cliente. A importação do layout IOB virá em uma próxima etapa.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={clienteSel} onValueChange={setClienteSel}>
                <SelectTrigger className="w-full sm:w-72">
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
                      placeholder="Código"
                      value={conta.codigo}
                      onChange={(e) => setConta({ ...conta, codigo: e.target.value })}
                    />
                    <Input
                      className="sm:col-span-2"
                      placeholder="Descrição"
                      value={conta.descricao}
                      onChange={(e) => setConta({ ...conta, descricao: e.target.value })}
                    />
                    <div className="flex gap-2">
                      <Input
                        placeholder="Tipo"
                        value={conta.tipo}
                        onChange={(e) => setConta({ ...conta, tipo: e.target.value })}
                      />
                      <Button onClick={() => criarConta.mutate()} disabled={criarConta.isPending}>
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  </div>

                  {!contas || contas.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Nenhuma conta cadastrada — adicione a primeira acima.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contas.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell className="font-mono text-xs">{c.codigo}</TableCell>
                            <TableCell>{c.descricao}</TableCell>
                            <TableCell>{c.tipo ?? "—"}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removerConta.mutate(c.id)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
