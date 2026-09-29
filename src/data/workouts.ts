import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Exercise, ExerciseRecord, SetValues, WorkoutExercise, WorkoutSession, WorkoutSet, WorkoutStatus, WorkoutSummary,
} from "@/domain/workout";
import { estimateOneRm } from "@/domain/progress";

type SessionRow = {
  id: string;
  status: WorkoutStatus;
  started_at: string;
  finished_at: string | null;
};

type ExerciseRow = { id: string; name: string; muscle_group: string };

type WorkoutExerciseRow = {
  id: string;
  workout_session_id: string;
  exercise_id: string;
  position: number;
  created_at?: string;
  exercises?: { name: string; muscle_group: string } | null;
};

type SetRow = {
  id: string;
  workout_exercise_id: string;
  position: number;
  weight_kg: number | string;
  reps: number;
  recorded_at: string;
};

function mapSet(row: SetRow): WorkoutSet {
  return {
    id: row.id,
    workoutExerciseId: row.workout_exercise_id,
    position: row.position,
    weightKg: Number(row.weight_kg),
    reps: row.reps,
    recordedAt: row.recorded_at,
  };
}

export async function getExercises(client: SupabaseClient): Promise<Exercise[]> {
  const { data, error } = await client.from("exercises")
    .select("id, name, muscle_group").order("name");
  if (error) throw error;
  return ((data ?? []) as ExerciseRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    muscleGroup: row.muscle_group,
  }));
}

export async function getWorkoutById(
  client: SupabaseClient,
  userId: string,
  workoutId: string,
): Promise<WorkoutSession | null> {
  const { data: sessionData, error: sessionError } = await client.from("workout_sessions")
    .select("id, status, started_at, finished_at")
    .eq("id", workoutId).eq("user_id", userId).maybeSingle();
  if (sessionError) throw sessionError;
  if (!sessionData) return null;
  const session = sessionData as SessionRow;

  const { data: exerciseData, error: exerciseError } = await client.from("workout_exercises")
    .select("id, workout_session_id, exercise_id, position, exercises(name, muscle_group)")
    .eq("workout_session_id", workoutId).order("position");
  if (exerciseError) throw exerciseError;
  const exerciseRows = (exerciseData ?? []) as unknown as WorkoutExerciseRow[];

  let setRows: SetRow[] = [];
  if (exerciseRows.length > 0) {
    const { data: setData, error: setError } = await client.from("workout_sets")
      .select("id, workout_exercise_id, position, weight_kg, reps, recorded_at")
      .in("workout_exercise_id", exerciseRows.map((row) => row.id)).order("position");
    if (setError) throw setError;
    setRows = (setData ?? []) as SetRow[];
  }

  const setsByExercise = new Map<string, WorkoutSet[]>();
  for (const row of setRows) {
    const sets = setsByExercise.get(row.workout_exercise_id) ?? [];
    sets.push(mapSet(row));
    setsByExercise.set(row.workout_exercise_id, sets);
  }

  const exercises: WorkoutExercise[] = exerciseRows.map((row) => ({
    id: row.id,
    exerciseId: row.exercise_id,
    exerciseName: row.exercises?.name ?? "種目",
    muscleGroup: row.exercises?.muscle_group ?? "",
    position: row.position,
    sets: setsByExercise.get(row.id) ?? [],
  }));

  return {
    id: session.id,
    status: session.status,
    startedAt: session.started_at,
    finishedAt: session.finished_at,
    exercises,
  };
}

export async function getActiveWorkout(
  client: SupabaseClient,
  userId: string,
): Promise<WorkoutSession | null> {
  const { data, error } = await client.from("workout_sessions")
    .select("id").eq("user_id", userId).eq("status", "active").maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return getWorkoutById(client, userId, data.id);
}

export async function startOrResumeWorkout(
  client: SupabaseClient,
  userId: string,
): Promise<WorkoutSession> {
  const active = await getActiveWorkout(client, userId);
  if (active) return active;

  const { data, error } = await client.from("workout_sessions")
    .insert({ user_id: userId }).select("id").single();
  if (error) {
    // The partial unique index makes two simultaneous start requests converge.
    if (error.code === "23505") {
      const resumed = await getActiveWorkout(client, userId);
      if (resumed) return resumed;
    }
    throw error;
  }

  const workout = await getWorkoutById(client, userId, data.id);
  if (!workout) throw new Error("作成したトレーニングを読み込めませんでした。");
  return workout;
}

