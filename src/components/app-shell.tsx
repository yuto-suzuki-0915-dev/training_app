"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const router = useRouter();
  const { client } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");

  async function signOut() {
    if (!client || signingOut) return;
    setSigningOut(true);
    setError("");
    const { error: authError } = await client.auth.signOut();
    if (authError) {
      setError("ログアウトに失敗しました。もう一度お試しください。");
      setSigningOut(false);
      return;
    }
    router.replace("/login");
  }

  return (
    <div className="app-root">
      <header className={`app-header${isHome ? " home-app-header" : ""}`}>
        <div className="header-inner">
          <Link className="brand" href="/" aria-label="ホームへ">LOG<span>BOOK</span><span className="brand-dot">.</span></Link>
          <div className="header-actions">
            <span className="header-caption">TRAINING JOURNAL</span>
            <button className="text-button" onClick={signOut} disabled={signingOut} type="button">ログアウト</button>
          </div>
        </div>
      </header>
      {error && <div className="global-error" role="alert">{error}</div>}
      <div className={`page-wrap${isHome ? " home-page-wrap" : ""}`}>{children}</div>
      <nav className="bottom-nav" aria-label="メインナビゲーション">
        <Link href="/history" className={pathname.startsWith("/history") ? "active" : ""}><span className="nav-icon">▤</span>履歴</Link>
        <Link href="/" className={`home-tab${pathname === "/" ? " active" : ""}`} aria-current={pathname === "/" ? "page" : undefined}><span className="nav-icon">⌂</span>ホーム</Link>
        <Link href="/workout" className={pathname === "/workout" ? "active" : ""}><span className="nav-icon">＋</span>記録</Link>
      </nav>
    </div>
  );
}
