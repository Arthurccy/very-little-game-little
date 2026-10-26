import { expect, test } from '@playwright/test';
import { registerPlayer } from '../helpers';

test('inscription, session conservée au rechargement, déconnexion', async ({ page }) => {
  const pseudo = await registerPlayer(page);

  // Le jeton d'accès vit en mémoire : après rechargement, le cookie refresh reprend la session.
  await page.reload();
  await expect(page.getByText(`Salut ${pseudo}`)).toBeVisible();

  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(page.getByRole('tab', { name: 'Connexion' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Connexion' })).toBeVisible();
});

test('affiche les erreurs de validation du serveur', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email').fill('inconnu@e2e.local');
  await page.getByLabel('Mot de passe').fill('mauvais');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('alert')).toHaveText('Email ou mot de passe incorrect');
});
