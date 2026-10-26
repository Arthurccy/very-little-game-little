import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { seedDatabase, type AdminSeed } from './seeder.js';

/**
 * Prépare une base jetable pour les tests : migrations, vidage complet, seed.
 * Garde-fou : refuse toute base dont le nom ne se termine pas par le suffixe attendu.
 */
export async function resetDatabase(url: string, suffix: '_test' | '_e2e', admin: AdminSeed): Promise<void> {
  const name = new URL(url).pathname.slice(1);
  if (!name.endsWith(suffix)) throw new Error(`Base « ${name} » refusée : le nom doit se terminer par ${suffix}`);

  execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "AnswerLog", "SessionQuestion", "GameSession", "RefreshToken", "User", "Answer", "Question", "Theme" CASCADE',
    );
    await seedDatabase(prisma, admin);
  } finally {
    await prisma.$disconnect();
  }
}
