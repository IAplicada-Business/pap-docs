import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil } from "@/hooks/use-perfil";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { STATUS_COMPETENCIA } from "@/lib/dominio";
import { formatarCompetencia, formatarDataHora, mesAtual } from "@/lib/formatadores";

export const Route = createFileRoute("/_authenticated/competencias")({
  head: () => ({
    meta: [
      { title: "Competências — P&A Consultoria" },
      {
        name: "description",
        content: "Controle dos períodos contábeis por cliente: abertura, conciliação e fechamento.",
      },
      { property: "og:title", content: "Competências — P&A Consultoria" },
      { property: "og:description", content: "Períodos contábeis por cliente e mês." },
    ],
  }),
  component: CompetenciasPage,
});

function CompetenciasPage() {
  const { data: perfil } = usePerfil();
  const queryClient = useQueryClient();
  const [fCliente, setFCliente] = useState("todos");
  const [aberto, setAberto] = useState(false);
  const [nova, setNova] = useState({ cliente: "", mes: mesAtual() });
  const [fechar, setFechar] = useState<{ id: string; rotulo: string } | null>(null);

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

  const { data: competencias, isLoading } = useQuery({
    queryKey: ["competencias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competencias")
        .select("id, mes_ano, status, fechada_em, cliente_id, clientes(nome_fantasia, nome)")
        .is("deleted_at", null)
        .order("mes_ano", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtradas = useMemo(
    () =>
      (competencias ?? []).filter((c) => fCliente === "todos" || c.cliente_id === fCliente),
    [competencias, fCliente],
  );

  const criar = useMutation({
    mutationFn: async () => {
      if (!perfil) throw new Error("Perfil não carregado.");
      if (!nova.cliente) throw new Error("Selecione o cliente.");
      const { error } = await supabase.from("competencias").insert({
        org_id: perfil.org_id,
        cliente_id: nova.cliente,
        mes_ano: `${nova.mes}-01`,
        status: "aberta",
      });
      if (error) {
        throw new Error(
          error.code === "23505"
            ? "Já existe uma competência deste cliente para o mês escolhido."
            : error.message,
        );
      }
    },
    onSuccess: () => {
      toast.success("Competência criada");
      setAberto(false);
      queryClient.invalidateQueries({ queryKey: ["competencias"] });
    },
    onError: (e: Error) => toast.error("Não foi possível criar", { description: e.message }),
  });

  const fecharCompetencia = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("competencias")
        .update({
          status: "fechada",
          fechada_em: new Date().toISOString(),
          fechada_por: perfil?.id ?? null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Competência fechada", { description: "Agora ela é somente leitura." });
      setFechar(null);
      queryClient.invalidateQueries({ queryKey: ["competencias"] });
    },
    onError: (e: Error) => toast.error("Não foi possível fechar", { description: e.message }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Competências</h1>
          <p className="text-sm text-muted-foreground">
            Períodos contábeis por cliente e mês de referência.
          </p>
        </div>
        <Button onClick={() => setAberto(true)}>
          <Plus className="size-4" /> Nova competência
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <Select value={fCliente} onValueChange={setFCliente}>
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os clientes</SelectItem>
              {(clientes ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome_fantasia ?? c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtradas.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Nenhuma competência ainda — crie a competência do mês para começar.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Competência</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fechada em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.clientes?.nome_fantasia ?? c.clientes?.nome ?? "—"}</TableCell>
                    <TableCell className="font-medium capitalize">
                      {formatarCompetencia(c.mes_ano)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          c.status === "fechada"
                            ? "bg-muted text-muted-foreground"
                            : c.status === "em_conciliacao"
                              ? "bg-warning/20 text-warning-foreground"
                              : "bg-success/15 text-success"
                        }
                      >
                        {STATUS_COMPETENCIA[c.status] ?? c.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatarDataHora(c.fechada_em)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={c.status === "fechada"}
                        onClick={() =>
                          setFechar({
                            id: c.id,
                            rotulo: `${c.clientes?.nome_fantasia ?? ""} · ${formatarCompetencia(c.mes_ano)}`,
                          })
                        }
                      >
                        <Lock className="size-4" /> Fechar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova competência</DialogTitle>
            <DialogDescription>Escolha o cliente e o mês de referência.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={nova.cliente} onValueChange={(v) => setNova({ ...nova, cliente: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(clientes ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome_fantasia ?? c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mês</Label>
              <Input
                type="month"
                value={nova.mes}
                onChange={(e) => setNova({ ...nova, mes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={() => criar.mutate()} disabled={criar.isPending}>
              {criar.isPending ? "Criando..." : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!fechar} onOpenChange={(v) => !v && setFechar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fechar competência?</AlertDialogTitle>
            <AlertDialogDescription>
              {fechar?.rotulo} ficará somente leitura após o fechamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => fechar && fecharCompetencia.mutate(fechar.id)}>
              Fechar competência
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
