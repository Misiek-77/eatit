import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { NutritionRepository } from '../data/repository';
import type { DiaryEntry, NutritionData, NutritionSettings, Product, WaterDay, WeightEntry } from '../domain/types';
import { NutritionContext, type NutritionStore } from './nutritionContext';

const upsert = <T extends { id: string }>(list: T[], item: T) =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];

const SAVE_ERROR = 'Nie udało się zapisać ostatniej zmiany na urządzeniu. Sprawdź wolne miejsce w pamięci i zrób kopię zapasową.';

type LoadState = { status: 'loading' } | { status: 'failed' } | { status: 'ready'; data: NutritionData };

/** Holds the diary in memory and saves every change to the device in the background. */
export function NutritionProvider({ repository, children }: { repository: NutritionRepository; children: ReactNode }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    repository.loadAll().then(
      (data) => {
        if (!cancelled) setState({ status: 'ready', data });
        // Keep the data when the device runs low on space.
        void navigator.storage?.persist?.().catch(() => undefined);
      },
      () => !cancelled && setState({ status: 'failed' }),
    );
    return () => {
      cancelled = true;
    };
  }, [repository]);

  const commit = useCallback((change: (d: NutritionData) => NutritionData, persist: () => Promise<void>) => {
    setState((s) => (s.status === 'ready' ? { status: 'ready', data: change(s.data) } : s));
    persist().then(
      () => setError(null),
      () => setError(SAVE_ERROR),
    );
  }, []);

  const actions = useMemo(
    () => ({
      dismissError: () => setError(null),
      saveProduct: (p: Product) => commit((d) => ({ ...d, products: upsert(d.products, p) }), () => repository.putProduct(p)),
      removeProduct: (id: string) => commit((d) => ({ ...d, products: d.products.filter((p) => p.id !== id) }), () => repository.deleteProduct(id)),
      saveEntry: (e: DiaryEntry) => commit((d) => ({ ...d, entries: upsert(d.entries, e) }), () => repository.putEntry(e)),
      removeEntry: (id: string) => commit((d) => ({ ...d, entries: d.entries.filter((e) => e.id !== id) }), () => repository.deleteEntry(id)),
      saveEntries: (list: DiaryEntry[]) =>
        commit(
          (d) => ({ ...d, entries: list.reduce(upsert, d.entries) }),
          () => Promise.all(list.map((e) => repository.putEntry(e))).then(() => undefined),
        ),
      saveWeight: (w: WeightEntry) => commit((d) => ({ ...d, weights: upsert(d.weights, w) }), () => repository.putWeight(w)),
      removeWeight: (id: string) => commit((d) => ({ ...d, weights: d.weights.filter((w) => w.id !== id) }), () => repository.deleteWeight(id)),
      setWater: (day: WaterDay) =>
        commit(
          (d) => ({ ...d, water: [...d.water.filter((w) => w.date !== day.date), ...(day.ml > 0 ? [day] : [])] }),
          () => repository.putWater(day),
        ),
      saveSettings: (s: NutritionSettings) => commit((d) => ({ ...d, settings: s }), () => repository.putSettings(s)),
      replaceAll: async (data: NutritionData) => {
        await repository.replaceAll(data);
        setState({ status: 'ready', data });
      },
    }),
    [commit, repository],
  );

  const data = state.status === 'ready' ? state.data : null;
  const store = useMemo<NutritionStore | null>(() => (data ? { ...data, ...actions, error } : null), [data, actions, error]);

  if (state.status === 'failed') {
    return (
      <main className="screen">
        <h1 className="title">Nie udało się wczytać danych</h1>
        <p className="subtitle">Przeglądarka nie pozwoliła otworzyć lokalnej bazy danych. Sprawdź, czy nie korzystasz z trybu prywatnego, i odśwież stronę.</p>
      </main>
    );
  }
  if (!store) return null;
  return <NutritionContext.Provider value={store}>{children}</NutritionContext.Provider>;
}
