import { COMBINED_APP, readDatabase } from '../../shared/otherApp';
import {
  DEFAULT_SETTINGS,
  MEALS,
  PRODUCT_SOURCES,
  WEIGHT_PLANS,
  type DiaryEntry,
  type Ingredient,
  type Nutrients,
  type NutritionData,
  type Product,
  type WaterDay,
  type WeightEntry,
} from '../domain/types';

/** Names the file format, so a merged app can tell this backup from the training one ("trening"). */
export const BACKUP_APP = 'jadlospis';
const VERSION = 1;

const backupObject = (data: NutritionData, now: string) => ({ app: BACKUP_APP, version: VERSION, exportedAt: now, data });

export function serializeBackup(data: NutritionData, now: string): string {
  return JSON.stringify(backupObject(data, now), null, 2);
}

/** What the training app fills in for settings it never saved; its own backup check needs them. */
const TRAINING_DEFAULTS = { restSeconds: 90, restSound: true, schedule: [null, null, null, null, null, null, null], unit: 'kg' };

/**
 * One file with both apps: this diary, and the training app's data read from its database on this device
 * (left out when the training app was never opened here). Each app restores its own part of the file.
 */
export async function serializeCombined(data: NutritionData, now: string): Promise<{ text: string; withTraining: boolean }> {
  const t = await readDatabase('trening');
  const training = t && {
    app: 'trening',
    version: 1,
    exportedAt: now,
    data: {
      exercises: t.exercises ?? [],
      plans: t.plans ?? [],
      workouts: t.workouts ?? [],
      measurements: t.measurements ?? [],
      goals: t.goals ?? [],
      settings: { ...TRAINING_DEFAULTS, ...(t.settings?.[0] as object | undefined) },
    },
  };
  const text = JSON.stringify({ app: COMBINED_APP, version: 1, exportedAt: now, trening: training, jadlospis: backupObject(data, now) }, null, 2);
  return { text, withTraining: !!training };
}

export type BackupResult = { ok: true; data: NutritionData; combined?: { withTraining: boolean } } | { ok: false; error: string };

class Invalid extends Error {}
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Invalid(message);
}
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isAmount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

function nutrients(v: unknown, where: string): Nutrients {
  check(isObject(v) && isAmount(v.kcal) && isAmount(v.protein) && isAmount(v.fat) && isAmount(v.carbs), `${where}: niepoprawne wartości odżywcze.`);
  const out: Nutrients = { kcal: v.kcal, protein: v.protein, fat: v.fat, carbs: v.carbs };
  for (const k of ['fiber', 'sugar', 'salt'] as const) if (isAmount(v[k])) out[k] = v[k] as number;
  return out;
}

function ingredient(v: unknown, dish: string): Ingredient {
  check(isObject(v) && isText(v.productId) && isText(v.name) && isAmount(v.grams) && v.grams > 0, `Danie „${dish}” ma niepoprawny składnik.`);
  return { productId: v.productId, name: v.name, grams: v.grams, per100: nutrients(v.per100, `Składnik „${v.name}”`) };
}

const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

function weight(v: unknown): WeightEntry {
  check(isObject(v) && isText(v.id) && isDay(v.date) && isAmount(v.kg) && v.kg > 0, 'Plik zawiera niepoprawny wpis masy ciała.');
  return { id: v.id, date: v.date, kg: v.kg, updatedAt: isText(v.updatedAt) ? v.updatedAt : new Date(0).toISOString() };
}

function waterDay(v: unknown): WaterDay {
  check(isObject(v) && isDay(v.date) && isAmount(v.ml), 'Plik zawiera niepoprawny wpis wody.');
  return { date: v.date, ml: v.ml };
}

function product(v: unknown): Product {
  check(isObject(v) && isText(v.id) && isText(v.name), 'Plik zawiera produkt bez nazwy lub identyfikatora.');
  const portions = Array.isArray(v.portions)
    ? v.portions.filter((p): p is { name: string; grams: number } => isObject(p) && isText(p.name) && isAmount(p.grams) && p.grams > 0)
    : [];
  return {
    id: v.id,
    name: v.name,
    ...(isText(v.brand) ? { brand: v.brand } : {}),
    ...(isText(v.barcode) && /^\d{8,14}$/.test(v.barcode) ? { barcode: v.barcode } : {}),
    per100: nutrients(v.per100, `Produkt „${v.name}”`),
    portions: portions.map((p) => ({ name: p.name, grams: p.grams })),
    source: (PRODUCT_SOURCES as readonly unknown[]).includes(v.source) ? (v.source as Product['source']) : 'manual',
    ...(v.favorite === true ? { favorite: true } : {}),
    ...(Array.isArray(v.ingredients) && v.ingredients.length ? { ingredients: v.ingredients.map((i) => ingredient(i, v.name as string)) } : {}),
    ...(isAmount(v.cookedGrams) && v.cookedGrams > 0 ? { cookedGrams: v.cookedGrams } : {}),
    updatedAt: isText(v.updatedAt) ? v.updatedAt : new Date(0).toISOString(),
  };
}

