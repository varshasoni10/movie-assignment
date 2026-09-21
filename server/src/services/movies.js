import { GENRES } from '../constants.js';

/**
 * Movie service = provider + cache. Routes never talk to a provider directly, so caching,
 * de-duplication and stale-if-error apply uniformly.
 * Every method resolves to `{ data, stale }`.
 */
export function createMovieService({ provider, cache, ttl }) {
  const listKey = (p) => `list:${p.query.toLowerCase()}|${p.genre ?? ''}|${p.sort}|${p.year ?? ''}|${p.page}`;

  return {
    async list(params) {
      const { value, stale } = await cache.get(listKey(params), ttl.list, () => provider.list(params));
      return { data: { ...value, hasMore: value.page < value.totalPages }, stale };
    },

    async detail(id) {
      const { value, stale } = await cache.get(`detail:${id}`, ttl.detail, () => provider.detail(id));
      return { data: value, stale };
    },

    async genres() {
      // Genres are near-static; if the upstream is unavailable fall back to the bundled list.
      try {
        const { value, stale } = await cache.get('genres', ttl.genre, () => provider.genres());
        return { data: value.length ? value : GENRES, stale };
      } catch {
        return { data: GENRES, stale: true };
      }
    },
  };
}
