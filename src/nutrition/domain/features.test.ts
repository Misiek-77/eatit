import { describe, expect, it } from 'vitest';
import { copyEntries, pastMeals } from './diary';
import { goalsForDay } from './nutrients';
import { recipePer100 } from './recipe';
import type { DiaryEntry, Ingredient } from './types';
import { weekStart, weekSummary } from './week';
import { mergeWeights, verdict, weeklyChange, type WeightPoint } from './weight';

const oats = { kcal: 370, protein: 13, fat: 7, carbs: 60 };
const milk = { kcal: 50, protein: 3.4, fat: 2, carbs: 4.8 };
const entry = (date: string, meal: DiaryEntry['meal'], grams = 100): DiaryEntry => ({
  id: `${date}-${meal}-${grams}`,
  date,
  meal,
  productId: 'p',
  name: 'Owsianka',
  grams,
  per100: oats,
  createdAt: `${date}T08:00:00Z`,
});

describe('a dish made of products', () => {
  const ingredients: Ingredient[] = [
    { productId: 'a', name: 'Płatki', grams: 50, per100: oats },
    { productId: 'b', name: 'Mleko', grams: 250, per100: milk },
  ];
  it('spreads the ingredients over their total weight', () => {
    // 185 + 125 kcal in 300 g.
    expect(recipePer100(ingredients)).toMatchObject({ kcal: 103, protein: 5, fat: 2.8, carbs: 14 });
  });
  it('uses the weight of the finished dish when given', () => {
    expect(recipePer100(ingredients, 200).kcal).toBe(155);
  });
});

describe('copying a meal', () => {
  const entries = [entry('2026-11-19', 'breakfast'), entry('2026-11-20', 'breakfast', 80), entry('2026-11-20', 'dinner'), entry('2026-11-18', 'dinner'), entry('2026-11-21', 'breakfast')];
  it('offers the same meal on earlier days, newest first, then the rest of yesterday', () => {
    const list = pastMeals(entries, '2026-11-21', 'breakfast');
    expect(list.map((p) => `${p.date} ${p.meal}`)).toEqual(['2026-11-20 breakfast', '2026-11-19 breakfast', '2026-11-20 dinner']);
  });
  it('makes new entries for the chosen day and meal', () => {
    let n = 0;
    const copies = copyEntries([entries[0]], '2026-11-21', 'lunch', '2026-11-21T12:00:00Z', () => `new${++n}`);
    expect(copies).toEqual([{ ...entries[0], id: 'new1', date: '2026-11-21', meal: 'lunch', createdAt: '2026-11-21T12:00:00Z' }]);
  });
});

describe('a training day', () => {
  const goals = { kcal: 2400, protein: 150, fat: 70, carbs: 290 };
  it('adds the extra energy as carbohydrates', () => {
    expect(goalsForDay(goals, 300, true)).toEqual({ ...goals, kcal: 2700, carbs: 365 });
    expect(goalsForDay(goals, 300, false)).toBe(goals);
  });
});

describe('the week summary', () => {
  it('starts on Monday', () => {
    expect(weekStart('2026-11-21')).toBe('2026-11-16');
    expect(weekStart('2026-11-16')).toBe('2026-11-16');
  });
  it('averages only the days with something logged and counts days on target', () => {
    const goals = { kcal: 370, protein: 13, fat: 7, carbs: 60 };
    const s = weekSummary([entry('2026-11-16', 'lunch'), entry('2026-11-17', 'lunch', 50)], [{ date: '2026-11-16', ml: 1500 }], '2026-11-16', '2026-11-18', () => goals);
    expect(s.days).toHaveLength(3);
    expect(s.loggedDays).toBe(2);
    expect(s.average?.kcal).toBeCloseTo(277.5);
    expect(s.kcalDays).toBe(1);
    expect(s.proteinDays).toBe(1);
    expect(s.averageWaterMl).toBe(1500);
  });
});

describe('body weight', () => {
  const at = (date: string, kg: number, updatedAt = date): WeightPoint => ({ date, kg, updatedAt });
  it('keeps one reading a day, the latest change winning', () => {
    expect(mergeWeights([at('2026-11-01', 80, 'a')], [at('2026-11-01', 81, 'b'), at('2026-10-31', 82)])).toEqual([at('2026-10-31', 82), at('2026-11-01', 81, 'b')]);
  });
  it('measures the weekly change of the 7-day average', () => {
    const points = Array.from({ length: 21 }, (_, i) => at(`2026-11-${String(i + 1).padStart(2, '0')}`, 80 - i * 0.1));
    expect(weeklyChange(points)).toBeCloseTo(-0.7);
    expect(weeklyChange(points.slice(0, 5))).toBeNull();
  });
  it('judges the pace against the plan', () => {
    expect(verdict(-0.5, 80, 'lose').tone).toBe('good');
    expect(verdict(0, 80, 'lose').tone).toBe('adjust');
    expect(verdict(-1, 80, 'lose').tone).toBe('adjust');
    expect(verdict(0.1, 80, 'keep').tone).toBe('good');
    expect(verdict(0.2, 80, 'gain').tone).toBe('good');
  });
});
