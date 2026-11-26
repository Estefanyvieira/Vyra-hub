"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password });
      if (error) throw error;

      const { data: authData, error: userError } = await supabaseBrowser().auth.getUser();
      if (userError || !authData.user) throw new Error("Não foi possível confirmar seu usuário.");

      const { data: profile, error: profileError } = await supabaseBrowser()
        .from("profiles")
        .select("role, client_id")
        .eq("id", authData.user.id)
        .single();

      if (profileError || !profile) throw new Error("Seu perfil ainda não está configurado. Entre em contato com a VYRA.");

      if (profile.role === "admin") router.replace("/dashboard");
      else if (profile.role === "client" && profile.client_id) router.replace("/cliente");
      else throw new Error("Seu usuário não possui um acesso válido.");

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

  async function recoverPassword() {
    setError("");
    setNotice("");
    if (!email.trim()) {
      setError("Digite seu e-mail no campo acima para receber o link de recuperação.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabaseBrowser().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: "https://vyra-hub.vercel.app/reset-password",
      });
      if (error) throw error;
      setNotice("Se esse e-mail estiver cadastrado, você receberá um link para criar uma nova senha. Confira também o spam.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar o link de recuperação.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <div className="brand">VYRA<span>.</span></div>
        <p className="eyebrow">ÁREA EXCLUSIVA</p>
        <h1>Bem-vinda de volta.</h1>
        <p className="muted">Entre para acessar seu espaço na VYRA HUB.</p>

        <form onSubmit={submit}>
          <label>E-mail de acesso</label>
          <input type="email" autoComplete="username" required value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />

          <label>Senha</label>
          <input type="password" autoComplete="current-password" required value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder="Sua senha" />

          {error && <p className="error">{error}</p>}
          {notice && <p className="hint">{notice}</p>}

          <button className="button full" disabled={busy}>
            {busy ? "Aguarde..." : "Entrar na plataforma"}
          </button>
        </form>

        <button type="button" className="button full" disabled={busy}
          onClick={recoverPassword} style={{ marginTop: 12 }}>
          Esqueci minha senha
        </button>

        <p className="hint">Informe seu e-mail e clique em “Esqueci minha senha” para receber um link seguro de recuperação.</p>
      </section>
    </main>
  );
}
