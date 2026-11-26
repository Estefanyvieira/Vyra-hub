"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../supabase";

type ClientInfo = {
  name: string;
  logo_url: string | null;
  welcome_message: string | null;
};

type PageState = "loading" | "ready" | "error";

export default function ClientHomePage() {
  const router = useRouter();
  const [state, setState] = useState<PageState>("loading");
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadClientSpace() {
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

        if (profile.role === "admin") {
          router.replace("/dashboard");
          return;
        }

        if (profile.role !== "client" || !profile.client_id) {
          throw new Error("Este usuário não está vinculado a uma empresa.");
        }

        const { data: company, error: companyError } = await supabase
          .from("clients")
          .select("name, logo_url, welcome_message")
          .eq("id", profile.client_id)
          .single();

        if (companyError || !company) {
          throw new Error("Não foi possível carregar os dados da empresa.");
        }

        if (!active) return;

        setClient(company);

        if (company.logo_url) {
          const { data: signed, error: signedError } = await supabase
            .storage
            .from("client-logos")
            .createSignedUrl(company.logo_url, 3600);

          if (!signedError && signed?.signedUrl) setLogoUrl(signed.signedUrl);
        }

        if (active) setState("ready");
      } catch (error) {
        if (active) {
          setMessage(error instanceof Error ? error.message : "Não foi possível carregar seu espaço.");
          setState("error");
        }
      }
    }

    loadClientSpace();
    return () => {
      active = false;
    };
  }, [router]);

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
  }

  if (state === "loading") {
    return <main className="app-shell"><p className="muted">Preparando seu espaço...</p></main>;
  }

  if (state === "error") {
    return <main className="app-shell"><div className="notice">{message}</div><button className="button" onClick={signOut}>Sair</button></main>;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand small">VYRA<span>.</span></div>
        <button className="ghost" onClick={signOut}>Sair da conta</button>
      </header>

      <section className="section">
        {logoUrl ? (
          <img src={logoUrl} alt={`Logo de ${client?.name ?? "sua empresa"}`} style={{ maxWidth: 180, maxHeight: 100, objectFit: "contain", marginBottom: 22 }} />
        ) : (
          <p className="eyebrow">ESPAÇO EXCLUSIVO DA EMPRESA</p>
        )}
        <h1>Bem-vindo(a), {client?.name}.</h1>
        <p className="lead">{client?.welcome_message || "Este é o espaço da sua empresa na VYRA HUB. Aqui você poderá acompanhar seus conteúdos, projetos e materiais."}</p>
      </section>

      <section className="section">
        <h2>Seus próximos passos</h2>
        <div className="client-grid">
          <div className="client-card"><strong>Briefing</strong><span>Compartilhe informações importantes sobre sua marca.</span><small>Em preparação</small></div>
          <div className="client-card"><strong>Calendário</strong><span>Acompanhe o planejamento dos conteúdos.</span><small>Em preparação</small></div>
          <div className="client-card"><strong>Aprovações</strong><span>Revise conteúdos e envie solicitações de ajustes.</span><small>Em preparação</small></div>
          <div className="client-card"><strong>Arquivos</strong><span>Encontre materiais e entregas da sua empresa.</span><small>Em preparação</small></div>
        </div>
      </section>
    </main>
  );
}
