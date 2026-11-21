import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { reconnecting } from '../../shared/reconnect';
import { DEFAULT_SETTINGS, type DiaryEntry, type NutritionData, type NutritionSettings, type Product, type WaterDay, type WeightEntry } from '../domain/types';

/**
 * Local storage of the nutrition diary: its own IndexedDB database, "jadlospis". The training app keeps its
 * data in "trening" on the same origin (misiek-77.github.io), so a merged app can open both as they are.
 */
interface Schema extends DBSchema {
  products: { key: string; value: Product; indexes: { barcode: string } };
  entries: { key: string; value: DiaryEntry; indexes: { date: string } };
  settings: { key: string; value: NutritionSettings };
  weights: { key: string; value: WeightEntry };
  water: { key: string; value: WaterDay };
}

const SETTINGS_KEY = 'settings';

export interface NutritionRepository {
  loadAll(): Promise<NutritionData>;
  putProduct(product: Product): Promise<void>;
  deleteProduct(id: string): Promise<void>;
  putEntry(entry: DiaryEntry): Promise<void>;
  deleteEntry(id: string): Promise<void>;
  putSettings(settings: NutritionSettings): Promise<void>;
  putWeight(weight: WeightEntry): Promise<void>;
  deleteWeight(id: string): Promise<void>;
  putWater(day: WaterDay): Promise<void>;
  /** Replaces everything with `data`, atomically. */
  replaceAll(data: NutritionData): Promise<void>;
}

export function createNutritionRepository(): NutritionRepository {
  const connection: { run<R>(op: (db: IDBPDatabase<Schema>) => Promise<R>): Promise<R>; reset(): void } = reconnecting(() =>
    openDB<Schema>('jadlospis', 2, {
      // A newer version of the app opened in another tab needs the database; let go and reload.
      blocking(_current, _blocked, event) {
        (event.target as IDBDatabase).close();
        connection.reset();
        if (typeof location !== 'undefined') location.reload();
      },
      // iOS closes the connection of apps left in the background.
      terminated() {
        connection.reset();
      },
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('products', { keyPath: 'id' }).createIndex('barcode', 'barcode');
          db.createObjectStore('entries', { keyPath: 'id' }).createIndex('date', 'date');
          db.createObjectStore('settings');
        }
        // Version 2 adds body weight and water; everything from version 1 stays as it is.
        if (oldVersion < 2) {
          db.createObjectStore('weights', { keyPath: 'id' });
          db.createObjectStore('water', { keyPath: 'date' });
        }
      },
    }),
  );
  const withDb = <R,>(op: (db: IDBPDatabase<Schema>) => Promise<R>) => connection.run(op);

  return {
    async loadAll() {
      const [products, entries, weights, water, settings] = await withDb((d) =>
        Promise.all([d.getAll('products'), d.getAll('entries'), d.getAll('weights'), d.getAll('water'), d.get('settings', SETTINGS_KEY)]),
      );
      return { products, entries, weights, water, settings: { ...DEFAULT_SETTINGS, ...settings } };
    },
    async putProduct(product) {
      await withDb((d) => d.put('products', product));
    },
    async deleteProduct(id) {
      await withDb((d) => d.delete('products', id));
    },
    async putEntry(entry) {
      await withDb((d) => d.put('entries', entry));
    },
    async deleteEntry(id) {
      await withDb((d) => d.delete('entries', id));
    },
    async putSettings(settings) {
      await withDb((d) => d.put('settings', settings, SETTINGS_KEY));
    },
    async putWeight(weight) {
      await withDb((d) => d.put('weights', weight));
    },
    async deleteWeight(id) {
      await withDb((d) => d.delete('weights', id));
    },
    async putWater(day) {
      // A day back at zero is simply forgotten.
      await withDb((d) => (day.ml > 0 ? d.put('water', day).then(() => undefined) : d.delete('water', day.date)));
    },
    async replaceAll(data) {
      await withDb(async (d) => {
        const tx = d.transaction(['products', 'entries', 'weights', 'water', 'settings'], 'readwrite');
        await Promise.all([
          tx.objectStore('products').clear(),
          tx.objectStore('entries').clear(),
          tx.objectStore('weights').clear(),
          tx.objectStore('water').clear(),
          ...data.weights.map((w) => tx.objectStore('weights').put(w)),
          ...data.water.map((w) => tx.objectStore('water').put(w)),
          ...data.products.map((p) => tx.objectStore('products').put(p)),
          ...data.entries.map((e) => tx.objectStore('entries').put(e)),
          tx.objectStore('settings').put(data.settings, SETTINGS_KEY),
          tx.done,
        ]);
      });
    },
  };
}
