"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth-provider";

type AuthMode = "login" | "register";

function getAuthErrorMessage(code: string | undefined, mode: AuthMode): string {
  if (code === "invalid_credentials") return "メールアドレスかパスワードが正しくありません。";
  if (code === "user_already_exists") return "このメールアドレスは登録済みです。ログインしてください。";
  if (code === "weak_password") return "パスワードが短いか、条件を満たしていません。";
  return mode === "register"
    ? "登録できませんでした。入力内容とSupabaseの設定を確認してください。"
    : "ログインできませんでした。しばらくしてから再度お試しください。";
}

export default function LoginPage() {
  const { client, user, loading, configured } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (!loading && user) router.replace("/"); }, [loading, router, user]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || busy) return;
    setBusy(true);
    setError("");

    try {
      const credentials = { email: email.trim(), password };
      const { data, error: authError } = mode === "register"
        ? await client.auth.signUp(credentials)
        : await client.auth.signInWithPassword(credentials);

      if (authError) {
        setError(getAuthErrorMessage(authError.code, mode));
        return;
      }
      if (!data.session) {
        setError("登録は受け付けられましたが、確認メールが必要な設定です。Supabaseの「Confirm email」をオフにしてください。");
        return;
      }
      // Load the saved session before showing the protected page.
      window.location.replace("/");
    } catch {
      setError("通信できませんでした。接続を確認して再度お試しください。");
    } finally {
      setBusy(false);
    }
  }

  function switchMode() {
    setMode((current) => current === "login" ? "register" : "login");
    setPassword("");
    setError("");
  }

  return (
    <main className="login-screen">
      <div className="login-decoration"><span className="brand brand-large">LOG<span>BOOK</span><span className="brand-dot">.</span></span><p>EVERY REP COUNTS.</p></div>
      <div className="login-card">
        <span className="eyebrow">{mode === "login" ? "WELCOME BACK" : "GET STARTED"}</span>
        <h1>{mode === "login" ? <>記録を、<br />積み重ねよう。</> : <>記録を、<br />始めよう。</>}</h1>
        <p className="login-description">メールアドレスとパスワードで{mode === "login" ? "ログイン" : "登録"}します。</p>

        {!configured ? <div className="alert error-alert" role="alert">Supabaseの接続設定がありません。<code>.env.local</code> を設定して開発サーバーを再起動してください。</div> : null}
        {error && <div className="alert error-alert" role="alert">{error}</div>}

        <form className="form-stack" onSubmit={submit}>
          <label htmlFor="email">メールアドレス</label>
          <input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={!configured || busy} />
          <label htmlFor="password">パスワード</label>
          <input id="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required disabled={!configured || busy} />
          <button className="primary-button" type="submit" disabled={!client || busy}>{busy ? "処理中…" : mode === "login" ? "ログインする" : "登録して始める"}<span aria-hidden="true">↗</span></button>
        </form>
        <button className="text-button centered auth-switch" type="button" onClick={switchMode} disabled={busy}>
          {mode === "login" ? "アカウントがない方はこちらから登録" : "登録済みの方はこちらからログイン"}
        </button>
        <p className="login-note">パスワードは6文字以上で入力してください。</p>
      </div>
    </main>
  );
}
