import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarRange, Lock, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil } from "@/hooks/use-perfil";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import { STATUS_COMPETENCIA } from "@/lib/dominio";
import { formatarCompetencia, formatarDataHora, mesAtual } from "@/lib/formatadores";

export const Route = createFileRoute("/_authenticated/competencias")({
  head: () => ({
    meta: [
      { title: "Competencias — ConcilIA" },
      {
        name: "description",
        content: "Controle dos periodos contabeis por cliente: abertura, conciliacao e fechamento.",
      },
      { property: "og:title", content: "Competencias — ConcilIA" },
      { property: "og:description", content: "Periodos contabeis por cliente e mes." },
    ],
  }),
  component: CompetenciasPage,
});

function statusConfig(status: string) {
  if (status === "fechada")
    return { dot: "bg-muted-foreground/50", bg: "bg-muted", text: "text-muted-foreground" };
  if (status === "em_conciliacao")
    return { dot: "bg-warning animate-pulse", bg: "bg-warning/10", text: "text-warning-foreground" };
  return { dot: "bg-success", bg: "bg-success/10", text: "text-success" };
}

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
      if (!perfil) throw new Error("Perfil nao carregado.");
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
            ? "Ja existe uma competencia deste cliente para o mes escolhido."
            : error.message,
        );
      }
    },
    onSuccess: () => {
      toast.success("Competencia criada");
      setAberto(false);
      queryClient.invalidateQueries({ queryKey: ["competencias"] });
    },
    onError: (e: Error) => toast.error("Nao foi possivel criar", { description: e.message }),
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
      toast.success("Competencia fechada", { description: "Agora ela e somente leitura." });
      setFechar(null);
      queryClient.invalidateQueries({ queryKey: ["competencias"] });
    },
    onError: (e: Error) => toast.error("Nao foi possivel fechar", { description: e.message }),
  });

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Competencias</h1>
          <p className="page-subtitle">
            Periodos contabeis por cliente e mes de referencia.
          </p>
        </div>
        <Button onClick={() => setAberto(true)} className="rounded-xl">
          <Plus className="size-4" /> Nova competencia
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-card">
        <div className="border-b border-border/60 p-4">
          <Select value={fCliente} onValueChange={setFCliente}>
            <SelectTrigger className="w-full rounded-xl sm:w-72">
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
        </div>

        <div className="p-2">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : filtradas.length === 0 ? (
            <div className="py-16 text-center">
              <CalendarRange className="mx-auto size-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm text-muted-foreground">
                Nenhuma competencia ainda — crie a competencia do mes para comecar.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filtradas.map((c) => {
                const sc = statusConfig(c.status);
                return (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                      <CalendarRange className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold capitalize">
                        {formatarCompetencia(c.mes_ano)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {c.clientes?.nome_fantasia ?? c.clientes?.nome ?? "—"}
                        {c.fechada_em ? ` · Fechada em ${formatarDataHora(c.fechada_em)}` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`status-dot ${sc.bg} ${sc.text}`}>
                        <span className={`size-1.5 rounded-full ${sc.dot}`} />
                        {STATUS_COMPETENCIA[c.status] ?? c.status}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg"
                        disabled={c.status === "fechada"}
                        onClick={() =>
                          setFechar({
                            id: c.id,
                            rotulo: `${c.clientes?.nome_fantasia ?? ""} · ${formatarCompetencia(c.mes_ano)}`,
                          })
                        }
                      >
                        <Lock className="size-3.5" /> Fechar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova competencia</DialogTitle>
            <DialogDescription>Escolha o cliente e o mes de referencia.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={nova.cliente} onValueChange={(v) => setNova({ ...nova, cliente: v })}>
                <SelectTrigger className="rounded-xl">
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
              <Label>Mes</Label>
              <Input
                type="month"
                className="rounded-xl"
                value={nova.mes}
                onChange={(e) => setNova({ ...nova, mes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button onClick={() => criar.mutate()} disabled={criar.isPending} className="rounded-xl">
              {criar.isPending ? "Criando..." : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!fechar} onOpenChange={(v) => !v && setFechar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fechar competencia?</AlertDialogTitle>
            <AlertDialogDescription>
              {fechar?.rotulo} ficara somente leitura apos o fechamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => fechar && fecharCompetencia.mutate(fechar.id)}>
              Fechar competencia
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
