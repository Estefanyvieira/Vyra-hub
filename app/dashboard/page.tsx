"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../supabase";

type PageState = "loading" | "ready" | "error";

function VyraStar({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M20 1.5 24.8 15.2 38.5 20 24.8 24.8 20 38.5 15.2 24.8 1.5 20 15.2 15.2 20 1.5Z" fill="currentColor" />
    </svg>
  );
}

const sections = [
  ["01", "Visão geral", "Ativo"],
  ["02", "Clientes", "Em breve"],
  ["03", "Conteúdo", "Abrir"],
  ["04", "Aprovações", "Em breve"],
  ["05", "Arquivos", "Em breve"],
  ["06", "Financeiro", "Em breve"],
];

export default function DashboardPage() {
  const router = useRouter();
  const [state, setState] = useState<PageState>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadAccess() {
      try {
        const supabase = supabaseBrowser();
        const { data: authData, error: authError } = await supabase.auth.getUser();

        if (authError || !authData.user) {
          router.replace("/login");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role, client_id")
          .eq("id", authData.user.id)
          .single();

        if (profileError || !profile) {
          throw new Error("Não foi possível localizar seu perfil de acesso.");
        }

        if (profile.role === "client") {
          router.replace("/cliente");
          return;
        }

        if (profile.role !== "admin") {
          throw new Error("Seu perfil não possui uma permissão reconhecida.");
        }

        if (active) setState("ready");
      } catch (error) {
        if (active) {
          setMessage(error instanceof Error ? error.message : "Não foi possível carregar o painel.");
          setState("error");
        }
      }
    }

    loadAccess();
    return () => {
      active = false;
    };
  }, [router]);

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
  }

  if (state === "loading") {
    return <main className="app-shell"><p className="muted">Preparando seu espaço VYRA...</p></main>;
  }

  if (state === "error") {
    return <main className="app-shell"><div className="notice">{message}</div><button className="button" onClick={signOut}>Sair</button></main>;
  }

  return (
    <main className="vyra-dashboard">
      <aside className="vyra-sidebar">
        <a className="vyra-wordmark" href="/dashboard" aria-label="VYRA Hub início">
          VYRA<span>.</span><VyraStar className="vyra-mark" />
        </a>
        <p className="sidebar-kicker">MÍDIA · HUB</p>
        <div className="sidebar-rule" />
        <p className="sidebar-label">ESPAÇO DE TRABALHO</p>
        <nav className="dashboard-nav" aria-label="Navegação administrativa">
          {sections.map(([number, label, status], index) => (
            index === 1 ? (
              <a className="nav-entry" href="/clientes" key={number}>
                <span className="nav-number">{number}</span>
                <span className="nav-name">{label}</span>
                <span className="nav-status">Abrir</span>
              </a>
            ) : (
              <div className={index === 0 ? "nav-entry selected" : "nav-entry disabled"} key={number}>
                <span className="nav-number">{number}</span>
                <span className="nav-name">{label}</span>
                {index === 0 ? <VyraStar className="nav-star" /> : <span className="nav-status">{status}</span>}
              </div>
            )
          ))}
        </nav>
        <div className="sidebar-signature">
          <VyraStar className="signature-star" />
          <span>MENOS DO MESMO.<br />MAIS IMPACTO.</span>
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="breadcrumb"><span>VYRA HUB</span><i>/</i> ADMINISTRAÇÃO</div>
          <button className="dashboard-logout" onClick={signOut}>Sair da conta <span>↗</span></button>
        </header>

        <div className="dashboard-content">
          <div className="dashboard-overline"><VyraStar className="overline-star" /> PAINEL ADMINISTRATIVO <span>·</span> 01 / 06</div>
          <div className="dashboard-hero">
            <div>
              <p className="hero-pretitle">ESTE É O SEU CENTRO DE COMANDO.</p>
              <h1>Ideias em movimento.<br /><em>Marcas em evolução.</em></h1>
              <p className="hero-description">Bem-vinda ao seu espaço de gestão. Aqui, estratégia, criatividade e organização trabalham juntas.</p>
            </div>
            <div className="hero-symbol-wrap" aria-hidden="true">
              <div className="hero-orbit orbit-one" />
              <div className="hero-orbit orbit-two" />
              <VyraStar className="hero-star" />
            </div>
          </div>

          <div className="dashboard-section-heading">
            <div>
              <p className="section-index">01 — CENTRAL DE OPERAÇÕES</p>
              <h2>Seu ambiente de trabalho<span>.</span></h2>
            </div>
            <span className="section-caption">VYRA MÍDIA · HUB</span>
          </div>

          <div className="dashboard-feature">
            <div className="feature-symbol"><VyraStar /></div>
            <div className="feature-copy">
              <span className="feature-tag">ESTRUTURA EM CONSTRUÇÃO</span>
              <h3>Um espaço. Todas as conexões.</h3>
              <p>Estamos preparando as áreas de clientes, usuários, calendário editorial, aprovações, arquivos e financeiro para centralizar a operação da VYRA.</p>
            </div>
            <div className="feature-index">VYRA<br /><strong>001</strong></div>
          </div>

          <footer className="dashboard-footer">
            <span>VYRA MÍDIA © 2026</span>
            <span>MENOS DO MESMO. <b>MAIS IMPACTO.</b></span>
          </footer>
        </div>
      </section>
    </main>
  );
}
