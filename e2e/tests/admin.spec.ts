import { expect, test } from '@playwright/test';
import { loginAdmin, registerPlayer } from '../helpers';

test('un joueur ne voit pas le back-office', async ({ page }) => {
  await registerPlayer(page);
  await expect(page.getByRole('button', { name: 'Back-office' })).toHaveCount(0);
});

test('back-office : modifier une question et consulter les statistiques', async ({ page }) => {
  await loginAdmin(page);
  await page.getByRole('button', { name: 'Back-office' }).click();
  await expect(page.locator('.table tbody tr')).toHaveCount(71);

  await page.getByRole('button', { name: 'Modifier' }).first().click();
  const statement = `Question modifiée par le test e2e ${Date.now()} ?`;
  await page.getByLabel('Énoncé').fill(statement);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('cell', { name: statement })).toBeVisible();

  await page.getByRole('button', { name: 'Désactiver' }).first().click();
  await expect(page.locator('.table tbody tr.inactive')).toHaveCount(1);

  await page.getByRole('tab', { name: 'Statistiques' }).click();
  await expect(page.locator('.table tbody tr')).toHaveCount(71);
});

test('classement accessible depuis le menu', async ({ page }) => {
  await registerPlayer(page);
  await page.getByRole('button', { name: 'Classement' }).click();
  await expect(page.getByRole('heading', { name: 'Classement' })).toBeVisible();
  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(page.getByRole('button', { name: 'Jouer', exact: true })).toBeVisible();
});
