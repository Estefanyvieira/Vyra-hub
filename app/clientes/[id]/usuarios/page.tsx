"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "../../../../supabase";

type UserRow = { id: string; full_name: string; email: string; active: boolean; created_at: string };
type Company = { id: string; name: string };

export default function ClientUsersPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [resetting, setResetting] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyUser, setBusyUser] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadUsers = useCallback(async () => {
    const supabase = supabaseBrowser();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) { router.replace("/login"); return; }
    const response = await fetch(`/api/admin/users?clientId=${encodeURIComponent(params.id)}`, {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
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
      } finally { if (active) setLoading(false); }
    }
    init();
    return () => { active = false; };
  }, [loadUsers, router]);

  async function apiAction(payload: Record<string, unknown>) {
    const supabase = supabaseBrowser();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...payload, clientId: params.id }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Não foi possível concluir a ação.");
    setMessage(result.message || "Alteração concluída.");
    setError("");
    await loadUsers();
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
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
      setMessage("Usuário principal criado e vinculado à empresa com sucesso.");
      await loadUsers();
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível criar o usuário."); }
    finally { setSaving(false); }
  }

  function beginEdit(user: UserRow) {
    setEditing(user); setEditName(user.full_name); setEditEmail(user.email);
    setResetting(null); setError(""); setMessage("");
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return;
    setBusyUser(editing.id); setError(""); setMessage("");
    try {
      await apiAction({ action: "edit", userId: editing.id, fullName: editName, email: editEmail });
      setEditing(null);
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível salvar os dados."); }
    finally { setBusyUser(""); }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!resetting) return;
    setBusyUser(resetting.id); setError(""); setMessage("");
    try {
      await apiAction({ action: "password", userId: resetting.id, password: newPassword });
      setResetting(null); setNewPassword("");
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível redefinir a senha."); }
    finally { setBusyUser(""); }
  }

  async function toggleStatus(user: UserRow) {
    const actionText = user.active ? "desativar" : "reativar";
    if (!window.confirm(`Deseja realmente ${actionText} o acesso de ${user.full_name}?`)) return;
    setBusyUser(user.id); setError(""); setMessage("");
    try { await apiAction({ action: "status", userId: user.id, active: !user.active }); }
    catch (err) { setError(err instanceof Error ? err.message : "Não foi possível alterar o acesso."); }
    finally { setBusyUser(""); }
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
          <div className="clients-page-heading"><div><p className="hero-pretitle">CONTROLE DO USUÁRIO PRINCIPAL</p><h1>Gerenciar<br /><em>acesso principal.</em></h1><p className="hero-description">{company?.name || "Empresa"} · cadastro e manutenção do único acesso principal da empresa. Os demais logins serão gerenciados pelo cliente principal.</p></div><div className="clients-total"><strong>{users.length}/1</strong><span>USUÁRIO PRINCIPAL</span></div></div>

          {error && <p className="error user-feedback">{error}</p>}
          {message && <p className="success-message user-feedback">{message}</p>}

          <div className="dashboard-section-heading"><div><p className="section-index">01 — ACESSO PRINCIPAL</p><h2>Cadastrar usuário principal<span>.</span></h2></div></div>
          <form className="user-admin-form" onSubmit={createUser}>
            <label>Nome completo<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="Nome da pessoa" /></label>
            <label>E-mail de acesso<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="email@exemplo.com" /></label>
            <label>Senha inicial<input required type="password" minLength={8} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo de 8 caracteres" /></label>
            <p className="user-form-note">A senha inicial será definida por você e entregue à pessoa com segurança. O usuário poderá usar a opção “Esqueci minha senha” para criar outra senha.</p>
            <button className="button" disabled={saving || users.length >= 1}>{saving ? "Criando acesso..." : users.length >= 6 ? "Usuário principal já cadastrado" : "Criar acesso"}</button>
          </form>

          <div className="dashboard-section-heading"><div><p className="section-index">02 — CONTA PRINCIPAL</p><h2>Usuário principal da empresa<span>.</span></h2></div><span className="section-caption">{users.length} DE 1 CONTA PRINCIPAL</span></div>
          <div className="user-list">{users.map((user,index)=><div className="user-row user-row-manage" key={user.id}>
            <span className="user-index">{String(index+1).padStart(2,"0")}</span>
            <div><strong>{user.full_name}</strong><small>{user.email}</small></div>
            <span className={user.active ? "user-status" : "user-status user-status-off"}>{user.active ? "ATIVO" : "DESATIVADO"}</span>
            <div className="user-actions">
              <button type="button" className="user-action" onClick={()=>beginEdit(user)}>Editar</button>
              <button type="button" className="user-action" onClick={()=>{setResetting(user);setNewPassword("");setEditing(null);setError("");setMessage("");}}>Redefinir senha</button>
              <button type="button" className="user-action user-action-warn" disabled={busyUser===user.id} onClick={()=>toggleStatus(user)}>{busyUser===user.id ? "Aguarde..." : user.active ? "Desativar" : "Reativar"}</button>
            </div>
          </div>)}
          {users.length===0 && <div className="clients-empty"><p>Nenhum usuário vinculado a esta empresa.</p></div>}</div>

          {editing && <form className="user-admin-form user-edit-panel" onSubmit={saveEdit}>
            <div><p className="section-index">EDITAR ACESSO</p><h3>{editing.full_name}</h3></div>
            <label>Nome completo<input required maxLength={120} value={editName} onChange={e=>setEditName(e.target.value)} /></label>
            <label>E-mail de acesso<input required type="email" value={editEmail} onChange={e=>setEditEmail(e.target.value)} /></label>
            <div className="user-panel-actions"><button className="button" disabled={busyUser===editing.id}>{busyUser===editing.id ? "Salvando..." : "Salvar alterações"}</button><button type="button" className="user-action" onClick={()=>setEditing(null)}>Cancelar</button></div>
          </form>}

          {resetting && <form className="user-admin-form user-edit-panel" onSubmit={savePassword}>
            <div><p className="section-index">REDEFINIR SENHA</p><h3>{resetting.full_name}</h3></div>
            <label>Nova senha<input required type="password" minLength={8} maxLength={128} value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Mínimo de 8 caracteres" /></label>
            <p className="user-form-note">A senha será alterada imediatamente. Compartilhe a nova senha com a pessoa por um canal seguro.</p>
            <div className="user-panel-actions"><button className="button" disabled={busyUser===resetting.id}>{busyUser===resetting.id ? "Salvando..." : "Redefinir senha"}</button><button type="button" className="user-action" onClick={()=>setResetting(null)}>Cancelar</button></div>
          </form>}

          <p className="clients-note">A administração da VYRA gerencia somente esta conta principal. Depois do primeiro acesso, o cliente principal poderá criar e administrar até 5 logins adicionais.</p>
          <Link className="button secondary-button" href={`/clientes/${params.id}`}>Voltar ao espaço da empresa</Link>
        </div>
      </section>
    </main>
  );
}
