"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "../../../supabase";

type ClientInfo = {
  id: string;
  name: string;
  service_summary: string | null;
  logo_url: string | null;
  welcome_message: string | null;
  brand_color: string | null;
};

export default function ClientWorkspacePreviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [serviceSummary, setServiceSummary] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [brandColor, setBrandColor] = useState("#B7A0A2");

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
          .from("profiles").select("role").eq("id", authData.user.id).single();

        if (profileError || !profile) throw new Error("Não foi possível validar seu acesso.");
        if (profile.role !== "admin") {
          router.replace(profile.role === "client" ? "/cliente" : "/login");
          return;
        }

        const { data, error: clientError } = await supabase
          .from("clients")
          .select("id, name, service_summary, logo_url, welcome_message, brand_color")
          .eq("id", params.id).single();

        if (clientError || !data) throw new Error("Não foi possível localizar esta empresa.");
        if (!active) return;
        setClient(data);
        setName(data.name);
        setServiceSummary(data.service_summary || "");
        setWelcomeMessage(data.welcome_message || "");
        setBrandColor(data.brand_color || "#B7A0A2");

        if (data.logo_url) {
          const { data: signed, error: signedError } = await supabase.storage
            .from("client-logos").createSignedUrl(data.logo_url, 3600);
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

  async function saveCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) return;
    setSaving(true); setError(""); setMessage("");
    const cleanName = name.trim();
    const cleanColor = /^#[0-9a-fA-F]{6}$/.test(brandColor) ? brandColor : "";
    if (!cleanName || cleanName.length > 120) {
      setError("Informe um nome de empresa com até 120 caracteres.");
      setSaving(false);
      return;
    }
    if (!cleanColor) {
      setError("Escolha uma cor válida para a identidade visual.");
      setSaving(false);
      return;
    }
    try {
      const supabase = supabaseBrowser();
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error("Sua sessão expirou. Entre novamente.");
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", authData.user.id).single();
      if (profile?.role !== "admin") throw new Error("Apenas a administração da VYRA pode editar a empresa.");

      const { error: updateError } = await supabase.from("clients").update({
        name: cleanName,
        service_summary: serviceSummary.trim() || null,
        welcome_message: welcomeMessage.trim() || null,
        brand_color: cleanColor,
      }).eq("id", client.id);
      if (updateError) throw updateError;

      setClient({ ...client, name: cleanName, service_summary: serviceSummary.trim() || null,
        welcome_message: welcomeMessage.trim() || null, brand_color: cleanColor });
      setEditing(false);
      setMessage("Dados e identidade visual atualizados com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar os dados da empresa.");
    } finally { setSaving(false); }
  }

  async function uploadLogo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !client) return;
    const extensions: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
    const extension = extensions[file.type];
    if (!extension) { setError("Escolha uma imagem PNG, JPG ou WEBP."); return; }
    if (file.size > 2 * 1024 * 1024) { setError("A logo deve ter no máximo 2 MB."); return; }

    setUploading(true); setError(""); setMessage("");
    const supabase = supabaseBrowser();
    const newPath = `${client.id}/logo.${extension}`;
    try {
      const { error: uploadError } = await supabase.storage.from("client-logos")
        .upload(newPath, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { error: updateError } = await supabase.from("clients")
        .update({ logo_url: newPath }).eq("id", client.id);
      if (updateError) throw updateError;

      if (client.logo_url && client.logo_url !== newPath) {
        const { error: removeError } = await supabase.storage.from("client-logos").remove([client.logo_url]);
        if (removeError) console.warn("A logo anterior não foi removida:", removeError.message);
      }
      const { data: signed, error: signedError } = await supabase.storage
        .from("client-logos").createSignedUrl(newPath, 3600);
      if (signedError || !signed?.signedUrl) throw new Error("Logo salva. Recarregue a página para atualizar a prévia.");
      setClient({ ...client, logo_url: newPath });
      setLogoUrl(signed.signedUrl);
      setMessage("Logo da empresa atualizada com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar a logo.");
    } finally { setUploading(false); }
  }

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
  }

  if (loading) return <main className="app-shell"><p className="muted">Abrindo espaço da empresa...</p></main>;
  if (error && !client) return <main className="app-shell"><div className="notice">{error}</div><Link className="button" href="/clientes">Voltar aos clientes</Link></main>;
  if (!client) return <main className="app-shell"><Link className="button" href="/clientes">Voltar aos clientes</Link></main>;

  return (
    <main className="vyra-dashboard">
      <aside className="vyra-sidebar">
        <Link className="vyra-wordmark" href="/dashboard">VYRA<span>.</span><span className="vyra-mark">✦</span></Link>
        <p className="sidebar-kicker">MÍDIA · HUB</p><div className="sidebar-rule" />
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
          {message && <p className="success-message user-feedback">{message}</p>}
          {error && <p className="error user-feedback">{error}</p>}
          <div className="section client-admin-preview" style={{ "--client-accent": client.brand_color || "#B7A0A2" } as React.CSSProperties}>
            {logoUrl ? <img src={logoUrl} alt={`Logo de ${client.name}`} className="client-admin-logo" /> : <p className="hero-pretitle">ESPAÇO EXCLUSIVO DA EMPRESA</p>}
            <h1>Bem-vindo(a),<br /><em>{client.name}.</em></h1>
            <p className="hero-description">{client.welcome_message || "Este é o espaço da empresa na VYRA HUB. Aqui serão reunidos conteúdos, projetos e materiais."}</p>
            {client.service_summary && <p className="muted">{client.service_summary}</p>}
            <div className="client-admin-color"><span>IDENTIDADE VISUAL</span><i style={{ background: client.brand_color || "#B7A0A2" }} />{client.brand_color || "#B7A0A2"}</div>
          </div>

          <div className="dashboard-section-heading">
            <div><p className="section-index">01 — PERSONALIZAÇÃO</p><h2>Identidade da empresa<span>.</span></h2></div>
            <button type="button" className="button" onClick={() => { setEditing(!editing); setError(""); setMessage(""); }}>
              {editing ? "Fechar edição" : "Editar empresa"}
            </button>
          </div>

          {editing && <form className="user-admin-form client-identity-form" onSubmit={saveCompany}>
            <label>Nome da empresa
              <input required maxLength={120} value={name} onChange={e => setName(e.target.value)} />
            </label>
            <label>Serviços contratados / descrição
              <textarea rows={3} maxLength={500} value={serviceSummary} onChange={e => setServiceSummary(e.target.value)} placeholder="Ex.: Gestão de redes sociais, fotografia e vídeos" />
            </label>
            <label>Mensagem de boas-vindas
              <textarea rows={3} maxLength={300} value={welcomeMessage} onChange={e => setWelcomeMessage(e.target.value)} placeholder="Mensagem exibida na página inicial do cliente" />
            </label>
            <label>Cor principal da identidade visual
              <div className="client-color-picker"><input aria-label="Selecionar cor" type="color" value={brandColor} onChange={e => setBrandColor(e.target.value)} /><input aria-label="Código hexadecimal da cor" value={brandColor} onChange={e => setBrandColor(e.target.value)} maxLength={7} /></div>
            </label>
            <button className="button" disabled={saving}>{saving ? "Salvando..." : "Salvar personalização"}</button>
          </form>}

          <div className="client-logo-admin">
            <div><p className="section-index">LOGO DA MARCA</p><p>Envie uma imagem PNG, JPG ou WEBP de até 2 MB. A logo será usada no espaço da empresa.</p></div>
            <label className="logo-upload-control">{uploading ? "Enviando..." : "Escolher nova logo"}
              <input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={uploadLogo} />
            </label>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 26 }}>
            <Link className="button" href={`/clientes/${client.id}/usuarios`}>Gerenciar usuários</Link>
            <Link className="button" href="/clientes" style={{ background: "transparent", color: "#e8d9f4", border: "1px solid #5c456f" }}>Voltar aos clientes</Link>
          </div>
          <div className="dashboard-section-heading">
            <div><p className="section-index">02 — ÁREA DA EMPRESA</p><h2>Próximos passos<span>.</span></h2></div>
            <span className="section-caption">VISUALIZAÇÃO ADMINISTRATIVA</span>
          </div>
          <div className="client-grid">
            <Link className="client-card" href={`/clientes/${client.id}/briefings`}><strong>Briefings</strong><span>Crie roteiros por vídeo, edite conteúdos e acompanhe as alterações dos clientes.</span><small>GERENCIAR BRIEFINGS ↗</small></Link>
            <div className="client-card"><strong>Calendário</strong><span>Planejamento dos conteúdos.</span><small>Em preparação</small></div>
            <div className="client-card"><strong>Aprovações</strong><span>Revisão e aprovação de conteúdos.</span><small>Em preparação</small></div>
            <div className="client-card"><strong>Arquivos</strong><span>Materiais e entregas da empresa.</span><small>Em preparação</small></div>
          </div>
          <p className="clients-note">Todos os usuários vinculados compartilham o mesmo espaço e a identidade visual desta empresa.</p>
        </div>
      </section>
    </main>
  );
}
