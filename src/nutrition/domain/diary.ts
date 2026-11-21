import { shiftDay } from '../../shared/date';
import { entryNutrients, sum } from './nutrients';
import type { DiaryEntry, Meal, Nutrients } from './types';

export interface PastMeal {
  date: string;
  meal: Meal;
  entries: DiaryEntry[];
  totals: Nutrients;
}

/**
 * Earlier meals that can be copied into `meal` of `date`: the same meal on each of the previous `days` days
 * when anything was logged, newest first, then yesterday's other meals.
 */
export function pastMeals(entries: DiaryEntry[], date: string, meal: Meal, days = 14): PastMeal[] {
  const from = shiftDay(date, -days);
  const byMeal = new Map<string, DiaryEntry[]>();
  for (const e of entries) {
    if (e.date >= date || e.date < from) continue;
    const key = `${e.date}|${e.meal}`;
    byMeal.set(key, [...(byMeal.get(key) ?? []), e]);
  }
  const yesterday = shiftDay(date, -1);
  return [...byMeal.entries()]
    .map(([key, list]) => {
      const [d, m] = key.split('|') as [string, Meal];
      return { date: d, meal: m, entries: list.sort((a, b) => a.createdAt.localeCompare(b.createdAt)), totals: sum(list.map(entryNutrients)) };
    })
    .filter((p) => p.meal === meal || p.date === yesterday)
    .sort((a, b) => Number(b.meal === meal) - Number(a.meal === meal) || b.date.localeCompare(a.date));
}

/** Copies of `source` logged for `meal` on `date`, as new entries. */
export function copyEntries(source: DiaryEntry[], date: string, meal: Meal, now: string, newId: () => string): DiaryEntry[] {
  return source.map((e) => ({ ...e, id: newId(), date, meal, createdAt: now }));
}
