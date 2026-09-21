import { GENRES, PAGE_SIZE } from '../constants.js';
import { UpstreamError } from '../lib/errors.js';

/*
 * Offline provider with a deterministic ~300 title catalogue. It exists so the app runs with zero setup
 * and so edge cases (long titles, missing posters, missing overviews, slow/flaky upstream) are easy to see.
 * It implements the exact same interface as the TMDB provider.
 */

// Seeded stock photos stand in for real artwork when no TMDB key is configured.
const IMG = 'https://picsum.photos/seed';

function rng(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ADJ = ['Silent', 'Crimson', 'Last', 'Hidden', 'Electric', 'Broken', 'Golden', 'Midnight', 'Forgotten', 'Wild', 'Distant', 'Hollow', 'Burning', 'Lonely', 'Iron'];
const NOUN = ['Horizon', 'Empire', 'Garden', 'Signal', 'Harbor', 'Witness', 'Kingdom', 'Machine', 'River', 'Promise', 'Frontier', 'Echo', 'Orchard', 'Voyage', 'Shadow'];
const FIRST = ['Ava', 'Liam', 'Noor', 'Mateo', 'Yuki', 'Zara', 'Omar', 'Ines', 'Kofi', 'Elena', 'Ravi', 'Sofia'];
const LAST = ['Okafor', 'Lindqvist', 'Tanaka', 'Moreau', 'Haddad', 'Reyes', 'Novak', 'Iyer', 'Costa', 'Bauer'];
const LONG_TITLES = [
  'The Extraordinarily Long and Unnecessarily Complicated Adventures of a Very Confused Lighthouse Keeper',
  'Supercalifragilisticexpialidocious Nightmares of the Antidisestablishmentarianism Society',
];

function build() {
  const rand = rng(42);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const seen = new Set();
  const movies = [];
  const push = (title) => {
    if (seen.has(title)) return;
    seen.add(title);
    const id = 1000 + movies.length;
    const year = 1960 + Math.floor(rand() * 66);
    const genreIds = [...new Set([pick(GENRES).id, pick(GENRES).id])];
    const votes = Math.floor(rand() * 20000);
    const missingOverview = rand() < 0.06;
    movies.push({
      id,
      title,
      year,
      releaseDate: `${year}-${String(1 + Math.floor(rand() * 12)).padStart(2, '0')}-${String(1 + Math.floor(rand() * 28)).padStart(2, '0')}`,
      overview: missingOverview
        ? null
        : `${title} follows a reluctant protagonist through a story of ${pick(NOUN).toLowerCase()}s and ${pick(ADJ).toLowerCase()} secrets. ` +
          'A sample synopsis generated for the offline catalogue, long enough to show how descriptions wrap and clamp across screen sizes.',
      hasPoster: rand() > 0.08,
      posterRatio: [1.5, 1.5, 1.5, 1.33, 1.78][Math.floor(rand() * 5)], // odd aspect ratios on purpose
      rating: votes > 0 ? Math.round((3 + rand() * 6.5) * 10) / 10 : null,
      voteCount: votes,
      popularity: rand() * 100,
      genreIds,
      runtime: rand() < 0.05 ? null : 80 + Math.floor(rand() * 90),
      director: `${pick(FIRST)} ${pick(LAST)}`,
      cast: Array.from({ length: 6 }, (_, i) => ({ id: id * 10 + i, name: `${pick(FIRST)} ${pick(LAST)}`, character: `Character ${i + 1}`, photoUrl: `${IMG}/reel-cast-${id * 10 + i}/185/185` })),
    });
  };
  LONG_TITLES.forEach(push);
  let guard = 0;
  while (movies.length < 300 && guard++ < 5000) {
    const r = rand();
    push(r < 0.5 ? `The ${pick(ADJ)} ${pick(NOUN)}` : r < 0.8 ? `${pick(ADJ)} ${pick(NOUN)}` : `${pick(NOUN)} of the ${pick(ADJ)} ${pick(NOUN)}`);
  }
  return movies;
}

const CATALOGUE = build();
const byId = new Map(CATALOGUE.map((m) => [m.id, m]));

const posterUrl = (m) => (m.hasPoster ? `${IMG}/reel-${m.id}/300/${Math.round(300 * m.posterRatio)}` : null);
const summary = (m) => ({
  id: m.id,
  title: m.title,
  year: m.year,
  overview: m.overview,
  posterUrl: posterUrl(m),
  rating: m.rating,
  genreIds: m.genreIds,
});

const SORTERS = {
  popularity: (a, b) => b.popularity - a.popularity,
  rating: (a, b) => (b.rating ?? -1) - (a.rating ?? -1),
  newest: (a, b) => b.releaseDate.localeCompare(a.releaseDate),
  oldest: (a, b) => a.releaseDate.localeCompare(b.releaseDate),
  title: (a, b) => a.title.localeCompare(b.title),
};

export function createSampleProvider({ latencyMs = 0, failRate = 0 } = {}) {
  const delay = async () => {
    if (latencyMs) await new Promise((r) => setTimeout(r, latencyMs * (0.5 + Math.random())));
    if (failRate && Math.random() < failRate) throw new UpstreamError('simulated failure', { status: 503, retryable: true });
  };

  return {
    name: 'sample',
    async list({ query, genre, sort, year, page }) {
      await delay();
      let items = CATALOGUE;
      if (query) {
        const q = query.toLowerCase();
        items = items.filter((m) => m.title.toLowerCase().includes(q));
      }
      if (genre) items = items.filter((m) => m.genreIds.includes(genre));
      if (year) items = items.filter((m) => m.year === year);
      items = [...items].sort(SORTERS[sort] ?? SORTERS.popularity);
      const totalPages = Math.ceil(items.length / PAGE_SIZE);
      return {
        items: items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(summary),
        page,
        totalPages,
        totalResults: items.length,
      };
    },
    async detail(id) {
      await delay();
      const m = byId.get(id);
      if (!m) throw new UpstreamError('not found', { status: 404 });
      return {
        ...summary(m),
        backdropUrl: m.hasPoster ? `${IMG}/reel-bg-${m.id}/1280/720` : null,
        tagline: null,
        runtime: m.runtime,
        releaseDate: m.releaseDate,
        status: 'Released',
        voteCount: m.voteCount,
        genres: GENRES.filter((g) => m.genreIds.includes(g.id)),
        director: m.director,
        cast: m.cast,
        trailerUrl: null,
      };
    },
    async genres() {
      await delay();
      return GENRES;
    },
  };
}
