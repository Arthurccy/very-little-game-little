import { expect, test } from '@playwright/test';
import { answerKeys, registerPlayer, remainingSeconds, waitForActiveQuestion } from '../helpers';

test.beforeEach(async ({ page }) => {
  await registerPlayer(page);
});

test('des tirs enchaînés très vite ne sont pas perdus', async ({ page }) => {
  await page.getByRole('button', { name: 'Jouer', exact: true }).click();
  await waitForActiveQuestion(page);
  const { wrong } = await answerKeys(page);

  // Toutes les mauvaises réponses d'affilée, sans attendre les réponses du serveur.
  for (const key of wrong) await page.keyboard.press(key);

  await expect(page.locator('.reveal')).toContainText('Bien joué');
  await expect(page.locator('.hud-score')).not.toHaveText('0');
});

test('tirer sur la bonne réponse coûte 25 PV, puis la question suivante arrive', async ({ page }) => {
  await page.getByRole('button', { name: 'Jouer', exact: true }).click();
  await waitForActiveQuestion(page);
  const statement = await page.locator('.question-panel__statement').innerText();
  const { correct } = await answerKeys(page);
  await page.keyboard.press(correct);

  await expect(page.locator('.reveal')).toContainText('Tu as abattu la bonne réponse');
  await expect(page.locator('.hud-box').first()).toContainText('75');
  await expect(page.getByText('Question 2 / 30')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.question-panel__statement')).not.toHaveText(statement);
});

test('la pause gèle le chrono et masque la question', async ({ page }) => {
  await page.getByRole('button', { name: 'Jouer', exact: true }).click();
  await waitForActiveQuestion(page);
  const before = await remainingSeconds(page);

  await page.keyboard.press('p');
  await expect(page.locator('.pause-status--on')).toBeVisible();
  await expect(page.locator('.question-panel')).toBeHidden();
  // Les tirs sont refusés pendant la pause.
  await page.keyboard.press('1');
  await page.waitForTimeout(3000);

  await page.keyboard.press('p');
  await expect(page.locator('.pause-status--on')).toHaveCount(0);
  await expect(page.locator('.question-panel')).toBeVisible();
  const after = await remainingSeconds(page);
  // 3 s de pause n'ont rien coûté (marge pour la latence des requêtes).
  expect(before - after).toBeLessThan(1.5);
  await expect(page.locator('.hud-box').first()).toContainText('100');
  await expect(page.locator('.lock-overlay')).toContainText('2 restantes');
});

test('mode entraînement : aucune perte de PV', async ({ page }) => {
  await page.getByRole('button', { name: 'Entraînement' }).click();
  await waitForActiveQuestion(page);
  await expect(page.getByText('Entraînement', { exact: true })).toBeVisible();
  const { correct } = await answerKeys(page);
  await page.keyboard.press(correct);
  await expect(page.locator('.reveal')).toBeVisible();
  await expect(page.locator('.hud-box').first()).toContainText('100');
});

test('abandon : écran de fin hors classement', async ({ page }) => {
  await page.getByRole('button', { name: 'Jouer', exact: true }).click();
  await waitForActiveQuestion(page);
  await page.getByRole('button', { name: 'Abandonner la partie' }).click();
  await expect(page.getByRole('heading', { name: 'Partie abandonnée' })).toBeVisible();
  await expect(page.getByText('Une partie abandonnée ne compte pas au classement.')).toBeVisible();
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('button', { name: 'Jouer', exact: true })).toBeVisible();
});
