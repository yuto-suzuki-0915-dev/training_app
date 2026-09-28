"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth-provider";

export default function LoginPage() {
  const { client, user, loading, configured } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => { if (!loading && user) router.replace("/"); }, [loading, router, user]);

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    const { error: authError } = await client.auth.signInWithOtp({ email: email.trim() });
    setBusy(false);
    if (authError) {
      setError("コードを送信できませんでした。メールアドレスと送信設定を確認してください。");
      return;
    }
    setStep("code");
    setNotice("メールに届いた6桁のコードを入力してください。");
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || busy) return;
    setBusy(true);
    setError("");
    const { error: authError } = await client.auth.verifyOtp({
      email: email.trim(), token: code.trim(), type: "email",
    });
    setBusy(false);
    if (authError) {
      setError("コードを確認できませんでした。期限切れの場合は再送してください。");
      return;
    }
    router.replace("/");
  }

  return (
    <main className="login-screen">
      <div className="login-decoration"><span className="brand brand-large">LOG<span>BOOK</span><span className="brand-dot">.</span></span><p>EVERY REP COUNTS.</p></div>
      <div className="login-card">
        <span className="eyebrow">WELCOME BACK</span>
        <h1>記録を、<br />積み重ねよう。</h1>
        <p className="login-description">メールでログインして、あなたのトレーニングを記録します。</p>

        {!configured ? <div className="alert error-alert" role="alert">Supabaseの接続設定がありません。<code>.env.local</code> を設定して開発サーバーを再起動してください。</div> : null}
        {error && <div className="alert error-alert" role="alert">{error}</div>}
        {notice && <div className="alert success-alert" role="status">{notice}</div>}

        {step === "email" ? (
          <form className="form-stack" onSubmit={sendCode}>
            <label htmlFor="email">メールアドレス</label>
            <input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={!configured || busy} />
            <button className="primary-button" type="submit" disabled={!client || busy}>{busy ? "送信中…" : "ログインコードを送る"}<span aria-hidden="true">↗</span></button>
          </form>
        ) : (
          <form className="form-stack" onSubmit={verifyCode}>
            <span className="email-target">送信先: {email}</span>
            <label htmlFor="code">6桁のコード</label>
            <input id="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="000000" value={code} onChange={(event) => setCode(event.target.value)} required disabled={busy} />
            <button className="primary-button" type="submit" disabled={!client || busy}>{busy ? "確認中…" : "ログインする"}<span aria-hidden="true">↗</span></button>
            <button className="text-button centered" type="button" disabled={busy} onClick={() => { setStep("email"); setCode(""); setNotice(""); }}>メールアドレスに戻る・コードを再送</button>
          </form>
        )}
        <p className="login-note">アカウントがない場合は、初回ログイン時に作成されます。</p>
      </div>
    </main>
  );
}
