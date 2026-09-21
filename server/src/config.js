import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Optional .env support without a dependency (Node 22+).
try {
  process.loadEnvFile(new URL('../.env', import.meta.url));
} catch {
  /* no .env file, that's fine */
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const int = (v, d) => (Number.isFinite(Number(v)) && v !== undefined && v !== '' ? Number(v) : d);

const hasTmdbCredentials = Boolean(process.env.TMDB_API_KEY || process.env.TMDB_READ_TOKEN);

export const config = {
  port: int(process.env.PORT, 4000),
  // "tmdb" when credentials exist, otherwise the offline "sample" catalogue so the app always runs.
  provider: process.env.MOVIE_PROVIDER || (hasTmdbCredentials ? 'tmdb' : 'sample'),
  tmdb: {
    apiKey: process.env.TMDB_API_KEY || '',
    readToken: process.env.TMDB_READ_TOKEN || '',
    baseUrl: 'https://api.themoviedb.org/3',
    imageBase: 'https://image.tmdb.org/t/p',
  },
  dbPath: process.env.DB_PATH || path.join(root, 'data', 'wishlist.db'),
  clientDir: path.resolve(root, '..', 'client', 'dist'),
  cache: {
    listTtlMs: int(process.env.CACHE_LIST_TTL_MS, 5 * 60_000),
    detailTtlMs: int(process.env.CACHE_DETAIL_TTL_MS, 30 * 60_000),
    genreTtlMs: 24 * 60 * 60_000,
    // How long an expired entry may still be served if the upstream is failing.
    staleTtlMs: int(process.env.CACHE_STALE_TTL_MS, 24 * 60 * 60_000),
    maxEntries: int(process.env.CACHE_MAX_ENTRIES, 2000),
  },
  upstream: {
    timeoutMs: int(process.env.UPSTREAM_TIMEOUT_MS, 8000),
    maxRetries: int(process.env.UPSTREAM_MAX_RETRIES, 2),
    maxConcurrent: int(process.env.UPSTREAM_MAX_CONCURRENT, 6),
    minIntervalMs: int(process.env.UPSTREAM_MIN_INTERVAL_MS, 30),
  },
  // Inbound per-IP limit protects our own upstream quota.
  rateLimit: { windowMs: 60_000, max: int(process.env.RATE_LIMIT_PER_MIN, 240) },
  sample: {
    latencyMs: int(process.env.SAMPLE_LATENCY_MS, 120),
    failRate: Number(process.env.SAMPLE_FAIL_RATE || 0), // 0..1, to demo error handling
  },
};
