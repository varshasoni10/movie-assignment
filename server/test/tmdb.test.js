import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSummary, normalizeDetail } from '../src/providers/tmdb.js';

const IMG = 'https://img';

test('normalizes a complete record', () => {
  const m = normalizeSummary(
    { id: 1, title: 'A', release_date: '2019-05-01', overview: 'x', poster_path: '/p.jpg', vote_average: 7.86, vote_count: 10, genre_ids: [1, 2] },
    IMG,
  );
  assert.deepEqual(m, { id: 1, title: 'A', year: 2019, overview: 'x', posterUrl: 'https://img/w342/p.jpg', rating: 7.9, genreIds: [1, 2] });
});

test('tolerates missing / malformed fields', () => {
  const m = normalizeSummary({ id: 2, title: '  ', original_title: 'Orig', release_date: '', overview: '', poster_path: null, vote_average: 0, vote_count: 0 }, IMG);
  assert.equal(m.title, 'Orig');
  assert.equal(m.year, null);
  assert.equal(m.overview, null);
  assert.equal(m.posterUrl, null);
  assert.equal(m.rating, null); // unrated, not "0"
  assert.deepEqual(m.genreIds, []);
});

test('drops unusable records', () => {
  assert.equal(normalizeSummary(null, IMG), null);
  assert.equal(normalizeSummary({ title: 'no id' }, IMG), null);
  assert.equal(normalizeSummary({ id: 3 }, IMG), null);
});

test('detail extracts director, cast and trailer defensively', () => {
  const d = normalizeDetail(
    {
      id: 5,
      title: 'D',
      runtime: 0,
      genres: [{ id: 1, name: 'X' }, null, { id: 2 }],
      credits: { crew: [{ job: 'Writer', name: 'W' }, { job: 'Director', name: 'Dir' }], cast: [{ id: 9, name: 'Actor', profile_path: '/a.jpg' }, {}] },
      videos: { results: [{ site: 'Vimeo', type: 'Trailer', key: 'v' }, { site: 'YouTube', type: 'Trailer', key: 'yt' }] },
    },
    IMG,
  );
  assert.equal(d.director, 'Dir');
  assert.equal(d.runtime, null);
  assert.deepEqual(d.genres, [{ id: 1, name: 'X' }]);
  assert.equal(d.cast.length, 1);
  assert.equal(d.trailerUrl, 'https://www.youtube.com/watch?v=yt');
});
