import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — ConcilIA" },
      {
        name: "description",
        content: "Plataforma de contabilidade inteligente para escritórios contábeis.",
      },
      { property: "og:title", content: "ConcilIA — Contabilidade inteligente" },
      {
        property: "og:description",
        content: "Plataforma SaaS de conciliação contábil para escritórios.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [carregando, setCarregando] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setCarregando(false);
    if (error) {
      toast.error("Não foi possível entrar", { description: error.message });
      return;
    }
    toast.success("Bem-vindo de volta!");
    navigate({ to: "/dashboard" });
  }

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        data: { nome },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    setCarregando(false);
    if (error) {
      toast.error("Não foi possível criar a conta", { description: error.message });
      return;
    }
    toast.success("Conta criada", { description: "Você já pode acessar o sistema." });
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/60 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <img
            src="/logo-concilia.svg"
            alt="ConcilIA"
            className="mx-auto mb-3 h-10 w-auto"
          />
          <p className="text-sm text-muted-foreground">
            Contabilidade inteligente para escritórios
          </p>
        </div>
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Acesso da equipe</CardTitle>
            <CardDescription>
              Entre com seu e-mail e senha para acessar o ambiente do seu escritório.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="entrar">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="entrar">Entrar</TabsTrigger>
                <TabsTrigger value="criar">Criar conta</TabsTrigger>
              </TabsList>

              <TabsContent value="entrar">
                <form onSubmit={entrar} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="senha">Senha</Label>
                    <Input
                      id="senha"
                      type="password"
                      required
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={carregando}>
                    {carregando ? "Entrando..." : "Entrar"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="criar">
                <form onSubmit={cadastrar} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome completo</Label>
                    <Input
                      id="nome"
                      required
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email2">E-mail</Label>
                    <Input
                      id="email2"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="senha2">Senha</Label>
                    <Input
                      id="senha2"
                      type="password"
                      required
                      minLength={6}
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={carregando}>
                    {carregando ? "Criando..." : "Criar conta"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Clientes: usem o link de envio de documentos fornecido pelo seu escritório.
        </p>
      </div>
    </div>
  );
}
