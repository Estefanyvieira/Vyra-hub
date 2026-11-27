"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../supabase";

type Client = { id: string; name: string };
type Post = {
  id: string;
  client_id: string;
  title: string;
  caption: string | null;
  format: string | null;
  scheduled_for: string | null;
  status: "draft" | "pending" | "approved" | "changes_requested" | "published";
};
const statusLabels: Record<Post["status"], string> = {
  draft: "Rascunho",
  pending: "Aguardando aprovação",
  approved: "Aprovado",
  changes_requested: "Ajustes solicitados",
  published: "Publicado",
};

export default function ContentPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedClient, setSelectedClient] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [format, setFormat] = useState("Reels");
  const [scheduledFor, setScheduledFor] = useState("");
  const [clientId, setClientId] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = supabaseBrowser();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.replace("/login"); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user.id).single();
      if (profile?.role !== "admin") { router.replace(profile?.role === "client" ? "/cliente" : "/login"); return; }
      const [{ data: clientRows, error: clientError }, { data: postRows, error: postError }] = await Promise.all([
        supabase.from("clients").select("id,name").order("name"),
        supabase.from("posts").select("id,client_id,title,caption,format,scheduled_for,status").order("scheduled_for", { ascending: true }),
      ]);
      if (!active) return;
      if (clientError || postError) setFeedback("Não foi possível carregar os dados. Atualize a página e tente novamente.");
      setClients(clientRows ?? []);
      setPosts(postRows ?? []);
      setClientId(clientRows?.[0]?.id ?? "");
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [router]);

  const visiblePosts = useMemo(() => posts.filter(post => selectedClient === "all" || post.client_id === selectedClient), [posts, selectedClient]);

  async function createPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clientId) { setFeedback("Cadastre uma empresa antes de criar uma publicação."); return; }
    setSaving(true); setFeedback("");
    const supabase = supabaseBrowser();
    const { data, error } = await supabase.from("posts").insert({
      client_id: clientId,
      title: title.trim(),
      caption: caption.trim() || null,
      format,
      scheduled_for: scheduledFor || null,
      status: "draft",
    }).select("id,client_id,title,caption,format,scheduled_for,status").single();
    if (error || !data) setFeedback(error?.message || "Não foi possível criar a publicação.");
    else {
      setPosts(current => [...current, data].sort((a,b) => (a.scheduled_for || "9999").localeCompare(b.scheduled_for || "9999")));
      setTitle(""); setCaption(""); setScheduledFor("");
      setFeedback("Publicação cadastrada como rascunho.");
    }
    setSaving(false);
  }

  async function updateStatus(post: Post, status: Post["status"]) {
    setFeedback("");
    const { error } = await supabaseBrowser().from("posts").update({ status }).eq("id", post.id);
    if (error) { setFeedback("Não foi possível atualizar o status da publicação."); return; }
    setPosts(current => current.map(item => item.id === post.id ? { ...item, status } : item));
  }

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
  }

  if (loading) return <main className="app-shell"><p className="muted">Carregando conteúdo...</p></main>;

  return <main className="vyra-dashboard">
    <aside className="vyra-sidebar">
      <Link className="vyra-wordmark" href="/dashboard">VYRA<span>.</span><span className="vyra-mark">✦</span></Link>
      <p className="sidebar-kicker">MÍDIA · HUB</p><div className="sidebar-rule" />
      <p className="sidebar-label">ESPAÇO DE TRABALHO</p>
      <nav className="dashboard-nav">
        <Link className="nav-entry" href="/dashboard"><span className="nav-number">01</span><span className="nav-name">Visão geral</span></Link>
        <Link className="nav-entry" href="/clientes"><span className="nav-number">02</span><span className="nav-name">Clientes</span></Link>
        <Link className="nav-entry selected" href="/conteudo"><span className="nav-number">03</span><span className="nav-name">Conteúdo</span><span className="nav-status">Ativo</span></Link>
        {[[ "04", "Aprovações" ], [ "05", "Arquivos" ], [ "06", "Financeiro" ]].map(([number,label]) => <div className="nav-entry disabled" key={number}><span className="nav-number">{number}</span><span className="nav-name">{label}</span><span className="nav-status">Em breve</span></div>)}
      </nav>
      <div className="sidebar-signature"><span>✦</span><span>MENOS DO MESMO.<br/>MAIS IMPACTO.</span></div>
    </aside>
    <section className="dashboard-main">
      <header className="dashboard-topbar"><div className="breadcrumb"><span>VYRA HUB</span><i>/</i> CONTEÚDO</div><button className="dashboard-logout" onClick={signOut}>Sair da conta ↗</button></header>
      <div className="dashboard-content">
        <div className="dashboard-overline">✦ PLANEJAMENTO EDITORIAL <span>·</span> 03 / 06</div>
        <div className="clients-page-heading"><div><p className="hero-pretitle">ESTRATÉGIA QUE GANHA FORMA.</p><h1>Conteúdo em<br/><em>movimento.</em></h1><p className="hero-description">Organize as publicações de cada empresa, defina datas e acompanhe o andamento.</p></div><div className="clients-total"><strong>{posts.length.toString().padStart(2,"0")}</strong><span>PUBLICAÇÕES</span></div></div>
        {feedback && <p className="success-message user-feedback" role="status">{feedback}</p>}
        <div className="dashboard-section-heading"><div><p className="section-index">01 — NOVA PUBLICAÇÃO</p><h2>Adicionar conteúdo<span>.</span></h2></div></div>
        <form className="user-admin-form" onSubmit={createPost}>
          <label>Empresa<select required value={clientId} onChange={e=>setClientId(e.target.value)}><option value="">Selecione uma empresa</option>{clients.map(client=><option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
          <label>Título da publicação<input required maxLength={160} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex.: 5 erros que prejudicam seus cílios"/></label>
          <label>Formato<select value={format} onChange={e=>setFormat(e.target.value)}><option>Reels</option><option>Carrossel</option><option>Post estático</option><option>Stories</option><option>Vídeo</option><option>Outro</option></select></label>
          <label>Data prevista<input type="date" value={scheduledFor} onChange={e=>setScheduledFor(e.target.value)}/></label>
          <label>Legenda / briefing<textarea rows={4} value={caption} onChange={e=>setCaption(e.target.value)} placeholder="Escreva a legenda ou orientações da publicação."/></label>
          <p className="user-form-note">A publicação será criada como rascunho. Você poderá organizar o status nesta mesma página.</p>
          <button className="button" disabled={saving || clients.length===0}>{saving ? "Salvando..." : "Cadastrar publicação"}</button>
        </form>
        <div className="dashboard-section-heading"><div><p className="section-index">02 — CALENDÁRIO EDITORIAL</p><h2>Publicações cadastradas<span>.</span></h2></div><select className="content-filter" value={selectedClient} onChange={e=>setSelectedClient(e.target.value)}><option value="all">Todas as empresas</option>{clients.map(client=><option key={client.id} value={client.id}>{client.name}</option>)}</select></div>
        {visiblePosts.length===0 ? <div className="clients-empty"><h3>Nenhuma publicação por aqui ainda.</h3><p>Cadastre a primeira publicação usando o formulário acima.</p></div> : <div className="content-post-list">{visiblePosts.map(post=><article className="content-post" key={post.id}>
          <div className="content-post-top"><span className="feature-tag">{clients.find(c=>c.id===post.client_id)?.name ?? "Empresa"}</span><span className="pill">{statusLabels[post.status]}</span></div>
          <h3>{post.title}</h3><p className="content-post-meta">{post.format || "Formato não definido"} · {post.scheduled_for ? new Date(post.scheduled_for+"T12:00:00").toLocaleDateString("pt-BR") : "Sem data definida"}</p>
          {post.caption && <p className="content-post-caption">{post.caption}</p>}
          <label className="status-control">Status<select value={post.status} onChange={e=>updateStatus(post,e.target.value as Post["status"])}>{Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        </article>)}</div>}
        <footer className="dashboard-footer"><span>VYRA MÍDIA © 2026</span><span>MENOS DO MESMO. <b>MAIS IMPACTO.</b></span></footer>
      </div>
    </section>
  </main>;
}
