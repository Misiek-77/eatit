import { forGrams, sum } from './nutrients';
import type { Ingredient, Nutrients } from './types';

/** Total weight of the ingredients, in grams. */
export const ingredientGrams = (ingredients: Ingredient[]) => ingredients.reduce((g, i) => g + i.grams, 0);

/** Everything the ingredients contain together. */
export const recipeTotals = (ingredients: Ingredient[]) => sum(ingredients.map((i) => forGrams(i.per100, i.grams)));

/**
 * Values per 100 g of the finished dish. Cooking changes the weight (pasta takes up water, a roast loses it)
 * but not what is in it, so the totals are spread over the weight of the dish when it is given.
 */
export function recipePer100(ingredients: Ingredient[], cookedGrams?: number): Nutrients {
  const weight = cookedGrams && cookedGrams > 0 ? cookedGrams : ingredientGrams(ingredients);
  if (weight <= 0) return { kcal: 0, protein: 0, fat: 0, carbs: 0 };
  const per100 = forGrams(recipeTotals(ingredients), (100 / weight) * 100);
  const round = (n: number) => Math.round(n * 10) / 10;
  const out: Nutrients = { kcal: Math.round(per100.kcal), protein: round(per100.protein), fat: round(per100.fat), carbs: round(per100.carbs) };
  for (const k of ['fiber', 'sugar', 'salt'] as const) if (per100[k] !== undefined) out[k] = k === 'salt' ? Math.round(per100[k]! * 100) / 100 : round(per100[k]!);
  return out;
}
