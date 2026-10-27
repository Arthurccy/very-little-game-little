import { defineConfig, devices } from '@playwright/test';
import { API_URL, CLIENT_URL, E2E } from './env';

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  // Un seul serveur et une seule base : les tests s'exécutent l'un après l'autre.
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: CLIENT_URL,
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        // WebGL logiciel : la scène 3D tourne aussi sans GPU (CI, conteneurs).
        launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
      },
    },
  ],
  webServer: [
    {
      command: 'npm run start -w server',
      cwd: '..',
      url: `${API_URL}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: 'test',
        DATABASE_URL: E2E.databaseUrl,
        API_PORT: String(E2E.apiPort),
        CLIENT_ORIGIN: CLIENT_URL,
        JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? 'e2e-access-secret-with-at-least-32-characters',
      },
    },
    {
      command: `npm run dev -w client -- --port ${E2E.clientPort} --strictPort`,
      cwd: '..',
      url: CLIENT_URL,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { VITE_API_URL: API_URL },
    },
  ],
});
