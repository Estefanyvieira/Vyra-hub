"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../supabase";

type Status = "draft" | "pending" | "approved" | "changes_requested" | "published";
type Post = {
  id: string; client_id: string; title: string; caption: string | null;
  format: string | null; scheduled_for: string | null; status: Status;
  media_path: string | null; media_type: string | null; media_name: string | null;
  media_url?: string | null; client_name?: string;
};
type Comment = { id: string; post_id: string; author_id: string; body: string; created_at: string; author_name?: string; author_role?: string };
type Filter = "all" | "pending" | "changes_requested" | "approved" | "published";
const labels: Record<Status, string> = {
  draft: "Rascunho", pending: "Aguardando aprovação", approved: "Aprovado",
  changes_requested: "Ajustes solicitados", published: "Publicado"
};
const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "Todos" }, { value: "pending", label: "Pendentes" },
  { value: "changes_requested", label: "Ajustes solicitados" },
  { value: "approved", label: "Aprovados" }, { value: "published", label: "Publicados" }
];

export default function AdminApprovalsPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<Filter>("pending");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const supabase = supabaseBrowser();
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) { router.replace("/login"); return; }
        const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", auth.user.id).single();
        if (profileError || !profile) throw new Error("Não foi possível identificar seu acesso.");
        if (profile.role !== "admin") { router.replace(profile.role === "client" ? "/cliente" : "/login"); return; }

        const [{ data: clientRows, error: clientsError }, { data: postRows, error: postsError }] = await Promise.all([
          supabase.from("clients").select("id,name").order("name"),
          supabase.from("posts").select("id,client_id,title,caption,format,scheduled_for,status,media_path,media_type,media_name").order("scheduled_for", { ascending: true })
        ]);
        if (clientsError || postsError) throw new Error("Não foi possível carregar as publicações da agência.");
        const clientNames = new Map((clientRows ?? []).map((client: {id:string;name:string}) => [client.id, client.name]));
        const withMedia = await Promise.all(((postRows ?? []) as Post[]).map(async post => {
          if (!post.media_path) return { ...post, client_name: clientNames.get(post.client_id) || "Empresa" };
          const { data } = await supabase.storage.from("client-content").createSignedUrl(post.media_path, 600);
          return { ...post, client_name: clientNames.get(post.client_id) || "Empresa", media_url: data?.signedUrl ?? null };
        }));
        const ids = withMedia.map(post => post.id);
        let commentRows: Comment[] = [];
        if (ids.length) {
          const { data, error: commentsError } = await supabase.from("comments").select("id,post_id,author_id,body,created_at").in("post_id", ids).order("created_at", { ascending: true });
          if (commentsError) throw new Error("Não foi possível carregar a conversa das publicações.");
          const raw = (data ?? []) as Comment[];
          const authorIds = [...new Set(raw.map(comment => comment.author_id))];
          let authorMap = new Map<string, {name:string;role:string}>();
          if (authorIds.length) {
            const { data: people } = await supabase.from("profiles").select("id,full_name,role").in("id", authorIds);
            authorMap = new Map((people ?? []).map((person: {id:string;full_name:string|null;role:string}) => [person.id, { name: person.full_name || (person.role === "admin" ? "Equipe VYRA" : "Cliente"), role: person.role }]));
          }
          commentRows = raw.map(comment => ({ ...comment, author_name: authorMap.get(comment.author_id)?.name || "Usuário", author_role: authorMap.get(comment.author_id)?.role }));
        }
        if (!active) return;
        setPosts(withMedia);
        setComments(commentRows);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Não foi possível abrir a central.");
      } finally { if (active) setLoading(false); }
    }
    load();
    return () => { active = false; };
  }, [router]);

  const visible = useMemo(() => filter === "all" ? posts : posts.filter(post => post.status === filter), [posts, filter]);
  const counts = useMemo(() => ({
    pending: posts.filter(p => p.status === "pending").length,
    changes: posts.filter(p => p.status === "changes_requested").length,
    approved: posts.filter(p => p.status === "approved").length,
    published: posts.filter(p => p.status === "published").length
  }), [posts]);

  async function changeStatus(post: Post, status: Status) {
    setBusy(post.id); setFeedback("");
    const { error } = await supabaseBrowser().from("posts").update({ status }).eq("id", post.id);
    if (error) setFeedback("Não foi possível atualizar o status. Confira sua conexão e tente novamente.");
    else {
      setPosts(current => current.map(item => item.id === post.id ? { ...item, status } : item));
      setFeedback("Status atualizado: " + labels[status] + ".");
    }
    setBusy("");
  }

  async function sendComment(post: Post) {
    const body = (drafts[post.id] || "").trim();
    if (!body) { setFeedback("Escreva uma mensagem antes de enviar."); return; }
    setBusy(post.id); setFeedback("");
    const supabase = supabaseBrowser();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { router.replace("/login"); return; }
    const { data, error } = await supabase.from("comments").insert({ post_id: post.id, author_id: auth.user.id, body }).select("id,post_id,author_id,body,created_at").single();
    if (error || !data) setFeedback("Não foi possível enviar a mensagem.");
    else {
      setComments(current => [...current, { ...data as Comment, author_name: "Equipe VYRA", author_role: "admin" }]);
      setDrafts(current => ({ ...current, [post.id]: "" }));
      setFeedback("Mensagem enviada ao cliente.");
    }
    setBusy("");
  }

  async function signOut() { await supabaseBrowser().auth.signOut(); router.replace("/login"); }

  if (loading) return <main className="app-shell"><p className="muted">Carregando central de aprovações...</p></main>;
  if (error) return <main className="app-shell"><p className="notice">{error}</p><Link href="/dashboard">Voltar ao painel</Link></main>;

  return <main className="vyra-dashboard">
    <aside className="vyra-sidebar">
      <Link className="vyra-wordmark" href="/dashboard">VYRA<span>.</span><span className="vyra-mark">✦</span></Link>
      <p className="sidebar-kicker">MÍDIA · HUB</p><div className="sidebar-rule" /><p className="sidebar-label">ESPAÇO DE TRABALHO</p>
      <nav className="dashboard-nav">
        <Link className="nav-entry" href="/dashboard"><span className="nav-number">01</span><span className="nav-name">Visão geral</span></Link>
        <Link className="nav-entry" href="/clientes"><span className="nav-number">02</span><span className="nav-name">Clientes</span></Link>
        <Link className="nav-entry" href="/conteudo"><span className="nav-number">03</span><span className="nav-name">Conteúdo</span></Link>
        <Link className="nav-entry selected" href="/aprovacoes"><span className="nav-number">04</span><span className="nav-name">Aprovações</span><span className="nav-status">Ativo</span></Link>
        <div className="nav-entry disabled"><span className="nav-number">05</span><span className="nav-name">Arquivos</span><span className="nav-status">Em breve</span></div>
        <div className="nav-entry disabled"><span className="nav-number">06</span><span className="nav-name">Financeiro</span><span className="nav-status">Em breve</span></div>
      </nav>
      <div className="sidebar-signature"><span>✦</span><span>MENOS DO MESMO.<br/>MAIS IMPACTO.</span></div>
    </aside>
    <section className="dashboard-main">
      <header className="dashboard-topbar"><div className="breadcrumb"><span>VYRA HUB</span><i>/</i> APROVAÇÕES</div><button className="dashboard-logout" onClick={signOut}>Sair da conta ↗</button></header>
      <div className="dashboard-content">
        <div className="dashboard-overline">✦ CONTROLE DE QUALIDADE <span>·</span> 04 / 06</div>
        <div className="clients-page-heading">
          <div><p className="hero-pretitle">CADA DETALHE SOB CONTROLE.</p><h1>Central de<br/><em>aprovações.</em></h1><p className="hero-description">Acompanhe as decisões dos clientes, converse sobre cada publicação e organize o que ainda precisa ser feito.</p></div>
          <div className="clients-total"><strong>{counts.pending.toString().padStart(2,"0")}</strong><span>AGUARDANDO</span></div>
        </div>
        <div className="approval-admin-summary">
          <div><strong>{counts.pending}</strong><span>PENDENTES</span></div><div><strong>{counts.changes}</strong><span>AJUSTES</span></div><div><strong>{counts.approved}</strong><span>APROVADOS</span></div><div><strong>{counts.published}</strong><span>PUBLICADOS</span></div>
        </div>
        {feedback && <p className="success-message user-feedback" role="status">{feedback}</p>}
        <div className="approval-admin-filters" role="tablist" aria-label="Filtrar publicações">
          {filters.map(item => <button key={item.value} className={filter === item.value ? "approval-admin-filter active" : "approval-admin-filter"} onClick={() => setFilter(item.value)}>{item.label}{item.value !== "all" ? <span>{item.value === "changes_requested" ? counts.changes : counts[item.value as "pending" | "approved" | "published"]}</span> : <span>{posts.length}</span>}</button>)}
        </div>
        {visible.length === 0 ? <div className="clients-empty"><span>✦</span><h3>Nenhuma publicação nesta etapa.</h3><p>Quando houver conteúdos neste status, eles aparecerão aqui.</p></div> :
          <div className="approval-admin-list">{visible.map(post => <article className="approval-admin-card" key={post.id}>
            <div className="approval-admin-card-head"><div><span className="approval-admin-client">{post.client_name}</span><h2>{post.title}</h2><p>{post.format || "Conteúdo"} · {post.scheduled_for ? new Date(post.scheduled_for + "T12:00:00").toLocaleDateString("pt-BR") : "Sem data prevista"}</p></div><span className={"approval-admin-status status-" + post.status}>{labels[post.status]}</span></div>
            {post.media_url ? (post.media_type?.startsWith("video/") ? <video className="approval-admin-media" src={post.media_url} controls playsInline controlsList="nodownload noplaybackrate" disablePictureInPicture /> : <img className="approval-admin-media" src={post.media_url} alt={post.media_name || post.title} />) : <div className="approval-admin-no-media">Nenhum arquivo anexado a esta publicação.</div>}
            {post.caption && <div className="approval-admin-caption"><h3>Legenda / texto</h3><p>{post.caption}</p></div>}
            <div className="approval-admin-conversation"><h3>Conversa com o cliente</h3>
              {comments.filter(comment => comment.post_id === post.id).length === 0 ? <p className="approval-admin-no-comments">Ainda não há comentários nesta publicação.</p> : comments.filter(comment => comment.post_id === post.id).map(comment => <div className="approval-admin-comment" key={comment.id}><strong>{comment.author_name}{comment.author_role === "admin" ? " · VYRA" : " · CLIENTE"}</strong><p>{comment.body}</p><small>{new Date(comment.created_at).toLocaleString("pt-BR")}</small></div>)}
              <textarea rows={3} value={drafts[post.id] || ""} onChange={event => setDrafts(current => ({ ...current, [post.id]: event.target.value }))} placeholder="Escreva uma mensagem para o cliente..." />
              <button className="approval-admin-send" onClick={() => sendComment(post)} disabled={busy === post.id}>{busy === post.id ? "ENVIANDO..." : "ENVIAR MENSAGEM"}</button>
            </div>
            <div className="approval-admin-actions">
              {post.status !== "approved" && <button onClick={() => changeStatus(post, "approved")} disabled={busy === post.id}>✓ MARCAR COMO APROVADO</button>}
              {post.status !== "changes_requested" && <button className="needs-change" onClick={() => changeStatus(post, "changes_requested")} disabled={busy === post.id}>SOLICITAR AJUSTES</button>}
              {post.status !== "published" && <button className="mark-published" onClick={() => changeStatus(post, "published")} disabled={busy === post.id}>MARCAR COMO PUBLICADO</button>}
              {post.status !== "pending" && <button className="reset-pending" onClick={() => changeStatus(post, "pending")} disabled={busy === post.id}>VOLTAR PARA PENDENTE</button>}
            </div>
          </article>)}</div>}
        <footer className="dashboard-footer"><span>VYRA MÍDIA © 2026</span><span>MENOS DO MESMO. <b>MAIS IMPACTO.</b></span></footer>
      </div>
    </section>
  </main>;
}
