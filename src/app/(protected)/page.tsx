"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { getActiveWorkout, getCompletedWorkoutsInRange, getHistory, startOrResumeWorkout } from "@/data/workouts";
import { localDayKey, localMonthRange } from "@/domain/progress";
import { formatWorkoutDate, formatWorkoutTime, getErrorMessage, type WorkoutSession, type WorkoutSummary } from "@/domain/workout";

const weekDays = ["日", "月", "火", "水", "木", "金", "土"];

export default function HomePage() {
  const { client, user } = useAuth();
  const router = useRouter();
  const [today, setToday] = useState<Date | null>(null);
  const [active, setActive] = useState<WorkoutSession | null>(null);
  const [monthSessions, setMonthSessions] = useState<WorkoutSummary[]>([]);
  const [recent, setRecent] = useState<WorkoutSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const startInFlight = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setToday(new Date()), 0);
    const refreshDate = () => { if (document.visibilityState === "visible") setToday(new Date()); };
    document.addEventListener("visibilitychange", refreshDate);
    window.addEventListener("focus", refreshDate);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", refreshDate);
      window.removeEventListener("focus", refreshDate);
    };
  }, []);

  const load = useCallback(async () => {
    if (!client || !user || !today) return;
    try {
      const { start, end } = localMonthRange(today);
      const [current, monthly, history] = await Promise.all([
        getActiveWorkout(client, user.id),
        getCompletedWorkoutsInRange(client, user.id, start, end),
        getHistory(client, user.id, 3),
      ]);
      setActive(current);
      setMonthSessions(monthly);
      setRecent(history);
      setError("");
    } catch (caught) {
      setError(getErrorMessage(caught, "ホームを読み込めませんでした。"));
    } finally {
      setLoading(false);
    }
  }, [client, today, user]);

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

  if (!today) return <main className="page-content home-page"><div className="empty-card">ホームを読み込み中…</div></main>;

  const todayKey = localDayKey(today);
  const completedDays = new Set(monthSessions.map((session) => localDayKey(session.startedAt)));
  const todaySessions = monthSessions.filter((session) => localDayKey(session.startedAt) === todayKey);
  const activeToday = active && localDayKey(active.startedAt) === todayKey ? active : null;
  const todayExerciseCount = todaySessions.reduce((sum, session) => sum + session.exerciseCount, 0) + (activeToday?.exercises.length ?? 0);
  const todaySetCount = todaySessions.reduce((sum, session) => sum + session.setCount, 0) +
    (activeToday?.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0) ?? 0);
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  return (
    <main className="page-content home-page">
      <div className="dashboard-heading">
        <div><span className="eyebrow">TRAINING DASHBOARD</span><h1>ホーム</h1></div>
        <span className="dashboard-date">{formatWorkoutDate(today.toISOString())}</span>
      </div>

      {error && <div className="alert error-alert" role="alert">{error}<button type="button" onClick={() => { setLoading(true); setError(""); void load(); }}>再読み込み</button></div>}

      <section className="calendar-card" aria-label={`${today.getFullYear()}年${today.getMonth() + 1}月のトレーニングカレンダー`}>
        <div className="dashboard-section-heading"><div><span className="eyebrow">THIS MONTH</span><h2>{today.getFullYear()}年 {today.getMonth() + 1}月</h2></div><span className="calendar-count">{completedDays.size} 日</span></div>
        <div className="calendar-grid">
          {weekDays.map((day) => <span className="calendar-weekday" key={day}>{day}</span>)}
          {Array.from({ length: firstDay }, (_, index) => <span key={`blank-${index}`} aria-hidden="true" />)}
          {Array.from({ length: daysInMonth }, (_, index) => {
            const day = index + 1;
            const dateKey = localDayKey(new Date(today.getFullYear(), today.getMonth(), day));
            const completed = completedDays.has(dateKey);
            return <span className={`calendar-day${completed ? " trained" : ""}${dateKey === todayKey ? " today" : ""}`} key={dateKey} aria-label={`${day}日${completed ? "、トレーニング済み" : ""}${dateKey === todayKey ? "、今日" : ""}`}>{day}</span>;
          })}
        </div>
        <p className="calendar-legend"><span className="legend-dot" /> 印のある日はトレーニング済み</p>
      </section>

      <section className="today-card" aria-label="今日のトレーニングのサマリー">
        <div className="dashboard-section-heading"><div><span className="eyebrow">TODAY</span><h2>今日のトレーニング</h2></div><span className="today-status">{activeToday ? "記録中" : todaySessions.length > 0 ? "記録済み" : "未記録"}</span></div>
        {loading ? <p className="today-empty">記録を読み込み中…</p> : todaySetCount === 0 && !activeToday ? <p className="today-empty">まだ記録はありません。今日のトレーニングを始めましょう。</p> : (
          <div className="today-stats"><div><strong>{todaySessions.length + (activeToday ? 1 : 0)}</strong><span>回のトレーニング</span></div><div><strong>{todayExerciseCount}</strong><span>種目</span></div><div><strong>{todaySetCount}</strong><span>セット</span></div></div>
        )}
        {activeToday && <p className="today-note">{formatWorkoutTime(activeToday.startedAt)} に開始した記録が進行中です。</p>}
      </section>

      <button className="primary-button dashboard-cta" type="button" onClick={handleStart} disabled={loading || starting}>
        {starting ? "準備中…" : active ? "進行中のトレーニングを再開" : "今日のトレーニングを追加"}<span aria-hidden="true">↗</span>
      </button>
      {active && !activeToday && <p className="today-note">{formatWorkoutDate(active.startedAt)} に始めたトレーニングを先に再開します。</p>}

      <section className="section-block recent-section">
        <div className="section-title-row"><div><span className="eyebrow">PAST SESSIONS</span><h2>最近の記録</h2></div><Link className="subtle-link" href="/history">すべて見る ↗</Link></div>
        {loading ? <div className="empty-card">記録を読み込み中…</div> : recent.length === 0 ? <div className="empty-card"><p>まだ完了した記録はありません。</p></div> : (
          <div className="history-list">{recent.map((session) => <Link className="history-item" key={session.id} href={`/history/${session.id}`}><div><strong>{formatWorkoutDate(session.startedAt)}</strong><span>{formatWorkoutTime(session.startedAt)} 開始</span></div><span className="history-meta">{session.exerciseCount} 種目 · {session.setCount} セット</span><span className="list-arrow">↗</span></Link>)}</div>
        )}
      </section>
    </main>
  );
}
