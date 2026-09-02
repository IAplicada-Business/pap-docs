import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  CloudUpload,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileWarning,
  Landmark,
  Loader2,
  Paperclip,
  Receipt,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EXTENSOES_ACEITAS, TAMANHO_MAXIMO_BYTES } from "@/lib/dominio";
import { formatarTamanho, mesAnterior } from "@/lib/formatadores";

export const Route = createFileRoute("/upload/$token")({
  head: () => ({
    meta: [
      { title: "Envio de documentos — ConcilIA" },
      {
        name: "description",
        content: "Página segura para envio de documentos contábeis. Não é preciso fazer login.",
      },
      { property: "og:title", content: "Envio de documentos — ConcilIA" },
      {
        property: "og:description",
        content: "Envie extratos, relatórios e notas em poucos cliques.",
      },
    ],
  }),
  component: UploadPublico,
});

type ItemEnvio = {
  arquivo: File;
  progresso: number;
  status: "pendente" | "enviando" | "sucesso" | "erro";
  mensagem?: string;
};

const TIPOS = [
  {
    value: "extrato",
    label: "Extrato bancário",
    ajuda: "O extrato completo do mês, em PDF ou OFX",
    icone: Landmark,
  },
  {
    value: "conta_azul",
    label: "Relatório Conta Azul",
    ajuda: "Exportado do sistema Conta Azul",
    icone: FileSpreadsheet,
  },
  {
    value: "aprisco",
    label: "Relatório Aprisco",
    ajuda: "Exportado do sistema Aprisco",
    icone: Users,
  },
  { value: "folha", label: "Folha de pagamento", ajuda: "Resumo da folha em PDF", icone: FileText },
  {
    value: "nota_fiscal",
    label: "Notas e comprovantes",
    ajuda: "Fotos, prints ou PDFs de notas e recibos",
    icone: Receipt,
  },
  {
    value: "outro",
    label: "Outro documento",
    ajuda: "Qualquer outro arquivo que a contabilidade pediu",
    icone: Paperclip,
  },
];

function opcoesMeses() {
  const lista: { value: string; label: string }[] = [];
  const hoje = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    lista.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    });
  }
  return lista;
}

function IconeArq({ nome }: { nome: string }) {
  const ext = nome.split(".").pop()?.toLowerCase() ?? "";
  if (["xlsx", "xls", "csv", "ofx"].includes(ext))
    return <FileSpreadsheet className="size-4 text-success" />;
  if (["jpg", "jpeg", "png"].includes(ext)) return <FileImage className="size-4 text-chart-4" />;
  return <FileText className="size-4 text-primary" />;
}

