/**
 * Types publics échangés entre l'API et le client.
 * Règle d'or : aucun de ces types ne porte `isCorrect`. La bonne réponse ne quitte
 * jamais le serveur avant que la question soit close.
 */

export type Role = 'PLAYER' | 'ADMIN';
export type GameMode = 'NORMAL' | 'TRAINING';
export type SessionStatus = 'IN_PROGRESS' | 'WON' | 'LOST' | 'ABANDONED';
export type QuestionKind = 'STANDARD' | 'BOSS';
export type SessionQuestionStatus = 'PENDING' | 'ACTIVE' | 'CLEARED' | 'FAILED';
export type ShotOutcome = 'ELIMINATED_WRONG' | 'HIT_CORRECT' | 'TIMEOUT';
export type BonusType = 'SLOW_TIME' | 'REMOVE_WRONG' | 'HEAL';

// --- Auth ---------------------------------------------------------------

export interface PublicUser {
  id: string;
  pseudo: string;
  role: Role;
}

export interface RegisterRequest {
  pseudo: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

/** Le refresh token voyage uniquement en cookie httpOnly, jamais dans ce JSON. */
export interface AuthResponse {
  accessToken: string;
  user: PublicUser;
}

// --- Thèmes -------------------------------------------------------------

export interface ThemeDTO {
  id: string;
  slug: string;
  name: string;
  scenery: string;
  order: number;
  intro: string;
}

// --- Partie -------------------------------------------------------------

/** Une cible à l'écran : identifiant opaque et texte, sans le booléen. */
export interface PublicAnswer {
  id: string;
  text: string;
}

export interface PublicQuestion {
  /** Identifiant de la SessionQuestion (pas de la Question). */
  id: string;
  position: number;
  total: number;
  zone: number;
  kind: QuestionKind;
  themeSlug: string;
  statement: string;
  /** Ordre mélangé par le serveur et persisté. */
  answers: PublicAnswer[];
  /** Réponses déjà éliminées sur cette question. */
  eliminatedAnswerIds: string[];
  timeLimitMs: number;
  /** Horodatage serveur ISO du début de question et de l'échéance. */
  startedAt: string;
  deadlineAt: string;
}

export interface SessionStateDTO {
  id: string;
  mode: GameMode;
  status: SessionStatus;
  score: number;
  hp: number;
  combo: number;
  multiplier: number;
  currentIndex: number;
  total: number;
}

export interface CreateSessionRequest {
  mode: GameMode;
}

export interface CreateSessionResponse {
  session: SessionStateDTO;
  question: PublicQuestion;
}

export interface ShotRequest {
  answerId: string;
}

/** Révélé seulement une fois la question close (réussie, ratée ou échue). */
export interface QuestionReveal {
  correctAnswerId: string;
  explanation: string;
  mdnUrl: string | null;
  pointsAwarded: number;
}

export interface BonusDrop {
  type: BonusType;
}

export interface ShotResponse {
  outcome: ShotOutcome;
  elapsedMs: number;
  session: SessionStateDTO;
  questionClosed: boolean;
  reveal: QuestionReveal | null;
  bonus: BonusDrop | null;
  /** Question suivante si la précédente est close et la partie continue. */
  nextQuestion: PublicQuestion | null;
}

export type TimeoutResponse = ShotResponse;

export interface EndSessionResponse {
  session: SessionStateDTO;
}

// --- Classement & stats -------------------------------------------------

export interface LeaderboardEntry {
  rank: number;
  pseudo: string;
  score: number;
  endedAt: string;
}

export interface QuestionStatDTO {
  questionId: string;
  statement: string;
  themeSlug: string;
  attempts: number;
  successRate: number;
  averageElapsedMs: number;
}

// --- Back-office --------------------------------------------------------

export interface AdminAnswerInput {
  text: string;
  isCorrect: boolean;
}

export interface AdminQuestionInput {
  themeId: string;
  statement: string;
  explanation: string;
  mdnUrl: string | null;
  difficulty: number;
  kind: QuestionKind;
  timeLimitMs: number;
  basePoints: number;
  answers: AdminAnswerInput[];
}

/** Réservé au rôle ADMIN : seul endroit où `isCorrect` est exposé. */
export interface AdminQuestionDTO extends AdminQuestionInput {
  id: string;
  isActive: boolean;
  answers: (AdminAnswerInput & { id: string })[];
}

// --- Erreurs ------------------------------------------------------------

export interface ApiError {
  error: {
    code: 'VALIDATION' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'INTERNAL';
    message: string;
    details?: unknown;
  };
}
