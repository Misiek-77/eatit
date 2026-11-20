import { describe, expect, it, vi } from 'vitest';
import { reconnecting } from './reconnect';

/** A fake connection that can be "lost" the way iOS drops IndexedDB connections of suspended apps. */
function fakeDb(id: number) {
  return { id, lost: false, close: vi.fn() };
}

const lost = () => new DOMException('Connection to Indexed Database server lost. Refresh the page to try again', 'UnknownError');

describe('a database connection that comes back after iOS closes it', () => {
  it('opens once and reuses the connection', async () => {
    let opened = 0;
    const db = reconnecting(async () => fakeDb(++opened));
    expect(await db.run(async (d) => d.id)).toBe(1);
    expect(await db.run(async (d) => d.id)).toBe(1);
    expect(opened).toBe(1);
  });

  it('reopens and retries once when an operation fails on a lost connection', async () => {
    let opened = 0;
    const db = reconnecting(async () => fakeDb(++opened));
    const first = await db.run(async (d) => d);
    first.lost = true;
    const result = await db.run(async (d) => {
      if (d.lost) throw lost();
      return d.id;
    });
    expect(result).toBe(2);
    expect(first.close).toHaveBeenCalled();
    // The new connection stays in use afterwards.
    expect(await db.run(async (d) => d.id)).toBe(2);
  });

  it('gives up after one retry, and does not retry when storage is full', async () => {
    let opened = 0;
    const db = reconnecting(async () => fakeDb(++opened));
    await expect(db.run(async () => Promise.reject(lost()))).rejects.toThrow('lost');
    expect(opened).toBe(2);
    const full = new DOMException('full', 'QuotaExceededError');
    await expect(db.run(async () => Promise.reject(full))).rejects.toBe(full);
    expect(opened).toBe(2);
  });

  it('reopens on the next operation after the browser reports the connection closed', async () => {
    let opened = 0;
    const db = reconnecting(async () => fakeDb(++opened));
    await db.run(async (d) => d.id);
    db.reset();
    expect(await db.run(async (d) => d.id)).toBe(2);
  });

  it('tries opening again after a failed open', async () => {
    let attempts = 0;
    const db = reconnecting(async () => {
      if (++attempts === 1) throw new Error('blocked');
      return fakeDb(attempts);
    });
    await expect(db.run(async (d) => d.id)).rejects.toThrow('blocked');
    expect(await db.run(async (d) => d.id)).toBe(2);
  });
});
