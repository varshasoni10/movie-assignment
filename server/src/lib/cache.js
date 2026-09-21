/**
 * In-memory cache with three behaviours the app relies on:
 *  1. TTL + LRU eviction (bounded memory).
 *  2. In-flight de-duplication: N concurrent requests for a key trigger ONE upstream call.
 *  3. Stale-if-error: if the loader fails and we hold an expired entry, serve it (flagged stale)
 *     instead of failing the user.
 */
export class Cache {
  constructor({ maxEntries = 1000, staleTtlMs = 0, now = Date.now } = {}) {
    this.maxEntries = maxEntries;
    this.staleTtlMs = staleTtlMs;
    this.now = now;
    this.entries = new Map(); // key -> { value, expiresAt }   (insertion order = LRU order)
    this.inflight = new Map(); // key -> Promise<{ value, stale }>
    this.stats = { hits: 0, misses: 0, staleServed: 0, deduped: 0 };
  }

  /** @returns {Promise<{ value: any, stale: boolean }>} */
  async get(key, ttlMs, loader) {
    const entry = this.entries.get(key);
    if (entry && entry.expiresAt > this.now()) {
      this.entries.delete(key); // refresh LRU position
      this.entries.set(key, entry);
      this.stats.hits++;
      return { value: entry.value, stale: false };
    }

    const pending = this.inflight.get(key);
    if (pending) {
      this.stats.deduped++;
      return pending;
    }

    this.stats.misses++;
    const promise = this.#load(key, ttlMs, loader, entry).finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }

  async #load(key, ttlMs, loader, staleEntry) {
    try {
      const value = await loader();
      this.#set(key, value, ttlMs);
      return { value, stale: false };
    } catch (err) {
      // Only "not found"-style client errors should not be masked by stale data; everything else may.
      const mayServeStale = staleEntry && staleEntry.expiresAt + this.staleTtlMs > this.now() && err?.status !== 404;
      if (mayServeStale) {
        this.stats.staleServed++;
        return { value: staleEntry.value, stale: true };
      }
      throw err;
    }
  }

  #set(key, value, ttlMs) {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + ttlMs });
    while (this.entries.size > this.maxEntries) {
      this.entries.delete(this.entries.keys().next().value);
    }
  }

  get size() {
    return this.entries.size;
  }
}
