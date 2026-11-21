import { dateOfKey, shiftDay } from '../../shared/date';
import { dayTotals } from './nutrients';
import type { DiaryEntry, Goals, Nutrients, WaterDay } from './types';

/** Monday of the week the day belongs to. */
export function weekStart(date: string): string {
  const weekday = (dateOfKey(date).getDay() + 6) % 7;
  return shiftDay(date, -weekday);
}

export interface WeekDay {
  date: string;
  totals: Nutrients;
  goals: Goals;
  /** Something was logged this day. */
  logged: boolean;
  waterMl: number;
}

export interface WeekSummary {
  days: WeekDay[];
  /** Averages over the days with anything logged; null when none was. */
  average: Nutrients | null;
  loggedDays: number;
  /** Days that reached the protein goal (90% of it counts). */
  proteinDays: number;
  /** Days within 10% of the energy goal. */
  kcalDays: number;
  averageWaterMl: number;
}

/** The week from `monday`, up to `today` at most. `goalsOn` gives each day's goals (more on training days). */
export function weekSummary(entries: DiaryEntry[], water: WaterDay[], monday: string, today: string, goalsOn: (date: string) => Goals): WeekSummary {
  const days: WeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = shiftDay(monday, i);
    if (date > today) break;
    const totals = dayTotals(entries, date).day;
    days.push({ date, totals, goals: goalsOn(date), logged: entries.some((e) => e.date === date), waterMl: water.find((w) => w.date === date)?.ml ?? 0 });
  }
  const logged = days.filter((d) => d.logged);
  const avg = (pick: (n: Nutrients) => number) => logged.reduce((s, d) => s + pick(d.totals), 0) / logged.length;
  const watered = days.filter((d) => d.waterMl > 0);
  return {
    days,
    average: logged.length ? { kcal: avg((n) => n.kcal), protein: avg((n) => n.protein), fat: avg((n) => n.fat), carbs: avg((n) => n.carbs) } : null,
    loggedDays: logged.length,
    proteinDays: logged.filter((d) => d.totals.protein >= d.goals.protein * 0.9).length,
    kcalDays: logged.filter((d) => Math.abs(d.totals.kcal - d.goals.kcal) <= d.goals.kcal * 0.1).length,
    averageWaterMl: watered.length ? watered.reduce((s, d) => s + d.waterMl, 0) / watered.length : 0,
  };
}
