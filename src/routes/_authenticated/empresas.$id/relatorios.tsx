import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileBarChart2,
  Globe,
  Mail,
  Minus,
  Package,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePerfil } from "@/hooks/use-perfil";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  Bars,
  CHART_COLORS,
  DataTable,
  KpiCard,
  KpiGrid,
  PageHeader,
  SectionCard,
  Segmented,
  pillCompetencia,
  type Column,
} from "@/components/ui-kit";
import { TIPOS_RELATORIO } from "@/lib/dominio";
import { formatarCompetencia, formatarDataHora, mesAnterior } from "@/lib/formatadores";
import { baixarDocumento } from "@/lib/documentos";

export const Route = createFileRoute("/_authenticated/empresas/$id/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — ConcilIA" },
      {
        name: "description",
        content:
          "Pacote mensal por cliente: Balancete, DRE, Balanço e DFC — geração, publicação no painel e envio.",
      },
    ],
  }),
  component: RelatoriosPage,
});

const TIPOS = Object.keys(TIPOS_RELATORIO);

type Rel = {
  id: string;
  tipo: string;
  arquivo_path: string | null;
  publicado_painel: boolean;
  enviado_em: string | null;
  competencia_id: string;
};

type Comp = {
  id: string;
  mes_ano: string;
  status: string;
  cliente_id: string;
  clientes: {
    nome_fantasia: string | null;
    nome: string | null;
    email_contato: string | null;
  } | null;
};

type Linha = Comp & {
  rels: Rel[];
  completo: boolean;
  gerados: number;
  publicados: number;
  enviados: number;
};

