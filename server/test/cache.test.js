import test from 'node:test';
import assert from 'node:assert/strict';
import { Cache } from '../src/lib/cache.js';

test('de-duplicates concurrent loads for the same key', async () => {
  const cache = new Cache();
  let calls = 0;
  const loader = async () => {
    calls++;
    await new Promise((r) => setTimeout(r, 20));
    return 'v';
  };
  const results = await Promise.all([cache.get('k', 1000, loader), cache.get('k', 1000, loader), cache.get('k', 1000, loader)]);
  assert.equal(calls, 1);
  assert.deepEqual(results.map((r) => r.value), ['v', 'v', 'v']);
});

test('serves from cache until TTL expires', async () => {
  let t = 0;
  const cache = new Cache({ now: () => t });
  let calls = 0;
  const loader = async () => ++calls;
  await cache.get('k', 100, loader);
  await cache.get('k', 100, loader);
  assert.equal(calls, 1);
  t = 101;
  const r = await cache.get('k', 100, loader);
  assert.equal(r.value, 2);
});

test('serves stale data when the loader fails, within the stale window', async () => {
  let t = 0;
  const cache = new Cache({ now: () => t, staleTtlMs: 1000 });
  await cache.get('k', 100, async () => 'old');
  t = 200;
  const r = await cache.get('k', 100, async () => {
    throw new Error('boom');
  });
  assert.deepEqual(r, { value: 'old', stale: true });
  t = 5000; // beyond the stale window
  await assert.rejects(cache.get('k', 100, async () => { throw new Error('boom'); }));
});

test('does not mask 404 with stale data, and failures are not cached', async () => {
  let t = 0;
  const cache = new Cache({ now: () => t, staleTtlMs: 1000 });
  await cache.get('k', 100, async () => 'old');
  t = 200;
  await assert.rejects(cache.get('k', 100, async () => { throw Object.assign(new Error('nf'), { status: 404 }); }));
  await assert.rejects(cache.get('x', 100, async () => { throw new Error('boom'); }));
  const r = await cache.get('x', 100, async () => 'ok');
  assert.equal(r.value, 'ok');
});

test('evicts least recently used entries beyond maxEntries', async () => {
  const cache = new Cache({ maxEntries: 2 });
  await cache.get('a', 1000, async () => 1);
  await cache.get('b', 1000, async () => 2);
  await cache.get('a', 1000, async () => 99); // touch a
  await cache.get('c', 1000, async () => 3); // evicts b
  assert.equal(cache.size, 2);
  const b = await cache.get('b', 1000, async () => 'reloaded');
  assert.equal(b.value, 'reloaded');
});
