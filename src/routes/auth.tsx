import { useState, useEffect, useMemo, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — P&A Contabilidade Digital" },
      {
        name: "description",
        content: "Acesso ao sistema de contabilidade da P&A Contabilidade Digital.",
      },
      { property: "og:title", content: "P&A Contabilidade Digital" },
      {
        property: "og:description",
        content: "Sistema de conciliação e contabilidade digital da P&A.",
      },
    ],
  }),
  component: AuthPage,
});

type PillColor = "blue" | "graphite" | "sky";

function AuthPage() {
  const navigate = useNavigate();
  const [carregando, setCarregando] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const pillsData = useMemo(() => {
    const seed = [
      { w: 220, h: 70, left: 5, top: 12, delay: 0, dur: 22, color: "graphite" as PillColor },
      { w: 180, h: 55, left: 60, top: 8, delay: -4, dur: 26, color: "blue" as PillColor },
      { w: 260, h: 80, left: 15, top: 65, delay: -8, dur: 20, color: "blue" as PillColor },
      { w: 150, h: 50, left: 70, top: 70, delay: -12, dur: 24, color: "graphite" as PillColor },
      { w: 200, h: 65, left: 40, top: 35, delay: -6, dur: 28, color: "sky" as PillColor },
      { w: 170, h: 55, left: -5, top: 45, delay: -15, dur: 23, color: "graphite" as PillColor },
      { w: 240, h: 75, left: 50, top: 50, delay: -10, dur: 25, color: "blue" as PillColor },
      { w: 140, h: 45, left: 25, top: 85, delay: -3, dur: 21, color: "sky" as PillColor },
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

  // Marca P&A: azul #0072CE e grafite #3A3A3A (manual de identidade).
  const pillGradient = (color: PillColor) => {
    switch (color) {
      case "blue":
        return "linear-gradient(135deg, #0072CE, #0058A3)";
      case "graphite":
        return "linear-gradient(135deg, #3A3A3A, #1E1E1E)";
      case "sky":
        return "linear-gradient(135deg, #3D9BE9, #0072CE)";
    }
  };

  const pillShadow = (color: PillColor) => {
    switch (color) {
      case "blue":
        return "inset -8px -8px 16px rgba(0,0,0,0.35), 6px 6px 20px rgba(0,114,206,0.3)";
      case "graphite":
        return "inset -8px -8px 16px rgba(0,0,0,0.6), 6px 6px 20px rgba(58,58,58,0.3)";
      case "sky":
        return "inset -8px -8px 16px rgba(0,0,0,0.3), 6px 6px 20px rgba(61,155,233,0.25)";
    }
  };

  return (
    <div className="pa-login-wrapper">
      <style>{`
        .pa-login-wrapper {
          --pa-bg: #0B1622;
          --pa-blue: #0072CE;
          --pa-sky: #3D9BE9;
          --pa-graphite: #3A3A3A;
          --pa-text: #FFFFFF;
          --pa-dim: rgba(255, 255, 255, 0.45);
          --pa-goo: url('#gooey-pills');

          background-color: var(--pa-bg);
          color: var(--pa-text);
          font-family: 'Montserrat', 'Inter', ui-sans-serif, system-ui, sans-serif;
          height: 100vh;
          width: 100vw;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .pa-login-wrapper * {
          box-sizing: border-box;
          -webkit-font-smoothing: antialiased;
        }

        .pa-stage {
          position: absolute;
          width: 100%;
          height: 100%;
          z-index: 0;
          filter: var(--pa-goo);
          opacity: 0.5;
        }

        .pa-pill {
          position: absolute;
          border-radius: 999px;
          filter: blur(18px);
          animation: pa-float 20s infinite alternate ease-in-out;
          transition: margin 0.1s ease-out;
        }

        @keyframes pa-float {
          0%   { transform: translate(0, 0) scale(1) rotate(0deg); }
          25%  { transform: translate(8vw, 12vh) scale(1.15) rotate(3deg); }
          50%  { transform: translate(-4vw, 8vh) scale(0.85) rotate(-2deg); }
          75%  { transform: translate(6vw, -6vh) scale(1.1) rotate(1deg); }
          100% { transform: translate(3vw, -8vh) scale(1.05) rotate(-1deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .pa-pill { animation: none; }
        }

        .pa-auth-container {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 440px;
          padding: 40px;
        }

        .pa-brand {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 40px;
        }

        .pa-brand-icon {
          width: 52px;
          height: 52px;
          flex-shrink: 0;
          filter: drop-shadow(0 8px 24px rgba(0, 114, 206, 0.45));
        }

        .pa-brand-name {
          font-weight: 800;
          font-size: 1.75rem;
          line-height: 1;
          letter-spacing: -0.5px;
        }

        .pa-brand-sub {
          margin-top: 5px;
          font-size: 0.625rem;
          font-weight: 500;
          letter-spacing: 1.6px;
          text-transform: uppercase;
          color: var(--pa-dim);
        }

        .pa-header {
          margin-bottom: 40px;
          text-align: left;
        }

        .pa-header h1 {
          font-weight: 800;
          font-size: 2.4rem;
          line-height: 1;
          letter-spacing: -1.2px;
          margin: 0 0 0 -2px;
        }

        .pa-header h1 .pa-accent {
          color: var(--pa-sky);
        }

        .pa-header p {
          margin: 12px 0 0;
          font-size: 0.8125rem;
          color: var(--pa-dim);
        }

        .pa-form-group {
          position: relative;
          margin-bottom: 28px;
          transition: transform 0.4s cubic-bezier(0.2, 1, 0.3, 1);
        }

        .pa-form-group:focus-within {
          transform: translateX(8px);
        }

        .pa-form-group label {
          display: block;
          font-size: 11px;
          font-weight: 500;
          color: var(--pa-dim);
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .pa-form-group input {
          width: 100%;
          background: transparent;
          border: none;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          color: var(--pa-text);
          padding: 12px 0;
          font-family: inherit;
          font-size: 16px;
          outline: none;
          transition: border-color 0.4s;
        }

        .pa-form-group input::placeholder {
          color: rgba(255, 255, 255, 0.2);
        }

        .pa-input-glow {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 0%;
          height: 2px;
          background: linear-gradient(90deg, var(--pa-blue), var(--pa-sky));
          transition: width 0.6s cubic-bezier(0.2, 1, 0.3, 1);
          box-shadow: 0 0 12px var(--pa-blue);
        }

        .pa-form-group input:focus + .pa-input-glow {
          width: 100%;
        }

        .pa-submit-wrap {
          margin-top: 44px;
          position: relative;
          filter: var(--pa-goo);
        }

        .pa-btn-base {
          background: var(--pa-blue);
          color: #FFFFFF;
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

        .pa-btn-base:hover {
          letter-spacing: 3.5px;
          background: #1A84DB;
        }

        .pa-btn-base:focus-visible {
          outline: 2px solid var(--pa-sky);
          outline-offset: 3px;
        }

        .pa-btn-base:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          letter-spacing: 2px;
        }

        .pa-mercury-drop {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, var(--pa-blue), var(--pa-sky));
          transform: translate(-50%, -50%);
          z-index: 1;
          border-radius: 50px;
          transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .pa-submit-wrap:hover .pa-mercury-drop {
          transform: translate(-50%, -50%) scale(1.04, 1.15);
          filter: brightness(1.15);
        }

        .pa-footer-nav {
          margin-top: 36px;
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          font-weight: 500;
        }

        .pa-footer-nav a {
          color: var(--pa-dim);
          text-decoration: none;
          letter-spacing: 0.5px;
          transition: color 0.3s;
        }

        .pa-footer-nav a:hover {
          color: var(--pa-text);
        }

        .pa-svg-hidden {
          position: absolute;
          width: 0;
          height: 0;
        }
      `}</style>

      <svg className="pa-svg-hidden">
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

      <div className="pa-stage">
        {pillsData.map((data, index) => (
          <div
            key={index}
            ref={(el) => {
              pillRefs.current[index] = el;
            }}
            className="pa-pill"
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

      <main className="pa-auth-container">
        <div className="pa-brand">
          <svg className="pa-brand-icon" viewBox="0 0 56 56" fill="none" aria-hidden="true">
            <rect
              x="10"
              y="10"
              width="36"
              height="36"
              rx="10"
              transform="rotate(45 28 28)"
              fill="#0072CE"
            />
            <path d="M28 17v11" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
            <path
              d="M20.5 21a11 11 0 1 0 15 0"
              stroke="#fff"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
          <div>
            <div className="pa-brand-name">P&amp;A</div>
            <div className="pa-brand-sub">Contabilidade Digital</div>
          </div>
        </div>

        <header className="pa-header">
          <h1>
            Acesse o<br />
            sistema<span className="pa-accent">.</span>
          </h1>
          <p>Conciliação, documentos e competências dos seus clientes em um só lugar.</p>
        </header>

        <form autoComplete="off" onSubmit={entrar}>
          <div className="pa-form-group">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              placeholder="seu@email.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="pa-input-glow" />
          </div>

          <div className="pa-form-group">
            <label htmlFor="senha">Senha</label>
            <input
              id="senha"
              type="password"
              placeholder="••••••••"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
            <div className="pa-input-glow" />
          </div>

          <div className="pa-submit-wrap">
            <div className="pa-mercury-drop" />
            <button type="submit" className="pa-btn-base" disabled={carregando}>
              {carregando ? "Entrando..." : "Entrar"}
            </button>
          </div>
        </form>

        <footer className="pa-footer-nav">
          <a href="#recuperar">Esqueci minha senha</a>
          <a href="#ajuda">Preciso de ajuda</a>
        </footer>
      </main>
    </div>
  );
}
