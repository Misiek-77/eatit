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

export const PRODUCT_SOURCES = ['manual', 'openfoodfacts', 'label', 'recipe'] as const;
export type ProductSource = (typeof PRODUCT_SOURCES)[number];

/** One product in a dish, with its values as they were when the dish was saved. */
export interface Ingredient {
  productId: string;
  name: string;
  grams: number;
  per100: Nutrients;
}

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
  /** Present on a dish made of other products ("recipe"): per100 is worked out from these. */
  ingredients?: Ingredient[];
  /** Weight of the finished dish when it differs from the ingredients' (water lost in cooking, added). */
  cookedGrams?: number;
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

/** What the body weight should be doing, for the hint next to the weight trend. */
export const WEIGHT_PLANS = ['lose', 'keep', 'gain'] as const;
export type WeightPlan = (typeof WEIGHT_PLANS)[number];

export interface NutritionSettings {
  goals: Goals;
  /** Water to drink a day, in ml. */
  waterGoalMl: number;
  /** Extra energy on a day with a workout in the training app; it goes to carbohydrates. 0 turns it off. */
  trainingBonusKcal: number;
  weightPlan: WeightPlan;
  lastBackupAt?: string;
}

export const DEFAULT_SETTINGS: NutritionSettings = {
  goals: { kcal: 2400, protein: 150, fat: 70, carbs: 290 },
  waterGoalMl: 2000,
  trainingBonusKcal: 0,
  weightPlan: 'keep',
};

/** Body weight on one day. At most one per day. */
export interface WeightEntry {
  id: string;
  date: string;
  kg: number;
  updatedAt: string;
}

/** Water drunk on one day. */
export interface WaterDay {
  date: string;
  ml: number;
}

export interface NutritionData {
  products: Product[];
  entries: DiaryEntry[];
  weights: WeightEntry[];
  water: WaterDay[];
  settings: NutritionSettings;
}
