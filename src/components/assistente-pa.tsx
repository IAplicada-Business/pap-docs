import { useEffect, useRef, useState } from "react";
import { Loader2, MessageSquare, RotateCcw, SendHorizontal, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Msg = { role: "user" | "assistant"; content: string; erro?: boolean };

const SUGESTOES = [
  "O que está pendente este mês?",
  "Quais clientes ainda não enviaram documentos?",
  "Quantos documentos deram erro nos últimos 30 dias?",
  "Como está a conciliação do mês passado?",
];

export function AssistentePA({
  empresaId,
  nomeCurto,
  nomeCompleto,
  logoUrl,
  corPrimaria,
}: {
  empresaId: string;
  nomeCurto: string;
  nomeCompleto: string;
  logoUrl: string | null;
  corPrimaria: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [mensagens, setMensagens] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (aberto) {
      fimRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      inputRef.current?.focus();
    }
  }, [aberto, mensagens, carregando]);

  // Conversa é por empresa: ao trocar de empresa, começa do zero.
  useEffect(() => {
    setMensagens([]);
  }, [empresaId]);

  async function enviar(pergunta: string) {
    const q = pergunta.trim();
    if (!q || carregando) return;
    const historico: Msg[] = [...mensagens.filter((m) => !m.erro), { role: "user", content: q }];
    setMensagens(historico);
    setTexto("");
    setCarregando(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Entre novamente.");
      const res = await fetch("/api/assistente", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          empresaId,
          mensagens: historico.map(({ role, content }) => ({ role, content })),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { resposta?: string; erro?: string };
      if (!res.ok) throw new Error(body.erro ?? `Falha (${res.status}).`);
      setMensagens((m) => [...m, { role: "assistant", content: body.resposta ?? "" }]);
    } catch (e) {
      setMensagens((m) => [
        ...m,
        {
          role: "assistant",
          erro: true,
          content: e instanceof Error ? e.message : "Não foi possível falar com o assistente.",
        },
      ]);
    } finally {
      setCarregando(false);
    }
  }

  const iniciais =
    nomeCurto
      .replace(/[^A-Za-z0-9&]/g, "")
      .slice(0, 3)
      .toUpperCase() || "AI";

  const Avatar = ({ size = "size-8" }: { size?: string }) =>
    logoUrl ? (
      <img src={logoUrl} alt={nomeCurto} className={`${size} shrink-0 rounded-xl object-contain`} />
    ) : (
      <span
        className={`${size} flex shrink-0 items-center justify-center rounded-xl text-[0.6875rem] font-bold text-white`}
        style={{ backgroundColor: corPrimaria }}
      >
        {iniciais}
      </span>
    );

  return (
    <>
      {/* Bolha flutuante */}
      <button
        type="button"
        onClick={() => setAberto((o) => !o)}
        aria-label={aberto ? "Fechar assistente" : `Abrir Assistente ${nomeCurto}`}
        className={`fixed bottom-5 right-5 z-40 flex size-14 items-center justify-center rounded-2xl bg-card shadow-[0_8px_30px_rgba(15,23,42,0.18)] ring-1 ring-border/60 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_36px_rgba(15,23,42,0.22)] ${aberto ? "scale-95 opacity-0 pointer-events-none" : ""}`}
      >
        <Avatar size="size-10" />
        <span
          className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full text-white shadow-sm"
          style={{ backgroundColor: corPrimaria }}
        >
          <MessageSquare className="size-3" />
        </span>
      </button>

      {/* Painel */}
      {aberto && (
        <div
          role="dialog"
          aria-label={`Assistente ${nomeCurto}`}
          className="fixed bottom-5 right-5 z-50 flex h-[min(620px,calc(100vh-2.5rem))] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_24px_60px_rgba(15,23,42,0.22)] animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <header className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
            <Avatar size="size-9" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold leading-tight">
                Assistente {nomeCurto}
              </div>
              <div className="truncate text-[0.6875rem] text-muted-foreground">
                Responde com os dados da {nomeCompleto}
              </div>
            </div>
            {mensagens.length > 0 && (
              <button
                type="button"
                onClick={() => setMensagens([])}
                title="Nova conversa"
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <RotateCcw className="size-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setAberto(false)}
              aria-label="Fechar"
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {mensagens.length === 0 && (
              <div className="space-y-4">
                <div className="flex items-start gap-2.5">
                  <Avatar size="size-7" />
                  <div className="rounded-2xl rounded-tl-md bg-muted/70 px-3.5 py-2.5 text-[0.8125rem] leading-relaxed">
                    Olá! Sou o Assistente {nomeCurto}. Pergunte sobre clientes, documentos,
                    conciliação, competências ou relatórios — eu consulto a base e respondo.
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 pl-9">
                  {SUGESTOES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => enviar(s)}
                      className="rounded-full border border-border/70 bg-card px-3 py-1.5 text-left text-[0.75rem] text-foreground/80 transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mensagens.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div
                    className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-md px-3.5 py-2.5 text-[0.8125rem] leading-relaxed text-white"
                    style={{ backgroundColor: corPrimaria }}
                  >
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex items-start gap-2.5">
                  <Avatar size="size-7" />
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tl-md px-3.5 py-2.5 text-[0.8125rem] leading-relaxed ${
                      m.erro ? "bg-destructive/10 text-destructive" : "bg-muted/70 text-foreground"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ),
            )}

            {carregando && (
              <div className="flex items-start gap-2.5">
                <Avatar size="size-7" />
                <div className="flex items-center gap-2 rounded-2xl rounded-tl-md bg-muted/70 px-3.5 py-2.5 text-[0.75rem] text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> Consultando a base…
                </div>
              </div>
            )}
            <div ref={fimRef} />
          </div>

          <form
            className="flex items-center gap-2 border-t border-border/60 px-3 py-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              enviar(texto);
            }}
          >
            <input
              ref={inputRef}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={`Pergunte ao Assistente ${nomeCurto}…`}
              disabled={carregando}
              className="h-9 flex-1 rounded-lg border border-border/70 bg-background px-3 text-[0.8125rem] outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/50"
            />
            <button
              type="submit"
              disabled={carregando || !texto.trim()}
              aria-label="Enviar"
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white transition-opacity disabled:opacity-40"
              style={{ backgroundColor: corPrimaria }}
            >
              <SendHorizontal className="size-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
