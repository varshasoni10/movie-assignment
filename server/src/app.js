import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { Cache } from './lib/cache.js';
import { createMovieService } from './services/movies.js';
import { createWishlistRepo } from './db.js';
import { moviesRouter } from './routes/movies.js';
import { wishlistRouter } from './routes/wishlist.js';
import { errorHandler, notFound, rateLimit } from './middleware/common.js';

/** Composition root: everything is injected so tests can build an app with fake providers / in-memory DB. */
export function createApp({ config, provider, db }) {
  const cache = new Cache({ maxEntries: config.cache.maxEntries, staleTtlMs: config.cache.staleTtlMs });
  const movies = createMovieService({
    provider,
    cache,
    ttl: { list: config.cache.listTtlMs, detail: config.cache.detailTtlMs, genre: config.cache.genreTtlMs },
  });
  const repo = createWishlistRepo(db);

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '10kb' }));

  const api = express.Router();
  api.use(rateLimit(config.rateLimit));
  api.get('/health', (_req, res) => res.json({ ok: true, provider: provider.name, cache: { size: cache.size, ...cache.stats } }));
  api.use(moviesRouter(movies));
  api.use(wishlistRouter({ repo, movies }));
  api.use(notFound);
  app.use('/api', api);

  // In production the same process serves the built React app (SPA fallback).
  if (fs.existsSync(path.join(config.clientDir, 'index.html'))) {
    app.use(express.static(config.clientDir, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(config.clientDir, 'index.html')));
  }

  app.use(errorHandler);
  return { app, cache };
}
