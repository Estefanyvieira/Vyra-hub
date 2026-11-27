"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../../supabase";

type ClientInfo = { id: string; name: string; logo_url: string | null; brand_color: string | null };
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

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function ClientCalendarPage() {
  const router = useRouter();
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const supabase = supabaseBrowser();
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) { router.replace("/login"); return; }
        const { data: profile, error: profileError } = await supabase.from("profiles").select("role,client_id").eq("id", auth.user.id).single();
        if (profileError || !profile) throw new Error("Não foi possível localizar seu acesso.");
        if (profile.role === "admin") { router.replace("/dashboard"); return; }
        if (profile.role !== "client" || !profile.client_id) throw new Error("Este usuário não está vinculado a uma empresa.");

        const [{ data: company, error: companyError }, { data: rows, error: postsError }] = await Promise.all([
          supabase.from("clients").select("id,name,logo_url,brand_color").eq("id", profile.client_id).single(),
          supabase.from("posts").select("id,client_id,title,caption,format,scheduled_for,status,media_path,media_type,media_name").eq("client_id", profile.client_id).order("scheduled_for", { ascending: true }),
        ]);
        if (companyError || !company) throw new Error("Não foi possível carregar a identidade da empresa.");
        if (postsError) throw new Error("Não foi possível carregar o calendário de publicações.");
        const withUrls = await Promise.all(((rows ?? []) as Post[]).map(async post => {
          if (!post.media_path) return post;
          const { data } = await supabase.storage.from("client-content").createSignedUrl(post.media_path, 3600);
          return { ...post, media_url: data?.signedUrl ?? null };
        }));
        if (!active) return;
        setClient(company);
        setPosts(withUrls);
        if (company.logo_url) {
          const { data } = await supabase.storage.from("client-logos").createSignedUrl(company.logo_url, 3600);
          if (active) setLogoUrl(data?.signedUrl ?? "");
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Não foi possível abrir o calendário.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [router]);

  const cells = useMemo(() => {
    const year = month.getFullYear();
    const m = month.getMonth();
    const offset = new Date(year, m, 1).getDay();
    const count = new Date(year, m + 1, 0).getDate();
    const total = Math.ceil((offset + count) / 7) * 7;
    return Array.from({ length: total }, (_, i) => {
      const day = i - offset + 1;
      return day > 0 && day <= count ? new Date(year, m, day) : null;
    });
  }, [month]);

  const postsByDate = useMemo(() => {
    const grouped: Record<string, Post[]> = {};
    posts.forEach(post => {
      if (!post.scheduled_for) return;
      (grouped[post.scheduled_for] ??= []).push(post);
    });
    return grouped;
  }, [posts]);

  if (loading) return <main className="client-calendar-page"><p>Preparando seu calendário...</p></main>;
  if (error || !client) return <main className="client-calendar-page"><p className="client-calendar-error">{error || "Não foi possível carregar o calendário."}</p><Link href="/cliente">Voltar ao espaço da empresa</Link></main>;

  const accent = client.brand_color || "#A47376";
  return <main className="client-calendar-page" style={{ "--client-accent": accent } as React.CSSProperties}>
    <header className="client-calendar-topbar">
      <Link href="/cliente" className="client-calendar-back">← Espaço da empresa</Link>
      {logoUrl ? <img src={logoUrl} alt={client.name} className="client-calendar-logo" /> : <span className="client-calendar-company">{client.name}</span>}
      <span className="client-calendar-top-label">CALENDÁRIO EDITORIAL</span>
    </header>

    <section className="client-calendar-content">
      <div className="client-calendar-title-row">
        <div><p className="client-calendar-kicker">PLANEJAMENTO DE CONTEÚDO</p><h1>{client.name}</h1><p className="client-calendar-subtitle">Seu conteúdo, organizado em um só lugar.</p></div>
        <div className="client-calendar-month">{month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</div>
      </div>
      <div className="client-calendar-controls">
        <div className="client-calendar-status-key">
          <span><i className="status-pending"/>Aguardando</span><span><i className="status-changes"/>Ajustes</span><span><i className="status-approved"/>Aprovado</span><span><i className="status-published"/>Publicado</span>
        </div>
        <div className="client-calendar-nav">
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Mês anterior">‹</button>
          <button onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Hoje</button>
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Próximo mês">›</button>
        </div>
      </div>
      <div className="client-calendar-grid">
        {["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"].map(day => <div className="client-calendar-weekday" key={day}>{day}</div>)}
        {cells.map((date, index) => {
          const dayPosts = date ? postsByDate[dateKey(date)] ?? [] : [];
          const today = date && dateKey(date) === dateKey(new Date());
          return <div key={date ? dateKey(date) : `blank-${index}`} className={`client-calendar-day${date ? "" : " is-empty"}${today ? " is-today" : ""}`}>
            {date && <><span className="client-calendar-day-number">{date.getDate()}</span><div className="client-calendar-day-posts">
              {dayPosts.map(post => <button key={post.id} className={`client-calendar-post status-${post.status}`} onClick={() => setSelectedPost(post)} title={`Abrir ${post.title}`}>
                <span>{post.title}</span>{post.media_path && <small>{post.media_type?.startsWith("video/") ? "VÍDEO" : "FOTO"}</small>}
              </button>)}
            </div></>}
          </div>;
        })}
      </div>
      <p className="client-calendar-footnote">Clique em uma publicação para abrir a foto ou o vídeo, conferir a legenda e consultar o status sem sair do calendário.</p>
    </section>

    {selectedPost && <div className="client-post-modal-backdrop" role="presentation" onClick={() => setSelectedPost(null)}>
      <section className="client-post-modal" role="dialog" aria-modal="true" aria-labelledby="client-post-modal-title" onClick={event => event.stopPropagation()}>
        <button className="client-post-modal-close" onClick={() => setSelectedPost(null)} aria-label="Fechar">×</button>
        <p className="client-calendar-kicker">PUBLICAÇÃO · {selectedPost.scheduled_for ? new Date(selectedPost.scheduled_for + "T12:00:00").toLocaleDateString("pt-BR") : "SEM DATA"}</p>
        <h2 id="client-post-modal-title">{selectedPost.title}</h2>
        <div className="client-post-modal-meta"><span>{selectedPost.format || "Conteúdo"}</span><span>{statusLabels[selectedPost.status]}</span></div>
        {selectedPost.media_url ? (selectedPost.media_type?.startsWith("video/") ? <video className="client-post-modal-media" src={selectedPost.media_url} controls playsInline /> : <img className="client-post-modal-media" src={selectedPost.media_url} alt={selectedPost.media_name || selectedPost.title} />) : <div className="client-post-no-media">Ainda não há foto ou vídeo anexado a esta publicação.</div>}
        {selectedPost.caption && <div className="client-post-modal-caption"><h3>Legenda</h3><p>{selectedPost.caption}</p></div>}
      </section>
    </div>}
  </main>;
}
