"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../supabase";

type Service = { id: string; name: string; description: string | null; category: string; price: number | null; price_label: string | null; is_portfolio_visible: boolean; active: boolean; display_order: number };

export default function AdminPortfolioPage() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Complementar");
  const [price, setPrice] = useState("");
  const [priceLabel, setPriceLabel] = useState("");
  const [visible, setVisible] = useState(true);
  const [active, setActive] = useState(true);
  useEffect(() => {
    let mounted = true;
    async function load() {
      const supabase = supabaseBrowser();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.replace("/login"); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user.id).single();
      if (profile?.role !== "admin") { router.replace(profile?.role === "client" ? "/cliente" : "/login"); return; }
      const { data, error } = await supabase.from("services").select("*").order("display_order").order("created_at", { ascending: false });
      if (!mounted) return;
      if (error) setMessage(error.message); else setServices(data ?? []);
      setLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, [router]);
  function resetForm() { setEditing(null); setName(""); setDescription(""); setCategory("Complementar"); setPrice(""); setPriceLabel(""); setVisible(true); setActive(true); }
  function editService(s: Service) { setEditing(s.id); setName(s.name); setDescription(s.description ?? ""); setCategory(s.category); setPrice(s.price === null ? "" : String(s.price)); setPriceLabel(s.price_label ?? ""); setVisible(s.is_portfolio_visible); setActive(s.active); setMessage(""); }
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setMessage("");
    const payload = { name: name.trim(), description: description.trim() || null, category: category.trim() || "Complementar", price: price.trim() ? Number(price.replace(",", ".")) : null, price_label: priceLabel.trim() || null, is_portfolio_visible: visible, active, updated_at: new Date().toISOString() };
    const supabase = supabaseBrowser();
    const result = editing ? await supabase.from("services").update(payload).eq("id", editing) : await supabase.from("services").insert(payload);
    if (result.error) setMessage(result.error.message);
    else {
      const { data } = await supabase.from("services").select("*").order("display_order").order("created_at", { ascending: false });
      setServices(data ?? []); resetForm(); setMessage("Serviço salvo. A visibilidade no portfólio foi atualizada.");
    }
    setSaving(false);
  }
  async function signOut() { await supabaseBrowser().auth.signOut(); router.replace("/login"); }
  if (loading) return <main className="app-shell"><p className="muted">Carregando portfólio...</p></main>;
  return (
    <main className="vyra-dashboard">
      <aside className="vyra-sidebar">
        <Link className="vyra-wordmark" href="/dashboard">VYRA<span>.</span></Link><p className="sidebar-kicker">MÍDIA · HUB</p><div className="sidebar-rule" /><p className="sidebar-label">ESPAÇO DE TRABALHO</p>
        <nav className="dashboard-nav">
          <Link className="nav-entry" href="/dashboard"><span className="nav-number">01</span><span className="nav-name">Visão geral</span></Link>
          <Link className="nav-entry" href="/clientes"><span className="nav-number">02</span><span className="nav-name">Clientes</span></Link>
          <Link className="nav-entry" href="/conteudo"><span className="nav-number">03</span><span className="nav-name">Conteúdo</span></Link>
          <Link className="nav-entry" href="/aprovacoes"><span className="nav-number">04</span><span className="nav-name">Aprovações</span></Link>
          <Link className="nav-entry" href="/arquivos"><span className="nav-number">05</span><span className="nav-name">Arquivos</span></Link>
          <Link className="nav-entry" href="/financeiro"><span className="nav-number">06</span><span className="nav-name">Financeiro</span></Link>
          <Link className="nav-entry selected" href="/portfolio"><span className="nav-number">07</span><span className="nav-name">Portfólio VYRA</span></Link>
        </nav>
      </aside>
      <section className="dashboard-main"><header className="dashboard-topbar"><div className="breadcrumb"><span>VYRA HUB</span><i>/</i> PORTFÓLIO</div><button className="dashboard-logout" onClick={signOut}>Sair da conta ↗</button></header>
        <div className="dashboard-content">
          <div className="dashboard-overline">✦ CATÁLOGO DE SERVIÇOS · 07 / 07</div>
          <div className="clients-page-heading"><div><p className="hero-pretitle">O QUE A VYRA PODE CRIAR COM CADA MARCA.</p><h1>Portfólio<br /><em>de serviços.</em></h1><p className="hero-description">Cadastre serviços complementares e escolha o que ficará visível para os clientes. Pacotes mensais de gestão não devem ser cadastrados aqui.</p></div></div>
          {message && <p className="success-message user-feedback">{message}</p>}
          <form className="user-admin-form" onSubmit={save}>
            <p className="section-index">{editing ? "EDITAR SERVIÇO" : "NOVO SERVIÇO"}</p>
            <label>Nome do serviço<input required value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Fotografia profissional" /></label>
            <label>Descrição<textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Explique como esse serviço pode complementar a marca." /></label>
            <label>Categoria<input value={category} onChange={e => setCategory(e.target.value)} /></label>
            <label>Preço (opcional)<input inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} placeholder="Ex.: 350,00" /></label>
            <label>Texto do preço (opcional)<input value={priceLabel} onChange={e => setPriceLabel(e.target.value)} placeholder="Ex.: Consulte um orçamento" /></label>
            <label className="service-toggle"><input type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)} /> Exibir no Portfólio VYRA para clientes</label>
            <label className="service-toggle"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /> Serviço ativo</label>
            <div className="service-form-actions"><button className="button" disabled={saving}>{saving ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar serviço"}</button>{editing && <button type="button" className="button button-secondary" onClick={resetForm}>Cancelar</button>}</div>
          </form>
          <div className="dashboard-section-heading"><div><p className="section-index">CATÁLOGO</p><h2>Serviços cadastrados<span>.</span></h2></div></div>
          <div className="admin-service-list">{services.map(s => <article className="admin-service-row" key={s.id}><div><span className="feature-tag">{s.category} · {s.active ? "ATIVO" : "INATIVO"} · {s.is_portfolio_visible ? "VISÍVEL" : "OCULTO"}</span><h3>{s.name}</h3><p>{s.description}</p></div><div className="admin-service-actions"><strong>{s.price_label || (s.price === null ? "Sem preço" : `R$ ${Number(s.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`)}</strong><button type="button" className="button button-secondary" onClick={() => editService(s)}>Editar</button></div></article>)}</div>
          <footer className="dashboard-footer"><span>VYRA MÍDIA © 2026</span><span>MENOS DO MESMO. <b>MAIS IMPACTO.</b></span></footer>
        </div>
      </section>
    </main>
  );
}
