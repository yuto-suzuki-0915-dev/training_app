"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { formatWorkoutDate, formatWorkoutTime, getErrorMessage, type WorkoutSession, type WorkoutSummary } from "@/domain/workout";
import { getActiveWorkout, getHistory, startOrResumeWorkout } from "@/data/workouts";

export default function HomePage() {
  const { client, user } = useAuth();
  const router = useRouter();
  const [active, setActive] = useState<WorkoutSession | null>(null);
  const [recent, setRecent] = useState<WorkoutSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const startInFlight = useRef(false);

  const load = useCallback(async () => {
    if (!client || !user) return;
    try {
      const [current, history] = await Promise.all([
        getActiveWorkout(client, user.id),
        getHistory(client, user.id, 3),
      ]);
      setActive(current);
      setRecent(history);
    } catch (caught) {
      setError(getErrorMessage(caught, "ホームを読み込めませんでした。"));
    } finally {
      setLoading(false);
    }
  }, [client, user]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function handleStart() {
    if (!client || !user || startInFlight.current) return;
    startInFlight.current = true;
    setStarting(true);
    setError("");
    try {
      await startOrResumeWorkout(client, user.id);
      router.push("/workout");
    } catch (caught) {
      setError(getErrorMessage(caught, "トレーニングを開始できませんでした。"));
      startInFlight.current = false;
      setStarting(false);
    }
  }

  return (
    <main className="page-content home-page">
      <div className="page-heading">
        <span className="eyebrow">YOUR TRAINING JOURNAL</span>
        <h1>今日の一歩を、<br /><span>記録に残そう。</span></h1>
        <p>セットを記録するだけ。次のトレーニングで、前回の自分と向き合えます。</p>
      </div>

      {error && <div className="alert error-alert" role="alert">{error}<button type="button" onClick={() => { setLoading(true); setError(""); void load(); }}>再読み込み</button></div>}

      <section className="start-card" aria-label="トレーニング">
        <div className="start-card-top">
          <span className="card-kicker">TODAY&apos;S SESSION</span>
          <span className="date-pill">{formatWorkoutDate(new Date().toISOString())}</span>
        </div>
        <div className="start-card-body">
          <div>
            <span className="status-dot" />
            <span className="muted-on-dark">{active ? "進行中のトレーニングがあります" : "準備ができたら始めましょう"}</span>
          </div>
          <h2>{active ? "続きから記録" : "トレーニングを開始"}</h2>
          {active && <p>{formatWorkoutTime(active.startedAt)} 開始 · {active.exercises.length} 種目</p>}
        </div>
        <button className="primary-button light-button" type="button" onClick={handleStart} disabled={loading || starting}>
          {starting ? "準備中…" : active ? "記録を再開する" : "記録を始める"}<span aria-hidden="true">↗</span>
        </button>
      </section>

      <section className="section-block">
        <div className="section-title-row"><div><span className="eyebrow">PAST SESSIONS</span><h2>最近の記録</h2></div><Link className="subtle-link" href="/history">すべて見る ↗</Link></div>
        {loading ? <div className="empty-card">記録を読み込み中…</div> : recent.length === 0 ? (
          <div className="empty-card"><span className="empty-icon">◌</span><p>まだ記録がありません。</p><span>最初のトレーニングを記録してみましょう。</span></div>
        ) : (
          <div className="history-list">
            {recent.map((session) => <Link className="history-item" key={session.id} href={`/history/${session.id}`}>
              <div><strong>{formatWorkoutDate(session.startedAt)}</strong><span>{formatWorkoutTime(session.startedAt)} 開始</span></div>
              <span className="history-meta">{session.exerciseCount} 種目 · {session.setCount} セット</span><span className="list-arrow">↗</span>
            </Link>)}
          </div>
        )}
      </section>
    </main>
  );
}
