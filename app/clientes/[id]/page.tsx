"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "../../../supabase";

type ClientInfo = {
  id: string;
  name: string;
  service_summary: string | null;
  logo_url: string | null;
  welcome_message: string | null;
};

export default function ClientWorkspacePreviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
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

        const { data, error: clientError } = await supabase
          .from("clients")
          .select("id, name, service_summary, logo_url, welcome_message")
          .eq("id", params.id)
          .single();

        if (clientError || !data) throw new Error("Não foi possível localizar esta empresa.");
        if (!active) return;
        setClient(data);

        if (data.logo_url) {
          const { data: signed, error: signedError } = await supabase
            .storage.from("client-logos").createSignedUrl(data.logo_url, 3600);
          if (!signedError && signed?.signedUrl && active) setLogoUrl(signed.signedUrl);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Ocorreu um erro ao abrir a empresa.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [params.id, router]);

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
  }

  if (loading) return <main className="app-shell"><p className="muted">Abrindo espaço da empresa...</p></main>;
  if (error || !client) return <main className="app-shell"><div className="notice">{error || "Empresa não encontrada."}</div><Link className="button" href="/clientes">Voltar aos clientes</Link></main>;

  return (
    <main className="vyra-dashboard">
      <aside className="vyra-sidebar">
        <Link className="vyra-wordmark" href="/dashboard">VYRA<span>.</span><span className="vyra-mark">✦</span></Link>
        <p className="sidebar-kicker">MÍDIA · HUB</p>
        <div className="sidebar-rule" />
        <p className="sidebar-label">ESPAÇO DE TRABALHO</p>
        <nav className="dashboard-nav">
          <Link className="nav-entry" href="/dashboard"><span className="nav-number">01</span><span className="nav-name">Visão geral</span></Link>
          <Link className="nav-entry selected" href="/clientes"><span className="nav-number">02</span><span className="nav-name">Clientes</span></Link>
        </nav>
        <div className="sidebar-signature"><span>✦</span><span>MENOS DO MESMO.<br />MAIS IMPACTO.</span></div>
      </aside>
      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="breadcrumb"><Link href="/clientes">CLIENTES</Link><i>/</i> {client.name.toUpperCase()}</div>
          <button className="dashboard-logout" onClick={signOut}>Sair da conta <span>↗</span></button>
        </header>
        <div className="dashboard-content">
          <div className="dashboard-overline">✦ ESPAÇO DA EMPRESA <span>·</span> VISÃO ADMINISTRATIVA</div>
          <div className="section">
            {logoUrl ? <img src={logoUrl} alt={`Logo de ${client.name}`} style={{ maxWidth: 180, maxHeight: 100, objectFit: "contain", marginBottom: 22 }} /> : <p className="hero-pretitle">ESPAÇO EXCLUSIVO DA EMPRESA</p>}
            <h1>Bem-vindo(a),<br /><em>{client.name}.</em></h1>
            <p className="hero-description">{client.welcome_message || "Este é o espaço da empresa na VYRA HUB. Aqui serão reunidos conteúdos, projetos e materiais."}</p>
            {client.service_summary && <p className="muted">{client.service_summary}</p>}
          </div>
          <div className="dashboard-section-heading">
            <div><p className="section-index">01 — ÁREA DA EMPRESA</p><h2>Próximos passos<span>.</span></h2></div>
            <span className="section-caption">VISUALIZAÇÃO ADMINISTRATIVA</span>
          </div>
          <div className="client-grid">
            <div className="client-card"><strong>Briefing</strong><span>Informações importantes sobre a marca.</span><small>Em preparação</small></div>
            <div className="client-card"><strong>Calendário</strong><span>Planejamento dos conteúdos.</span><small>Em preparação</small></div>
            <div className="client-card"><strong>Aprovações</strong><span>Revisão e aprovação de conteúdos.</span><small>Em preparação</small></div>
            <div className="client-card"><strong>Arquivos</strong><span>Materiais e entregas da empresa.</span><small>Em preparação</small></div>
          </div>
          <p className="clients-note">Esta é a primeira visualização do espaço da empresa. As ferramentas de conteúdo, briefing, aprovações e arquivos serão implementadas nas próximas etapas.</p>
          <Link className="button" href="/clientes">Voltar à carteira de clientes</Link>
        </div>
      </section>
    </main>
  );
}
