import { execSync } from 'node:child_process';
import { E2E } from './env';

/** Remet la base e2e à zéro (migrations, vidage, seed) avant la suite. */
export default function globalSetup(): void {
  execSync('npm run e2e:prepare -w server', {
    cwd: new URL('..', import.meta.url).pathname,
    env: { ...process.env, DATABASE_URL_E2E: E2E.databaseUrl },
    stdio: 'inherit',
  });
}
