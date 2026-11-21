import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type NutritionData } from '../domain/types';
import { parseBackup, serializeBackup } from './backup';

const data: NutritionData = {
  products: [{ id: 'p', name: 'Płatki', barcode: '5906827001229', per100: { kcal: 372, protein: 13.5, fat: 7, carbs: 58.7, fiber: 10 }, portions: [{ name: '1 porcja', grams: 40 }], source: 'openfoodfacts', favorite: true, updatedAt: 'x' }],
  entries: [{ id: 'e', date: '2026-11-20', meal: 'breakfast', productId: 'p', name: 'Płatki', grams: 60, per100: { kcal: 372, protein: 13.5, fat: 7, carbs: 58.7 }, createdAt: 'y' }],
  weights: [{ id: 'w', date: '2026-11-20', kg: 81.4, updatedAt: 'x' }],
  water: [{ date: '2026-11-20', ml: 1750 }],
  settings: { goals: { kcal: 2500, protein: 160, fat: 70, carbs: 300 }, waterGoalMl: 2500, trainingBonusKcal: 300, weightPlan: 'lose', lastBackupAt: 'z' },
};
data.products.push({
  id: 'd',
  name: 'Owsianka',
  per100: { kcal: 120, protein: 5, fat: 3, carbs: 18 },
  portions: [],
  source: 'recipe',
  ingredients: [{ productId: 'p', name: 'Płatki', grams: 50, per100: data.products[0].per100 }],
  cookedGrams: 250,
  updatedAt: 'x',
});

describe('nutrition backup', () => {
  it('round-trips everything', () => {
    expect(parseBackup(serializeBackup(data, 'now'))).toEqual({ ok: true, data });
  });

  it('refuses a training backup with a pointer to the right app, and broken files', () => {
    const training = parseBackup(JSON.stringify({ app: 'trening', version: 1, data: {} }));
    expect(training.ok === false && training.error).toMatch(/Trening/);
    expect(parseBackup('{').ok).toBe(false);
    const badEntry = JSON.parse(serializeBackup(data, 'now'));
    badEntry.data.entries[0].meal = 'brunch';
    expect(parseBackup(JSON.stringify(badEntry)).ok).toBe(false);
  });

  it('falls back to default goals when a file has none', () => {
    const plain = JSON.parse(serializeBackup(data, 'now'));
    delete plain.data.settings;
    const r = parseBackup(JSON.stringify(plain));
    expect(r.ok && r.data.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('reads its own part of a file with both apps, and says whether training data is in it', () => {
    const own = JSON.parse(serializeBackup(data, 'now'));
    const both = parseBackup(JSON.stringify({ app: 'komplet', version: 1, trening: { app: 'trening', data: {} }, jadlospis: own }));
    expect(both).toEqual({ ok: true, data, combined: { withTraining: true } });
    const none = parseBackup(JSON.stringify({ app: 'komplet', version: 1, trening: null, jadlospis: null }));
    expect(none.ok === false && none.error).toMatch(/Jadłospisu/);
  });
});
