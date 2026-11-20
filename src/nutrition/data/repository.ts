import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { reconnecting } from '../../shared/reconnect';
import { DEFAULT_SETTINGS, type DiaryEntry, type NutritionData, type NutritionSettings, type Product } from '../domain/types';

/**
 * Local storage of the nutrition diary: its own IndexedDB database, "jadlospis". The training app keeps its
 * data in "trening" on the same origin (misiek-77.github.io), so a merged app can open both as they are.
 */
interface Schema extends DBSchema {
  products: { key: string; value: Product; indexes: { barcode: string } };
  entries: { key: string; value: DiaryEntry; indexes: { date: string } };
  settings: { key: string; value: NutritionSettings };
}

const SETTINGS_KEY = 'settings';

export interface NutritionRepository {
  loadAll(): Promise<NutritionData>;
  putProduct(product: Product): Promise<void>;
  deleteProduct(id: string): Promise<void>;
  putEntry(entry: DiaryEntry): Promise<void>;
  deleteEntry(id: string): Promise<void>;
  putSettings(settings: NutritionSettings): Promise<void>;
  /** Replaces everything with `data`, atomically. */
  replaceAll(data: NutritionData): Promise<void>;
}

export function createNutritionRepository(): NutritionRepository {
  const connection: { run<R>(op: (db: IDBPDatabase<Schema>) => Promise<R>): Promise<R>; reset(): void } = reconnecting(() =>
    openDB<Schema>('jadlospis', 1, {
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
      },
    }),
  );
  const withDb = <R,>(op: (db: IDBPDatabase<Schema>) => Promise<R>) => connection.run(op);

  return {
    async loadAll() {
      const [products, entries, settings] = await withDb((d) => Promise.all([d.getAll('products'), d.getAll('entries'), d.get('settings', SETTINGS_KEY)]));
      return { products, entries, settings: { ...DEFAULT_SETTINGS, ...settings } };
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
    async replaceAll(data) {
      await withDb(async (d) => {
        const tx = d.transaction(['products', 'entries', 'settings'], 'readwrite');
        await Promise.all([
          tx.objectStore('products').clear(),
          tx.objectStore('entries').clear(),
          ...data.products.map((p) => tx.objectStore('products').put(p)),
          ...data.entries.map((e) => tx.objectStore('entries').put(e)),
          tx.objectStore('settings').put(data.settings, SETTINGS_KEY),
          tx.done,
        ]);
      });
    },
  };
}
