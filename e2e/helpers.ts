import { expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { E2E } from './env';

/** Accès direct à la base e2e : sert uniquement à connaître les bonnes réponses. */
export const db = new PrismaClient({ datasources: { db: { url: E2E.databaseUrl } } });

let counter = 0;

export async function registerPlayer(page: Page): Promise<string> {
  const pseudo = `e2e_${Date.now().toString(36)}${counter++}`;
  await page.goto('/');
  await page.getByRole('tab', { name: 'Inscription' }).click();
  await page.getByLabel('Pseudo').fill(pseudo);
  await page.getByLabel('Email').fill(`${pseudo}@e2e.local`);
  await page.getByLabel('Mot de passe').fill('motdepasse-solide');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByText(`Salut ${pseudo}`)).toBeVisible();
  return pseudo;
}

export async function loginAdmin(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Email').fill(E2E.admin.email);
  await page.getByLabel('Mot de passe').fill(E2E.admin.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('button', { name: 'Back-office' })).toBeVisible();
}

/** Attend que la question en cours accepte les tirs (fin du compte à rebours). */
export async function waitForActiveQuestion(page: Page): Promise<void> {
  await expect(page.locator('.question-panel__statement')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.zone-intro')).toHaveCount(0, { timeout: 10_000 });
}

/** Touches (1 à 6) des bonnes et mauvaises réponses affichées pour la question en cours. */
export async function answerKeys(page: Page): Promise<{ correct: string; wrong: string[] }> {
  const statement = await page.locator('.question-panel__statement').innerText();
  const question = await db.question.findFirstOrThrow({ where: { statement }, include: { answers: true } });
  const labels = await page
    .locator('.labels .target-label')
    .evaluateAll((els) => els.map((e) => e.lastChild?.textContent?.trim() ?? ''));
  const keyOf = (text: string) => String(labels.indexOf(text) + 1);
  return {
    correct: keyOf(question.answers.find((a) => a.isCorrect)!.text),
    wrong: question.answers.filter((a) => !a.isCorrect).map((a) => keyOf(a.text)),
  };
}

/** Secondes restantes affichées sous la question. */
export async function remainingSeconds(page: Page): Promise<number> {
  const hint = await page.locator('.question-panel__hint').innerText();
  return Number(hint.match(/([\d.]+) s/)![1]);
}
