import { Router } from 'express';
import { AppError } from '../lib/errors.js';
import { DEFAULT_SORT, MAX_PAGE, SORTS } from '../constants.js';

const intParam = (raw, { name, min, max, fallback }) => {
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) throw new AppError(400, 'BAD_PARAM', `Invalid "${name}".`);
  return n;
};

export function parseListParams(q) {
  const sort = q.sort === undefined || q.sort === '' ? DEFAULT_SORT : q.sort;
  if (!Object.hasOwn(SORTS, sort)) throw new AppError(400, 'BAD_PARAM', 'Invalid "sort".');
  const query = typeof q.query === 'string' ? q.query.trim().replace(/\s+/g, ' ').slice(0, 100) : '';
  return {
    query,
    genre: intParam(q.genre, { name: 'genre', min: 1, max: 1_000_000, fallback: null }),
    year: intParam(q.year, { name: 'year', min: 1870, max: 2100, fallback: null }),
    page: intParam(q.page, { name: 'page', min: 1, max: MAX_PAGE, fallback: 1 }),
    // Upstream search endpoints rank by relevance and ignore sort, so sort only applies when browsing.
    sort: query ? 'relevance' : sort,
  };
}

function send(res, { data, stale }, maxAge) {
  res.set('Cache-Control', stale ? 'no-store' : `private, max-age=${maxAge}`);
  res.set('X-Data-Stale', stale ? 'true' : 'false');
  res.json({ ...data, stale });
}

export function moviesRouter(movies) {
  const r = Router();

  r.get('/movies', async (req, res) => {
    send(res, await movies.list(parseListParams(req.query)), 60);
  });

  r.get('/movies/:id', async (req, res) => {
    const id = intParam(req.params.id, { name: 'id', min: 1, max: Number.MAX_SAFE_INTEGER, fallback: null });
    send(res, await movies.detail(id), 300);
  });

  r.get('/genres', async (_req, res) => {
    const { data, stale } = await movies.genres();
    res.set('Cache-Control', 'private, max-age=3600');
    res.json({ genres: data, sorts: Object.entries(SORTS).map(([id, label]) => ({ id, label })), stale });
  });

  return r;
}
