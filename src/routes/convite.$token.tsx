import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, UserPlus, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/convite/$token")({
  head: () => ({
    meta: [
      { title: "Aceitar convite — ConcilIA" },
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
      <div className="flex min-h-screen items-center justify-center bg-secondary/60">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (invalido || !info) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/60 px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="space-y-3 py-10">
            <XCircle className="mx-auto size-10 text-destructive" />
            <h1 className="text-lg font-semibold">
              Convite invalido ou expirado
            </h1>
            <p className="text-sm text-muted-foreground">
              Este link de convite nao e mais valido. Peca ao administrador do
              escritorio para enviar um novo convite.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/60 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          {info.escritorio_logo_url ? (
            <img
              src={info.escritorio_logo_url}
              alt={info.escritorio_nome}
              className="mx-auto mb-3 h-12 w-auto"
            />
          ) : (
            <img
              src="/logo-concilia.svg"
              alt="ConcilIA"
              className="mx-auto mb-3 h-10 w-auto"
            />
          )}
        </div>

        <Card className="shadow-sm">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <UserPlus className="size-5" />
              Criar sua conta
            </CardTitle>
            <CardDescription>
              Voce foi convidado para o escritorio{" "}
              <strong>{info.escritorio_nome}</strong>. Preencha os dados abaixo
              para aceitar o convite e acessar o sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="escritorio">Escritorio</Label>
                <Input
                  id="escritorio"
                  value={info.escritorio_nome}
                  readOnly
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nome">Nome completo</Label>
                <Input
                  id="nome"
                  required
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
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="senha">Senha</Label>
                <Input
                  id="senha"
                  type="password"
                  required
                  minLength={6}
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
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  placeholder="Repita a senha"
                />
              </div>

              <Button type="submit" className="w-full" disabled={enviando}>
                {enviando ? "Criando conta..." : "Criar conta e entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>

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
