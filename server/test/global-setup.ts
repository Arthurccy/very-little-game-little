import type { TestProject } from 'vitest/node';
import { resetDatabase } from '../prisma/reset-database.js';

export const TEST_ADMIN = { email: 'admin@test.local', password: 'admin-password-123', pseudo: 'admin' };

/** Recrée la base de test (migrations, vidage, seed) avant la suite. */
export default async function setup(project: TestProject): Promise<void> {
  await resetDatabase(project.config.env.DATABASE_URL as string, '_test', TEST_ADMIN);
}
