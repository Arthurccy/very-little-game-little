/** Usage : npm run db:seed (lit ../.env via dotenv-cli). */
import { PrismaClient } from '@prisma/client';
import { seedDatabase } from './seeder.js';

const prisma = new PrismaClient();

seedDatabase(prisma, {
  email: process.env.ADMIN_EMAIL,
  password: process.env.ADMIN_PASSWORD,
  pseudo: process.env.ADMIN_PSEUDO,
})
  .then((summary) => console.log(`Seed terminé : ${summary}.`))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
