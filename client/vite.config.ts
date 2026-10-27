import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Le .env est partagé à la racine du monorepo.
  envDir: '..',
  server: { port: 43123, strictPort: true },
  preview: { port: 43123, strictPort: true },
  // Three.js pèse ~900 ko : il vit dans le chunk de la scène, chargé seulement au lancement d'une partie.
  build: { chunkSizeWarningLimit: 1000 },
});