function RelatoriosPage() {
  const { id: empresaId } = Route.useParams();
  const { data: perfil } = usePerfil();
  const queryClient = useQueryClient();
  const [mes, setMes] = useState(mesAnterior());
  const [escopo, setEscopo] = useState<"mes" | "todos">("mes");
  const [fCliente, setFCliente] = useState("todos");

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

  const { data, isLoading } = useQuery({
    queryKey: ["relatorios-visao"],
    queryFn: async () => {
      const [comps, rels] = await Promise.all([
        supabase
          .from("competencias")
          .select("id, mes_ano, status, cliente_id, clientes(nome_fantasia, nome, email_contato)")
          .is("deleted_at", null)
          .order("mes_ano", { ascending: false }),
        supabase
          .from("relatorios")
          .select("id, tipo, arquivo_path, publicado_painel, enviado_em, competencia_id")
          .is("deleted_at", null),
      ]);
      return { comps: (comps.data ?? []) as Comp[], rels: (rels.data ?? []) as Rel[] };
    },
  });

  const linhas = useMemo<Linha[]>(() => {
    const porComp = new Map<string, Rel[]>();
    (data?.rels ?? []).forEach((r) =>
      porComp.set(r.competencia_id, [...(porComp.get(r.competencia_id) ?? []), r]),
    );
    return (data?.comps ?? [])
      .filter((c) => (escopo === "mes" ? c.mes_ano.startsWith(mes) : true))
      .filter((c) => fCliente === "todos" || c.cliente_id === fCliente)
      .map((c) => {
        const rels = porComp.get(c.id) ?? [];
        const gerados = rels.filter((r) => r.arquivo_path).length;
        return {
          ...c,
          rels,
          gerados,
          completo: TIPOS.every((t) => rels.some((r) => r.tipo === t && r.arquivo_path)),
          publicados: rels.filter((r) => r.publicado_painel).length,
          enviados: rels.filter((r) => r.enviado_em).length,
        };
      });
  }, [data, escopo, mes, fCliente]);

  const k = useMemo(() => {
    const fechadas = linhas.filter((l) => l.status === "fechada").length;
    const completos = linhas.filter((l) => l.completo).length;
    const publicados = linhas.filter((l) => l.publicados === TIPOS.length).length;
    const enviados = linhas.filter((l) => l.enviados > 0).length;
    const porTipo = TIPOS.map((t) => ({
      tipo: TIPOS_RELATORIO[t] ?? t,
      gerados: linhas.filter((l) => l.rels.some((r) => r.tipo === t && r.arquivo_path)).length,
    }));
    return { fechadas, completos, publicados, enviados, porTipo };
  }, [linhas]);

  const gerarPacote = useMutation({
    mutationFn: async (linha: Linha) => {
      if (!perfil) throw new Error("Perfil não carregado.");
      const faltam = TIPOS.filter((t) => !linha.rels.some((r) => r.tipo === t));
      if (faltam.length === 0) return 0;
      const { error } = await supabase
        .from("relatorios")
        .insert(faltam.map((tipo) => ({ org_id: perfil.org_id, competencia_id: linha.id, tipo })));
      if (error) throw error;
      return faltam.length;
    },
    onSuccess: (n) => {
      toast.success(n ? "Pacote solicitado" : "Pacote já solicitado", {
        description: n ? "Os PDFs ficam disponíveis aqui assim que forem gerados." : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["relatorios-visao"] });
    },
    onError: (e: Error) => toast.error("Não foi possível solicitar", { description: e.message }),
  });

  const publicar = useMutation({
    mutationFn: async ({ linha, valor }: { linha: Linha; valor: boolean }) => {
      const { error } = await supabase
        .from("relatorios")
        .update({ publicado_painel: valor })
        .eq("competencia_id", linha.id)
        .is("deleted_at", null);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      toast.success(v.valor ? "Publicado no painel do cliente" : "Removido do painel");
      queryClient.invalidateQueries({ queryKey: ["relatorios-visao"] });
    },
    onError: (e: Error) => toast.error("Não foi possível atualizar", { description: e.message }),
  });

  const marcarEnviado = useMutation({
    mutationFn: async (linha: Linha) => {
      const { error } = await supabase
        .from("relatorios")
        .update({ enviado_em: new Date().toISOString() })
        .eq("competencia_id", linha.id)
        .is("deleted_at", null);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marcado como enviado");
      queryClient.invalidateQueries({ queryKey: ["relatorios-visao"] });
    },
  });

  function CelulaRel({ linha, tipo }: { linha: Linha; tipo: string }) {
    const r = linha.rels.find((x) => x.tipo === tipo);
    const rotulo = TIPOS_RELATORIO[tipo] ?? tipo;
    let icone: React.ReactNode;
    let cls: string;
    let tip: string;
    if (!r) {
      icone = <Minus className="size-3.5" />;
      cls = "bg-muted text-muted-foreground/50";
      tip = `${rotulo}: não gerado`;
    } else if (!r.arquivo_path) {
      icone = <Clock className="size-3.5" />;
      cls = "bg-warning/15 text-warning-foreground";
      tip = `${rotulo}: em geração`;
    } else {
      icone = <CheckCircle2 className="size-3.5" />;
      cls = "bg-success/10 text-success hover:bg-success/20";
      tip = `${rotulo}: baixar PDF`;
    }
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled={!r?.arquivo_path}
              onClick={() =>
                r?.arquivo_path &&
                baixarDocumento(r.arquivo_path, `${rotulo}-${linha.mes_ano}.pdf`).catch(() =>
                  toast.error("Não foi possível baixar"),
                )
              }
              className={`flex size-7 items-center justify-center rounded-md transition-colors ${cls}`}
              aria-label={tip}
            >
              {icone}
            </button>
          </TooltipTrigger>
          <TooltipContent className="bg-foreground text-background">{tip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const colunas: Column<Linha>[] = [
    {
      key: "cliente",
      header: "Cliente",
      sortValue: (l) => l.clientes?.nome_fantasia ?? l.clientes?.nome ?? "",
      cell: (l) => (
        <div className="min-w-0">
          <Link
            to="/empresas/$id/clientes/$clienteId"
            params={{ id: empresaId, clienteId: l.cliente_id }}
            className="block truncate font-medium hover:underline"
          >
            {l.clientes?.nome_fantasia ?? l.clientes?.nome ?? "—"}
          </Link>
          <div className="text-[0.6875rem] capitalize text-muted-foreground">
            {formatarCompetencia(l.mes_ano)}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Competência",
      hideBelow: "md",
      sortValue: (l) => l.status,
      cell: (l) => pillCompetencia(l.status, "xs"),
    },
    ...TIPOS.map<Column<Linha>>((t) => ({
      key: t,
      header: (
        <span title={TIPOS_RELATORIO[t]}>{t === "balanco" ? "Balanço" : t.toUpperCase()}</span>
      ),
      align: "center",
      width: "64px",
      cell: (l) => (
        <div className="flex justify-center">
          <CelulaRel linha={l} tipo={t} />
        </div>
      ),
    })),
    {
      key: "painel",
      header: "Painel",
      align: "center",
      hideBelow: "sm",
      cell: (l) => (
        <div className="flex justify-center">
          <Switch
            checked={l.publicados > 0 && l.publicados === l.rels.length}
            disabled={l.gerados === 0}
            onCheckedChange={(v) => publicar.mutate({ linha: l, valor: v })}
            aria-label="Publicar no painel"
          />
        </div>
      ),
    },
    {
      key: "envio",
      header: "Envio",
      hideBelow: "lg",
      cell: (l) => {
        const dt = l.rels
          .map((r) => r.enviado_em)
          .filter(Boolean)
          .sort()
          .pop();
        return dt ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Mail className="size-3 text-success" /> {formatarDataHora(dt)}
          </span>
        ) : (
          <button
            className="text-xs font-medium text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
            disabled={!l.completo}
            onClick={() => marcarEnviado.mutate(l)}
          >
            Marcar enviado
          </button>
        );
      },
    },
    {
      key: "acoes",
      header: "",
      align: "right",
      cell: (l) =>
        l.rels.length < TIPOS.length ? (
          <Button
            size="sm"
            variant={l.status === "fechada" ? "default" : "outline"}
            className="h-7 rounded-md px-2 text-xs"
            onClick={() => gerarPacote.mutate(l)}
            disabled={gerarPacote.isPending}
          >
            <Sparkles className="size-3" /> Gerar pacote
          </Button>
        ) : l.completo ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
            <Package className="size-3.5" /> Completo
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            {l.gerados}/{TIPOS.length} prontos
          </span>
        ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Relatórios"
        description="Pacote mensal por cliente: Balancete, DRE, Balanço patrimonial e DFC. Gere com um clique após fechar a competência, publique no painel e envie."
        actions={
          <>
            <Segmented
              value={escopo}
              onChange={setEscopo}
              items={[
                { value: "mes", label: "Por mês" },
                { value: "todos", label: "Histórico" },
              ]}
            />
            {escopo === "mes" && (
              <Input
                type="month"
                className="h-8 w-40 rounded-lg text-xs"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
              />
            )}
            <Select value={fCliente} onValueChange={setFCliente}>
              <SelectTrigger className="h-8 w-48 rounded-lg text-xs">
                <SelectValue placeholder="Cliente" />
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
          </>
        }
      />

      <KpiGrid cols={4}>
        <KpiCard
          label="Competências fechadas"
          value={k.fechadas}
          icon={CheckCircle2}
          tone="primary"
          loading={isLoading}
          footer={`de ${linhas.length} no filtro`}
          hint="Só competências fechadas geram o pacote definitivo."
        />
        <KpiCard
          label="Pacotes completos"
          value={k.completos}
          icon={Package}
          tone="success"
          loading={isLoading}
          progress={linhas.length ? (k.completos / linhas.length) * 100 : 0}
          hint="Competências com os 4 relatórios gerados em PDF."
        />
        <KpiCard
          label="Publicados no painel"
          value={k.publicados}
          icon={Globe}
          tone="accent"
          loading={isLoading}
          hint="Clientes que já enxergam o pacote no painel próprio (link sem senha)."
        />
        <KpiCard
          label="Enviados"
          value={k.enviados}
          icon={Mail}
          tone={k.enviados < k.completos ? "warning" : "neutral"}
          loading={isLoading}
          footer={
            k.completos - k.enviados > 0
              ? `${k.completos - k.enviados} completos sem envio`
              : "tudo enviado"
          }
          hint="Pacotes já encaminhados ao cliente por e-mail."
        />
      </KpiGrid>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <SectionCard
          flush
          title="Pacote mensal"
          icon={FileBarChart2}
          description="Uma linha por competência. Os ícones mostram cada relatório: cinza = não gerado, amarelo = em geração, verde = pronto (clique para baixar)."
        >
          <DataTable
            rows={linhas}
            columns={colunas}
            rowKey={(l) => l.id}
            loading={isLoading}
            defaultSort={{ key: "cliente", dir: "asc" }}
            emptyTitle="Nenhuma competência no filtro"
            emptyHint="Escolha outro mês ou cliente. As competências são criadas quando documentos chegam."
          />
        </SectionCard>

        <div className="space-y-4">
          <SectionCard
            title="Relatórios gerados"
            description="Quantos clientes já têm cada relatório pronto no filtro atual."
            icon={FileBarChart2}
            dense
          >
            <Bars
              data={k.porTipo}
              xKey="tipo"
              horizontal
              height={150}
              series={[{ key: "gerados", label: "Prontos", color: CHART_COLORS.primary }]}
            />
          </SectionCard>
          <SectionCard title="Como funciona" icon={Sparkles} dense>
            <ol className="space-y-2 text-xs text-muted-foreground">
              <li className="flex gap-2">
                <span className="font-bold text-primary">1</span> Feche a competência na tela de
                Conciliação.
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-primary">2</span> Clique em <b>Gerar pacote</b>: os
                4 PDFs saem com a identidade da empresa.
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-primary">3</span> Ligue <b>Painel</b> para o cliente
                ver no link dele e marque o envio.
              </li>
            </ol>
            <Link
              to="/empresas/$id/clientes"
              params={{ id: empresaId }}
              className="mt-3 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Links dos painéis dos clientes <ExternalLink className="size-3" />
            </Link>
          </SectionCard>
          <div className="flex items-center gap-2 text-[0.6875rem] text-muted-foreground">
            <Download className="size-3" /> Os PDFs também aparecem na aba Relatórios de cada
            cliente.
          </div>
        </div>
      </div>
    </div>
  );
}
