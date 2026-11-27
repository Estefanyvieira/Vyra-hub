"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../supabase";

type ClientRow = {
  id: string;
  name: string;
  service_summary: string | null;
  logo_url: string | null;
  created_at: string;
};

type PageState = "loading" | "ready" | "error";

function VyraStar({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M20 1.5 24.8 15.2 38.5 20 24.8 24.8 20 38.5 15.2 24.8 1.5 20 15.2 15.2 20 1.5Z" fill="currentColor" />
    </svg>
  );
}

export default function ClientsPage() {
  const router = useRouter();
  const [state, setState] = useState<PageState>("loading");
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [userCounts, setUserCounts] = useState<Record<string, number>>({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadClients() {
      try {
        const supabase = supabaseBrowser();
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) {
          router.replace("/login");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", authData.user.id)
          .single();

        if (profileError || !profile) throw new Error("Não foi possível validar seu acesso.");
        if (profile.role !== "admin") {
          router.replace(profile.role === "client" ? "/cliente" : "/login");
          return;
        }

        const { data, error } = await supabase
          .from("clients")
          .select("id, name, service_summary, logo_url, created_at")
          .order("created_at", { ascending: true });

        if (error) throw error;

        const { data: profiles, error: usersError } = await supabase
          .from("profiles")
          .select("client_id")
          .eq("role", "client");

        if (usersError) throw usersError;

        if (!active) return;
        const rows = data ?? [];
        const counts: Record<string, number> = {};
        (profiles ?? []).forEach((item) => {
          if (item.client_id) counts[item.client_id] = (counts[item.client_id] ?? 0) + 1;
        });
        setClients(rows);
        setUserCounts(counts);
        setState("ready");
      } catch (error) {
        if (active) {
          setMessage(error instanceof Error ? error.message : "Não foi possível carregar os clientes.");
          setState("error");
        }
      }
    }

    loadClients();
    return () => { active = false; };
  }, [router]);

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
  }

  if (state === "loading") return <main className="app-shell"><p className="muted">Carregando carteira de clientes...</p></main>;
  if (state === "error") return <main className="app-shell"><div className="notice">{message}</div><button className="button" onClick={signOut}>Sair</button></main>;

  return (
    <main className="vyra-dashboard">
      <aside className="vyra-sidebar">
        <Link className="vyra-wordmark" href="/dashboard" aria-label="VYRA Hub início">
          VYRA<span>.</span><VyraStar className="vyra-mark" />
        </Link>
        <p className="sidebar-kicker">MÍDIA · HUB</p>
        <div className="sidebar-rule" />
        <p className="sidebar-label">ESPAÇO DE TRABALHO</p>
        <nav className="dashboard-nav" aria-label="Navegação administrativa">
          <Link className="nav-entry" href="/dashboard"><span className="nav-number">01</span><span className="nav-name">Visão geral</span></Link>
          <Link className="nav-entry selected" href="/clientes"><span className="nav-number">02</span><span className="nav-name">Clientes</span><VyraStar className="nav-star" /></Link>
          {[[ "03", "Conteúdo" ], [ "04", "Aprovações" ], [ "05", "Arquivos" ], [ "06", "Financeiro" ]].map(([number, label]) => (
            <div className="nav-entry disabled" key={number}><span className="nav-number">{number}</span><span className="nav-name">{label}</span><span className="nav-status">Em breve</span></div>
          ))}
        </nav>
        <div className="sidebar-signature"><VyraStar className="signature-star" /><span>MENOS DO MESMO.<br />MAIS IMPACTO.</span></div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="breadcrumb"><span>VYRA HUB</span><i>/</i> CLIENTES</div>
          <button className="dashboard-logout" onClick={signOut}>Sair da conta <span>↗</span></button>
        </header>

        <div className="dashboard-content">
          <div className="dashboard-overline"><VyraStar className="overline-star" /> GESTÃO DE CLIENTES <span>·</span> 02 / 06</div>
          <div className="clients-page-heading">
            <div>
              <p className="hero-pretitle">RELACIONAMENTO, ORGANIZAÇÃO E ESTRATÉGIA.</p>
              <h1>Marcas que<br /><em>movem ideias.</em></h1>
              <p className="hero-description">Gerencie os espaços das empresas atendidas pela VYRA Mídia.</p>
            </div>
            <div className="clients-total"><VyraStar /><strong>{clients.length.toString().padStart(2, "0")}</strong><span>CLIENTE{clients.length === 1 ? "" : "S"} CADASTRADO{clients.length === 1 ? "" : "S"}</span></div>
          </div>

          <div className="dashboard-section-heading">
            <div><p className="section-index">01 — SUA CARTEIRA</p><h2>Clientes cadastrados<span>.</span></h2></div>
            <span className="section-caption">DADOS ATUALIZADOS DO SUPABASE</span>
          </div>

          {clients.length === 0 ? (
            <div className="clients-empty"><VyraStar /><h3>Nenhum cliente cadastrado ainda.</h3><p>Quando uma empresa for cadastrada, ela aparecerá aqui.</p></div>
          ) : (
            <div className="clients-list">
              {clients.map((client, index) => (
                <article className="managed-client-card" key={client.id}>
                  <div className="managed-client-number">{String(index + 1).padStart(2, "0")}</div>
                  <div className="managed-client-main">
                    <span className="feature-tag">CLIENTE VYRA</span>
                    <h3>{client.name}</h3>
                    <p>{client.service_summary || "Serviços e informações da empresa serão organizados neste espaço."}</p>
                    <div className="managed-client-meta"><span>{userCounts[client.id] ?? 0} / 6 usuários vinculados</span><span>{client.logo_url ? "Logo cadastrada" : "Logo pendente"}</span></div>
                  </div>
                  <div className="managed-client-action"><span className="client-active-dot" /> <small>CADASTRADO</small></div>
                </article>
              ))}
            </div>
          )}

          <div className="clients-note"><VyraStar /><p>Esta área mostra apenas empresas já cadastradas. O cadastro de novas empresas e o gerenciamento dos acessos serão adicionados na próxima etapa.</p></div>

          <footer className="dashboard-footer"><span>VYRA MÍDIA © 2026</span><span>MENOS DO MESMO. <b>MAIS IMPACTO.</b></span></footer>
        </div>
      </section>
    </main>
  );
}
