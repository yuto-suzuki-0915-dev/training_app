"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { getActiveWorkout, getCompletedWorkoutsInRange, startOrResumeWorkout } from "@/data/workouts";
import { localDayKey, localMonthRange } from "@/domain/progress";
import { formatWorkoutDate, formatWorkoutTime, getErrorMessage, type WorkoutSession, type WorkoutSummary } from "@/domain/workout";

const weekDays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const volumeFormatter = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 });
const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

export default function HomePage() {
  const { client, user } = useAuth();
  const router = useRouter();
  const [today, setToday] = useState<Date | null>(null);
  const [active, setActive] = useState<WorkoutSession | null>(null);
  const [monthSessions, setMonthSessions] = useState<WorkoutSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState(false);
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
    setLoading(true);
    try {
      const { start, end } = localMonthRange(today);
      const [current, monthly] = await Promise.all([
        getActiveWorkout(client, user.id),
        getCompletedWorkoutsInRange(client, user.id, start, end),
      ]);
      setActive(current);
      setMonthSessions(monthly);
      setDataError(false);
      setError("");
    } catch (caught) {
      setActive(null);
      setMonthSessions([]);
      setDataError(true);
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
  const activeDayKey = active ? localDayKey(active.startedAt) : null;
  const todaySessions = monthSessions.filter((session) => localDayKey(session.startedAt) === todayKey);
  const activeToday = active && localDayKey(active.startedAt) === todayKey ? active : null;
  const monthSetCount = monthSessions.reduce((sum, session) => sum + session.setCount, 0);
  const monthVolumeKg = monthSessions.reduce((sum, session) => sum + session.volumeKg, 0);
  const todayExerciseCount = todaySessions.reduce((sum, session) => sum + session.exerciseCount, 0) + (activeToday?.exercises.length ?? 0);
  const todaySetCount = todaySessions.reduce((sum, session) => sum + session.setCount, 0) +
    (activeToday?.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0) ?? 0);
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay();

  return (
    <main className="page-content home-page">
      {error && <div className="alert error-alert" role="alert">{error}<button type="button" onClick={() => { setLoading(true); setError(""); void load(); }}>再読み込み</button></div>}

      <section className="calendar-card home-calendar" aria-label={`${today.getFullYear()}年${today.getMonth() + 1}月のトレーニングカレンダー`}>
        <div className="home-calendar-inner">
          <div className="dashboard-section-heading"><h1>{monthFormatter.format(today)}</h1><span className="calendar-count">{loading || dataError ? "—" : completedDays.size} 日</span></div>
          <div className="calendar-grid">
            {weekDays.map((day) => <span className="calendar-weekday" key={day}>{day}</span>)}
            {Array.from({ length: 42 }, (_, index) => {
              const date = new Date(today.getFullYear(), today.getMonth(), index - firstDay + 1);
              const dateKey = localDayKey(date);
              const inMonth = date.getMonth() === today.getMonth();
              const completed = completedDays.has(dateKey);
              const inProgress = activeDayKey === dateKey;
              return <span className={`calendar-day${inMonth ? "" : " outside-month"}${completed ? " trained" : ""}${inProgress ? " in-progress" : ""}${dateKey === todayKey ? " today" : ""}`} key={dateKey} aria-label={`${date.getMonth() + 1}月${date.getDate()}日${completed ? "、トレーニング済み" : ""}${inProgress ? "、記録中" : ""}${dateKey === todayKey ? "、今日" : ""}`}>{date.getDate()}</span>;
            })}
          </div>
          <div className="calendar-legend"><span><i className="legend-dot" /> トレーニング済み</span><span><i className="legend-dot in-progress-dot" /> 記録中</span></div>
          <div className="calendar-metrics" aria-label="今月の集計">
            <div><span>セット数</span><strong>{loading || dataError ? "—" : monthSetCount}<small>セット</small></strong></div>
            <div><span>総負荷量</span><strong>{loading || dataError ? "—" : volumeFormatter.format(monthVolumeKg)}<small>kg</small></strong></div>
          </div>
          <p className="calendar-metric-note">総負荷量は「重量 × 回数」の合計です。重量0kgのセットもセット数に含みます。</p>
        </div>
      </section>

      <div className="home-lower">
        <section className="today-card home-today" aria-label="今日のトレーニングのサマリー">
          <div className="dashboard-section-heading"><div><span className="eyebrow">TODAY</span><h2>今日のトレーニング</h2></div><span className="today-status">{loading ? "読み込み中" : dataError ? "取得できません" : activeToday ? "記録中" : todaySessions.length > 0 ? "記録済み" : "未記録"}</span></div>
          {loading ? <p className="today-empty">記録を読み込み中…</p> : dataError ? <p className="today-empty">今日の記録を取得できませんでした。</p> : todaySetCount === 0 && !activeToday ? <p className="today-empty">今日の記録はまだありません。</p> : (
            <p className="today-summary">{todaySessions.length + (activeToday ? 1 : 0)} 回のトレーニング <span>·</span> {todayExerciseCount} 種目 <span>·</span> {todaySetCount} セット</p>
          )}
          {activeToday && <p className="today-note">{formatWorkoutTime(activeToday.startedAt)} に開始した記録が進行中です。</p>}
        </section>

        <section className="home-actions" aria-label="ホームの操作">
          <button className="primary-button dashboard-cta" type="button" onClick={handleStart} disabled={loading || starting || dataError}>
            <span className="cta-plus" aria-hidden="true">＋</span>{starting ? "準備中…" : active ? "未完了の記録を再開" : "今日のトレーニングを追加"}<span className="cta-arrow" aria-hidden="true">›</span>
          </button>
          <Link className="home-action-link" href="/history"><span aria-hidden="true">▤</span>履歴を見る<span aria-hidden="true">›</span></Link>
        </section>
        {active && !activeToday && <p className="today-note">{formatWorkoutDate(active.startedAt)} に始めたトレーニングを先に再開します。</p>}
      </div>
    </main>
  );
}
