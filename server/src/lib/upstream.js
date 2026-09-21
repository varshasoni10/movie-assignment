import { UpstreamError } from './errors.js';

/**
 * Outbound scheduler: limits concurrent upstream calls and spaces out their start times so a burst of
 * user activity can never exceed the third-party API's rate limit. Bounded queue => fail fast under overload.
 */
export class Scheduler {
  constructor({ maxConcurrent, minIntervalMs, maxQueue = 100 }) {
    this.maxConcurrent = maxConcurrent;
    this.minIntervalMs = minIntervalMs;
    this.maxQueue = maxQueue;
    this.active = 0;
    this.queue = [];
    this.nextStart = 0;
    this.timer = null;
  }

  run(task) {
    if (this.queue.length >= this.maxQueue) {
      return Promise.reject(new UpstreamError('queue full', { status: 429 }));
    }
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.#pump();
    });
  }

  #pump() {
    while (this.active < this.maxConcurrent && this.queue.length > 0) {
      const wait = this.nextStart - Date.now();
      if (wait > 0) {
        this.timer ??= setTimeout(() => {
          this.timer = null;
          this.#pump();
        }, wait);
        return;
      }
      const { task, resolve, reject } = this.queue.shift();
      this.nextStart = Date.now() + this.minIntervalMs;
      this.active++;
      task()
        .then(resolve, reject)
        .finally(() => {
          this.active--;
          this.#pump();
        });
    }
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Thin JSON HTTP client with timeout, retry (5xx / network / 429 with Retry-After) and scheduling.
 * 4xx other than 429 are NOT retried: they will not succeed on a second attempt.
 */
export function createUpstreamClient({ baseUrl, headers = {}, defaultParams = {}, timeoutMs, maxRetries, maxConcurrent, minIntervalMs }) {
  const scheduler = new Scheduler({ maxConcurrent, minIntervalMs });

  async function attempt(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json', ...headers }, signal: controller.signal });
      if (!res.ok) {
        const retryAfter = Number(res.headers.get('retry-after'));
        throw new UpstreamError(`upstream ${res.status}`, {
          status: res.status,
          retryable: res.status >= 500 || res.status === 429,
          retryAfterMs: Number.isFinite(retryAfter) ? retryAfter * 1000 : 0,
        });
      }
      try {
        return await res.json();
      } catch (cause) {
        throw new UpstreamError('invalid json', { status: 502, retryable: true, cause });
      }
    } catch (err) {
      if (err instanceof UpstreamError) throw err;
      const aborted = err?.name === 'AbortError';
      throw new UpstreamError(aborted ? 'timeout' : 'network', { retryable: true, cause: err });
    } finally {
      clearTimeout(timer);
    }
  }

  async function get(path, params = {}) {
    const url = new URL(baseUrl + path);
    for (const [k, v] of Object.entries({ ...defaultParams, ...params })) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }

    let lastError;
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await scheduler.run(() => attempt(url));
      } catch (err) {
        lastError = err;
        if (!(err instanceof UpstreamError) || !err.retryable || i === maxRetries) break;
        const backoff = 300 * 2 ** i + Math.random() * 100;
        await sleep(Math.min(Math.max(err.retryAfterMs, backoff), 3000));
      }
    }
    throw lastError;
  }

  return { get, scheduler };
}
