"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { supabaseBrowser } from "../../supabase";

type Theme = {
  accent: string;
  companyName: string;
  logoUrl: string;
};

export default function ClientAreaLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [theme, setTheme] = useState<Theme | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadTheme() {
      try {
        const supabase = supabaseBrowser();
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) {
          router.replace("/login");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role, client_id")
          .eq("id", auth.user.id)
          .single();

        if (profileError || !profile) throw new Error("Não foi possível identificar o perfil.");
        if (profile.role === "admin") {
          router.replace("/dashboard");
          return;
        }
        if (profile.role !== "client" || !profile.client_id) {
          throw new Error("Este acesso não está vinculado a uma empresa.");
        }

        const { data: company, error: companyError } = await supabase
          .from("clients")
          .select("name, brand_color, logo_url")
          .eq("id", profile.client_id)
          .single();

        if (companyError || !company) throw new Error("Não foi possível carregar a identidade da empresa.");

        let logoUrl = "";
        if (company.logo_url) {
          const { data } = await supabase.storage.from("client-logos").createSignedUrl(company.logo_url, 3600);
          logoUrl = data?.signedUrl ?? "";
        }

        if (active) setTheme({
          accent: company.brand_color || "#B7A0A2",
          companyName: company.name,
          logoUrl,
        });
      } catch {
        if (active) setFailed(true);
      }
    }

    loadTheme();
    return () => { active = false; };
  }, [router]);

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
  }

  if (failed) {
    return <main className="client-brand-loading"><p>Não foi possível preparar o espaço da empresa. Atualize a página ou entre novamente.</p><button onClick={() => router.replace("/login")}>Voltar ao acesso</button></main>;
  }

  if (!theme) return <main className="client-brand-loading"><p>Preparando o espaço da sua empresa...</p></main>;

  return (
    <div
      className="client-brand-environment"
      data-company={theme.companyName}
      style={{
        "--client-accent": theme.accent,
        "--client-background": "#050505",
        "--client-surface": "#0d090a",
        "--client-display-font": "'DM Serif Display', Georgia, serif",
      } as React.CSSProperties}
    >
      <header className="client-global-header">
        <Link href="/cliente" className="client-global-brand" aria-label="Início da empresa">
          {theme.logoUrl ? <img src={theme.logoUrl} alt={theme.companyName} /> : <span>{theme.companyName}</span>}
        </Link>
        <nav className="client-global-nav" aria-label="Navegação da empresa">
          <Link href="/cliente" className={pathname === "/cliente" ? "active" : ""}>INÍCIO</Link>
          <Link href="/cliente/calendario" className={pathname.startsWith("/cliente/calendario") ? "active" : ""}>CALENDÁRIO</Link>
          <Link href="/cliente/aprovacoes" className={pathname.startsWith("/cliente/aprovacoes") ? "active" : ""}>APROVAÇÕES</Link>
          <Link href="/cliente/arquivos" className={pathname.startsWith("/cliente/arquivos") ? "active" : ""}>ARQUIVOS</Link>
          <Link href="/cliente/financeiro" className={pathname.startsWith("/cliente/financeiro") ? "active" : ""}>FINANCEIRO</Link>
          <Link href="/cliente/portfolio" className={pathname.startsWith("/cliente/portfolio") ? "active" : ""}>PORTFÓLIO VYRA</Link>
        </nav>
        <button className="client-global-signout" onClick={signOut}>SAIR ↗</button>
      </header>
      {children}
      <footer className="client-platform-signature">✦ VYRA HUB</footer>
    </div>
  );
}
