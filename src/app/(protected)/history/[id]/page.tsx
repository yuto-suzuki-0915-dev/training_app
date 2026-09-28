"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { getWorkoutById } from "@/data/workouts";
import { formatWeight, formatWorkoutDate, formatWorkoutTime, getErrorMessage, type WorkoutSession } from "@/domain/workout";

export default function HistoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { client, user } = useAuth();
  const [workout, setWorkout] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!client || !user || !id) return;
    try {
      const result = await getWorkoutById(client, user.id, id);
      setWorkout(result?.status === "completed" ? result : null);
    } catch (caught) { setError(getErrorMessage(caught, "履歴を読み込めませんでした。")); }
    finally { setLoading(false); }
  }, [client, id, user]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return <main className="page-content detail-page">
    <Link className="back-link" href="/history">← 履歴に戻る</Link>
    {error && <div className="alert error-alert" role="alert">{error}<button type="button" onClick={() => { setLoading(true); setError(""); void load(); }}>再読み込み</button></div>}
    {loading ? <div className="empty-card">記録を読み込み中…</div> : !workout ? <div className="empty-card"><h1>記録が見つかりません</h1><p>この記録は表示できません。</p></div> : <>
      <div className="page-heading compact-heading"><span className="eyebrow">SESSION DETAILS</span><h1>{formatWorkoutDate(workout.startedAt)}<span className="accent-dot">.</span></h1><p>{formatWorkoutTime(workout.startedAt)} 開始 · {workout.finishedAt ? formatWorkoutTime(workout.finishedAt) : ""} 終了</p></div>
      <div className="session-strip"><span>完了したトレーニング</span><strong>{workout.exercises.length} 種目 <i /> {workout.exercises.reduce((total, exercise) => total + exercise.sets.length, 0)} セット</strong></div>
      <div className="exercise-stack">{workout.exercises.map((exercise) => <section className="exercise-card" key={exercise.id}><div className="exercise-heading"><div><span className="exercise-number">{String(exercise.position).padStart(2, "0")} / {exercise.muscleGroup}</span><h2>{exercise.exerciseName}</h2></div><span className="set-count">{exercise.sets.length} セット</span></div><div className="set-table"><div className="set-table-head detail-table-head"><span>SET</span><span>重量</span><span>回数</span></div>{exercise.sets.length === 0 ? <div className="set-empty">記録したセットはありません</div> : exercise.sets.map((set, index) => <div className="set-row detail-set-row" key={set.id}><span className="set-index">{String(index + 1).padStart(2, "0")}</span><strong>{formatWeight(set.weightKg)} <small>kg</small></strong><strong>{set.reps} <small>回</small></strong></div>)}</div></section>)}</div>
    </>}
  </main>;
}
