import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, CloudUpload, FileWarning, Loader2, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EXTENSOES_ACEITAS,
  TAMANHO_MAXIMO_BYTES,
  TIPOS_DOCUMENTO,
} from "@/lib/dominio";
import { formatarTamanho, mesAnterior } from "@/lib/formatadores";

export const Route = createFileRoute("/upload/$token")({
  head: () => ({
    meta: [
      { title: "Envio de documentos — ConcilIA" },
      {
        name: "description",
        content:
          "Página segura para envio de documentos contábeis. Não é preciso fazer login.",
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

function opcoesMeses() {
  const lista: { value: string; label: string }[] = [];
  const hoje = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    lista.push({
      value,
      label: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    });
  }
  return lista;
}

function UploadPublico() {
  const { token } = Route.useParams();
  const [carregando, setCarregando] = useState(true);
  const [nomeFantasia, setNomeFantasia] = useState<string | null>(null);
  const [escritorio, setEscritorio] = useState<{ nome: string; logo_url: string | null; cor_primaria: string | null } | null>(null);
  const [linkInvalido, setLinkInvalido] = useState(false);
  const [tipo, setTipo] = useState<string>("extrato");
  const [mes, setMes] = useState<string>(mesAnterior());
  const [itens, setItens] = useState<ItemEnvio[]>([]);
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const meses = opcoesMeses();

  useEffect(() => {
    fetch(`/api/public/upload-info?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("invalido");
        const json = (await r.json()) as {
          nome_fantasia: string;
          cliente_branding?: { logo_url: string | null; cor_primaria: string };
          escritorio?: { nome: string; logo_url: string | null; cor_primaria: string | null };
        };
        setNomeFantasia(json.nome_fantasia);
        const cb = json.cliente_branding;
        const esc = json.escritorio;
        setEscritorio({
          nome: esc?.nome ?? "ConcilIA",
          logo_url: cb?.logo_url ?? esc?.logo_url ?? null,
          cor_primaria: cb?.cor_primaria ?? esc?.cor_primaria ?? null,
        });
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

  function adicionar(arquivos: FileList | null) {
    if (!arquivos) return;
    const novos: ItemEnvio[] = [];
    for (const arquivo of Array.from(arquivos)) {
      if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
        novos.push({
          arquivo,
          progresso: 0,
          status: "erro",
          mensagem: "Arquivo maior que 20 MB.",
        });
      } else {
        novos.push({ arquivo, progresso: 0, status: "pendente" });
      }
    }
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
        setItens((atual) =>
          atual.map((it, i) => (i === indice ? { ...it, progresso: pct, status: "enviando" } : it)),
        );
      };
      xhr.onload = () => {
        let mensagem = "Não foi possível enviar. Tente novamente.";
        try {
          const json = JSON.parse(xhr.responseText) as { erro?: string };
          if (json.erro) mensagem = json.erro;
        } catch {
          /* resposta sem json */
        }
        const ok = xhr.status >= 200 && xhr.status < 300;
        setItens((atual) =>
          atual.map((it, i) =>
            i === indice
              ? {
                  ...it,
                  progresso: 100,
                  status: (ok ? "sucesso" : "erro") as ItemEnvio["status"],
                  mensagem: ok ? "" : mensagem,
                }
              : it,
          ),
        );
        resolve();
      };
      xhr.onerror = () => {
        setItens((atual) =>
          atual.map((it, i) =>
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
    for (let i = 0; i < itens.length; i++) {
      const item = itens[i];
      if (!item || item.status !== "pendente") continue;
      await enviarUm(item, i);
    }
  }

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
          <h1 className="mt-4 text-lg font-semibold">Este link não está mais válido</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Peça um novo link para a equipe do seu escritório e tente novamente.
          </p>
        </div>
      </div>
    );
  }

  const pendentes = itens.filter((i) => i.status === "pendente").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 px-4 py-8">
      <div className="mx-auto w-full max-w-lg space-y-6">
        <header className="text-center">
          {escritorio?.logo_url ? (
            <img src={escritorio.logo_url} alt={escritorio.nome} className="mx-auto mb-3 h-10 w-auto" />
          ) : (
            <img src="/logo-concilia.svg" alt="ConcilIA" className="mx-auto mb-3 h-8 w-auto" />
          )}
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            {escritorio?.nome ?? "ConcilIA"}
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">Olá, {nomeFantasia}!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Envie aqui os documentos do mês. É simples: escolha o tipo, o mês e anexe os arquivos.
            Não precisa de senha.
          </p>
        </header>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Que tipo de documento você está enviando?</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_DOCUMENTO.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>De qual mês são esses documentos?</Label>
              <Select value={mes} onValueChange={setMes}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {meses.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
              className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                arrastando ? "border-primary bg-primary/5" : "border-border bg-muted/40"
              }`}
            >
              <CloudUpload className="mx-auto size-8 text-primary" />
              <p className="mt-2 text-sm font-medium">Arraste os arquivos até aqui</p>
              <p className="text-xs text-muted-foreground">
                PDF, OFX, planilhas, fotos ou prints — até 20 MB cada.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-3 rounded-xl"
                onClick={() => inputRef.current?.click()}
              >
                <Paperclip className="size-4" /> Escolher arquivos
              </Button>
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
              <div className="space-y-2">
                {itens.map((item, i) => (
                  <div
                    key={`${item.arquivo.name}-${i}`}
                    className="rounded-xl border border-border/60 p-3"
                  >
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{item.arquivo.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatarTamanho(item.arquivo.size)}
                      </span>
                    </div>
                    {item.status === "enviando" && (
                      <Progress value={item.progresso} className="mt-2 h-2" />
                    )}
                    {item.status === "sucesso" && (
                      <p className="mt-2 flex items-center gap-1 text-xs font-medium text-success">
                        <CheckCircle2 className="size-4" /> Enviado com sucesso
                      </p>
                    )}
                    {item.status === "erro" && (
                      <p className="mt-2 text-xs font-medium text-destructive">{item.mensagem}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <Button
              className="w-full rounded-xl"
              disabled={pendentes === 0}
              onClick={enviarTodos}
            >
              {pendentes === 0 ? "Nenhum arquivo para enviar" : `Enviar ${pendentes} arquivo(s)`}
            </Button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Dúvidas? Fale com a equipe do {escritorio?.nome ?? "seu escritório"}.
        </p>
      </div>
    </div>
  );
}
