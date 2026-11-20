import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type NutritionData } from '../domain/types';
import { parseBackup, serializeBackup } from './backup';

const data: NutritionData = {
  products: [{ id: 'p', name: 'Płatki', barcode: '5906827001229', per100: { kcal: 372, protein: 13.5, fat: 7, carbs: 58.7, fiber: 10 }, portions: [{ name: '1 porcja', grams: 40 }], source: 'openfoodfacts', favorite: true, updatedAt: 'x' }],
  entries: [{ id: 'e', date: '2026-11-20', meal: 'breakfast', productId: 'p', name: 'Płatki', grams: 60, per100: { kcal: 372, protein: 13.5, fat: 7, carbs: 58.7 }, createdAt: 'y' }],
  settings: { goals: { kcal: 2500, protein: 160, fat: 70, carbs: 300 }, lastBackupAt: 'z' },
};

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
    expect(r.ok && r.data.settings).toEqual({ goals: DEFAULT_SETTINGS.goals });
  });
});
