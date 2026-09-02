import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil } from "@/hooks/use-perfil";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { ORIGENS_DOCUMENTO, rotuloOrigemDocumento } from "@/lib/dominio";
import { apenasDigitos, cnpjValido, formatarCnpj, formatarTelefone } from "@/lib/formatadores";

export const Route = createFileRoute("/_authenticated/empresas/$id/clientes/")({
  head: () => ({
    meta: [
      { title: "Clientes — ConcilIA" },
      {
        name: "description",
        content: "Cadastro e gestao dos clientes atendidos pela ConcilIA.",
      },
    ],
  }),
  component: ClientesPage,
});

function ClientesPage() {
  const { id: empresaId } = Route.useParams();
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
      if (!perfil) throw new Error("Perfil nao carregado.");
      if (!form.razao_social.trim()) throw new Error("Informe a razao social.");
      if (!cnpjValido(form.cnpj)) throw new Error("CNPJ invalido.");
      const { error } = await supabase.from("clientes").insert({
        org_id: perfil.org_id,
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
    onError: (e: Error) => toast.error("Nao foi possivel cadastrar", { description: e.message }),
  });

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-subtitle">Carteira de clientes do escritorio.</p>
        </div>
        <Button onClick={() => setAberto(true)} className="rounded-xl">
          <Plus className="size-4" /> Novo cliente
        </Button>
      </div>

      <div className="card-section">
        <div className="filter-bar">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="rounded-xl pl-9"
              placeholder="Buscar por nome ou CNPJ"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <Select value={filtro} onValueChange={(v) => setFiltro(v as typeof filtro)}>
            <SelectTrigger className="w-44 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativos">Somente ativos</SelectItem>
              <SelectItem value="inativos">Somente inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="card-section-body">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : filtrados.length === 0 ? (
            <div className="empty-state">
              <Building2 className="empty-state-icon" />
              <p className="empty-state-text">
                Nenhum cliente ainda — cadastre o primeiro.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {filtrados.map((c) => (
                <Link
                  key={c.id}
                  to="/empresas/$id/clientes/$clienteId"
                  params={{ id: empresaId, clienteId: c.id }}
                  className="list-row"
                >
                  <div className="list-row-icon bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
                    <Building2 className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {c.nome_fantasia ?? c.nome}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {c.razao_social}
                      {c.cnpj ? ` · ${formatarCnpj(c.cnpj)}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="hidden flex-wrap gap-1 sm:flex">
                      {(c.origem_documentos ?? []).slice(0, 2).map((o) => (
                        <Badge key={o} variant="secondary" className="rounded-lg text-[0.6875rem]">
                          {rotuloOrigemDocumento(o)}
                        </Badge>
                      ))}
                    </div>
                    <span
                      className={`status-dot ${
                        c.ativo
                          ? "bg-success/10 text-success"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          c.ativo ? "bg-success" : "bg-muted-foreground/50"
                        }`}
                      />
                      {c.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo cliente</DialogTitle>
            <DialogDescription>Cadastre uma nova organizacao atendida.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Razao social</Label>
              <Input
                className="rounded-xl"
                value={form.razao_social}
                onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Nome fantasia</Label>
              <Input
                className="rounded-xl"
                value={form.nome_fantasia}
                onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input
                className="rounded-xl"
                value={form.cnpj}
                placeholder="00.000.000/0000-00"
                onChange={(e) => setForm({ ...form, cnpj: formatarCnpj(e.target.value) })}
              />
              {form.cnpj && !cnpjValido(form.cnpj) && (
                <p className="text-xs text-destructive">CNPJ invalido</p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>E-mail de contato</Label>
                <Input
                  className="rounded-xl"
                  type="email"
                  value={form.email_contato}
                  onChange={(e) => setForm({ ...form, email_contato: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  className="rounded-xl"
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
            <Button variant="outline" onClick={() => setAberto(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button onClick={() => criar.mutate()} disabled={criar.isPending} className="rounded-xl">
              {criar.isPending ? "Salvando..." : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
