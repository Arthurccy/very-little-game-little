import { createApp } from './app.js';
import { prisma } from './db.js';
import { env } from './env.js';

const server = createApp().listen(env.API_PORT, (err) => {
  // Express 5 transmet ici les erreurs d'écoute (port déjà pris…).
  if (err) {
    console.error(`Impossible d'écouter sur le port ${env.API_PORT} :`, err.message);
    process.exit(1);
  }
  console.log(`API prête sur http://localhost:${env.API_PORT} (client autorisé : ${env.CLIENT_ORIGIN})`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`${signal} reçu, arrêt…`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
