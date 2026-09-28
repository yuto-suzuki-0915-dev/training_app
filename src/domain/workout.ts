export type Exercise = {
  id: string;
  name: string;
  muscleGroup: string;
};

export type WorkoutSet = {
  id: string;
  workoutExerciseId: string;
  position: number;
  weightKg: number;
  reps: number;
  recordedAt: string;
};

export type WorkoutExercise = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string;
  position: number;
  sets: WorkoutSet[];
};

export type WorkoutStatus = "active" | "completed" | "cancelled";

export type WorkoutSession = {
  id: string;
  status: WorkoutStatus;
  startedAt: string;
  finishedAt: string | null;
  exercises: WorkoutExercise[];
};

export type WorkoutSummary = {
  id: string;
  startedAt: string;
  finishedAt: string;
  exerciseCount: number;
  setCount: number;
};

export type SetValues = { weightKg: number; reps: number };

export function parseSetInput(weight: string, reps: string): SetValues {
  const trimmedWeight = weight.trim();
  const trimmedReps = reps.trim();

  if (!/^\d{1,5}(?:\.\d{1,2})?$/.test(trimmedWeight)) {
    throw new Error("重量は0以上、少数第2位までのkgで入力してください。");
  }

  if (!/^\d+$/.test(trimmedReps)) {
    throw new Error("回数は1以上の整数で入力してください。");
  }

  const weightKg = Number(trimmedWeight);
  const parsedReps = Number(trimmedReps);

  if (!Number.isFinite(weightKg) || !Number.isInteger(parsedReps) || parsedReps < 1 || parsedReps > 2147483647) {
    throw new Error("重量または回数が入力可能な範囲を超えています。");
  }

  return { weightKg, reps: parsedReps };
}

export function formatWorkoutDate(date: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(new Date(date));
}

export function formatWorkoutTime(date: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatWeight(weightKg: number): string {
  return String(weightKg);
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && /[ぁ-んァ-ン一-龥]/.test(error.message)) return error.message;
  return fallback;
}
