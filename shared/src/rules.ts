/**
 * Règles de partie figées dans docs/conception.md.
 * Le serveur est seul à les appliquer ; le client ne s'en sert que pour l'affichage.
 */

export const STARTING_HP = 100;
/** Tirer sur la bonne réponse : la question est ratée. */
export const HIT_CORRECT_PENALTY = 25;
/** Chrono serveur échu : la question est ratée. */
export const TIMEOUT_PENALTY = 20;

export const STANDARD_QUESTIONS_PER_ZONE = 4;
export const BOSS_QUESTION_COUNT = 6;
export const MIN_STANDARD_POOL_PER_THEME = 10;
/** Numéro de zone réservé au boss, après les zones thématiques 1 à 6. */
export const BOSS_ZONE = 7;

export const MAX_MULTIPLIER = 4;
export const MULTIPLIER_STEP = 0.25;
/** Bonus de vitesse maximal quand la question est réglée instantanément. */
export const MAX_SPEED_BONUS = 0.5;

/** Multiplicateur = min(4, 1 + combo × 0,25). */
export function comboMultiplier(combo: number): number {
  return Math.min(MAX_MULTIPLIER, 1 + Math.max(0, combo) * MULTIPLIER_STEP);
}

/** Bonus de vitesse = 1 + 0,5 × (temps restant / temps imparti), borné à [1 ; 1,5]. */
export function speedBonus(elapsedMs: number, timeLimitMs: number): number {
  if (timeLimitMs <= 0) return 1;
  const remaining = Math.min(1, Math.max(0, (timeLimitMs - elapsedMs) / timeLimitMs));
  return 1 + MAX_SPEED_BONUS * remaining;
}

/**
 * Points d'une question réussie = basePoints × multiplicateur × bonus de vitesse, arrondi.
 * Le multiplicateur est celui du combo atteint avant cette réussite (première réussite : × 1) ;
 * le combo monte d'un cran ensuite.
 */
export function questionPoints(
  basePoints: number,
  comboBefore: number,
  elapsedMs: number,
  timeLimitMs: number,
): number {
  return Math.round(basePoints * comboMultiplier(comboBefore) * speedBonus(elapsedMs, timeLimitMs));
}
