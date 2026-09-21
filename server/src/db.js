import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * SQLite schema. Only data we OWN is stored: the wishlist.
 * Movie catalogue data stays with the third-party API (cached in memory), because it changes upstream
 * and duplicating it would mean owning its freshness.
 *
 * A wishlist row keeps a small snapshot (title, year, poster, rating) so the wishlist page renders in a
 * single DB query and still works when the movie API is down. Details are fetched on demand.
 */
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS wishlist (
    client_id  TEXT    NOT NULL,
    movie_id   INTEGER NOT NULL,
    title      TEXT    NOT NULL,
    year       INTEGER,
    poster_url TEXT,
    rating     REAL,
    added_at   INTEGER NOT NULL,
    PRIMARY KEY (client_id, movie_id)
  ) WITHOUT ROWID;
  CREATE INDEX IF NOT EXISTS idx_wishlist_client_added ON wishlist (client_id, added_at DESC);
`;

export function openDatabase(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}

export function createWishlistRepo(db) {
  const insert = db.prepare(
    `INSERT INTO wishlist (client_id, movie_id, title, year, poster_url, rating, added_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (client_id, movie_id) DO NOTHING`,
  );
  const remove = db.prepare('DELETE FROM wishlist WHERE client_id = ? AND movie_id = ?');
  const page = db.prepare(
    `SELECT movie_id AS id, title, year, poster_url AS posterUrl, rating, added_at AS addedAt
     FROM wishlist WHERE client_id = ? ORDER BY added_at DESC, movie_id DESC LIMIT ? OFFSET ?`,
  );
  const count = db.prepare('SELECT COUNT(*) AS n FROM wishlist WHERE client_id = ?');
  const ids = db.prepare('SELECT movie_id AS id FROM wishlist WHERE client_id = ?');

  return {
    add(clientId, m) {
      insert.run(clientId, m.id, m.title, m.year ?? null, m.posterUrl ?? null, m.rating ?? null, Date.now());
    },
    remove(clientId, movieId) {
      return remove.run(clientId, movieId).changes > 0;
    },
    list(clientId, { limit, offset }) {
      return { items: page.all(clientId, limit, offset), total: count.get(clientId).n };
    },
    ids(clientId) {
      return ids.all(clientId).map((r) => r.id);
    },
  };
}
