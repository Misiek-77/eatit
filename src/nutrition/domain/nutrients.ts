import type { DiaryEntry, Goals, Meal, Nutrients } from './types';

const ZERO: Nutrients = { kcal: 0, protein: 0, fat: 0, carbs: 0 };

/** What `grams` of a food with these values per 100 g contain. */
export function forGrams(per100: Nutrients, grams: number): Nutrients {
  const f = grams / 100;
  const out: Nutrients = { kcal: per100.kcal * f, protein: per100.protein * f, fat: per100.fat * f, carbs: per100.carbs * f };
  if (per100.fiber !== undefined) out.fiber = per100.fiber * f;
  if (per100.sugar !== undefined) out.sugar = per100.sugar * f;
  if (per100.salt !== undefined) out.salt = per100.salt * f;
  return out;
}

/** The sum of several amounts; optional values are summed only when some entry has them. */
export function sum(list: Nutrients[]): Nutrients {
  return list.reduce<Nutrients>((acc, n) => {
    const out: Nutrients = { kcal: acc.kcal + n.kcal, protein: acc.protein + n.protein, fat: acc.fat + n.fat, carbs: acc.carbs + n.carbs };
    for (const k of ['fiber', 'sugar', 'salt'] as const) {
      if (acc[k] !== undefined || n[k] !== undefined) out[k] = (acc[k] ?? 0) + (n[k] ?? 0);
    }
    return out;
  }, ZERO);
}

/** What one diary entry adds up to. */
export const entryNutrients = (e: DiaryEntry) => forGrams(e.per100, e.grams);

/** Totals for one day, and for each meal of it. */
export function dayTotals(entries: DiaryEntry[], date: string): { day: Nutrients; meals: Record<Meal, Nutrients> } {
  const today = entries.filter((e) => e.date === date);
  const of = (meal: Meal) => sum(today.filter((e) => e.meal === meal).map(entryNutrients));
  return { day: sum(today.map(entryNutrients)), meals: { breakfast: of('breakfast'), lunch: of('lunch'), dinner: of('dinner'), snack: of('snack') } };
}

/**
 * Energy the macronutrients account for (4 kcal per gram of protein and carbohydrate, 9 per gram of fat).
 * Fibre is part of the carbohydrates on EU labels but gives about 2 kcal, so it is counted at that.
 */
export function kcalFromMacros(n: Nutrients): number {
  return n.protein * 4 + (n.carbs - (n.fiber ?? 0)) * 4 + (n.fiber ?? 0) * 2 + n.fat * 9;
}

/**
 * Whether label values look inconsistent: the energy stated differs from what the macros give by more than
 * 15% (and 20 kcal, so tiny numbers are not flagged). Catches a misread or mistyped value.
 */
export function looksWrong(n: Nutrients): boolean {
  const fromMacros = kcalFromMacros(n);
  const diff = Math.abs(fromMacros - n.kcal);
  return diff > 20 && diff > 0.15 * Math.max(n.kcal, fromMacros);
}

/**
 * Daily goals from body weight, energy and a protein share: protein in grams per kilogram, fat as a share of
 * energy, carbohydrates make up the rest. Rounded to whole grams.
 */
export function goalsFromWeight(weightKg: number, kcal: number, proteinPerKg = 2, fatShare = 0.25): Goals {
  const protein = Math.round(weightKg * proteinPerKg);
  const fat = Math.round((kcal * fatShare) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal: Math.round(kcal), protein, fat, carbs };
}

/** The day's goals with the training-day extra: energy goes up, the added part as carbohydrates. */
export function goalsForDay(goals: Goals, bonusKcal: number, trainingDay: boolean): Goals {
  if (!trainingDay || bonusKcal <= 0) return goals;
  return { ...goals, kcal: goals.kcal + bonusKcal, carbs: goals.carbs + Math.round(bonusKcal / 4) };
}
