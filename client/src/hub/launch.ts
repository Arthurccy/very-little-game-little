/**
 * Lancement depuis le hub Full-Stack Quest (contracts/integration-v1.yaml) : le hub ouvre
 * `https://<notre-jeu>/?fsq_token=<JWT>`. Le front lit ce jeton, le retire aussitôt de l'URL
 * (historique, lien copié, en-tête Referer) et ne le transmet qu'à NOTRE back (POST /hub/link).
 */
const PARAM = 'fsq_token';
const KEY = 'fsq:pending-token';

/** À appeler une fois au démarrage, avant le premier rendu. */
export function captureLaunchToken(): void {
  const url = new URL(window.location.href);
  const token = url.searchParams.get(PARAM);
  if (token === null) return;
  url.searchParams.delete(PARAM);
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  if (!token.trim()) return;
  try {
    sessionStorage.setItem(KEY, token.trim());
  } catch {
    // stockage indisponible : le lien au hub ne survivra pas à la connexion
  }
}

/** Jeton reçu du hub et pas encore transmis au back. */
export function pendingLaunchToken(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearLaunchToken(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // rien à faire
  }
}
