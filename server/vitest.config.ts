import { defineConfig } from 'vitest/config';

/** Les tests tournent sur une base dédiée : DATABASE_URL_TEST, ou DATABASE_URL suffixée de « _test ». */
function testDatabaseUrl(): string {
  if (process.env.DATABASE_URL_TEST) return process.env.DATABASE_URL_TEST;
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error('DATABASE_URL ou DATABASE_URL_TEST doit être défini pour les tests');
  const url = new URL(base);
  url.pathname = `${url.pathname}_test`;
  return url.toString();
}

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDatabaseUrl(),
      JWT_ACCESS_SECRET: 'test-access-secret-with-at-least-32-characters',
      CLIENT_ORIGIN: 'http://localhost:43123',
    },
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
