import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, UserPlus, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/convite/$token")({
  head: () => ({
    meta: [
      { title: "Aceitar convite — P&A Contabilidade Digital" },
      {
        name: "description",
        content:
          "Crie sua conta e entre no escritorio que te convidou.",
      },
    ],
  }),
  component: ConvitePage,
});

type ConviteInfo = {
  email: string;
  escritorio_nome: string;
  escritorio_logo_url: string | null;
  escritorio_cor_primaria: string | null;
};

function ConvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();

  const [carregando, setCarregando] = useState(true);
  const [invalido, setInvalido] = useState(false);
  const [info, setInfo] = useState<ConviteInfo | null>(null);

  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    fetch(`/api/public/convite-info?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("invalido");
        const json = (await r.json()) as ConviteInfo;
        setInfo(json);
      })
      .catch(() => setInvalido(true))
      .finally(() => setCarregando(false));
  }, [token]);

  useEffect(() => {
    if (!info?.escritorio_cor_primaria) return;
    const root = document.documentElement;
    root.style.setProperty("--primary", info.escritorio_cor_primaria);
    return () => {
      root.style.removeProperty("--primary");
    };
  }, [info]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (senha.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (senha !== confirmarSenha) {
      toast.error("As senhas nao coincidem.");
      return;
    }

    if (!info) return;

    setEnviando(true);
    const { error } = await supabase.auth.signUp({
      email: info.email,
      password: senha,
      options: {
        data: { nome },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    setEnviando(false);

    if (error) {
      toast.error("Nao foi possivel criar a conta", {
        description: error.message,
      });
      return;
    }

    toast.success("Conta criada com sucesso!", {
      description: "Voce ja esta dentro do escritorio.",
    });
    navigate({ to: "/dashboard" });
  }

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (invalido || !info) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-card">
          <XCircle className="mx-auto size-10 text-destructive" />
          <h1 className="mt-4 text-lg font-semibold">
            Convite invalido ou expirado
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Este link de convite nao e mais valido. Peca ao administrador do
            escritorio para enviar um novo convite.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          {info.escritorio_logo_url ? (
            <img
              src={info.escritorio_logo_url}
              alt={info.escritorio_nome}
              className="mx-auto mb-4 h-12 w-auto"
            />
          ) : (
            <img
              src="/logo-pa.svg"
              alt="P&A Contabilidade Digital"
              className="mx-auto mb-4 h-10 w-auto"
            />
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/8 text-primary">
              <UserPlus className="size-5" />
            </div>
            <h1 className="text-lg font-semibold">Criar sua conta</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Voce foi convidado para o escritorio{" "}
              <strong>{info.escritorio_nome}</strong>. Preencha os dados abaixo
              para aceitar o convite e acessar o sistema.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="escritorio">Escritorio</Label>
              <Input
                id="escritorio"
                value={info.escritorio_nome}
                readOnly
                disabled
                className="rounded-xl bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome">Nome completo</Label>
              <Input
                id="nome"
                required
                className="rounded-xl"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome completo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={info.email}
                readOnly
                disabled
                className="rounded-xl bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                required
                minLength={6}
                className="rounded-xl"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Minimo 6 caracteres"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmar-senha">Confirmar senha</Label>
              <Input
                id="confirmar-senha"
                type="password"
                required
                minLength={6}
                className="rounded-xl"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                placeholder="Repita a senha"
              />
            </div>

            <Button type="submit" className="w-full rounded-xl" disabled={enviando}>
              {enviando ? "Criando conta..." : "Criar conta e entrar"}
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Ja tem uma conta?{" "}
          <a href="/auth" className="text-primary underline underline-offset-2">
            Entrar
          </a>
        </p>
      </div>
    </div>
  );
}
