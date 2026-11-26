"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../supabase";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    let active = true;
    supabaseBrowser().auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error || !data.session) {
        setError("Este link é inválido ou expirou. Solicite um novo link na tela de entrada.");
      } else {
        setReady(true);
      }
    });
    return () => { active = false; };
  }, []);

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (password.length < 8) {
      setError("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    setBusy(true);
    const { error } = await supabaseBrowser().auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setMessage("Senha alterada com sucesso. Você já pode entrar no VYRA HUB.");
    await supabaseBrowser().auth.signOut();
    setTimeout(() => router.replace("/login"), 1800);
  }

  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <div className="brand">VYRA<span>.</span></div>
        <p className="eyebrow">SEGURANÇA DA CONTA</p>
        <h1>Crie uma nova senha.</h1>
        <p className="muted">Escolha uma senha nova para acessar seu espaço na VYRA HUB.</p>

        {ready ? (
          <form onSubmit={savePassword}>
            <label>Nova senha</label>
            <input type="password" autoComplete="new-password" minLength={8} required
              value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo de 8 caracteres" />
            <label>Confirme a nova senha</label>
            <input type="password" autoComplete="new-password" minLength={8} required
              value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Digite novamente" />
            <button className="button full" disabled={busy}>{busy ? "Salvando..." : "Salvar nova senha"}</button>
          </form>
        ) : <p className="hint">Verificando o link de recuperação...</p>}

        {error && <p className="error">{error}</p>}
        {message && <p className="hint">{message}</p>}
      </section>
    </main>
  );
}
