import { describe, expect, it } from 'vitest';
import { dayTotals, forGrams, goalsFromWeight, kcalFromMacros, looksWrong, sum } from './nutrients';
import type { DiaryEntry, Nutrients } from './types';

const oats: Nutrients = { kcal: 370, protein: 13, fat: 7, carbs: 60, fiber: 10 };
const milk: Nutrients = { kcal: 50, protein: 3.4, fat: 2, carbs: 4.8 };
const entry = (date: string, meal: DiaryEntry['meal'], per100: Nutrients, grams: number): DiaryEntry => ({
  id: `${date}-${meal}-${grams}`,
  date,
  meal,
  productId: 'p',
  name: 'x',
  grams,
  per100,
  createdAt: '',
});

describe('nutrients', () => {
  it('scales values per 100 g to the amount eaten', () => {
    expect(forGrams(oats, 50)).toEqual({ kcal: 185, protein: 6.5, fat: 3.5, carbs: 30, fiber: 5 });
  });

  it('adds amounts, keeping optional values only when some have them', () => {
    expect(sum([forGrams(oats, 100), forGrams(milk, 200)])).toEqual({ kcal: 470, protein: 19.8, fat: 11, carbs: 69.6, fiber: 10 });
    expect(sum([])).toEqual({ kcal: 0, protein: 0, fat: 0, carbs: 0 });
  });

  it('totals a day and each meal, leaving other days out', () => {
    const entries = [entry('2026-11-20', 'breakfast', oats, 50), entry('2026-11-20', 'breakfast', milk, 200), entry('2026-11-20', 'dinner', milk, 100), entry('2026-11-19', 'lunch', oats, 100)];
    const t = dayTotals(entries, '2026-11-20');
    expect(t.day.kcal).toBe(335);
    expect(t.meals.breakfast.kcal).toBe(285);
    expect(t.meals.lunch.kcal).toBe(0);
  });

  it('checks label energy against the macros', () => {
    expect(Math.round(kcalFromMacros(oats))).toBe(335);
    expect(looksWrong(oats)).toBe(false);
    expect(looksWrong({ ...oats, kcal: 37 })).toBe(true); // a lost digit
    expect(looksWrong({ kcal: 5, protein: 0, fat: 0, carbs: 0 })).toBe(false);
  });

  it('builds goals from body weight', () => {
    expect(goalsFromWeight(80, 2500)).toEqual({ kcal: 2500, protein: 160, fat: 69, carbs: 310 });
  });
});