function entry(v: unknown): DiaryEntry {
  check(
    isObject(v) && isText(v.id) && isText(v.date) && /^\d{4}-\d{2}-\d{2}$/.test(v.date) && isText(v.productId) && isText(v.name) && isAmount(v.grams) && v.grams > 0,
    'Plik zawiera niepoprawny wpis w dzienniku.',
  );
  check((MEALS as readonly unknown[]).includes(v.meal), 'Plik zawiera wpis z nieznanym posiłkiem.');
  return {
    id: v.id,
    date: v.date,
    meal: v.meal as DiaryEntry['meal'],
    productId: v.productId,
    name: v.name,
    grams: v.grams,
    per100: nutrients(v.per100, `Wpis „${v.name}”`),
    createdAt: isText(v.createdAt) ? v.createdAt : new Date(0).toISOString(),
  };
}

/** Validates a backup file. Never throws; on failure the error is a message for the person. */
export function parseBackup(text: string): BackupResult {
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch {
    return { ok: false, error: 'To nie jest plik kopii zapasowej (niepoprawny JSON).' };
  }
  let combined: { withTraining: boolean } | undefined;
  try {
    check(isObject(file), 'To nie jest plik kopii zapasowej.');
    if (file.app === COMBINED_APP) {
      combined = { withTraining: isObject(file.trening) };
      file = file.jadlospis;
      check(isObject(file), 'W tym pliku nie ma danych Jadłospisu.');
    }
    check(file.app !== 'trening', 'To kopia aplikacji Trening. Zaimportuj ją w tamtej aplikacji.');
    check(file.app === BACKUP_APP, 'To nie jest plik kopii zapasowej Jadłospisu.');
    check(file.version === VERSION, 'Ta kopia pochodzi z nowszej wersji aplikacji.');
    const d = file.data;
    check(isObject(d) && Array.isArray(d.products) && Array.isArray(d.entries), 'Plik kopii zapasowej jest niekompletny.');
    const products = d.products.map(product);
    check(new Set(products.map((p) => p.id)).size === products.length, 'Plik zawiera zduplikowane produkty.');
    const entries = d.entries.map(entry);
    const g = isObject(d.settings) && isObject(d.settings.goals) ? d.settings.goals : {};
    const goals = {
      kcal: isAmount(g.kcal) && g.kcal > 0 ? g.kcal : DEFAULT_SETTINGS.goals.kcal,
      protein: isAmount(g.protein) ? g.protein : DEFAULT_SETTINGS.goals.protein,
      fat: isAmount(g.fat) ? g.fat : DEFAULT_SETTINGS.goals.fat,
      carbs: isAmount(g.carbs) ? g.carbs : DEFAULT_SETTINGS.goals.carbs,
    };
    const st = isObject(d.settings) ? d.settings : {};
    const last = isText(st.lastBackupAt) ? { lastBackupAt: st.lastBackupAt } : {};
    const settings = {
      goals,
      waterGoalMl: isAmount(st.waterGoalMl) && st.waterGoalMl > 0 ? st.waterGoalMl : DEFAULT_SETTINGS.waterGoalMl,
      trainingBonusKcal: isAmount(st.trainingBonusKcal) ? st.trainingBonusKcal : DEFAULT_SETTINGS.trainingBonusKcal,
      weightPlan: (WEIGHT_PLANS as readonly unknown[]).includes(st.weightPlan) ? (st.weightPlan as NutritionData['settings']['weightPlan']) : DEFAULT_SETTINGS.weightPlan,
      ...last,
    };
    // Backups from before body weight and water existed simply have none.
    const weights = Array.isArray(d.weights) ? d.weights.map(weight) : [];
    const water = Array.isArray(d.water) ? d.water.map(waterDay) : [];
    return { ok: true, data: { products, entries, weights, water, settings }, ...(combined ? { combined } : {}) };
  } catch (e) {
    if (e instanceof Invalid) return { ok: false, error: e.message };
    throw e;
  }
}
