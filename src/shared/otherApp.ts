/**
 * Reading the other app's data. Trening ("trening") and Jadłospis ("jadlospis") live on the same origin, so each
 * can see the other's IndexedDB database. This only ever reads: a database that does not exist is not created
 * (that would break the other app's own set-up), and the connection is closed straight away so it never holds
 * up the other app's upgrades. A merged app keeps working the same way, with both databases as they are.
 */

export type DatabaseDump = Record<string, unknown[]>;

/** Every store of database `name` with all its records, or null when there is no such database here. */
export function readDatabase(name: string): Promise<DatabaseDump | null> {
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      request = indexedDB.open(name);
    } catch {
      return resolve(null);
    }
    let missing = false;
    // Only fired when the database does not exist yet: abort, so it is not created.
    request.onupgradeneeded = () => {
      missing = true;
      request.transaction?.abort();
    };
    request.onerror = (e) => {
      e.preventDefault();
      resolve(null);
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      const names = [...db.objectStoreNames];
      if (missing || names.length === 0) {
        db.close();
        return resolve(null);
      }
      const out: DatabaseDump = {};
      const tx = db.transaction(names, 'readonly');
      for (const store of names) {
        const all = tx.objectStore(store).getAll();
        all.onsuccess = () => (out[store] = all.result);
      }
      tx.oncomplete = () => {
        db.close();
        resolve(out);
      };
      tx.onerror = tx.onabort = () => {
        db.close();
        resolve(null);
      };
    };
  });
}

/** File marker of a backup holding both apps: { app: "komplet", trening: <its backup>, jadlospis: <its backup> }. */
export const COMBINED_APP = 'komplet';
