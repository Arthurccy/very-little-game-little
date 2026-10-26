/** Usage : npm run e2e:prepare -w server — base <DATABASE_URL>_e2e prête pour Playwright. */
import { derivedDatabaseUrl } from './db-url.js';
import { resetDatabase } from './reset-database.js';

export const E2E_ADMIN = { email: 'admin@e2e.local', password: 'admin-password-e2e', pseudo: 'admin' };

const url = process.env.DATABASE_URL_E2E ?? derivedDatabaseUrl(process.env.DATABASE_URL ?? '', '_e2e');
resetDatabase(url, '_e2e', E2E_ADMIN)
  .then(() => console.log('Base e2e prête.'))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
