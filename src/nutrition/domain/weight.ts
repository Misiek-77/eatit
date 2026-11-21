import { dateOfKey, shiftDay } from '../../shared/date';
import type { WeightPlan } from './types';

export interface WeightPoint {
  date: string;
  kg: number;
  updatedAt: string;
}

/** One reading per day from several sources (this app and the training app), the most recently changed winning. */
export function mergeWeights(...sources: WeightPoint[][]): WeightPoint[] {
  const byDay = new Map<string, WeightPoint>();
  for (const p of sources.flat()) {
    const had = byDay.get(p.date);
    if (!had || had.updatedAt < p.updatedAt) byDay.set(p.date, p);
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Average of the readings in the 7 days ending on `date`; null without any. */
export function averageAt(points: WeightPoint[], date: string): number | null {
  const from = shiftDay(date, -6);
  const inside = points.filter((p) => p.date >= from && p.date <= date);
  return inside.length ? inside.reduce((s, p) => s + p.kg, 0) / inside.length : null;
}

/** The 7-day average at each reading: day-to-day swings (water, salt) mostly cancel out. */
export const trendLine = (points: WeightPoint[]) => points.map((p) => ({ date: p.date, kg: averageAt(points, p.date)! }));

const daysBetween = (a: string, b: string) => Math.round((dateOfKey(b).getTime() - dateOfKey(a).getTime()) / 86_400_000);

/**
 * Change of the 7-day average per week, from about the last four weeks of readings. Null until readings span
 * at least 10 days, since anything shorter is mostly noise.
 */
export function weeklyChange(points: WeightPoint[]): number | null {
  if (points.length < 3) return null;
  const last = points.at(-1)!.date;
  const window = points.filter((p) => p.date >= shiftDay(last, -28));
  const first = window[0].date;
  const span = daysBetween(first, last);
  if (span < 10) return null;
  const start = averageAt(window, shiftDay(first, 6))!;
  const end = averageAt(window, last)!;
  return ((end - start) / (span - 6)) * 7;
}

export type TrendVerdict = { tone: 'good' | 'adjust'; text: string };

/**
 * What the trend means for the plan. Healthy pace: losing 0.25–1% of body weight a week, gaining up to 0.5%,
 * keeping within 0.25%. A step of about 200 kcal a day changes the trend by roughly 0.2 kg a week.
 */
export function verdict(change: number, weightKg: number, plan: WeightPlan): TrendVerdict {
  const share = change / weightKg;
  if (plan === 'lose') {
    if (share > -0.0025) return { tone: 'adjust', text: 'Waga prawie stoi. Żeby chudnąć, zjadaj około 200 kcal mniej dziennie.' };
    if (share < -0.01) return { tone: 'adjust', text: 'Spadek jest bardzo szybki. Żeby nie tracić mięśni, zjadaj około 200 kcal więcej dziennie.' };
    return { tone: 'good', text: 'Dobre tempo chudnięcia. Tak trzymaj.' };
  }
  if (plan === 'gain') {
    if (share < 0.001) return { tone: 'adjust', text: 'Waga nie rośnie. Żeby budować masę, zjadaj około 200 kcal więcej dziennie.' };
    if (share > 0.005) return { tone: 'adjust', text: 'Waga rośnie szybko, część to pewnie tłuszcz. Zjadaj około 200 kcal mniej dziennie.' };
    return { tone: 'good', text: 'Dobre tempo budowania masy. Tak trzymaj.' };
  }
  if (Math.abs(share) <= 0.0025) return { tone: 'good', text: 'Waga stabilna, zgodnie z celem.' };
  return change > 0
    ? { tone: 'adjust', text: 'Waga rośnie. Żeby ją utrzymać, zjadaj około 200 kcal mniej dziennie.' }
    : { tone: 'adjust', text: 'Waga spada. Żeby ją utrzymać, zjadaj około 200 kcal więcej dziennie.' };
}
