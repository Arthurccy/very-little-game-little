/**
 * Horloge et hasard du serveur, regroupés pour que les tests puissent les piloter
 * (vi.spyOn(clock, 'now'), vi.spyOn(rng, 'next')).
 */
export const clock = {
  now: (): Date => new Date(),
};

export const rng = {
  next: (): number => Math.random(),
};

/** Mélange de Fisher-Yates, sans muter l'entrée. */
export function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
