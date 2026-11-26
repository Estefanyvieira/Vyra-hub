
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");

    try {
      const { error } = await supabaseBrowser().auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível entrar."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <div className="brand">
          VYRA<span>.</span>
        </div>

        <p className="eyebrow">ÁREA EXCLUSIVA</p>

        <h1>Bem-vinda de volta.</h1>

        <p className="muted">
          Entre para acessar seu espaço na VYRA HUB.
        </p>

        <form onSubmit={submit}>
          <label>E-mail de acesso</label>

          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
          />

          <label>Senha</label>

          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Sua senha"
          />

          {error && <p className="error">{error}</p>}

          <button className="button full" disabled={busy}>
            {busy ? "Entrando..." : "Entrar na plataforma"}
          </button>
        </form>

        <p className="hint">
          Problemas com o acesso? Solicite à administração da VYRA
          a redefinição da sua senha.
        </p>
      </section>
    </main>
  );
}
