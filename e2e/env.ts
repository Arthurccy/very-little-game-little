/**
 * Configuration partagée par playwright.config.ts et les tests. La base e2e est
 * dérivée de DATABASE_URL (suffixe « _e2e ») ; l'API et le client tournent sur des
 * ports dédiés pour ne pas gêner `npm run dev`.
 */
try {
  process.loadEnvFile(new URL('../.env', import.meta.url).pathname);
} catch {
  // Pas de .env (CI) : les variables viennent de l'environnement.
}

function e2eDatabaseUrl(): string {
  if (process.env.DATABASE_URL_E2E) return process.env.DATABASE_URL_E2E;
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error('DATABASE_URL ou DATABASE_URL_E2E doit être défini pour les tests e2e');
  const url = new URL(base);
  url.pathname = `${url.pathname}_e2e`;
  return url.toString();
}

export const E2E = {
  databaseUrl: e2eDatabaseUrl(),
  apiPort: 43196,
  clientPort: 43195,
  /** Doit correspondre à server/prisma/prepare-e2e.ts. */
  admin: { email: 'admin@e2e.local', password: 'admin-password-e2e' },
};
export const API_URL = `http://localhost:${E2E.apiPort}`;
export const CLIENT_URL = `http://localhost:${E2E.clientPort}`;