export async function addExercise(
  client: SupabaseClient,
  workoutId: string,
  exerciseId: string,
): Promise<void> {
  const { data: last, error: positionError } = await client.from("workout_exercises")
    .select("position").eq("workout_session_id", workoutId)
    .order("position", { ascending: false }).limit(1);
  if (positionError) throw positionError;

  const { error } = await client.from("workout_exercises").insert({
    workout_session_id: workoutId,
    exercise_id: exerciseId,
    position: ((last ?? [])[0]?.position ?? 0) + 1,
  });
  if (error?.code === "23505") throw new Error("この種目は追加済みです。画面を更新して確認してください。");
  if (error) throw error;
}

export async function saveSet(
  client: SupabaseClient,
  params: { id: string; workoutExerciseId: string; position: number } & SetValues,
): Promise<WorkoutSet> {
  const { data, error } = await client.from("workout_sets").insert({
    id: params.id,
    workout_exercise_id: params.workoutExerciseId,
    position: params.position,
    weight_kg: params.weightKg,
    reps: params.reps,
  }).select("id, workout_exercise_id, position, weight_kg, reps, recorded_at").single();

  if (error?.code === "23505") {
    // A response can be lost after the insert succeeded. Retry with the same UUID.
    const { data: existing, error: lookupError } = await client.from("workout_sets")
      .select("id, workout_exercise_id, position, weight_kg, reps, recorded_at")
      .eq("id", params.id).maybeSingle();
    if (lookupError) throw lookupError;
    if (existing && existing.workout_exercise_id === params.workoutExerciseId &&
      Number(existing.weight_kg) === params.weightKg && existing.reps === params.reps) {
      return mapSet(existing as SetRow);
    }
    throw new Error("セットの保存が重複しました。画面を更新して確認してください。");
  }

  if (error) throw error;
  return mapSet(data as SetRow);
}

export async function updateSet(
  client: SupabaseClient,
  setId: string,
  values: SetValues,
): Promise<void> {
  const { error } = await client.from("workout_sets")
    .update({ weight_kg: values.weightKg, reps: values.reps })
    .eq("id", setId).select("id").single();
  if (error) throw error;
}

export async function deleteSet(client: SupabaseClient, setId: string): Promise<void> {
  const { error } = await client.from("workout_sets")
    .delete().eq("id", setId).select("id").single();
  if (error) throw error;
}

export async function finishWorkout(
  client: SupabaseClient,
  userId: string,
  workoutId: string,
): Promise<void> {
  const workout = await getWorkoutById(client, userId, workoutId);
  if (!workout || workout.status !== "active") throw new Error("進行中のトレーニングが見つかりません。");
  if (!workout.exercises.some((exercise) => exercise.sets.length > 0)) {
    throw new Error("1セット以上記録してから終了してください。");
  }

  const { error } = await client.from("workout_sessions")
    .update({ status: "completed" }).eq("id", workoutId).eq("status", "active")
    .select("id").single();
  if (error) throw error;
}

export async function cancelWorkout(
  client: SupabaseClient,
  workoutId: string,
): Promise<void> {
  const { error } = await client.from("workout_sessions")
    .update({ status: "cancelled" }).eq("id", workoutId).eq("status", "active")
    .select("id").single();
  if (error) throw error;
}

export async function getHistory(
  client: SupabaseClient,
  userId: string,
  limit = 30,
): Promise<WorkoutSummary[]> {
  const { data: sessionData, error: sessionError } = await client.from("workout_sessions")
    .select("id, status, started_at, finished_at")
    .eq("user_id", userId).eq("status", "completed")
    .order("started_at", { ascending: false }).limit(limit);
  if (sessionError) throw sessionError;
  return summarizeSessions(client, (sessionData ?? []) as SessionRow[]);
}

export async function getCompletedWorkoutsInRange(
  client: SupabaseClient,
  userId: string,
  start: string,
  end: string,
): Promise<WorkoutSummary[]> {
  const sessions: SessionRow[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from("workout_sessions")
      .select("id, status, started_at, finished_at")
      .eq("user_id", userId).eq("status", "completed")
      .gte("started_at", start).lt("started_at", end)
      .order("started_at", { ascending: false }).order("id", { ascending: false })
      .range(offset, offset + 499);
    if (error) throw error;
    const rows = (data ?? []) as SessionRow[];
    sessions.push(...rows);
    if (rows.length < 500) break;
  }
  return summarizeSessions(client, sessions);
}

