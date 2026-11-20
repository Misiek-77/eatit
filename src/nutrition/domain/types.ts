/**
 * Data of the nutrition diary. Kept apart from the training app's types (everything nutrition lives in
 * src/nutrition) so the two apps can later be merged by copying this folder over.
 */

/** Values per 100 g. Energy in kcal, the rest in grams. */
export interface Nutrients {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber?: number;
  sugar?: number;
  salt?: number;
}

/** A named amount, "1 kromka" = 35 g. */
export interface Portion {
  name: string;
  grams: number;
}

export const PRODUCT_SOURCES = ['manual', 'openfoodfacts', 'label'] as const;
export type ProductSource = (typeof PRODUCT_SOURCES)[number];

export interface Product {
  id: string;
  name: string;
  brand?: string;
  /** EAN or UPC from the package, digits only. */
  barcode?: string;
  per100: Nutrients;
  portions: Portion[];
  source: ProductSource;
  favorite?: boolean;
  updatedAt: string;
}

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type Meal = (typeof MEALS)[number];

/** One thing eaten. Carries its own copy of the product's values, so editing a product later never rewrites past days. */
export interface DiaryEntry {
  id: string;
  /** Local calendar day, "2026-03-09". */
  date: string;
  meal: Meal;
  productId: string;
  name: string;
  grams: number;
  per100: Nutrients;
  createdAt: string;
}

/** Daily targets. */
export interface Goals {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface NutritionSettings {
  goals: Goals;
  lastBackupAt?: string;
}

export const DEFAULT_SETTINGS: NutritionSettings = {
  goals: { kcal: 2400, protein: 150, fat: 70, carbs: 290 },
};

export interface NutritionData {
  products: Product[];
  entries: DiaryEntry[];
  settings: NutritionSettings;
}
