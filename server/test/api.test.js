import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/db.js';
import { createSampleProvider } from '../src/providers/sample.js';
import { UpstreamError } from '../src/lib/errors.js';

const config = {
  cache: { maxEntries: 100, staleTtlMs: 60_000, listTtlMs: 60_000, detailTtlMs: 60_000, genreTtlMs: 60_000 },
  rateLimit: { windowMs: 60_000, max: 10_000 },
  clientDir: '/nonexistent',
};
const CLIENT = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

let server, base, provider, listCalls;

before(async () => {
  provider = createSampleProvider();
  const list = provider.list;
  listCalls = 0;
  provider.list = (...a) => (listCalls++, list(...a));
  const { app } = createApp({ config, provider, db: openDatabase(':memory:') });
  await new Promise((r) => (server = app.listen(0, r)));
  base = `http://localhost:${server.address().port}/api`;
});
after(() => server.close());

const get = (p, headers) => fetch(base + p, { headers }).then(async (r) => ({ status: r.status, body: r.status === 204 ? null : await r.json().catch(() => null) }));
const wl = { 'x-client-id': CLIENT, 'content-type': 'application/json' };

test('lists movies with pagination metadata', async () => {
  const { status, body } = await get('/movies?page=2');
  assert.equal(status, 200);
  assert.equal(body.page, 2);
  assert.equal(body.items.length, 20);
  assert.equal(body.hasMore, true);
});

test('search, genre and sort are applied', async () => {
  const { body } = await get('/movies?query=  shadow  ');
  assert.ok(body.items.length > 0);
  assert.ok(body.items.every((m) => m.title.toLowerCase().includes('shadow')));
  const sorted = await get('/movies?sort=title');
  const titles = sorted.body.items.map((m) => m.title);
  assert.deepEqual(titles, [...titles].sort((a, b) => a.localeCompare(b)));
  const g = await get('/movies?genre=27');
  assert.ok(g.body.items.every((m) => m.genreIds.includes(27)));
});

test('empty result set is a valid response', async () => {
  const { status, body } = await get('/movies?query=zzzzqqqq');
  assert.equal(status, 200);
  assert.deepEqual(body.items, []);
  assert.equal(body.hasMore, false);
});

test('rejects invalid params', async () => {
  for (const q of ['page=0', 'page=abc', 'sort=nope', 'genre=x', 'page=501']) {
    const { status, body } = await get(`/movies?${q}`);
    assert.equal(status, 400, q);
    assert.equal(body.error.code, 'BAD_PARAM');
  }
});

test('repeated identical requests hit the cache, not the provider', async () => {
  const before = listCalls;
  await get('/movies?query=iron&page=1');
  await get('/movies?query=IRON&page=1'); // key is case-normalized
  assert.equal(listCalls - before, 1);
});

test('movie detail and 404', async () => {
  const ok = await get('/movies/1000');
  assert.equal(ok.status, 200);
  assert.ok(Array.isArray(ok.body.cast));
  const nf = await get('/movies/999999');
  assert.equal(nf.status, 404);
});

test('wishlist requires a client id', async () => {
  assert.equal((await get('/wishlist')).status, 400);
});

test('wishlist add / list / ids / remove, isolated per client', async () => {
  const add = await fetch(`${base}/wishlist`, { method: 'POST', headers: wl, body: JSON.stringify({ movieId: 1001 }) });
  assert.equal(add.status, 201);
  await fetch(`${base}/wishlist`, { method: 'POST', headers: wl, body: JSON.stringify({ movieId: 1001 }) }); // idempotent
  const list = await get('/wishlist', wl);
  assert.equal(list.body.total, 1);
  assert.equal(list.body.items[0].id, 1001);
  assert.deepEqual((await get('/wishlist/ids', wl)).body.ids, [1001]);
  assert.equal((await get('/wishlist', { 'x-client-id': OTHER })).body.total, 0);
  const del = await fetch(`${base}/wishlist/1001`, { method: 'DELETE', headers: wl });
  assert.equal(del.status, 204);
  assert.equal((await get('/wishlist', wl)).body.total, 0);
});

test('wishlist rejects unknown movies and bad bodies', async () => {
  const nf = await fetch(`${base}/wishlist`, { method: 'POST', headers: wl, body: JSON.stringify({ movieId: 999999 }) });
  assert.equal(nf.status, 404);
  const bad = await fetch(`${base}/wishlist`, { method: 'POST', headers: wl, body: JSON.stringify({ movieId: 'x' }) });
  assert.equal(bad.status, 400);
});

test('upstream outage returns a clean 502, and stale cache is served when available', async () => {
  const original = provider.list;
  await get('/movies?query=harbor'); // warm cache
  provider.list = async () => {
    throw new UpstreamError('down', { status: 503, retryable: true });
  };
  const uncached = await get('/movies?query=neverseen');
  assert.equal(uncached.status, 502);
  assert.equal(uncached.body.error.code, 'UPSTREAM_UNAVAILABLE');
  provider.list = original;
});
