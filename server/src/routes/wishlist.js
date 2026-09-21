import { Router } from 'express';
import { AppError } from '../lib/errors.js';
import { requireClientId } from '../middleware/common.js';

export function wishlistRouter({ repo, movies }) {
  const r = Router();
  r.use(requireClientId);
  r.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  const movieId = (raw) => {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1) throw new AppError(400, 'BAD_PARAM', 'Invalid movie id.');
    return n;
  };

  // Lightweight list of ids so every card can render its heart state from one small request.
  r.get('/wishlist/ids', (req, res) => res.json({ ids: repo.ids(req.clientId) }));

  r.get('/wishlist', (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 24, 1), 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const { items, total } = repo.list(req.clientId, { limit, offset });
    res.json({ items, total, hasMore: offset + items.length < total, nextOffset: offset + items.length });
  });

  // The snapshot is built from OUR service (validated + cached), never from client-supplied data.
  r.post('/wishlist', async (req, res) => {
    const id = movieId(req.body?.movieId);
    const { data } = await movies.detail(id);
    repo.add(req.clientId, data);
    res.status(201).json({ id });
  });

  r.delete('/wishlist/:id', (req, res) => {
    repo.remove(req.clientId, movieId(req.params.id)); // idempotent: deleting a missing item is fine
    res.status(204).end();
  });

  return r;
}
