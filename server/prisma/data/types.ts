export interface SeedTheme {
  slug: string;
  name: string;
  scenery: string;
  order: number;
  intro: string;
}

export interface SeedQuestion {
  /** Clé stable, unique sur tout le seed, qui rend le seed rejouable. */
  key: string;
  statement: string;
  correct: string;
  wrong: string[];
  explanation: string;
  mdn?: string;
  difficulty?: 1 | 2 | 3;
  timeLimitMs?: number;
  basePoints?: number;
}

export interface SeedQuestionSet {
  themeSlug: string;
  kind: 'STANDARD' | 'BOSS';
  questions: SeedQuestion[];
}

const MDN = 'https://developer.mozilla.org/fr/docs/';
/** Raccourci pour les liens MDN en français. */
export const mdn = (path: string) => MDN + path;