function UploadPublico() {
  const { token } = Route.useParams();
  const [carregando, setCarregando] = useState(true);
  const [nomeFantasia, setNomeFantasia] = useState<string | null>(null);
  const [escritorio, setEscritorio] = useState<{
    nome: string;
    logo_url: string | null;
    cor_primaria: string | null;
  } | null>(null);
  const [linkInvalido, setLinkInvalido] = useState(false);
  const [passo, setPasso] = useState<1 | 2 | 3>(1);
  const [tipo, setTipo] = useState<string>("");
  const [mes, setMes] = useState<string>(mesAnterior());
  const [itens, setItens] = useState<ItemEnvio[]>([]);
  const [arrastando, setArrastando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const meses = opcoesMeses();

  useEffect(() => {
    fetch(`/api/public/upload-info?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("invalido");
        const json = (await r.json()) as {
          nome_fantasia: string;
          escritorio?: { nome: string; logo_url: string | null; cor_primaria: string | null };
        };
        setNomeFantasia(json.nome_fantasia);
        setEscritorio({
          nome: json.escritorio?.nome ?? "ConcilIA",
          logo_url: json.escritorio?.logo_url ?? null,
          cor_primaria: json.escritorio?.cor_primaria ?? null,
        });
      })
      .catch(() => setLinkInvalido(true))
      .finally(() => setCarregando(false));
  }, [token]);

  useEffect(() => {
    if (!escritorio?.cor_primaria) return;
    document.documentElement.style.setProperty("--primary", escritorio.cor_primaria);
    return () => {
      document.documentElement.style.removeProperty("--primary");
    };
  }, [escritorio]);

  function adicionar(arquivos: FileList | null) {
    if (!arquivos) return;
    const novos: ItemEnvio[] = Array.from(arquivos).map((a) =>
      a.size > TAMANHO_MAXIMO_BYTES
        ? { arquivo: a, progresso: 0, status: "erro", mensagem: "Arquivo maior que 20 MB" }
        : { arquivo: a, progresso: 0, status: "pendente" },
    );
    setItens((atual) => [...atual, ...novos]);
  }

  function enviarUm(item: ItemEnvio, indice: number) {
    return new Promise<void>((resolve) => {
      const form = new FormData();
      form.append("token", token);
      form.append("tipo", tipo);
      form.append("mes", mes);
      form.append("arquivo", item.arquivo);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/public/upload");
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const pct = Math.round((e.loaded / e.total) * 95);
        setItens((a) =>
          a.map((it, i) => (i === indice ? { ...it, progresso: pct, status: "enviando" } : it)),
        );
      };
      xhr.onload = () => {
        let mensagem = "Não foi possível enviar. Tente novamente.";
        try {
          const json = JSON.parse(xhr.responseText) as { erro?: string };
          if (json.erro) mensagem = json.erro;
        } catch {
          /* sem json */
        }
        const ok = xhr.status >= 200 && xhr.status < 300;
        setItens((a) =>
          a.map((it, i) =>
            i === indice
              ? {
                  ...it,
                  progresso: 100,
                  status: ok ? "sucesso" : "erro",
                  mensagem: ok ? "" : mensagem,
                }
              : it,
          ),
        );
        resolve();
      };
      xhr.onerror = () => {
        setItens((a) =>
          a.map((it, i) =>
            i === indice
              ? { ...it, status: "erro", mensagem: "Falha de conexão. Tente novamente." }
              : it,
          ),
        );
        resolve();
      };
      xhr.send(form);
    });
  }

  async function enviarTodos() {
    setEnviando(true);
    for (let i = 0; i < itens.length; i++) {
      const item = itens[i];
      if (!item || item.status !== "pendente") continue;
      await enviarUm(item, i);
    }
    setEnviando(false);
    setConcluido(true);
  }

  function reiniciar() {
    setItens([]);
    setConcluido(false);
    setTipo("");
    setPasso(1);
  }

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (linkInvalido) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-card">
          <FileWarning className="mx-auto size-10 text-destructive" />
          <h1 className="mt-4 text-lg font-semibold">Este link não está mais válido</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Peça um novo link para a equipe do seu escritório contábil.
          </p>
        </div>
      </div>
    );
  }

  const pendentes = itens.filter((i) => i.status === "pendente").length;
  const sucesso = itens.filter((i) => i.status === "sucesso").length;
  const erros = itens.filter((i) => i.status === "erro").length;
  const tipoSel = TIPOS.find((t) => t.value === tipo);
  const mesSel = meses.find((m) => m.value === mes);

  return (
    <div className="min-h-screen bg-background">
      <div className="h-1.5 w-full bg-primary" />
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
        <header className="mb-8 flex flex-col items-center text-center">
          {escritorio?.logo_url ? (
            <img
              src={escritorio.logo_url}
              alt={escritorio.nome}
              className="mb-3 h-12 w-auto object-contain"
            />
          ) : (
            <span className="mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Building2 className="size-6" />
            </span>
          )}
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {escritorio?.nome}
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Olá, {nomeFantasia}!
          </h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Envie aqui os documentos do mês. São três passos rápidos e não precisa de senha.
          </p>
        </header>

        {!concluido && (
          <ol className="mb-6 flex items-center justify-center gap-2 text-xs">
            {[
              { n: 1, l: "Tipo" },
              { n: 2, l: "Mês" },
              { n: 3, l: "Arquivos" },
            ].map((p, i) => {
              const ativo = passo === p.n;
              const feito = passo > p.n;
              return (
                <li key={p.n} className="flex items-center gap-2">
                  {i > 0 && (
                    <span
                      className={`h-px w-8 sm:w-14 ${feito || ativo ? "bg-primary" : "bg-border"}`}
                    />
                  )}
                  <button
                    type="button"
                    disabled={!feito}
                    onClick={() => feito && setPasso(p.n as 1 | 2 | 3)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition-colors ${ativo ? "bg-primary text-primary-foreground" : feito ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                  >
                    {feito ? (
                      <CheckCircle2 className="size-3.5" />
                    ) : (
                      <span className="flex size-4 items-center justify-center rounded-full bg-white/20 text-[0.625rem] font-bold">
                        {p.n}
                      </span>
                    )}
                    {p.l}
                  </button>
                </li>
              );
            })}
          </ol>
        )}

        <div className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-7">
          {concluido ? (
            <div className="text-center">
              <span
                className={`mx-auto flex size-16 items-center justify-center rounded-full ${erros ? "bg-warning/15 text-warning-foreground" : "bg-success/10 text-success"}`}
              >
                <CheckCircle2 className="size-8" />
              </span>
              <h2 className="mt-4 text-xl font-bold">
                {erros ? "Envio parcial" : "Tudo enviado!"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {sucesso} arquivo(s) de <b>{tipoSel?.label}</b> de <b>{mesSel?.label}</b> chegaram
                para a equipe do {escritorio?.nome}.
                {erros > 0 && (
                  <span className="block mt-1 text-destructive">
                    {erros} arquivo(s) não foram enviados — veja abaixo.
                  </span>
                )}
              </p>
              {erros > 0 && (
                <ul className="mt-4 space-y-1.5 text-left">
                  {itens
                    .filter((i) => i.status === "erro")
                    .map((it, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-2 rounded-lg bg-destructive/8 px-3 py-2 text-xs text-destructive"
                      >
                        <FileWarning className="size-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{it.arquivo.name}</span>
                        <span className="shrink-0">{it.mensagem}</span>
                      </li>
                    ))}
                </ul>
              )}
              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Button className="h-11 rounded-xl" onClick={reiniciar}>
                  Enviar outro tipo de documento
                </Button>
                <Button
                  variant="outline"
                  className="h-11 rounded-xl"
                  onClick={() => {
                    setItens([]);
                    setConcluido(false);
                    setPasso(3);
                  }}
                >
                  Enviar mais arquivos do mesmo tipo
                </Button>
              </div>
            </div>
          ) : passo === 1 ? (
            <>
              <h2 className="text-base font-semibold">Que tipo de documento você vai enviar?</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Escolha uma opção. Depois você pode voltar e enviar outros tipos.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {TIPOS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => {
                      setTipo(t.value);
                      setPasso(2);
                    }}
                    className={`flex items-start gap-3 rounded-xl border-2 p-3.5 text-left transition-all hover:border-primary/60 hover:bg-primary/5 ${tipo === t.value ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <t.icone className="size-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{t.label}</span>
                      <span className="block text-xs text-muted-foreground">{t.ajuda}</span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : passo === 2 ? (
            <>
              <h2 className="text-base font-semibold">De qual mês são esses documentos?</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Normalmente é o mês que acabou de terminar.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {meses.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMes(m.value)}
                    className={`rounded-xl border-2 px-3 py-3 text-sm font-medium capitalize transition-all hover:border-primary/60 ${mes === m.value ? "border-primary bg-primary/5 text-primary" : "border-border text-foreground"}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between">
                <Button variant="ghost" className="rounded-xl" onClick={() => setPasso(1)}>
                  <ArrowLeft className="size-4" /> Voltar
                </Button>
                <Button className="h-11 rounded-xl px-6" onClick={() => setPasso(3)}>
                  Continuar <ArrowRight className="size-4" />
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-md bg-primary/10 px-2 py-1 font-medium text-primary">
                  {tipoSel?.label}
                </span>
                <span className="rounded-md bg-muted px-2 py-1 font-medium capitalize text-muted-foreground">
                  {mesSel?.label}
                </span>
                <button
                  type="button"
                  className="ml-auto text-muted-foreground underline-offset-2 hover:underline"
                  onClick={() => setPasso(1)}
                >
                  Alterar
                </button>
              </div>
              <h2 className="mt-4 text-base font-semibold">Agora anexe os arquivos</h2>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setArrastando(true);
                }}
                onDragLeave={() => setArrastando(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setArrastando(false);
                  adicionar(e.dataTransfer.files);
                }}
                onClick={() => inputRef.current?.click()}
                className={`mt-3 flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors ${arrastando ? "border-primary bg-primary/5" : "border-border bg-muted/30 hover:border-primary/50 hover:bg-primary/5"}`}
              >
                <CloudUpload className="size-9 text-primary" />
                <p className="mt-2 text-sm font-semibold">Toque aqui para escolher os arquivos</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  ou arraste para esta área · PDF, OFX, planilhas, fotos · até 20 MB cada
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept={EXTENSOES_ACEITAS}
                  className="hidden"
                  onChange={(e) => {
                    adicionar(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>

              {itens.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {itens.map((item, i) => (
                    <li
                      key={`${item.arquivo.name}-${i}`}
                      className="rounded-xl border border-border/70 px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2.5 text-sm">
                        <IconeArq nome={item.arquivo.name} />
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {item.arquivo.name}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatarTamanho(item.arquivo.size)}
                        </span>
                        {item.status === "sucesso" && (
                          <CheckCircle2 className="size-4 text-success" />
                        )}
                        {item.status === "enviando" && (
                          <Loader2 className="size-4 animate-spin text-primary" />
                        )}
                        {item.status === "pendente" && !enviando && (
                          <button
                            type="button"
                            aria-label="Remover"
                            onClick={() => setItens((a) => a.filter((_, j) => j !== i))}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="size-4" />
                          </button>
                        )}
                      </div>
                      {item.status === "enviando" && (
                        <Progress value={item.progresso} className="mt-2 h-1.5" />
                      )}
                      {item.status === "erro" && (
                        <p className="mt-1.5 text-xs font-medium text-destructive">
                          {item.mensagem}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-5 flex items-center justify-between gap-2">
                <Button
                  variant="ghost"
                  className="rounded-xl"
                  onClick={() => setPasso(2)}
                  disabled={enviando}
                >
                  <ArrowLeft className="size-4" /> Voltar
                </Button>
                <Button
                  className="h-11 flex-1 rounded-xl text-sm sm:flex-none sm:px-8"
                  disabled={pendentes === 0 || enviando}
                  onClick={enviarTodos}
                >
                  {enviando ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Enviando…
                    </>
                  ) : pendentes === 0 ? (
                    "Escolha os arquivos"
                  ) : (
                    `Enviar ${pendentes} arquivo(s)`
                  )}
                </Button>
              </div>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Dúvidas? Fale com a equipe do {escritorio?.nome ?? "seu escritório"}. Seus arquivos são
          enviados com segurança.
        </p>
      </div>
    </div>
  );
}
