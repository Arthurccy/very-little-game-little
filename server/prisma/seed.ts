/**
 * Seed rejouable : thèmes, questions (standard + boss) et compte administrateur.
 * Usage : npm run db:seed (lit ../.env via dotenv-cli).
 */
import { PrismaClient, Role } from '@prisma/client';
import argon2 from 'argon2';
import { BOSS_QUESTION_COUNT, MIN_STANDARD_POOL_PER_THEME } from '@fps/shared';
import { themes } from './data/themes.js';
import type { SeedQuestionSet } from './data/types.js';
import { httpQuestions } from './data/questions/http.js';
import { restQuestions } from './data/questions/rest.js';
import { corsQuestions } from './data/questions/cors.js';
import { authQuestions } from './data/questions/auth.js';
import { securiteQuestions } from './data/questions/securite.js';
import { cacheQuestions } from './data/questions/cache.js';
import { bossQuestions } from './data/questions/boss.js';

const prisma = new PrismaClient();

const questionSets: SeedQuestionSet[] = [
  httpQuestions,
  restQuestions,
  corsQuestions,
  authQuestions,
  securiteQuestions,
  cacheQuestions,
  ...bossQuestions,
];

/** Vérifie les invariants avant d'écrire quoi que ce soit en base. */
function validate(): void {
  const errors: string[] = [];
  const keys = new Set<string>();
  const slugs = new Set(themes.map((t) => t.slug));

  for (const set of questionSets) {
    if (!slugs.has(set.themeSlug)) errors.push(`Thème inconnu : ${set.themeSlug}`);
    for (const q of set.questions) {
      if (keys.has(q.key)) errors.push(`Clé en double : ${q.key}`);
      keys.add(q.key);
      if (q.wrong.length < 2) errors.push(`${q.key} : au moins deux mauvaises réponses`);
      const texts = [q.correct, ...q.wrong].map((t) => t.trim().toLowerCase());
      if (new Set(texts).size !== texts.length) errors.push(`${q.key} : réponses en double`);
    }
  }

  for (const theme of themes) {
    const count = questionSets
      .filter((s) => s.themeSlug === theme.slug && s.kind === 'STANDARD')
      .reduce((n, s) => n + s.questions.length, 0);
    if (count < MIN_STANDARD_POOL_PER_THEME) {
      errors.push(`${theme.slug} : ${count} questions standard (minimum ${MIN_STANDARD_POOL_PER_THEME})`);
    }
  }

  const bossCount = questionSets.filter((s) => s.kind === 'BOSS').reduce((n, s) => n + s.questions.length, 0);
  if (bossCount < BOSS_QUESTION_COUNT) errors.push(`${bossCount} questions boss (minimum ${BOSS_QUESTION_COUNT})`);

  if (errors.length > 0) throw new Error(`Données de seed invalides :\n- ${errors.join('\n- ')}`);
}

async function seedThemes(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  // Libère les `order` avant l'upsert pour permettre de réordonner les thèmes sans conflit d'unicité.
  await prisma.theme.updateMany({ data: { order: { increment: 1000 } } });
  for (const t of themes) {
    const theme = await prisma.theme.upsert({
      where: { slug: t.slug },
      create: t,
      update: { name: t.name, scenery: t.scenery, order: t.order, intro: t.intro },
    });
    ids.set(t.slug, theme.id);
  }
  return ids;
}

async function seedQuestions(themeIds: Map<string, string>): Promise<number> {
  let count = 0;
  for (const set of questionSets) {
    const themeId = themeIds.get(set.themeSlug)!;
    for (const q of set.questions) {
      const data = {
        themeId,
        statement: q.statement,
        explanation: q.explanation,
        mdnUrl: q.mdn ?? null,
        difficulty: q.difficulty ?? 1,
        kind: set.kind,
        timeLimitMs: q.timeLimitMs ?? 20000,
        basePoints: q.basePoints ?? 100,
        isActive: true,
      };
      const answers = [
        { text: q.correct, isCorrect: true },
        ...q.wrong.map((text) => ({ text, isCorrect: false })),
      ];
      await prisma.$transaction(async (tx) => {
        const question = await tx.question.upsert({
          where: { seedKey: q.key },
          create: { ...data, seedKey: q.key },
          update: data,
        });
        // Les réponses sont recréées : les AnswerLog existants passent à answerId = null.
        await tx.answer.deleteMany({ where: { questionId: question.id } });
        await tx.answer.createMany({ data: answers.map((a) => ({ ...a, questionId: question.id })) });
      });
      count++;
    }
  }
  return count;
}

async function seedAdmin(): Promise<string> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const pseudo = process.env.ADMIN_PSEUDO?.trim() || 'admin';
  if (!email || !password) throw new Error('ADMIN_EMAIL et ADMIN_PASSWORD doivent être définis (voir .env.example).');
  if (password.length < 12) throw new Error('ADMIN_PASSWORD doit faire au moins 12 caractères.');

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await prisma.user.upsert({
    where: { email },
    create: { email, pseudo, passwordHash, role: Role.ADMIN },
    update: { pseudo, passwordHash, role: Role.ADMIN },
  });
  return email;
}

async function main(): Promise<void> {
  validate();
  const themeIds = await seedThemes();
  const questionCount = await seedQuestions(themeIds);
  const adminEmail = await seedAdmin();
  console.log(`Seed terminé : ${themeIds.size} thèmes, ${questionCount} questions, admin ${adminEmail}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
