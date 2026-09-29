export function localDayKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localMonthRange(date: Date): { start: string; end: string } {
  return {
    start: new Date(date.getFullYear(), date.getMonth(), 1).toISOString(),
    end: new Date(date.getFullYear(), date.getMonth() + 1, 1).toISOString(),
  };
}

// Epley estimate; high-repetition sets are excluded because the estimate becomes unreliable.
export function estimateOneRm(weightKg: number, reps: number): number | null {
  if (!Number.isFinite(weightKg) || weightKg <= 0 || !Number.isInteger(reps) || reps < 1 || reps > 10) return null;
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

export function estimateRm(weightKg: number, estimatedOneRm: number | null): number | null {
  if (!estimatedOneRm || !Number.isFinite(weightKg) || weightKg <= 0) return null;
  return Math.max(1, Math.round(30 * (estimatedOneRm / weightKg - 1)));
}
