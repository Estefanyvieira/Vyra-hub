"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../supabase";

type ClientInfo = {
  id: string;
  name: string;
  logo_url: string | null;
  welcome_message: string | null;
  brand_color: string | null;
};

type PageState = "loading" | "ready" | "error";

export default function ClientHomePage() {
  const router = useRouter();
  const [state, setState] = useState<PageState>("loading");
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState("");

  useEffect(() => {
    const updateWelcome = () => {
      const content = document.querySelector<HTMLElement>(".client-home-content");
      if (!content) return;
      const progress = Math.min(1, Math.max(0, window.scrollY / 420));
      content.style.setProperty("--welcome-progress", progress.toFixed(3));
    };

    updateWelcome();
    window.addEventListener("scroll", updateWelcome, { passive: true });
    return () => window.removeEventListener("scroll", updateWelcome);
  }, []);

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
          .select("id, name, logo_url, welcome_message, brand_color")
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

          if (!signedError && signed?.signedUrl && active) setLogoUrl(signed.signedUrl);
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

  async function uploadLogo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !client) return;

    const allowedTypes: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
    };

    const extension = allowedTypes[file.type];
    if (!extension) {
      setUploadFeedback("Escolha uma imagem PNG, JPG ou WEBP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadFeedback("A imagem deve ter no máximo 2 MB.");
      return;
    }

    setUploading(true);
    setUploadFeedback("");
    const supabase = supabaseBrowser();
    const newPath = `${client.id}/logo.${extension}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from("client-logos")
        .upload(newPath, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from("clients")
        .update({ logo_url: newPath })
        .eq("id", client.id);

      if (updateError) {
        await supabase.storage.from("client-logos").remove([newPath]);
        throw updateError;
      }

      if (client.logo_url && client.logo_url !== newPath) {
        await supabase.storage.from("client-logos").remove([client.logo_url]);
      }

      const { data: signed, error: signedError } = await supabase.storage
        .from("client-logos")
        .createSignedUrl(newPath, 3600);

      if (signedError || !signed?.signedUrl) {
        throw new Error("A logo foi salva, mas não foi possível atualizar a prévia. Recarregue a página.");
      }

      setClient({ ...client, logo_url: newPath });
      setLogoUrl(signed.signedUrl);
      setUploadFeedback("Logo atualizada com sucesso!");
    } catch (error) {
      setUploadFeedback(error instanceof Error ? error.message : "Não foi possível enviar a logo.");
    } finally {
      setUploading(false);
    }
  }

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
  }

  if (state === "loading") {
    return <main className="client-brand-loading"><p>Preparando seu espaço...</p></main>;
  }

  if (state === "error") {
    return <main className="client-brand-loading"><div className="notice">{message}</div><button onClick={signOut}>Sair da conta</button></main>;
  }

  return (
    <main
      className="client-home-shell client-home-redesigned"
      style={{ "--client-accent": client?.brand_color || "#B7A0A2" } as React.CSSProperties}
    >
      <div className="client-home-content">
        <section className="client-welcome-panel">
          <div className="client-welcome-mark" aria-hidden="true">{logoUrl ? <img src={logoUrl} alt="" /> : <span>{client?.name?.slice(0, 1).toUpperCase()}</span>}</div>
          <div className="client-welcome-copy">
            <p className="client-home-kicker">SEU ESPAÇO · SUA MARCA</p>
            <h1>Bem-vindo(a),<br /><em>{client?.name}.</em></h1>
            <p>{client?.welcome_message || "Este é o espaço exclusivo da sua empresa. Aqui você acompanha conteúdos, projetos, aprovações e materiais desenvolvidos para sua marca."}</p>
          </div>
        </section>

        <section className="client-home-section">
          <div className="client-home-section-heading">
            <div><p className="client-home-kicker">CENTRAL DA EMPRESA</p><h2>O que você precisa?</h2></div>
            <span className="client-home-section-number">01 / 04</span>
          </div>
          <div className="client-home-modules">
            <a className="client-home-module client-home-module-active" href="/cliente/calendario">
              <span className="client-home-module-number">01</span>
              <span className="client-home-module-icon">▦</span>
              <strong>Calendário editorial</strong>
              <span className="client-home-module-description">Acompanhe datas, publicações e conteúdos programados.</span>
              <span className="client-home-module-action">ACESSAR <b>↗</b></span>
            </a>
            <div className="client-home-module">
              <span className="client-home-module-number">02</span>
              <span className="client-home-module-icon">✳</span>
              <strong>Briefing</strong>
              <span className="client-home-module-description">Compartilhe informações e detalhes importantes da sua marca.</span>
              <span className="client-home-module-status">EM PREPARAÇÃO</span>
            </div>
            <a className="client-home-module client-home-module-active" href="/cliente/aprovacoes">
              <span className="client-home-module-number">03</span>
              <span className="client-home-module-icon">✓</span>
              <strong>Aprovações</strong>
              <span className="client-home-module-description">Revise conteúdos e envie solicitações de ajustes.</span>
              <span className="client-home-module-action">ACESSAR <b>↗</b></span>
            </a>
            <a className="client-home-module client-home-module-active" href="/cliente/arquivos">
              <span className="client-home-module-number">04</span>
              <span className="client-home-module-icon">⌑</span>
              <strong>Arquivos e entregas</strong>
              <span className="client-home-module-description">Encontre materiais e arquivos da sua empresa.</span>
              <span className="client-home-module-action">ACESSAR <b>↗</b></span>
            </a>
            <a className="client-home-module client-home-module-active" href="/cliente/financeiro">
              <span className="client-home-module-number">05</span>
              <span className="client-home-module-icon">＄</span>
              <strong>Financeiro</strong>
              <span className="client-home-module-description">Consulte seu pacote, pagamentos e histórico financeiro.</span>
              <span className="client-home-module-action">ACESSAR <b>↗</b></span>
            </a>
            <a className="client-home-module client-home-module-active" href="/cliente/portfolio">
              <span className="client-home-module-number">06</span>
              <span className="client-home-module-icon">✦</span>
              <strong>Portfólio VYRA</strong>
              <span className="client-home-module-description">Descubra serviços que podem complementar sua marca.</span>
              <span className="client-home-module-action">CONHECER <b>↗</b></span>
            </a>
          </div>
        </section>

        <section className="client-brand-settings">
          <div>
            <p className="client-home-kicker">PERSONALIZAÇÃO</p>
            <h2>Identidade da sua empresa</h2>
            <p>Você pode atualizar a logo que aparece neste espaço. As demais configurações são gerenciadas pela equipe responsável.</p>
          </div>
          <div className="client-logo-control">
            <div className="client-logo-preview">{logoUrl ? <img src={logoUrl} alt={`Logo de ${client?.name}`} /> : <span>LOGO</span>}</div>
            <label htmlFor="company-logo" className="client-logo-upload-button">{uploading ? "ENVIANDO..." : "TROCAR LOGO"}</label>
            <input id="company-logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadLogo} disabled={uploading} />
            <small>PNG, JPG ou WEBP · máximo de 2 MB</small>
            {uploadFeedback && <small className="client-logo-feedback" role="status">{uploadFeedback}</small>}
          </div>
        </section>
      </div>
    </main>
  );
}
