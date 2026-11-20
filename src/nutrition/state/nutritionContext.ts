import { createContext, useContext } from 'react';
import type { DiaryEntry, NutritionData, NutritionSettings, Product } from '../domain/types';

// The context lives apart from its provider, so hot reload while developing never leaves screens holding an old one.

export interface NutritionStore extends NutritionData {
  /** Message of the last failed save, shown as a banner. */
  error: string | null;
  dismissError(): void;
  saveProduct(product: Product): void;
  removeProduct(id: string): void;
  saveEntry(entry: DiaryEntry): void;
  removeEntry(id: string): void;
  saveSettings(settings: NutritionSettings): void;
  replaceAll(data: NutritionData): Promise<void>;
}

export const NutritionContext = createContext<NutritionStore | null>(null);

export function useNutrition(): NutritionStore {
  const store = useContext(NutritionContext);
  if (!store) throw new Error('useNutrition must be used inside <NutritionProvider>');
  return store;
}
