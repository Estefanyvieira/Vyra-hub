"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../supabase";

type PageState = "loading" | "ready" | "error";

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
    return <main className="app-shell"><p className="muted">Carregando seu espaço VYRA...</p></main>;
  }

  if (state === "error") {
    return <main className="app-shell"><div className="notice">{message}</div><button className="button" onClick={signOut}>Sair</button></main>;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <div className="brand small">VYRA<span>.</span></div>
          <p className="eyebrow">HUB · ADMINISTRAÇÃO</p>
        </div>
        <button className="ghost" onClick={signOut}>Sair da conta</button>
      </header>

      <section>
        <p className="eyebrow">PAINEL ADMINISTRATIVO</p>
        <h1>Bem-vinda à <em>VYRA HUB.</em></h1>
        <p className="lead">Seu centro de gestão de clientes, conteúdo e projetos da VYRA Mídia.</p>
      </section>

      <section className="section">
        <h2>Seu ambiente de trabalho</h2>
        <p className="muted">A estrutura inicial do painel administrativo está sendo preparada. As próximas etapas vão incluir clientes, usuários, calendário editorial, aprovações, arquivos e financeiro.</p>
      </section>
    </main>
  );
}
