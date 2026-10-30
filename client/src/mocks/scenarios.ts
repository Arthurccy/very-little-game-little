/**
 * Scénarios d'erreur des maquettes : un par écran du niveau 1. Le scénario actif est
 * choisi dans le panneau « Maquettes » et gardé dans le localStorage du navigateur.
 */
export interface Scenario {
  id: string;
  screen: string;
  label: string;
}

export const SCENARIOS = [
  { id: 'login-401', screen: 'Connexion', label: 'Identifiants refusés (401)' },
  { id: 'menu-start-409', screen: 'Menu', label: 'Lancement de partie impossible (409)' },
  { id: 'game-shot-500', screen: 'Partie', label: 'Le serveur rejette les tirs (500)' },
  { id: 'end-summary-404', screen: 'Fin de partie', label: 'Bilan introuvable (404)' },
  { id: 'leaderboard-500', screen: 'Classement', label: 'Classement indisponible (500)' },
  { id: 'admin-save-422', screen: 'Back-office', label: 'Enregistrement refusé (422)' },
  { id: 'hub-link-invalid', screen: 'Hub (menu)', label: 'Jeton du hub refusé (422)' },
  { id: 'hub-down', screen: 'Hub (menu, fin)', label: 'Hub indisponible (502, score non envoyé)' },
  { id: 'offline', screen: 'Tous', label: 'Réseau coupé (aucune réponse)' },
] as const satisfies readonly Scenario[];

export type ScenarioId = (typeof SCENARIOS)[number]['id'];

const KEY = 'msw:scenario';

export function activeScenario(): ScenarioId | null {
  try {
    const value = localStorage.getItem(KEY);
    return SCENARIOS.some((s) => s.id === value) ? (value as ScenarioId) : null;
  } catch {
    return null;
  }
}

export function setActiveScenario(id: ScenarioId | null): void {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    // stockage indisponible : le scénario ne survivra pas au rechargement
  }
}
