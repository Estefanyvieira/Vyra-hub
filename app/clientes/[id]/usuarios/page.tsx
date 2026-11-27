"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "../../../../supabase";

type UserRow = { id: string; full_name: string; email: string; created_at: string };
type Company = { id: string; name: string };

export default function ClientUsersPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadUsers = useCallback(async () => {
    const supabase = supabaseBrowser();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) { router.replace("/login"); return; }

    const response = await fetch(`/api/admin/users?clientId=${encodeURIComponent(params.id)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Não foi possível carregar os usuários.");
    setCompany(result.client);
    setUsers(result.users || []);
  }, [params.id, router]);

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const supabase = supabaseBrowser();
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user) { router.replace("/login"); return; }
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", authData.user.id).single();
        if (profile?.role !== "admin") { router.replace(profile?.role === "client" ? "/cliente" : "/login"); return; }
        await loadUsers();
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Ocorreu um erro.");
      } finally {
        if (active) setLoading(false);
      }
    }
    init();
    return () => { active = false; };
  }, [loadUsers, router]);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(""); setMessage("");
    try {
      const supabase = supabaseBrowser();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fullName: name, email, password, clientId: params.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível criar o usuário.");
      setName(""); setEmail(""); setPassword("");
      setMessage("Acesso criado e vinculado à empresa com sucesso.");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar o usuário.");
    } finally { setSaving(false); }
  }

  async function signOut() { await supabaseBrowser().auth.signOut(); router.replace("/login"); }

  if (loading) return <main className="app-shell"><p className="muted">Carregando usuários...</p></main>;

  return (
    <main className="vyra-dashboard">
      <aside className="vyra-sidebar">
        <Link className="vyra-wordmark" href="/dashboard">VYRA<span>.</span><span className="vyra-mark">✦</span></Link>
        <p className="sidebar-kicker">MÍDIA · HUB</p><div className="sidebar-rule" />
        <p className="sidebar-label">ESPAÇO DE TRABALHO</p>
        <nav className="dashboard-nav"><Link className="nav-entry" href="/dashboard"><span className="nav-number">01</span><span className="nav-name">Visão geral</span></Link><Link className="nav-entry selected" href="/clientes"><span className="nav-number">02</span><span className="nav-name">Clientes</span></Link></nav>
        <div className="sidebar-signature"><span>✦</span><span>MENOS DO MESMO.<br />MAIS IMPACTO.</span></div>
      </aside>
      <section className="dashboard-main">
        <header className="dashboard-topbar"><div className="breadcrumb"><Link href="/clientes">CLIENTES</Link><i>/</i> USUÁRIOS</div><button className="dashboard-logout" onClick={signOut}>Sair da conta <span>↗</span></button></header>
        <div className="dashboard-content">
          <div className="dashboard-overline">✦ GESTÃO DE ACESSOS <span>·</span> VYRA HUB</div>
          <div className="clients-page-heading"><div><p className="hero-pretitle">CONTROLE DE ACESSOS DA EMPRESA</p><h1>Gerenciar<br /><em>usuários.</em></h1><p className="hero-description">{company?.name || "Empresa"} · cada pessoa terá seu próprio login e acesso ao mesmo espaço da empresa.</p></div><div className="clients-total"><strong>{users.length}/6</strong><span>ACESSOS UTILIZADOS</span></div></div>

          <div className="dashboard-section-heading"><div><p className="section-index">01 — NOVO ACESSO</p><h2>Cadastrar usuário<span>.</span></h2></div></div>
          <form className="user-admin-form" onSubmit={createUser}>
            <label>Nome completo<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="Nome da pessoa" /></label>
            <label>E-mail de acesso<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="email@exemplo.com" /></label>
            <label>Senha inicial<input required type="password" minLength={8} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo de 8 caracteres" /></label>
            <p className="user-form-note">A senha inicial será definida por você e entregue à pessoa com segurança. O usuário poderá usar a opção “Esqueci minha senha” para criar outra senha.</p>
            {error && <p className="error">{error}</p>}{message && <p className="success-message">{message}</p>}
            <button className="button" disabled={saving || users.length >= 6}>{saving ? "Criando acesso..." : users.length >= 6 ? "Limite de 6 usuários atingido" : "Criar acesso"}</button>
          </form>

          <div className="dashboard-section-heading"><div><p className="section-index">02 — ACESSOS VINCULADOS</p><h2>Usuários da empresa<span>.</span></h2></div><span className="section-caption">{users.length} DE 6 VAGAS UTILIZADAS</span></div>
          <div className="user-list">{users.map((user,index)=><div className="user-row" key={user.id}><span className="user-index">{String(index+1).padStart(2,"0")}</span><div><strong>{user.full_name}</strong><small>{user.email}</small></div><span className="user-status">ATIVO</span></div>)}
          {users.length===0 && <div className="clients-empty"><p>Nenhum usuário vinculado a esta empresa.</p></div>}</div>
          <p className="clients-note">O limite máximo é de 6 logins por empresa. Todos os usuários vinculados compartilham o mesmo espaço e os mesmos dados da empresa.</p>
          <Link className="button secondary-button" href={`/clientes/${params.id}`}>Voltar ao espaço da empresa</Link>
        </div>
      </section>
    </main>
  );
}