async function summarizeSessions(client: SupabaseClient, sessions: SessionRow[]): Promise<WorkoutSummary[]> {
  if (sessions.length === 0) return [];

  const exerciseRows: Pick<WorkoutExerciseRow, "id" | "workout_session_id">[] = [];
  for (let index = 0; index < sessions.length; index += 100) {
    const sessionIds = sessions.slice(index, index + 100).map((session) => session.id);
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client.from("workout_exercises")
        .select("id, workout_session_id")
        .in("workout_session_id", sessionIds).order("id").range(offset, offset + 499);
      if (error) throw error;
      const rows = (data ?? []) as Pick<WorkoutExerciseRow, "id" | "workout_session_id">[];
      exerciseRows.push(...rows);
      if (rows.length < 500) break;
    }
  }

  const setRows: Pick<SetRow, "workout_exercise_id" | "weight_kg" | "reps">[] = [];
  for (let index = 0; index < exerciseRows.length; index += 100) {
    const exerciseIds = exerciseRows.slice(index, index + 100).map((row) => row.id);
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client.from("workout_sets")
        .select("workout_exercise_id, weight_kg, reps, id")
        .in("workout_exercise_id", exerciseIds).order("id").range(offset, offset + 499);
      if (error) throw error;
      const rows = (data ?? []) as Pick<SetRow, "workout_exercise_id" | "weight_kg" | "reps">[];
      setRows.push(...rows);
      if (rows.length < 500) break;
    }
  }

  const sessionIdByExerciseId = new Map(exerciseRows.map((row) => [row.id, row.workout_session_id]));
  const counts = new Map(sessions.map((session) => [session.id, { exercises: 0, sets: 0, volumeKg: 0 }]));
  for (const row of exerciseRows) counts.get(row.workout_session_id)!.exercises += 1;
  for (const row of setRows) {
    const sessionId = sessionIdByExerciseId.get(row.workout_exercise_id);
    if (sessionId) {
      const summary = counts.get(sessionId)!;
      summary.sets += 1;
      summary.volumeKg += Number(row.weight_kg) * row.reps;
    }
  }

  return sessions.map((session) => ({
    id: session.id,
    startedAt: session.started_at,
    finishedAt: session.finished_at!,
    exerciseCount: counts.get(session.id)!.exercises,
    setCount: counts.get(session.id)!.sets,
    volumeKg: Math.round(counts.get(session.id)!.volumeKg * 100) / 100,
  }));
}

export async function getExerciseRecord(
  client: SupabaseClient,
  userId: string,
  exerciseId: string,
): Promise<ExerciseRecord> {
  const workoutExerciseIds: string[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from("workout_exercises")
      .select("id, workout_sessions!inner(user_id, status)")
      .eq("exercise_id", exerciseId)
      .eq("workout_sessions.user_id", userId)
      .in("workout_sessions.status", ["active", "completed"])
      .order("id")
      .range(offset, offset + 499);
    if (error) throw error;
    const rows = data ?? [];
    workoutExerciseIds.push(...rows.map((row) => row.id));
    if (rows.length < 500) break;
  }

  let maxWeight: WorkoutSet | null = null;
  let estimatedOneRm: number | null = null;
  for (let index = 0; index < workoutExerciseIds.length; index += 100) {
    const ids = workoutExerciseIds.slice(index, index + 100);
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client.from("workout_sets")
        .select("id, workout_exercise_id, position, weight_kg, reps, recorded_at")
        .in("workout_exercise_id", ids).order("id").range(offset, offset + 499);
      if (error) throw error;
      const rows = (data ?? []) as SetRow[];
      for (const row of rows) {
        const set = mapSet(row);
        if (!maxWeight || set.weightKg > maxWeight.weightKg ||
          (set.weightKg === maxWeight.weightKg && set.recordedAt > maxWeight.recordedAt)) maxWeight = set;
        const estimate = estimateOneRm(set.weightKg, set.reps);
        if (estimate !== null && (estimatedOneRm === null || estimate > estimatedOneRm)) estimatedOneRm = estimate;
      }
      if (rows.length < 500) break;
    }
  }
  return { maxWeight, estimatedOneRm };
}

export async function getLastExerciseSets(
  client: SupabaseClient,
  userId: string,
  exerciseId: string,
): Promise<WorkoutSet[]> {
  const { data, error } = await client.from("workout_exercises")
    .select("id, workout_sessions!inner(user_id, status)")
    .eq("exercise_id", exerciseId)
    .eq("workout_sessions.user_id", userId)
    .eq("workout_sessions.status", "completed")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (!data) return [];

  const { data: setData, error: setError } = await client.from("workout_sets")
    .select("id, workout_exercise_id, position, weight_kg, reps, recorded_at")
    .eq("workout_exercise_id", data.id).order("position");
  if (setError) throw setError;
  return ((setData ?? []) as SetRow[]).map(mapSet);
}
