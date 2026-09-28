"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { getHistory } from "@/data/workouts";
import { formatWorkoutDate, formatWorkoutTime, getErrorMessage, type WorkoutSummary } from "@/domain/workout";

export default function HistoryPage() {
  const { client, user } = useAuth();
  const [history, setHistory] = useState<WorkoutSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!client || !user) return;
    try { setHistory(await getHistory(client, user.id)); }
    catch (caught) { setError(getErrorMessage(caught, "履歴を読み込めませんでした。")); }
    finally { setLoading(false); }
  }, [client, user]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return <main className="page-content history-page">
    <div className="page-heading compact-heading"><span className="eyebrow">PAST SESSIONS</span><h1>トレーニング履歴<span className="accent-dot">.</span></h1><p>積み重ねた記録を振り返りましょう。</p></div>
    {error && <div className="alert error-alert" role="alert">{error}<button type="button" onClick={() => { setLoading(true); setError(""); void load(); }}>再読み込み</button></div>}
    {loading ? <div className="empty-card">履歴を読み込み中…</div> : history.length === 0 ? <div className="empty-card"><span className="empty-icon">◌</span><h2>履歴はまだありません</h2><p>最初のトレーニングを記録すると、ここに表示されます。</p><Link className="primary-button inline-button" href="/">ホームへ戻る ↗</Link></div> : (
      <div className="history-list full-list">{history.map((session) => <Link className="history-item" key={session.id} href={`/history/${session.id}`}><div><strong>{formatWorkoutDate(session.startedAt)}</strong><span>{formatWorkoutTime(session.startedAt)} 開始</span></div><span className="history-meta">{session.exerciseCount} 種目 · {session.setCount} セット</span><span className="list-arrow">↗</span></Link>)}</div>
    )}
  </main>;
}
