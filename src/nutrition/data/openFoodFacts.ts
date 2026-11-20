import { newId } from '../../shared/id';
import type { Nutrients, Product } from '../domain/types';

/**
 * Product lookup in Open Food Facts, the free and open product database (openfoodfacts.org). Only the barcode is
 * sent; nothing about the person. The answer becomes a product the person checks before it is saved.
 */
const FIELDS = 'product_name,product_name_pl,generic_name_pl,generic_name,brands,nutriments,serving_quantity,serving_size,quantity';

/** Digits only, 8 to 14 of them (EAN-8, UPC-A, EAN-13, ITF-14). */
export const isBarcode = (text: string) => /^\d{8,14}$/.test(text);

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : undefined;
};

/** The product from an Open Food Facts answer, or null when it is unknown or has no nutrition table. */
export function productFromOff(json: unknown, barcode: string, now: string): Product | null {
  if (typeof json !== 'object' || json === null) return null;
  const answer = json as { status?: number; product?: Record<string, unknown> };
  const p = answer.product;
  if (answer.status !== 1 || !p) return null;
  const n = (p.nutriments ?? {}) as Record<string, unknown>;

  // Energy in kcal; some products only give kJ (1 kcal = 4.184 kJ).
  const kcal = num(n['energy-kcal_100g']) ?? (num(n['energy_100g']) !== undefined ? Math.round(num(n['energy_100g'])! / 4.184) : undefined);
  const protein = num(n['proteins_100g']);
  const fat = num(n['fat_100g']);
  const carbs = num(n['carbohydrates_100g']);
  if (kcal === undefined && protein === undefined && fat === undefined && carbs === undefined) return null;

  const per100: Nutrients = { kcal: kcal ?? 0, protein: protein ?? 0, fat: fat ?? 0, carbs: carbs ?? 0 };
  const fiber = num(n['fiber_100g']);
  const sugar = num(n['sugars_100g']);
  const salt = num(n['salt_100g']);
  if (fiber !== undefined) per100.fiber = fiber;
  if (sugar !== undefined) per100.sugar = sugar;
  if (salt !== undefined) per100.salt = salt;

  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const name = text(p.product_name_pl) ?? text(p.product_name) ?? text(p.generic_name_pl) ?? text(p.generic_name) ?? `Produkt ${barcode}`;
  const brand = text(p.brands)?.split(',')[0]?.trim();
  const serving = num(p.serving_quantity);

  return {
    id: newId(),
    name: name.slice(0, 80),
    ...(brand ? { brand: brand.slice(0, 60) } : {}),
    barcode,
    per100,
    portions: serving && serving > 0 ? [{ name: '1 porcja', grams: serving }] : [],
    source: 'openfoodfacts',
    updatedAt: now,
  };
}

export type LookupResult = { kind: 'found'; product: Product } | { kind: 'unknown' } | { kind: 'offline' } | { kind: 'error' };

/** Asks Open Food Facts about a barcode. Never throws: no network and unknown products are ordinary answers. */
export async function lookupBarcode(barcode: string, now: string): Promise<LookupResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { kind: 'offline' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${FIELDS}`, { signal: controller.signal });
    if (res.status === 404) return { kind: 'unknown' };
    if (!res.ok) return { kind: 'error' };
    const product = productFromOff(await res.json(), barcode, now);
    return product ? { kind: 'found', product } : { kind: 'unknown' };
  } catch {
    return { kind: navigator.onLine === false ? 'offline' : 'error' };
  } finally {
    clearTimeout(timer);
  }
}
