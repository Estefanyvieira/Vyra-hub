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
  media_path: string | null;
  media_type: string | null;
  media_name: string | null;
  media_url?: string | null;
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
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  async function attachSignedUrls(rows: Post[]) {
    const supabase = supabaseBrowser();
    return Promise.all(rows.map(async post => {
      if (!post.media_path) return post;
      const { data } = await supabase.storage.from("client-content").createSignedUrl(post.media_path, 3600);
      return { ...post, media_url: data?.signedUrl ?? null };
    }));
  }

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
        supabase.from("posts").select("id,client_id,title,caption,format,scheduled_for,status,media_path,media_type,media_name").order("scheduled_for", { ascending: true }),
      ]);
      if (!active) return;
      if (clientError || postError) setFeedback("Não foi possível carregar os dados. Atualize a página e tente novamente.");
      setClients(clientRows ?? []);
      setPosts(await attachSignedUrls((postRows ?? []) as Post[]));
      setClientId(clientRows?.[0]?.id ?? "");
      setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [router]);

  const visiblePosts = useMemo(() => posts.filter(post => selectedClient === "all" || post.client_id === selectedClient), [posts, selectedClient]);

  const calendarCells = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
    return Array.from({ length: totalCells }, (_, index) => {
      const day = index - firstWeekday + 1;
      return day > 0 && day <= daysInMonth ? new Date(year, month, day) : null;
    });
  }, [calendarMonth]);

  const postsByDate = useMemo(() => {
    const grouped: Record<string, Post[]> = {};
    visiblePosts.forEach(post => {
      if (!post.scheduled_for) return;
      grouped[post.scheduled_for] ??= [];
      grouped[post.scheduled_for].push(post);
    });
    return grouped;
  }, [visiblePosts]);

  function dateKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function calendarPostClass(status: Post["status"]) {
    if (status === "pending") return "calendar-event calendar-event-pending";
    if (status === "changes_requested") return "calendar-event calendar-event-changes";
    if (status === "approved") return "calendar-event calendar-event-approved";
    if (status === "published") return "calendar-event calendar-event-published";
    return "calendar-event calendar-event-draft";
  }

  function chooseFile(file: File | null) {
    setFeedback("");
    if (!file) { setMediaFile(null); return; }
    const allowed = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime", "video/webm"];
    if (!allowed.includes(file.type)) {
      setMediaFile(null);
      setFeedback("Formato não permitido. Envie JPG, PNG, WEBP, MP4, MOV ou WEBM.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setMediaFile(null);
      setFeedback("O arquivo ultrapassa o limite de 50 MB.");
      return;
    }
    setMediaFile(file);
  }

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
      status: "pending",
    }).select("id,client_id,title,caption,format,scheduled_for,status,media_path,media_type,media_name").single();
    if (error || !data) {
      setFeedback("Não foi possível criar a publicação. Confira os dados e tente novamente.");
      setSaving(false);
      return;
    }

    let newPost = data as Post;
    if (mediaFile) {
      const safeName = mediaFile.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "arquivo";
      const path = `${clientId}/${data.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("client-content").upload(path, mediaFile, { contentType: mediaFile.type, upsert: false });
      if (uploadError) {
        setFeedback("A publicação foi criada, mas o anexo não foi enviado. Tente novamente.");
        setPosts(current => [...current, newPost]);
        setSaving(false);
        return;
      }
      const { error: updateError } = await supabase.from("posts").update({
        media_path: path, media_type: mediaFile.type, media_name: mediaFile.name,
      }).eq("id", data.id);
      if (updateError) {
        setFeedback("O arquivo foi enviado, mas não foi possível vinculá-lo à publicação.");
        setPosts(current => [...current, newPost]);
        setSaving(false);
        return;
      }
      const { data: signed } = await supabase.storage.from("client-content").createSignedUrl(path, 3600);
      newPost = { ...newPost, media_path: path, media_type: mediaFile.type, media_name: mediaFile.name, media_url: signed?.signedUrl ?? null };
    }

    setPosts(current => [...current, newPost].sort((a,b) => (a.scheduled_for || "9999").localeCompare(b.scheduled_for || "9999")));
    setTitle(""); setCaption(""); setScheduledFor(""); setMediaFile(null);
    const fileInput = document.getElementById("content-media-file") as HTMLInputElement | null;
    if (fileInput) fileInput.value = "";
    setFeedback("Publicação enviada automaticamente para aprovação" + (newPost.media_path ? " com anexo." : "."));
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
          <label>Anexar foto ou vídeo<input id="content-media-file" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" onChange={e=>chooseFile(e.target.files?.[0] ?? null)}/></label>
          <p className="user-form-note">Formatos aceitos: JPG, PNG, WEBP, MP4, MOV e WEBM. Limite de 50 MB por arquivo. O anexo ficará privado e vinculado à empresa selecionada.</p>
          {mediaFile && <div className="content-file-preview"><strong>Arquivo selecionado:</strong> {mediaFile.name} ({(mediaFile.size / (1024 * 1024)).toFixed(1)} MB)</div>}
          <p className="user-form-note">Ao cadastrar, a publicação será enviada automaticamente para aprovação do cliente e aparecerá em vermelho no calendário.</p>
          <button className="button" disabled={saving || clients.length===0}>{saving ? "Salvando..." : "Cadastrar publicação"}</button>
        </form>
        <div className="dashboard-section-heading"><div><p className="section-index">02 — CALENDÁRIO EDITORIAL</p><h2>Publicações cadastradas<span>.</span></h2></div><select className="content-filter" value={selectedClient} onChange={e=>setSelectedClient(e.target.value)}><option value="all">Todas as empresas</option>{clients.map(client=><option key={client.id} value={client.id}>{client.name}</option>)}</select></div>
        <div className="editorial-calendar">
          <div className="calendar-heading">
            <div><p className="section-index">AGENDA DE POSTAGENS</p><h3>{calendarMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</h3></div>
            <div className="calendar-navigation">
              <button type="button" aria-label="Mês anterior" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}>‹</button>
              <button type="button" onClick={() => setCalendarMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Hoje</button>
              <button type="button" aria-label="Próximo mês" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}>›</button>
            </div>
          </div>
          <div className="calendar-legend">
            <span><i className="legend-dot legend-red" />Aguardando aprovação</span>
            <span><i className="legend-dot legend-orange" />Alteração solicitada · alerta</span>
            <span><i className="legend-dot legend-green" />Aprovado</span>
            <span><i className="legend-dot legend-purple" />Publicado</span>
            <span><i className="legend-dot legend-muted" />Rascunho</span>
          </div>
          <div className="calendar-grid">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(day => <div className="calendar-weekday" key={day}>{day}</div>)}
            {calendarCells.map((date, index) => {
              const key = date ? dateKey(date) : `empty-${index}`;
              const dayPosts = date ? (postsByDate[dateKey(date)] ?? []) : [];
              const today = date && dateKey(date) === dateKey(new Date());
              return <div className={`calendar-day${date ? "" : " calendar-day-empty"}${today ? " calendar-day-today" : ""}`} key={key}>
                {date && <><span className="calendar-day-number">{date.getDate()}</span><div className="calendar-day-events">
                  {dayPosts.map(post => <div className={calendarPostClass(post.status)} key={post.id} title={`${post.title} — ${statusLabels[post.status]}`}>
                    <strong>{post.title}</strong><small>{post.status === "pending" ? "Aguardando aprovação" : post.status === "changes_requested" ? "ALTERAÇÃO NECESSÁRIA" : statusLabels[post.status]}</small>
                  </div>)}
                </div></>}
              </div>;
            })}
          </div>
          <p className="calendar-note">As publicações com data prevista aparecem automaticamente neste calendário. Ao mudar o status, a cor é atualizada.</p>
        </div>
        {visiblePosts.length===0 ? <div className="clients-empty"><h3>Nenhuma publicação por aqui ainda.</h3><p>Cadastre a primeira publicação usando o formulário acima.</p></div> : <div className="content-post-list">{visiblePosts.map(post=><article className="content-post" key={post.id}>
          <div className="content-post-top"><span className="feature-tag">{clients.find(c=>c.id===post.client_id)?.name ?? "Empresa"}</span><span className="pill">{statusLabels[post.status]}</span></div>
          <h3>{post.title}</h3><p className="content-post-meta">{post.format || "Formato não definido"} · {post.scheduled_for ? new Date(post.scheduled_for+"T12:00:00").toLocaleDateString("pt-BR") : "Sem data definida"}</p>
          {post.caption && <p className="content-post-caption">{post.caption}</p>}
          {post.media_path && <div className="content-post-media"><p><strong>Anexo:</strong> {post.media_name || "Arquivo"}</p>{post.media_url ? (post.media_type?.startsWith("video/") ? <video src={post.media_url} controls /> : <a href={post.media_url} target="_blank" rel="noreferrer"><img src={post.media_url} alt={post.media_name || "Anexo da publicação"}/></a>) : <p>Prévia indisponível no momento.</p>}</div>}
          <label className="status-control">Status<select value={post.status} onChange={e=>updateStatus(post,e.target.value as Post["status"])}>{Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        </article>)}</div>}
        <footer className="dashboard-footer"><span>VYRA MÍDIA © 2026</span><span>MENOS DO MESMO. <b>MAIS IMPACTO.</b></span></footer>
      </div>
    </section>
  </main>;
}
