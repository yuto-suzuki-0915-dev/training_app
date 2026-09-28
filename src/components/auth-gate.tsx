"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { client, user, loading, configured } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && configured && client && !user) router.replace("/login");
  }, [client, configured, loading, router, user]);

  if (!configured) {
    return (
      <main className="setup-screen">
        <div className="setup-card">
          <span className="eyebrow">SETUP REQUIRED</span>
          <h1>Supabaseの接続設定が必要です</h1>
          <p><code>.env.example</code> を参考に <code>.env.local</code> を作成し、Project URLとpublishable keyを設定してください。</p>
          <p>設定後に開発サーバーを再起動すると、ログイン画面を利用できます。</p>
        </div>
      </main>
    );
  }

  if (loading || !client) return <main className="loading-screen">読み込み中…</main>;
  if (!user) return <main className="loading-screen">ログイン画面へ移動中… <Link href="/login">移動する</Link></main>;
  return children;
}
