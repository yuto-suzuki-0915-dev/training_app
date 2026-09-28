"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  formatWeight, formatWorkoutDate, formatWorkoutTime, getErrorMessage, parseSetInput,
  type Exercise, type WorkoutExercise, type WorkoutSession, type WorkoutSet,
} from "@/domain/workout";
import {
  addExercise, cancelWorkout, deleteSet, finishWorkout, getActiveWorkout,
  getExercises, getLastExerciseSets, getWorkoutById, saveSet, updateSet,
} from "@/data/workouts";

type Draft = { id: string; weight: string; reps: string };
type Edit = { id: string; weight: string; reps: string };

export default function WorkoutPage() {
  const { client, user } = useAuth();
  const router = useRouter();
  const [workout, setWorkout] = useState<WorkoutSession | null>(null);
  const [catalog, setCatalog] = useState<Exercise[]>([]);
  const [previous, setPrevious] = useState<Record<string, WorkoutSet[]>>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [editing, setEditing] = useState<Edit | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const operationInFlight = useRef(false);

  const load = useCallback(async () => {
    if (!client || !user) return;
    try {
      const [active, exercises] = await Promise.all([
        getActiveWorkout(client, user.id), getExercises(client),
      ]);
      setWorkout(active);
      setCatalog(exercises);
      if (active) {
        const results = await Promise.allSettled(active.exercises.map(async (exercise) => ({
          id: exercise.exerciseId,
          sets: await getLastExerciseSets(client, user.id, exercise.exerciseId),
        })));
        const records: Record<string, WorkoutSet[]> = {};
        for (const result of results) {
          if (result.status === "fulfilled") records[result.value.id] = result.value.sets;
        }
        setPrevious(records);
      }
    } catch (caught) {
      setError(getErrorMessage(caught, "トレーニングを読み込めませんでした。"));
    } finally {
      setLoading(false);
    }
  }, [client, user]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function refreshWorkout() {
    if (!client || !user || !workout) return;
    const updated = await getWorkoutById(client, user.id, workout.id);
    if (!updated) throw new Error("トレーニングを再読み込みできませんでした。");
    setWorkout(updated);
  }

  async function runAction(key: string, action: () => Promise<void>) {
    if (operationInFlight.current) return;
    operationInFlight.current = true;
    setBusy(key);
    setError("");
    setErrorKey(null);
    setNotice("");
    try {
      await action();
    } catch (caught) {
      setError(getErrorMessage(caught, "操作に失敗しました。もう一度お試しください。"));
      setErrorKey(key);
    } finally {
      operationInFlight.current = false;
      setBusy(null);
    }
  }

  function updateDraft(exerciseId: string, field: "weight" | "reps", value: string) {
    setDrafts((current) => ({
      ...current,
      [exerciseId]: { ...(current[exerciseId] ?? { id: crypto.randomUUID(), weight: "", reps: "" }), [field]: value },
    }));
  }

  async function handleAddExercise(exercise: Exercise) {
    if (!client || !user || !workout) return;
    await runAction(`exercise:${exercise.id}`, async () => {
      await addExercise(client, workout.id, exercise.id);
      await refreshWorkout();
      setDialogOpen(false);
      setSearch("");
      try {
        const sets = await getLastExerciseSets(client, user.id, exercise.id);
        setPrevious((current) => ({ ...current, [exercise.id]: sets }));
      } catch {
        setPrevious((current) => ({ ...current, [exercise.id]: [] }));
      }
    });
  }

  async function handleSaveSet(event: FormEvent<HTMLFormElement>, exercise: WorkoutExercise) {
    event.preventDefault();
    if (!client || !workout || busy) return;
    const draft = drafts[exercise.id];
    if (!draft) return;
    let values;
    try { values = parseSetInput(draft.weight, draft.reps); }
    catch (caught) { setError(getErrorMessage(caught, "入力を確認してください。")); setErrorKey(`set:${exercise.id}`); return; }

    await runAction(`set:${exercise.id}`, async () => {
      const position = Math.max(0, ...exercise.sets.map((set) => set.position)) + 1;
      await saveSet(client, { id: draft.id, workoutExerciseId: exercise.id, position, ...values });
      await refreshWorkout();
      setDrafts((current) => ({ ...current, [exercise.id]: { id: crypto.randomUUID(), weight: "", reps: "" } }));
      setNotice("セットを保存しました。");
    });
  }

  async function handleUpdateSet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || !editing || busy) return;
    let values;
    try { values = parseSetInput(editing.weight, editing.reps); }
    catch (caught) { setError(getErrorMessage(caught, "入力を確認してください。")); setErrorKey(`edit:${editing.id}`); return; }
    await runAction(`edit:${editing.id}`, async () => {
      await updateSet(client, editing.id, values);
      await refreshWorkout();
      setEditing(null);
      setNotice("セットを修正しました。");
    });
  }

  async function handleDeleteSet(set: WorkoutSet) {
    if (!client || busy || !window.confirm("このセットを削除しますか？")) return;
    await runAction(`delete:${set.id}`, async () => {
      await deleteSet(client, set.id);
      await refreshWorkout();
      setNotice("セットを削除しました。");
    });
  }

  const hasUnsavedInput = Object.values(drafts).some((draft) => draft.weight.trim() || draft.reps.trim()) || editing !== null;
  const completedSetCount = workout?.exercises.reduce((count, exercise) => count + exercise.sets.length, 0) ?? 0;

  async function handleFinish() {
    if (!client || !user || !workout || busy) return;
    if (hasUnsavedInput) { setError("未保存の入力があります。記録するか、入力を消してから終了してください。"); return; }
    if (completedSetCount === 0) { setError("1セット以上記録してから終了してください。"); return; }
    if (!window.confirm("トレーニングを終了しますか？終了後は記録を編集できません。")) return;
    await runAction("finish", async () => {
      await finishWorkout(client, user.id, workout.id);
      router.push(`/history/${workout.id}`);
    });
  }

  async function handleCancel() {
    if (!client || !workout || busy) return;
    if (!window.confirm("このトレーニングを中止しますか？中止した記録は履歴に表示されません。")) return;
    await runAction("cancel", async () => {
      await cancelWorkout(client, workout.id);
      router.push("/");
    });
  }

  const available = catalog.filter((exercise) =>
    !workout?.exercises.some((added) => added.exerciseId === exercise.id) &&
    `${exercise.name} ${exercise.muscleGroup}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  if (loading) return <main className="page-content"><div className="empty-card">トレーニングを読み込み中…</div></main>;
  if (!workout) return <main className="page-content"><div className="empty-card"><h1>進行中のトレーニングはありません</h1><p>ホームから新しいトレーニングを開始してください。</p><Link className="primary-button inline-button" href="/">ホームへ戻る ↗</Link></div></main>;

  return (
    <main className="page-content workout-page">
      <div className="page-heading compact-heading"><span className="eyebrow">ACTIVE SESSION</span><h1>トレーニング記録<span className="accent-dot">.</span></h1><p>{formatWorkoutDate(workout.startedAt)} · {formatWorkoutTime(workout.startedAt)} 開始</p></div>
      <div className="session-strip"><span><span className="status-dot" /> 記録中</span><strong>{workout.exercises.length} 種目 <i /> {completedSetCount} セット</strong></div>
      {error && <div className="alert error-alert" role="alert">{error}<button type="button" onClick={() => { setLoading(true); setError(""); void load(); }}>再読み込み</button></div>}
      {notice && <div className="alert success-alert" role="status">{notice}</div>}

      {workout.exercises.length === 0 ? <div className="empty-card"><span className="empty-icon">＋</span><h2>種目を追加しましょう</h2><p>最初の種目を選ぶと、セットを記録できます。</p></div> : (
        <div className="exercise-stack">
          {workout.exercises.map((exercise) => {
            const draft = drafts[exercise.id] ?? { id: "", weight: "", reps: "" };
            const previousSets = previous[exercise.exerciseId] ?? [];
            return <section className="exercise-card" key={exercise.id}>
              <div className="exercise-heading"><div><span className="exercise-number">{String(exercise.position).padStart(2, "0")} / {exercise.muscleGroup}</span><h2>{exercise.exerciseName}</h2></div><span className="set-count">{exercise.sets.length} セット</span></div>

              <div className="previous-box"><span className="mini-label">前回の記録</span>{previousSets.length === 0 ? <p>この種目の前回記録はありません</p> : <div className="previous-pills">{previousSets.map((set) => <span key={set.id}>{formatWeight(set.weightKg)}kg × {set.reps}</span>)}</div>}</div>

              <div className="set-table"><div className="set-table-head"><span>SET</span><span>重量</span><span>回数</span><span>操作</span></div>
                {exercise.sets.length === 0 ? <div className="set-empty">まだセットがありません</div> : exercise.sets.map((set, index) => (
                  <div className="set-row" key={set.id}><span className="set-index">{String(index + 1).padStart(2, "0")}</span><strong>{formatWeight(set.weightKg)} <small>kg</small></strong><strong>{set.reps} <small>回</small></strong><div className="set-actions"><button type="button" disabled={Boolean(busy)} onClick={() => setEditing({ id: set.id, weight: String(set.weightKg), reps: String(set.reps) })} aria-label={`${index + 1}セット目を編集`}>編集</button><button type="button" disabled={Boolean(busy)} onClick={() => void handleDeleteSet(set)} aria-label={`${index + 1}セット目を削除`}>削除</button></div></div>
                ))}
              </div>

              <form className="set-entry" onSubmit={(event) => void handleSaveSet(event, exercise)}><span className="entry-label">セットを追加</span><div className="entry-fields"><label><span>重量 kg</span><input type="text" inputMode="decimal" placeholder="80" value={draft.weight} onChange={(event) => updateDraft(exercise.id, "weight", event.target.value)} disabled={Boolean(busy)} required /></label><label><span>回数</span><input type="text" inputMode="numeric" placeholder="8" value={draft.reps} onChange={(event) => updateDraft(exercise.id, "reps", event.target.value)} disabled={Boolean(busy)} required /></label><button className="save-set-button" type="submit" disabled={Boolean(busy)}>{busy === `set:${exercise.id}` ? "保存中…" : "記録する"}</button></div>{error && errorKey === `set:${exercise.id}` && <p className="field-error" role="alert">保存できませんでした。入力は残っています。{error}</p>}</form>
            </section>;
          })}
        </div>
      )}

      <button className="add-exercise-button" type="button" onClick={() => setDialogOpen(true)} disabled={Boolean(busy)}><span>＋</span> 種目を追加する</button>
      <div className="session-actions"><button className="primary-button" type="button" onClick={() => void handleFinish()} disabled={Boolean(busy) || completedSetCount === 0}>トレーニングを終了 <span aria-hidden="true">↗</span></button><button className="text-button danger-text" type="button" onClick={() => void handleCancel()} disabled={Boolean(busy)}>このトレーニングを中止</button></div>

      {dialogOpen && <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialogOpen(false); }}><div className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="exercise-dialog-title"><div className="dialog-header"><div><span className="eyebrow">EXERCISE LIBRARY</span><h2 id="exercise-dialog-title">種目を選ぶ</h2></div><button className="close-button" type="button" onClick={() => setDialogOpen(false)} aria-label="閉じる">×</button></div>{error && <div className="alert error-alert" role="alert">{error}</div>}<input className="search-input" type="search" placeholder="種目名・部位で検索" value={search} onChange={(event) => setSearch(event.target.value)} autoFocus /><div className="exercise-options">{available.length === 0 ? <p className="option-empty">該当する種目がありません</p> : available.map((exercise) => <button key={exercise.id} type="button" onClick={() => void handleAddExercise(exercise)} disabled={Boolean(busy)}><span><strong>{exercise.name}</strong><small>{exercise.muscleGroup}</small></span><b>＋</b></button>)}</div></div></div>}

      {editing && <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}><div className="dialog-card edit-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-dialog-title"><div className="dialog-header"><div><span className="eyebrow">EDIT SET</span><h2 id="edit-dialog-title">セットを修正</h2></div><button className="close-button" type="button" onClick={() => setEditing(null)} aria-label="閉じる">×</button></div>{error && <div className="alert error-alert" role="alert">{error}</div>}<form className="form-stack" onSubmit={(event) => void handleUpdateSet(event)}><label htmlFor="edit-weight">重量 kg</label><input id="edit-weight" type="text" inputMode="decimal" value={editing.weight} onChange={(event) => setEditing({ ...editing, weight: event.target.value })} disabled={Boolean(busy)} required /><label htmlFor="edit-reps">回数</label><input id="edit-reps" type="text" inputMode="numeric" value={editing.reps} onChange={(event) => setEditing({ ...editing, reps: event.target.value })} disabled={Boolean(busy)} required /><button className="primary-button" type="submit" disabled={Boolean(busy)}>変更を保存 <span aria-hidden="true">↗</span></button></form></div></div>}
    </main>
  );
}
