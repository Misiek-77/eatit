/** Errors that say the data itself cannot be written; a new connection would fail the same way. */
const PERMANENT = new Set(['QuotaExceededError', 'ConstraintError', 'DataError', 'DataCloneError']);

/**
 * A database connection that is opened on first use and opened again when it stops working.
 *
 * iOS closes the IndexedDB connection of a web app that has been in the background for a while, often
 * without telling the page. Every later read or write on the old connection then fails ("Connection to
 * Indexed Database server lost") until the app is restarted. Here the failed operation instead drops the
 * dead connection, opens a new one and runs once more, so a save made after hours in the background
 * simply goes through.
 */
export function reconnecting<T extends { close(): void }>(open: () => Promise<T>) {
  let connection: Promise<T> | undefined;

  const get = () =>
    (connection ??= open().catch((error) => {
      // A failed open is not remembered, so the next operation tries again.
      connection = undefined;
      throw error;
    }));

  /** Forgets the current connection; the next operation opens a new one. */
  function reset() {
    const old = connection;
    connection = undefined;
    void old?.then((db) => db.close()).catch(() => undefined);
  }

  async function run<R>(operation: (db: T) => Promise<R>): Promise<R> {
    const current = get();
    const db = await current;
    try {
      return await operation(db);
    } catch (error) {
      if (error instanceof DOMException && PERMANENT.has(error.name)) throw error;
      // Another operation may already have replaced the connection; only drop it if it is still this one.
      if (connection === current) reset();
      return operation(await get());
    }
  }

  return { run, reset };
}
