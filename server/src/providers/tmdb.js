import { createUpstreamClient } from '../lib/upstream.js';
import { UpstreamError } from '../lib/errors.js';
import { MAX_PAGE } from '../constants.js';

/*
 * TMDB provider. Everything TMDB-specific (field names, image URLs, sort keys, quirks) lives here;
 * the rest of the app only sees the normalized shapes returned by the `normalize*` functions.
 */

const SORT_MAP = {
  popularity: 'popularity.desc',
  rating: 'vote_average.desc',
  newest: 'primary_release_date.desc',
  oldest: 'primary_release_date.asc',
  title: 'original_title.asc',
};

const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function parseYear(date) {
  const m = typeof date === 'string' ? /^(\d{4})/.exec(date) : null;
  return m ? Number(m[1]) : null;
}

export function normalizeSummary(raw, imageBase) {
  if (!raw || !Number.isInteger(raw.id)) return null; // unusable record => dropped by caller
  const title = str(raw.title) ?? str(raw.original_title);
  if (!title) return null;
  return {
    id: raw.id,
    title,
    year: parseYear(raw.release_date),
    overview: str(raw.overview),
    posterUrl: raw.poster_path ? `${imageBase}/w342${raw.poster_path}` : null,
    // vote_average is 0 for unrated titles; treat "no votes" as unknown rather than a bad score.
    rating: raw.vote_count > 0 ? Math.round((num(raw.vote_average) ?? 0) * 10) / 10 : null,
    genreIds: Array.isArray(raw.genre_ids) ? raw.genre_ids.filter(Number.isInteger) : [],
  };
}

export function normalizeDetail(raw, imageBase) {
  const base = normalizeSummary({ ...raw, genre_ids: (raw?.genres ?? []).map((g) => g?.id) }, imageBase);
  if (!base) return null;
  const crew = raw.credits?.crew ?? [];
  const cast = (raw.credits?.cast ?? [])
    .filter((p) => str(p?.name))
    .slice(0, 12)
    .map((p) => ({
      id: p.id,
      name: p.name,
      character: str(p.character),
      photoUrl: p.profile_path ? `${imageBase}/w185${p.profile_path}` : null,
    }));
  const trailer = (raw.videos?.results ?? []).find((v) => v?.site === 'YouTube' && v?.type === 'Trailer' && v?.key);
  return {
    ...base,
    posterUrl: raw.poster_path ? `${imageBase}/w500${raw.poster_path}` : null,
    backdropUrl: raw.backdrop_path ? `${imageBase}/w1280${raw.backdrop_path}` : null,
    tagline: str(raw.tagline),
    runtime: raw.runtime > 0 ? raw.runtime : null,
    releaseDate: str(raw.release_date),
    status: str(raw.status),
    voteCount: num(raw.vote_count) ?? 0,
    genres: (raw.genres ?? []).filter((g) => g && Number.isInteger(g.id) && str(g.name)).map((g) => ({ id: g.id, name: g.name })),
    director: str(crew.find((c) => c?.job === 'Director')?.name),
    cast,
    trailerUrl: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
  };
}

export function createTmdbProvider({ tmdb, upstream }) {
  const client = createUpstreamClient({
    baseUrl: tmdb.baseUrl,
    headers: tmdb.readToken ? { Authorization: `Bearer ${tmdb.readToken}` } : {},
    defaultParams: tmdb.readToken ? {} : { api_key: tmdb.apiKey },
    ...upstream,
  });
  const img = tmdb.imageBase;

  return {
    name: 'tmdb',
    scheduler: client.scheduler,

    async list({ query, genre, sort, year, page }) {
      let data;
      if (query) {
        // /search ignores sort & genre upstream; genre is applied to the returned page below.
        data = await client.get('/search/movie', { query, page, year, include_adult: false });
      } else {
        const today = new Date().toISOString().slice(0, 10);
        data = await client.get('/discover/movie', {
          page,
          sort_by: SORT_MAP[sort],
          with_genres: genre,
          primary_release_year: year,
          include_adult: false,
          // Without these, "highest rated" is dominated by titles with 1-2 votes and
          // "newest" by unreleased placeholders.
          'vote_count.gte': sort === 'rating' ? 300 : undefined,
          'primary_release_date.lte': sort === 'newest' ? today : undefined,
        });
      }
      let items = (Array.isArray(data?.results) ? data.results : []).map((r) => normalizeSummary(r, img)).filter(Boolean);
      if (query && genre) items = items.filter((m) => m.genreIds.includes(genre));
      const totalPages = Math.min(Number(data?.total_pages) || 0, MAX_PAGE);
      return { items, page: Number(data?.page) || page, totalPages, totalResults: Number(data?.total_results) || 0 };
    },

    async detail(id) {
      const raw = await client.get(`/movie/${id}`, { append_to_response: 'credits,videos' });
      const movie = normalizeDetail(raw, img);
      if (!movie) throw new UpstreamError('bad payload', { status: 502 });
      return movie;
    },

    async genres() {
      const data = await client.get('/genre/movie/list');
      return (data?.genres ?? []).filter((g) => Number.isInteger(g?.id) && str(g?.name)).map((g) => ({ id: g.id, name: g.name }));
    },
  };
}
