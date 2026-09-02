import { useState, useEffect, useMemo, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
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

  const pillsData = useMemo(() => {
    const seed = [
      { w: 220, h: 70, left: 5, top: 12, delay: 0, dur: 22, color: "navy" as const },
      { w: 180, h: 55, left: 60, top: 8, delay: -4, dur: 26, color: "green" as const },
      { w: 260, h: 80, left: 15, top: 65, delay: -8, dur: 20, color: "green" as const },
      { w: 150, h: 50, left: 70, top: 70, delay: -12, dur: 24, color: "navy" as const },
      { w: 200, h: 65, left: 40, top: 35, delay: -6, dur: 28, color: "teal" as const },
      { w: 170, h: 55, left: -5, top: 45, delay: -15, dur: 23, color: "navy" as const },
      { w: 240, h: 75, left: 50, top: 50, delay: -10, dur: 25, color: "green" as const },
      { w: 140, h: 45, left: 25, top: 85, delay: -3, dur: 21, color: "teal" as const },
    ];
    return seed;
  }, []);

  const pillRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;

      pillRefs.current.forEach((pill, index) => {
        if (pill) {
          const speed = (index + 1) * 15;
          pill.style.marginLeft = `${x * speed}px`;
          pill.style.marginTop = `${y * speed}px`;
        }
      });
    };

    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, []);

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

  const pillGradient = (color: "navy" | "green" | "teal") => {
    switch (color) {
      case "navy":
        return "linear-gradient(135deg, #1C2B3A, #0D1B24)";
      case "green":
        return "linear-gradient(135deg, #3CC25E, #2A9E47)";
      case "teal":
        return "linear-gradient(135deg, #1E8C80, #155F57)";
    }
  };

  const pillShadow = (color: "navy" | "green" | "teal") => {
    switch (color) {
      case "navy":
        return "inset -8px -8px 16px rgba(0,0,0,0.6), 6px 6px 20px rgba(28,43,58,0.3)";
      case "green":
        return "inset -8px -8px 16px rgba(0,0,0,0.3), 6px 6px 20px rgba(60,194,94,0.25)";
      case "teal":
        return "inset -8px -8px 16px rgba(0,0,0,0.4), 6px 6px 20px rgba(30,140,128,0.25)";
    }
  };

  return (
    <div className="concilia-login-wrapper">
      <style>{`
        .concilia-login-wrapper {
          --cl-bg: #0A1A1F;
          --cl-navy: #1C2B3A;
          --cl-green: #3CC25E;
          --cl-teal: #1E8C80;
          --cl-support: #2BB3A3;
          --cl-text: #FFFFFF;
          --cl-dim: rgba(255, 255, 255, 0.45);
          --cl-goo: url('#gooey-pills');

          background-color: var(--cl-bg);
          color: var(--cl-text);
          font-family: 'Montserrat', 'Inter', ui-sans-serif, system-ui, sans-serif;
          height: 100vh;
          width: 100vw;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .concilia-login-wrapper * {
          box-sizing: border-box;
          -webkit-font-smoothing: antialiased;
        }

        .cl-stage {
          position: absolute;
          width: 100%;
          height: 100%;
          z-index: 0;
          filter: var(--cl-goo);
          opacity: 0.5;
        }

        .cl-pill {
          position: absolute;
          border-radius: 999px;
          filter: blur(18px);
          animation: cl-float 20s infinite alternate ease-in-out;
          transition: margin 0.1s ease-out;
        }

        @keyframes cl-float {
          0%   { transform: translate(0, 0) scale(1) rotate(0deg); }
          25%  { transform: translate(8vw, 12vh) scale(1.15) rotate(3deg); }
          50%  { transform: translate(-4vw, 8vh) scale(0.85) rotate(-2deg); }
          75%  { transform: translate(6vw, -6vh) scale(1.1) rotate(1deg); }
          100% { transform: translate(3vw, -8vh) scale(1.05) rotate(-1deg); }
        }

        .cl-auth-container {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 440px;
          padding: 40px;
        }

        .cl-header {
          margin-bottom: 48px;
          text-align: left;
        }

        .cl-header h1 {
          font-weight: 800;
          font-size: 2.8rem;
          line-height: 0.95;
          letter-spacing: -1.5px;
          margin: 0 0 0 -3px;
        }

        .cl-header h1 .cl-green {
          color: var(--cl-green);
        }

        .cl-form-group {
          position: relative;
          margin-bottom: 28px;
          transition: transform 0.4s cubic-bezier(0.2, 1, 0.3, 1);
        }

        .cl-form-group:focus-within {
          transform: translateX(8px);
        }

        .cl-form-group label {
          display: block;
          font-size: 11px;
          font-weight: 500;
          color: var(--cl-dim);
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .cl-form-group input {
          width: 100%;
          background: transparent;
          border: none;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          color: var(--cl-text);
          padding: 12px 0;
          font-family: inherit;
          font-size: 16px;
          outline: none;
          transition: border-color 0.4s;
        }

        .cl-form-group input::placeholder {
          color: rgba(255, 255, 255, 0.2);
        }

        .cl-input-glow {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 0%;
          height: 2px;
          background: linear-gradient(90deg, var(--cl-teal), var(--cl-green));
          transition: width 0.6s cubic-bezier(0.2, 1, 0.3, 1);
          box-shadow: 0 0 12px var(--cl-teal);
        }

        .cl-form-group input:focus + .cl-input-glow {
          width: 100%;
        }

        .cl-submit-wrap {
          margin-top: 44px;
          position: relative;
          filter: var(--cl-goo);
        }

        .cl-btn-base {
          background: var(--cl-green);
          color: #0A1A1F;
          border: none;
          padding: 18px 40px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 2px;
          cursor: pointer;
          width: 100%;
          position: relative;
          z-index: 2;
          transition: letter-spacing 0.3s, background 0.3s;
        }

        .cl-btn-base:hover {
          letter-spacing: 3.5px;
          background: #45D468;
        }

        .cl-btn-base:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          letter-spacing: 2px;
        }

        .cl-mercury-drop {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, var(--cl-teal), var(--cl-green));
          transform: translate(-50%, -50%);
          z-index: 1;
          border-radius: 50px;
          transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .cl-submit-wrap:hover .cl-mercury-drop {
          transform: translate(-50%, -50%) scale(1.04, 1.15);
          filter: brightness(1.15);
        }

        .cl-footer-nav {
          margin-top: 36px;
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          font-weight: 500;
        }

        .cl-footer-nav a {
          color: var(--cl-dim);
          text-decoration: none;
          letter-spacing: 0.5px;
          transition: color 0.3s;
        }

        .cl-footer-nav a:hover {
          color: var(--cl-text);
        }

        .cl-svg-hidden {
          position: absolute;
          width: 0;
          height: 0;
        }
      `}</style>

      <svg className="cl-svg-hidden">
        <defs>
          <filter id="gooey-pills">
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      <div className="cl-stage">
        {pillsData.map((data, index) => (
          <div
            key={index}
            ref={(el) => { pillRefs.current[index] = el; }}
            className="cl-pill"
            style={{
              width: `${data.w}px`,
              height: `${data.h}px`,
              left: `${data.left}%`,
              top: `${data.top}%`,
              animationDelay: `${data.delay}s`,
              animationDuration: `${data.dur}s`,
              background: pillGradient(data.color),
              boxShadow: pillShadow(data.color),
            }}
          />
        ))}
      </div>

      <main className="cl-auth-container">
        <header className="cl-header">
          <h1>
            Acesse seu<br />
            escritório<span className="cl-green">.</span>
          </h1>
        </header>

        <form autoComplete="off" onSubmit={entrar}>
          <div className="cl-form-group">
            <label>E-mail</label>
            <input
              type="email"
              placeholder="seu@email.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="cl-input-glow" />
          </div>

          <div className="cl-form-group">
            <label>Senha</label>
            <input
              type="password"
              placeholder="••••••••"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
            <div className="cl-input-glow" />
          </div>

          <div className="cl-submit-wrap">
            <div className="cl-mercury-drop" />
            <button type="submit" className="cl-btn-base" disabled={carregando}>
              {carregando ? "Entrando..." : "Entrar"}
            </button>
          </div>
        </form>

        <footer className="cl-footer-nav">
          <a href="#recuperar">Esqueci minha senha</a>
          <a href="#ajuda">Preciso de ajuda</a>
        </footer>
      </main>
    </div>
  );
}
