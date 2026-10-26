import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import type { TestProject } from 'vitest/node';
import { seedDatabase } from '../prisma/seeder.js';

export const TEST_ADMIN = { email: 'admin@test.local', password: 'admin-password-123', pseudo: 'admin' };

/**
 * Applique les migrations sur la base de test, la vide, puis la remplit avec le seed.
 * Garde-fou : refuse toute base dont le nom ne se termine pas par « _test ».
 */
export default async function setup(project: TestProject): Promise<void> {
  const url = project.config.env.DATABASE_URL as string;
  if (!new URL(url).pathname.endsWith('_test')) throw new Error(`Base de test attendue (suffixe _test) : ${url}`);

  execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "AnswerLog", "SessionQuestion", "GameSession", "RefreshToken", "User", "Answer", "Question", "Theme" CASCADE',
    );
    await seedDatabase(prisma, TEST_ADMIN);
  } finally {
    await prisma.$disconnect();
  }
}
