"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../../supabase";

type UserRow = { id: string; full_name: string; email: string; active: boolean; created_at: string };
type Company = { id: string; name: string };

export default function CompanyUsersPage() {
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(1);
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
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const token = useCallback(async () => {
    const { data } = await supabaseBrowser().auth.getSession();
    if (!data.session?.access_token) throw new Error("Sua sessão expirou. Entre novamente.");
    return data.session.access_token;
  }, []);

  const loadUsers = useCallback(async () => {
    const accessToken = await token();
    const response = await fetch("/api/client/users", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Não foi possível carregar os acessos.");
    setCompany(result.company);
    setUsers(result.users || []);
    setTotal(result.total || 1);
  }, [token]);

  useEffect(() => {
    let alive = true;
    async function init() {
      try {
        const supabase = supabaseBrowser();
        const { data } = await supabase.auth.getUser();
        if (!data.user) { router.replace("/login"); return; }
        const { data: profile } = await supabase.from("profiles").select("role, is_primary").eq("id", data.user.id).single();
        if (profile?.role !== "client") { router.replace(profile?.role === "admin" ? "/dashboard" : "/login"); return; }
        if (profile.is_primary !== true) { router.replace("/cliente"); return; }
        await loadUsers();
      } catch (e) { if (alive) setError(e instanceof Error ? e.message : "Ocorreu um erro."); }
      finally { if (alive) setLoading(false); }
    }
    init();
    return () => { alive = false; };
  }, [loadUsers, router]);

  async function action(payload: Record<string, unknown>) {
    const accessToken = await token();
    const response = await fetch("/api/client/users", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Não foi possível concluir a ação.");
    setMessage(result.message || "Alteração concluída.");
    setError("");
    await loadUsers();
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const accessToken = await token();
      const response = await fetch("/api/client/users", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ fullName: name, email, password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível criar o acesso.");
      setName(""); setEmail(""); setPassword(""); setMessage(result.message || "Acesso criado.");
      await loadUsers();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível criar o acesso."); }
    finally { setSaving(false); }
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return; setBusy(editing.id); setError(""); setMessage("");
    try { await action({ action: "edit", userId: editing.id, fullName: editName, email: editEmail }); setEditing(null); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setBusy(""); }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!resetting) return; setBusy(resetting.id); setError(""); setMessage("");
    try { await action({ action: "password", userId: resetting.id, password: newPassword }); setResetting(null); setNewPassword(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível redefinir a senha."); }
    finally { setBusy(""); }
  }

  async function toggle(user: UserRow) {
    const verb = user.active ? "desativar" : "reativar";
    if (!window.confirm(`Deseja realmente ${verb} o acesso de ${user.full_name}?`)) return;
    setBusy(user.id); setError(""); setMessage("");
    try { await action({ action: "status", userId: user.id, active: !user.active }); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível alterar o acesso."); }
    finally { setBusy(""); }
  }

  async function signOut() { await supabaseBrowser().auth.signOut(); router.replace("/login"); }

  if (loading) return <main className="client-brand-loading"><p>Carregando acessos...</p></main>;

  return <main className="client-home-shell client-home-redesigned">
    <div className="client-home-content">
      <header className="client-home-section-heading">
        <div><p className="client-home-kicker">ACESSO DA EQUIPE · {company?.name || "SUA EMPRESA"}</p><h1>Gerenciar <em>usuários.</em></h1><p>Adicione pessoas para que elas também acessem o espaço da empresa.</p></div>
        <Link href="/cliente" className="client-home-module-action">VOLTAR AO INÍCIO ↗</Link>
      </header>
      <section className="client-brand-settings">
        <div><p className="client-home-kicker">LIMITE DE ACESSOS</p><h2>{total} de 6 logins utilizados</h2><p>O usuário principal já ocupa uma vaga. Você pode adicionar até {Math.max(0, 6 - total)} pessoa(s). Todos compartilham os mesmos módulos e dados da empresa.</p></div>
      </section>
      {error && <p className="error user-feedback">{error}</p>}
      {message && <p className="success-message user-feedback">{message}</p>}
      <section className="client-brand-settings">
        <div><p className="client-home-kicker">NOVO ACESSO</p><h2>Adicionar pessoa</h2><p>Crie um login individual para alguém da sua equipe.</p></div>
        <form className="user-admin-form" onSubmit={createUser}>
          <label>Nome completo<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="Nome da pessoa" /></label>
          <label>E-mail de acesso<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="email@exemplo.com" /></label>
          <label>Senha inicial<input required type="password" minLength={8} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo de 8 caracteres" /></label>
          <p className="user-form-note">Compartilhe os dados de acesso diretamente com a pessoa. Ela poderá entrar com seu próprio e-mail e senha.</p>
          <button className="button" disabled={saving || total >= 6}>{saving ? "Criando acesso..." : total >= 6 ? "Limite de 6 logins atingido" : "Criar acesso"}</button>
        </form>
      </section>
      <section className="client-brand-settings">
        <div><p className="client-home-kicker">USUÁRIOS ADICIONAIS</p><h2>Pessoas com acesso</h2></div>
        <div className="user-list">{users.map((user,index)=><div className="user-row user-row-manage" key={user.id}>
          <span className="user-index">{String(index+1).padStart(2,"0")}</span>
          <div><strong>{user.full_name}</strong><small>{user.email}</small></div>
          <span className={user.active ? "user-status" : "user-status user-status-off"}>{user.active ? "ATIVO" : "DESATIVADO"}</span>
          <div className="user-actions">
            <button type="button" className="user-action" onClick={()=>{setEditing(user);setEditName(user.full_name);setEditEmail(user.email);setResetting(null);}}>Editar</button>
            <button type="button" className="user-action" onClick={()=>{setResetting(user);setNewPassword("");setEditing(null);}}>Redefinir senha</button>
            <button type="button" className="user-action user-action-warn" disabled={busy===user.id} onClick={()=>toggle(user)}>{busy===user.id ? "Aguarde..." : user.active ? "Desativar" : "Reativar"}</button>
          </div>
        </div>)}
        {users.length===0 && <p>Nenhum usuário adicional cadastrado.</p>}</div>
      </section>
      {editing && <form className="user-admin-form user-edit-panel" onSubmit={saveEdit}>
        <p className="client-home-kicker">EDITAR ACESSO</p><h2>{editing.full_name}</h2>
        <label>Nome completo<input required maxLength={120} value={editName} onChange={e=>setEditName(e.target.value)} /></label>
        <label>E-mail<input required type="email" value={editEmail} onChange={e=>setEditEmail(e.target.value)} /></label>
        <div className="user-panel-actions"><button className="button" disabled={busy===editing.id}>{busy===editing.id ? "Salvando..." : "Salvar alterações"}</button><button type="button" className="user-action" onClick={()=>setEditing(null)}>Cancelar</button></div>
      </form>}
      {resetting && <form className="user-admin-form user-edit-panel" onSubmit={savePassword}>
        <p className="client-home-kicker">REDEFINIR SENHA</p><h2>{resetting.full_name}</h2>
        <label>Nova senha<input required type="password" minLength={8} maxLength={128} value={newPassword} onChange={e=>setNewPassword(e.target.value)} /></label>
        <div className="user-panel-actions"><button className="button" disabled={busy===resetting.id}>{busy===resetting.id ? "Salvando..." : "Redefinir senha"}</button><button type="button" className="user-action" onClick={()=>setResetting(null)}>Cancelar</button></div>
      </form>}
      <button className="dashboard-logout" onClick={signOut}>Sair da conta ↗</button>
    </div>
  </main>;
}
