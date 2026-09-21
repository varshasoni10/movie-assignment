import { config } from './config.js';
import { openDatabase } from './db.js';
import { createApp } from './app.js';
import { createTmdbProvider } from './providers/tmdb.js';
import { createSampleProvider } from './providers/sample.js';

const provider =
  config.provider === 'tmdb'
    ? createTmdbProvider({ tmdb: config.tmdb, upstream: config.upstream })
    : createSampleProvider(config.sample);

const { app } = createApp({ config, provider, db: openDatabase(config.dbPath) });

const server = app.listen(config.port, () => {
  console.log(`API on http://localhost:${config.port}  (provider: ${provider.name})`);
  if (provider.name === 'sample') console.log('No TMDB credentials found: serving the offline sample catalogue. See README.');
});

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
