"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { getCompletedWorkoutsInRange, startOrResumeWorkout } from "@/data/workouts";
import { localDayKey, localMonthRange } from "@/domain/progress";
import { getErrorMessage, type WorkoutSummary } from "@/domain/workout";

const weekDays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

export default function HomePage() {
  const { client, user } = useAuth();
  const router = useRouter();
  const [today, setToday] = useState<Date | null>(null);
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
      const monthly = await getCompletedWorkoutsInRange(client, user.id, start, end);
      setMonthSessions(monthly);
      setDataError(false);
      setError("");
    } catch (caught) {
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
  const todaySessions = monthSessions.filter((session) => localDayKey(session.startedAt) === todayKey);
  const todayExerciseCount = todaySessions.reduce((sum, session) => sum + session.exerciseCount, 0);
  const todaySetCount = todaySessions.reduce((sum, session) => sum + session.setCount, 0);
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay();

  return (
    <main className="page-content home-page">
      {error && <div className="alert error-alert" role="alert">{error}<button type="button" onClick={() => { setLoading(true); setError(""); void load(); }}>再読み込み</button></div>}

      <section className="calendar-card home-calendar" aria-label={`${today.getFullYear()}年${today.getMonth() + 1}月のトレーニングカレンダー`}>
        <div className="home-calendar-inner">
          <div className="dashboard-section-heading"><h1>{monthFormatter.format(today)}</h1></div>
          <div className="calendar-grid">
            {weekDays.map((day) => <span className="calendar-weekday" key={day}>{day}</span>)}
            {Array.from({ length: 42 }, (_, index) => {
              const date = new Date(today.getFullYear(), today.getMonth(), index - firstDay + 1);
              const dateKey = localDayKey(date);
              const inMonth = date.getMonth() === today.getMonth();
              const completed = completedDays.has(dateKey);
              return <span className={`calendar-day${inMonth ? "" : " outside-month"}${completed ? " trained" : ""}${dateKey === todayKey ? " today" : ""}`} key={dateKey} aria-label={`${date.getMonth() + 1}月${date.getDate()}日${completed ? "、トレーニング済み" : ""}${dateKey === todayKey ? "、今日" : ""}`}>{date.getDate()}</span>;
            })}
          </div>
          <div className="monthly-archive" aria-label="今月のトレーニング日数">
            <span className="monthly-archive-label">MONTHLY<br />ARCHIVE</span>
            <strong>{loading || dataError ? "—" : completedDays.size}<small>days</small></strong>
          </div>
        </div>
      </section>

      <div className="home-lower">
        {!dataError && todaySessions.length > 0 && (
          <section className="today-card home-today" aria-label="今日のトレーニングのサマリー">
            <div className="dashboard-section-heading"><div><span className="eyebrow">TODAY</span><h2>今日のトレーニング</h2></div><span className="today-status">記録済み</span></div>
            <p className="today-summary">{todaySessions.length} 回のトレーニング <span>·</span> {todayExerciseCount} 種目 <span>·</span> {todaySetCount} セット</p>
          </section>
        )}

        <section className="home-actions" aria-label="ホームの操作">
          <button className="primary-button dashboard-cta" type="button" onClick={handleStart} disabled={loading || starting || dataError}>
            <span className="cta-plus" aria-hidden="true">＋</span>{starting ? "準備中…" : "今日のトレーニングを追加"}<span className="cta-arrow" aria-hidden="true">›</span>
          </button>
          <button className="home-action-link" type="button" disabled title="RM計算機は準備中です" aria-label="RM計算機（準備中）">
            <svg className="rm-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 12h18M5 8v8M8 9v6M16 9v6M19 8v8" /></svg>
            <span className="rm-action-copy">RM計算機<small>準備中</small></span>
          </button>
        </section>
        <button className="monthly-share-button" type="button" disabled title="月間サマリーの共有は準備中です">
          月間サマリーをシェアする <small>準備中</small>
        </button>
      </div>
    </main>
  );
}
