import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarRange,
  CheckCircle2,
  FileBarChart,
  FileWarning,
  Loader2,
  Scale,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  STATUS_COMPETENCIA,
  TIPOS_RELATORIO,
} from "@/lib/dominio";
import {
  formatarCompetencia,
  formatarDataHora,
  formatarPorcentagem,
} from "@/lib/formatadores";

export const Route = createFileRoute("/painel/$token")({
  head: () => ({
    meta: [
      { title: "Painel do cliente — ConcilIA" },
      {
        name: "description",
        content: "Acompanhe relatorios e status das competencias do seu escritorio.",
      },
    ],
  }),
  component: PainelPublico,
});

type Competencia = {
  id: string;
  mes_ano: string;
  status: string;
  taxa_conciliacao: number | null;
  fechada_em: string | null;
};

type Relatorio = {
  id: string;
  tipo: string;
  publicado_painel: boolean | null;
  enviado_em: string | null;
  created_at: string;
  competencia_id: string;
};

type Escritorio = {
  nome: string;
  logo_url: string | null;
  cor_primaria: string | null;
};

function competenciaStatusConfig(status: string) {
  if (status === "fechada")
    return { dot: "bg-gray-400", bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400" };
  if (status === "em_conciliacao")
    return { dot: "bg-amber-500 animate-pulse", bg: "bg-amber-50 dark:bg-amber-950", text: "text-amber-700 dark:text-amber-400" };
  return { dot: "bg-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950", text: "text-emerald-700 dark:text-emerald-400" };
}

function PainelPublico() {
  const { token } = Route.useParams();
  const [carregando, setCarregando] = useState(true);
  const [nomeFantasia, setNomeFantasia] = useState<string>("");
  const [escritorio, setEscritorio] = useState<Escritorio | null>(null);
  const [competencias, setCompetencias] = useState<Competencia[]>([]);
  const [relatorios, setRelatorios] = useState<Relatorio[]>([]);
  const [linkInvalido, setLinkInvalido] = useState(false);

  useEffect(() => {
    fetch(`/api/public/painel-info?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("invalido");
        const json = (await r.json()) as {
          nome_fantasia: string;
          cliente_branding?: { logo_url: string | null; cor_primaria: string };
          escritorio: Escritorio | null;
          competencias: Competencia[];
          relatorios: Relatorio[];
        };
        setNomeFantasia(json.nome_fantasia);
        const cb = json.cliente_branding;
        const esc = json.escritorio;
        setEscritorio({
          nome: esc?.nome ?? "ConcilIA",
          logo_url: cb?.logo_url ?? esc?.logo_url ?? null,
          cor_primaria: cb?.cor_primaria ?? esc?.cor_primaria ?? null,
        });
        setCompetencias(json.competencias);
        setRelatorios(json.relatorios);
      })
      .catch(() => setLinkInvalido(true))
      .finally(() => setCarregando(false));
  }, [token]);

  useEffect(() => {
    if (!escritorio?.cor_primaria) return;
    const root = document.documentElement;
    root.style.setProperty("--primary", escritorio.cor_primaria);
    return () => {
      root.style.removeProperty("--primary");
    };
  }, [escritorio]);

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (linkInvalido) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-card">
          <FileWarning className="mx-auto size-10 text-destructive" />
          <h1 className="mt-4 text-lg font-semibold">Este link nao esta mais valido</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Peca um novo link para a equipe do seu escritorio e tente novamente.
          </p>
        </div>
      </div>
    );
  }

  const compAbertas = competencias.filter((c) => c.status !== "fechada");
  const compFechadas = competencias.filter((c) => c.status === "fechada");

  function relatoriosDaCompetencia(competenciaId: string) {
    return relatorios.filter((r) => r.competencia_id === competenciaId);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 px-4 py-8">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <header className="text-center">
          {escritorio?.logo_url ? (
            <img
              src={escritorio.logo_url}
              alt={escritorio.nome}
              className="mx-auto mb-3 h-10 w-auto"
            />
          ) : (
            <img
              src="/logo-concilia.svg"
              alt="ConcilIA"
              className="mx-auto mb-3 h-8 w-auto"
            />
          )}
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            {escritorio?.nome ?? "ConcilIA"}
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">
            Painel de {nomeFantasia}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Acompanhe o andamento das suas competencias e relatorios contabeis.
          </p>
        </header>

        {/* Summary cards */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5 text-center shadow-card">
            <CalendarRange className="mx-auto size-6 text-primary" />
            <div className="mt-2 text-2xl font-bold tracking-tight">
              {competencias.length}
            </div>
            <p className="text-xs text-muted-foreground">Competencias</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 text-center shadow-card">
            <FileBarChart className="mx-auto size-6 text-primary" />
            <div className="mt-2 text-2xl font-bold tracking-tight">
              {relatorios.length}
            </div>
            <p className="text-xs text-muted-foreground">Relatorios disponiveis</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 text-center shadow-card">
            <Scale className="mx-auto size-6 text-primary" />
            <div className="mt-2 text-2xl font-bold tracking-tight">
              {formatarPorcentagem(
                competencias.length
                  ? competencias.reduce((acc, c) => acc + (c.taxa_conciliacao ?? 0), 0) /
                      competencias.length
                  : null,
              )}
            </div>
            <p className="text-xs text-muted-foreground">Conciliacao media</p>
          </div>
        </div>

        <Tabs defaultValue="competencias">
          <TabsList className="w-full rounded-xl">
            <TabsTrigger value="competencias" className="flex-1 rounded-lg">
              <CalendarRange className="mr-1.5 size-3.5" /> Competencias
            </TabsTrigger>
            <TabsTrigger value="relatorios" className="flex-1 rounded-lg">
              <FileBarChart className="mr-1.5 size-3.5" /> Relatorios
            </TabsTrigger>
          </TabsList>

          {/* Tab: Competencias */}
          <TabsContent value="competencias">
            <div className="rounded-2xl border border-border bg-card shadow-card">
              {competencias.length === 0 ? (
                <div className="py-16 text-center">
                  <CalendarRange className="mx-auto size-10 text-muted-foreground/30" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    Nenhuma competencia registrada ainda.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {compAbertas.length > 0 && (
                    <div className="p-4">
                      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Em andamento
                      </h3>
                      <div className="space-y-3">
                        {compAbertas.map((c) => {
                          const taxa = c.taxa_conciliacao ?? 0;
                          const sc = competenciaStatusConfig(c.status);
                          const rels = relatoriosDaCompetencia(c.id);
                          return (
                            <div
                              key={c.id}
                              className="rounded-xl border border-border/60 p-4"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-sm font-semibold capitalize">
                                  {formatarCompetencia(c.mes_ano)}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${sc.bg} ${sc.text}`}
                                >
                                  <span className={`size-1.5 rounded-full ${sc.dot}`} />
                                  {STATUS_COMPETENCIA[c.status] ?? c.status}
                                </span>
                              </div>
                              <div className="mt-3">
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>Conciliacao</span>
                                  <span className="font-medium">{formatarPorcentagem(taxa)}</span>
                                </div>
                                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                                  <div
                                    className="h-full rounded-full bg-primary transition-all"
                                    style={{ width: `${Math.min(taxa, 100)}%` }}
                                  />
                                </div>
                              </div>
                              {rels.length > 0 && (
                                <div className="mt-3 space-y-1">
                                  {rels.map((r) => (
                                    <div
                                      key={r.id}
                                      className="flex items-center gap-2 text-xs text-muted-foreground"
                                    >
                                      <FileBarChart className="size-3" />
                                      {TIPOS_RELATORIO[r.tipo] ?? r.tipo}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {compFechadas.length > 0 && (
                    <div className="p-4">
                      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Fechadas
                      </h3>
                      <div className="space-y-2">
                        {compFechadas.map((c) => {
                          const rels = relatoriosDaCompetencia(c.id);
                          return (
                            <div
                              key={c.id}
                              className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3"
                            >
                              <div className="flex items-center gap-3">
                                <CheckCircle2 className="size-4 text-emerald-500" />
                                <span className="text-sm font-medium capitalize">
                                  {formatarCompetencia(c.mes_ano)}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                {rels.length > 0 && (
                                  <span>{rels.length} relatorio(s)</span>
                                )}
                                {c.fechada_em && (
                                  <span>Fechada em {formatarDataHora(c.fechada_em)}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Tab: Relatorios */}
          <TabsContent value="relatorios">
            <div className="rounded-2xl border border-border bg-card shadow-card">
              {relatorios.length === 0 ? (
                <div className="py-16 text-center">
                  <FileBarChart className="mx-auto size-10 text-muted-foreground/30" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    Nenhum relatorio disponivel ainda.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Os relatorios aparecirao aqui quando o escritorio publica-los.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {relatorios.map((r) => {
                    const comp = competencias.find((c) => c.id === r.competencia_id);
                    return (
                      <div
                        key={r.id}
                        className="flex items-center gap-3 px-4 py-3"
                      >
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <FileBarChart className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">
                            {TIPOS_RELATORIO[r.tipo] ?? r.tipo}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {comp ? formatarCompetencia(comp.mes_ano) : "—"}
                            {" · "}
                            {formatarDataHora(r.created_at)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <p className="text-center text-xs text-muted-foreground">
          Duvidas? Fale com a equipe do {escritorio?.nome ?? "seu escritorio"}.
        </p>
      </div>
    </div>
  );
}
