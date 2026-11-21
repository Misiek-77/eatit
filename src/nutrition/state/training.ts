import { useEffect, useState } from 'react';
import { dayKey } from '../../shared/date';
import { readDatabase } from '../../shared/otherApp';
import type { WeightPoint } from '../domain/weight';

/** What the diary takes from the training app on this device: workout days and body weight readings. */
export interface TrainingLink {
  /** Days with a workout, "2026-11-21". */
  workoutDays: Set<string>;
  weights: WeightPoint[];
}

const EMPTY: TrainingLink = { workoutDays: new Set(), weights: [] };

export async function readTrainingLink(): Promise<TrainingLink> {
  const db = await readDatabase('trening');
  if (!db) return EMPTY;
  const workoutDays = new Set<string>();
  for (const w of (db.workouts ?? []) as { startedAt?: unknown }[]) {
    if (typeof w.startedAt === 'string') workoutDays.add(dayKey(new Date(w.startedAt)));
  }
  const weights: WeightPoint[] = [];
  for (const m of (db.measurements ?? []) as { date?: unknown; values?: { weight?: unknown }; updatedAt?: unknown }[]) {
    const kg = m.values?.weight;
    if (typeof m.date === 'string' && typeof kg === 'number' && kg > 0) weights.push({ date: m.date, kg, updatedAt: typeof m.updatedAt === 'string' ? m.updatedAt : '' });
  }
  return { workoutDays, weights };
}

/** The training app's data, read again whenever the diary comes back to the foreground. */
export function useTrainingLink(): TrainingLink {
  const [link, setLink] = useState(EMPTY);
  useEffect(() => {
    let alive = true;
    const load = () => void readTrainingLink().then((l) => alive && setLink(l), () => undefined);
    load();
    const onShow = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onShow);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onShow);
    };
  }, []);
  return link;
}
