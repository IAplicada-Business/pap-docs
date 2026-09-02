import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil } from "@/hooks/use-perfil";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ORIGENS_DOCUMENTO, rotuloOrigemDocumento } from "@/lib/dominio";
import { apenasDigitos, cnpjValido, formatarCnpj, formatarTelefone } from "@/lib/formatadores";

export const Route = createFileRoute("/_authenticated/clientes/")({
  head: () => ({
    meta: [
      { title: "Clientes — ConcilIA" },
      {
        name: "description",
        content: "Cadastro e gestão dos clientes atendidos pela ConcilIA.",
      },
      { property: "og:title", content: "Clientes — ConcilIA" },
      { property: "og:description", content: "Gerencie a carteira de clientes do escritório." },
    ],
  }),
  component: ClientesPage,
});

function ClientesPage() {
  const { data: perfil } = usePerfil();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "ativos" | "inativos">("todos");
  const [aberto, setAberto] = useState(false);

  const [form, setForm] = useState({
    razao_social: "",
    nome_fantasia: "",
    cnpj: "",
    email_contato: "",
    telefone: "",
    origem_documentos: [] as string[],
  });

  const { data: clientes, isLoading } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, razao_social, nome_fantasia, nome, cnpj, email_contato, ativo, origem_documentos")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (clientes ?? []).filter((c) => {
      if (filtro === "ativos" && !c.ativo) return false;
      if (filtro === "inativos" && c.ativo) return false;
      if (!termo) return true;
      return [c.razao_social, c.nome_fantasia, c.nome, c.cnpj]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(termo));
    });
  }, [clientes, busca, filtro]);

  const criar = useMutation({
    mutationFn: async () => {
      if (!perfil) throw new Error("Perfil não carregado.");
      if (!form.razao_social.trim()) throw new Error("Informe a razão social.");
      if (!cnpjValido(form.cnpj)) throw new Error("CNPJ inválido.");
      const { error } = await supabase.from("clientes").insert({
        escritorio_id: perfil.escritorio_id,
        nome: form.nome_fantasia || form.razao_social,
        razao_social: form.razao_social,
        nome_fantasia: form.nome_fantasia || form.razao_social,
        cnpj: apenasDigitos(form.cnpj),
        email_contato: form.email_contato || null,
        telefone: form.telefone || null,
        origem_documentos: form.origem_documentos,
        ativo: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente cadastrado");
      setAberto(false);
      setForm({
        razao_social: "",
        nome_fantasia: "",
        cnpj: "",
        email_contato: "",
        telefone: "",
        origem_documentos: [],
      });
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
    },
    onError: (e: Error) => toast.error("Não foi possível cadastrar", { description: e.message }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">Carteira de clientes do escritório.</p>
        </div>
        <Button onClick={() => setAberto(true)}>
          <Plus className="size-4" /> Novo cliente
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-56 flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por nome ou CNPJ"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <Select value={filtro} onValueChange={(v) => setFiltro(v as typeof filtro)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativos">Somente ativos</SelectItem>
                <SelectItem value="inativos">Somente inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtrados.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhum cliente ainda — cadastre o primeiro.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Origens</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium">{c.nome_fantasia ?? c.nome}</div>
                      <div className="text-xs text-muted-foreground">{c.razao_social}</div>
                    </TableCell>
                    <TableCell>{formatarCnpj(c.cnpj ?? "")}</TableCell>
                    <TableCell className="space-x-1">
                      {(c.origem_documentos ?? []).map((o) => (
                        <Badge key={o} variant="secondary">
                          {rotuloOrigemDocumento(o)}
                        </Badge>
                      ))}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          c.ativo ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                        }
                      >
                        {c.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link to="/clientes/$id" params={{ id: c.id }}>
                          Abrir
                        </Link>
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
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo cliente</DialogTitle>
            <DialogDescription>Cadastre uma nova organização atendida.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Razão social</Label>
              <Input
                value={form.razao_social}
                onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Nome fantasia</Label>
              <Input
                value={form.nome_fantasia}
                onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input
                value={form.cnpj}
                placeholder="00.000.000/0000-00"
                onChange={(e) => setForm({ ...form, cnpj: formatarCnpj(e.target.value) })}
              />
              {form.cnpj && !cnpjValido(form.cnpj) && (
                <p className="text-xs text-destructive">CNPJ inválido</p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>E-mail de contato</Label>
                <Input
                  type="email"
                  value={form.email_contato}
                  onChange={(e) => setForm({ ...form, email_contato: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: formatarTelefone(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Origens de documentos</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {ORIGENS_DOCUMENTO.map((o) => (
                  <label key={o.value} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.origem_documentos.includes(o.value)}
                      onCheckedChange={(marcado) =>
                        setForm({
                          ...form,
                          origem_documentos: marcado
                            ? [...form.origem_documentos, o.value]
                            : form.origem_documentos.filter((v) => v !== o.value),
                        })
                      }
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={() => criar.mutate()} disabled={criar.isPending}>
              {criar.isPending ? "Salvando..." : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
