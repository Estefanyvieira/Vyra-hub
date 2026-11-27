"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../../supabase";

type Post = {
  id: string;
  client_id: string;
  title: string;
  caption: string | null;
  format: string | null;
  scheduled_for: string | null;
  status: "pending" | "approved" | "changes_requested" | "published" | "draft";
  media_path: string | null;
  media_type: string | null;
  media_name: string | null;
  media_url?: string | null;
};
type Comment = { id: string; post_id: string; author_id: string; body: string; created_at: string };

const labels: Record<Post["status"], string> = {
  pending: "Aguardando sua aprovação",
  approved: "Aprovado",
  changes_requested: "Ajustes solicitados",
  published: "Publicado",
  draft: "Rascunho",
};

export default function ClientApprovalsPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyPost, setBusyPost] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const supabase = supabaseBrowser();
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) { router.replace("/login"); return; }
        const { data: profile, error: profileError } = await supabase.from("profiles").select("role,client_id").eq("id", auth.user.id).single();
        if (profileError || !profile) throw new Error("Não foi possível identificar seu acesso.");
        if (profile.role === "admin") { router.replace("/dashboard"); return; }
        if (profile.role !== "client" || !profile.client_id) throw new Error("Este usuário não está vinculado a uma empresa.");

        const { data: rows, error: postsError } = await supabase
          .from("posts")
          .select("id,client_id,title,caption,format,scheduled_for,status,media_path,media_type,media_name")
          .eq("client_id", profile.client_id)
          .in("status", ["pending", "changes_requested"])
          .order("scheduled_for", { ascending: true });
        if (postsError) throw new Error("Não foi possível carregar as publicações para aprovação.");

        const withUrls = await Promise.all(((rows ?? []) as Post[]).map(async post => {
          if (!post.media_path) return post;
          const { data } = await supabase.storage.from("client-content").createSignedUrl(post.media_path, 3600);
          return { ...post, media_url: data?.signedUrl ?? null };
        }));
        const ids = withUrls.map(post => post.id);
        let commentRows: Comment[] = [];
        if (ids.length) {
          const { data, error: commentsError } = await supabase.from("comments").select("id,post_id,author_id,body,created_at").in("post_id", ids).order("created_at", { ascending: true });
          if (commentsError) throw new Error("Não foi possível carregar os comentários.");
          commentRows = (data ?? []) as Comment[];
        }
        if (!active) return;
        setPosts(withUrls);
        setComments(commentRows);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Não foi possível abrir as aprovações.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [router]);

  const pendingCount = useMemo(() => posts.filter(post => post.status === "pending").length, [posts]);

  async function changeStatus(post: Post, status: "approved" | "changes_requested") {
    setBusyPost(post.id);
    setFeedback("");
    const { error } = await supabaseBrowser().from("posts").update({ status }).eq("id", post.id).eq("client_id", post.client_id);
    if (error) {
      setFeedback("Não foi possível registrar sua decisão. Tente novamente ou entre em contato com a VYRA.");
      setBusyPost("");
      return;
    }
    setPosts(current => current.filter(item => item.id !== post.id));
    setFeedback(status === "approved" ? "Publicação aprovada." : "Solicitação de ajustes enviada à VYRA.");
    setBusyPost("");
  }

  async function sendComment(post: Post) {
    const body = (drafts[post.id] || "").trim();
    if (!body) { setFeedback("Escreva seu comentário antes de enviar."); return; }
    setBusyPost(post.id);
    setFeedback("");
    const supabase = supabaseBrowser();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { router.replace("/login"); return; }
    const { data, error } = await supabase.from("comments").insert({ post_id: post.id, author_id: auth.user.id, body }).select("id,post_id,author_id,body,created_at").single();
    if (error || !data) {
      setFeedback("Não foi possível enviar o comentário. Tente novamente.");
      setBusyPost("");
      return;
    }
    setComments(current => [...current, data as Comment]);
    setDrafts(current => ({ ...current, [post.id]: "" }));
    setFeedback("Comentário enviado à equipe VYRA.");
    setBusyPost("");
  }

  if (loading) return <main className="client-approvals-page"><p>Carregando aprovações...</p></main>;
  if (error) return <main className="client-approvals-page"><p className="client-approvals-error">{error}</p><Link href="/cliente">Voltar ao início</Link></main>;

  return <main className="client-approvals-page">
    <section className="client-approvals-content">
      <div className="client-approvals-heading">
        <div><p className="client-approvals-kicker">REVISÃO DE CONTEÚDO</p><h1>Aprovações<span>.</span></h1><p>Confira os materiais preparados para sua marca e conte à equipe se está tudo certo.</p></div>
        <div className="client-approvals-count"><strong>{pendingCount.toString().padStart(2, "0")}</strong><span>AGUARDANDO</span></div>
      </div>
      {feedback && <p className="client-approvals-feedback" role="status">{feedback}</p>}
      {posts.length === 0 ? <div className="client-approvals-empty"><span>✦</span><h2>Nenhuma publicação aguardando revisão.</h2><p>Quando a equipe VYRA enviar um novo conteúdo, ele aparecerá aqui.</p></div> :
        <div className="client-approval-list">{posts.map(post => <article className="client-approval-card" key={post.id}>
          <div className="client-approval-card-top"><span>{post.format || "CONTEÚDO"}</span><span className={post.status === "changes_requested" ? "is-changes" : ""}>{labels[post.status]}</span></div>
          <h2>{post.title}</h2>
          <p className="client-approval-date">{post.scheduled_for ? "DATA PREVISTA · " + new Date(post.scheduled_for + "T12:00:00").toLocaleDateString("pt-BR") : "SEM DATA PREVISTA"}</p>
          {post.media_url ? (post.media_type?.startsWith("video/") ? <video className="client-approval-media" src={post.media_url} controls playsInline /> : <img className="client-approval-media" src={post.media_url} alt={post.media_name || post.title} />) : <div className="client-approval-no-media">A equipe ainda não anexou uma foto ou vídeo.</div>}
          {post.caption && <div className="client-approval-caption"><h3>Legenda / texto da publicação</h3><p>{post.caption}</p></div>}
          <div className="client-approval-comments"><h3>Conversa sobre esta publicação</h3>
            {comments.filter(comment => comment.post_id === post.id).map(comment => <div className="client-approval-comment" key={comment.id}><p>{comment.body}</p><small>{comment.created_at ? new Date(comment.created_at).toLocaleString("pt-BR") : ""}</small></div>)}
            <textarea value={drafts[post.id] || ""} onChange={event => setDrafts(current => ({ ...current, [post.id]: event.target.value }))} placeholder="Escreva uma observação ou explique o ajuste necessário..." rows={3} />
            <button className="client-approval-comment-button" onClick={() => sendComment(post)} disabled={busyPost === post.id}>ENVIAR COMENTÁRIO</button>
          </div>
          <div className="client-approval-actions">
            <button className="client-approval-revise" onClick={() => changeStatus(post, "changes_requested")} disabled={busyPost === post.id}>SOLICITAR ALTERAÇÕES</button>
            <button className="client-approval-approve" onClick={() => changeStatus(post, "approved")} disabled={busyPost === post.id}>✓ APROVAR PUBLICAÇÃO</button>
          </div>
        </article>)}</div>}
    </section>
  </main>;
}
