import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Le .env est partagé à la racine du monorepo.
  envDir: '..',
  server: { port: 43123, strictPort: true },
  preview: { port: 43123, strictPort: true },
});
