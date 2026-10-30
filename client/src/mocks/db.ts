/**
 * Faux serveur en mémoire pour Mock Service Worker. Il reproduit l'arbitrage de la vraie
 * API (tirage, chrono, tirs, bonus, pause) avec les mêmes règles (`@fps/shared`), pour que
 * le front se comporte comme en production sans backend.
 */
import {
  BONUS_DROP_CHANCE,
  BOSS_QUESTION_COUNT,
  BOSS_ZONE,
  FIRST_QUESTION_DELAY_MS,
  HEAL_AMOUNT,
  HIT_CORRECT_PENALTY,
  INTER_QUESTION_DELAY_MS,
  MAX_PAUSE_MS,
  MAX_PAUSES,
  SLOW_TIME_BONUS_MS,
  STANDARD_QUESTIONS_PER_ZONE,
  STARTING_HP,
  TIMEOUT_PENALTY,
  comboMultiplier,
  questionPoints,
} from '@fps/shared';
import type { components as HubComponents } from '../api/hub-schema';
import type {
  AdminQuestion,
  AdminQuestionInput,
  CreateSessionResponse,
  GameMode,
  HubLink,
  HubPlayer,
  HubScore,
  LeaderboardEntry,
  PublicQuestion,
  PublicUser,
  QuestionStat,
  SessionDetailResponse,
  SessionState,
  SessionSummary,
  ShotResponse,
  Theme,
} from '../api/types';
import fixtures from './fixtures.json';
import { activeScenario } from './scenarios';

// --- Erreurs ------------------------------------------------------------

export class MockApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: 'VALIDATION' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'INTERNAL',
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

// --- Données ------------------------------------------------------------

interface MockUser extends PublicUser {
  email: string;
  password: string;
}

/** Comptes de démonstration (mot de passe : « motdepasse »). */
export const DEMO_ACCOUNTS = [
  { id: 'u-player', pseudo: 'joueur', email: 'joueur@demo.local', password: 'motdepasse', role: 'PLAYER' },
  { id: 'u-admin', pseudo: 'admin', email: 'admin@demo.local', password: 'motdepasse', role: 'ADMIN' },
] as const satisfies readonly MockUser[];

const users: MockUser[] = DEMO_ACCOUNTS.map((u) => ({ ...u }));
const themes: Theme[] = fixtures.themes;
const questions: AdminQuestion[] = fixtures.questions.map((q) => ({
  ...q,
  kind: q.kind as AdminQuestion['kind'],
  answers: q.answers.map((a) => ({ ...a })),
}));

interface MockSessionQuestion {
  id: string;
  question: AdminQuestion;
  position: number;
  zone: number;
  status: 'PENDING' | 'ACTIVE' | 'CLEARED' | 'FAILED';
  answerOrder: string[];
  eliminated: string[];
  startedAt: number | null;
  deadlineAt: number | null;
  resolvedAt: number | null;
  points: number;
}

interface MockSession {
  id: string;
  userId: string;
  mode: GameMode;
  status: SessionState['status'];
  score: number;
  hp: number;
  combo: number;
  currentIndex: number;
  pausedAt: number | null;
  pausesUsed: number;
  startedAt: number;
  endedAt: number | null;
  questions: MockSessionQuestion[];
  /** Résultat de l'envoi du score au hub, fixé à la fin de la partie. */
  hub: HubScore | null;
}

const sessions = new Map<string, MockSession>();

/** Parties déjà terminées par d'autres joueurs, pour un classement vivant. */
const fakeLeaderboard: LeaderboardEntry[] = [
  { rank: 0, pseudo: 'trinity', score: 21480, endedAt: '2026-10-28T18:12:00.000Z' },
  { rank: 0, pseudo: 'neo', score: 17320, endedAt: '2026-10-28T20:40:00.000Z' },
  { rank: 0, pseudo: 'morpheus', score: 12950, endedAt: '2026-10-29T09:05:00.000Z' },
  { rank: 0, pseudo: 'oracle', score: 8410, endedAt: '2026-10-29T14:27:00.000Z' },
];

let counter = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;
const iso = (ms: number) => new Date(ms).toISOString();

function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

// --- Authentification ---------------------------------------------------

const REFRESH_KEY = 'msw:refresh-user';

const toPublicUser = (u: MockUser): PublicUser => ({ id: u.id, pseudo: u.pseudo, role: u.role });
const tokenFor = (u: MockUser) => `mock-access-${u.id}`;

/** Simule le cookie refresh httpOnly : l'utilisateur connecté survit au rechargement. */
function rememberRefresh(userId: string | null): void {
  try {
    if (userId) localStorage.setItem(REFRESH_KEY, userId);
    else localStorage.removeItem(REFRESH_KEY);
  } catch {
    // stockage indisponible : la session ne survivra pas au rechargement
  }
}

function issue(u: MockUser) {
  rememberRefresh(u.id);
  return { accessToken: tokenFor(u), user: toPublicUser(u) };
}

export const auth = {
  register(body: { pseudo: string; email: string; password: string }) {
    const email = body.email.trim().toLowerCase();
    const details: { path: string; message: string }[] = [];
    if (body.pseudo.trim().length < 3) details.push({ path: 'pseudo', message: 'Pseudo : 3 caractères minimum' });
    if (!email.includes('@')) details.push({ path: 'email', message: 'Email invalide' });
    if (body.password.length < 8) details.push({ path: 'password', message: 'Mot de passe : 8 caractères minimum' });
    if (details.length) throw new MockApiError(400, 'VALIDATION', 'Requête invalide', details);
    if (users.some((u) => u.email === email)) throw new MockApiError(409, 'CONFLICT', 'Email déjà utilisé');
    if (users.some((u) => u.pseudo.toLowerCase() === body.pseudo.trim().toLowerCase())) {
      throw new MockApiError(409, 'CONFLICT', 'Pseudo déjà pris');
    }
    const user: MockUser = {
      id: newId('u'),
      pseudo: body.pseudo.trim(),
      email,
      password: body.password,
      role: 'PLAYER',
    };
    users.push(user);
    return issue(user);
  },
  login(body: { email: string; password: string }) {
    const user = users.find((u) => u.email === body.email.trim().toLowerCase());
    if (!user || user.password !== body.password) {
      throw new MockApiError(401, 'UNAUTHENTICATED', 'Email ou mot de passe incorrect');
    }
    return issue(user);
  },
  refresh() {
    let userId: string | null = null;
    try {
      userId = localStorage.getItem(REFRESH_KEY);
    } catch {
      userId = null;
    }
    const user = users.find((u) => u.id === userId);
    if (!user) throw new MockApiError(401, 'UNAUTHENTICATED', 'Session expirée');
    return issue(user);
  },
  logout() {
    rememberRefresh(null);
  },
  /** Utilisateur du jeton `Authorization: Bearer`, sinon 401. */
  fromHeader(header: string | null): MockUser {
    const token = header?.match(/^Bearer (.+)$/i)?.[1];
    const user = users.find((u) => tokenFor(u) === token);
    if (!user) throw new MockApiError(401, 'UNAUTHENTICATED', 'Authentification requise');
    return user;
  },
  requireAdmin(header: string | null): MockUser {
    const user = auth.fromHeader(header);
    if (user.role !== 'ADMIN') throw new MockApiError(403, 'FORBIDDEN', 'Rôle insuffisant');
    return user;
  },
};

// --- Thèmes et classement ----------------------------------------------

export const listThemes = (): Theme[] => [...themes].sort((a, b) => a.order - b.order);

export function leaderboard(limit: number): LeaderboardEntry[] {
  const best = new Map<string, LeaderboardEntry>();
  for (const e of fakeLeaderboard) best.set(e.pseudo, e);
  for (const s of sessions.values()) {
    if (s.mode !== 'NORMAL' || (s.status !== 'WON' && s.status !== 'LOST') || s.endedAt === null) continue;
    const pseudo = users.find((u) => u.id === s.userId)?.pseudo ?? '?';
    const entry = { rank: 0, pseudo, score: s.score, endedAt: iso(s.endedAt) };
    const previous = best.get(pseudo);
    if (!previous || previous.score < entry.score) best.set(pseudo, entry);
  }
  return [...best.values()]
    .sort((a, b) => b.score - a.score || a.endedAt.localeCompare(b.endedAt))
    .slice(0, limit)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

// --- Partie -------------------------------------------------------------

function sessionState(s: MockSession): SessionState {
  return {
    id: s.id,
    mode: s.mode,
    status: s.status,
    score: s.score,
    hp: s.hp,
    combo: s.combo,
    multiplier: comboMultiplier(s.combo),
    currentIndex: s.currentIndex,
    total: s.questions.length,
    paused: s.pausedAt !== null,
    pauseEndsAt: s.pausedAt !== null ? iso(s.pausedAt + MAX_PAUSE_MS) : null,
    pausesLeft: Math.max(0, MAX_PAUSES - s.pausesUsed),
  };
}

function displayed(sq: MockSessionQuestion) {
  const byId = new Map(sq.question.answers.map((a) => [a.id, a]));
  return sq.answerOrder.flatMap((id) => {
    const a = byId.get(id);
    return a ? [a] : [];
  });
}

function publicQuestion(sq: MockSessionQuestion, total: number): PublicQuestion {
  return {
    id: sq.id,
    position: sq.position,
    total,
    zone: sq.zone,
    kind: sq.question.kind,
    themeSlug: sq.question.themeSlug,
    statement: sq.question.statement,
    answers: displayed(sq).map((a) => ({ id: a.id, text: a.text })),
    eliminatedAnswerIds: [...sq.eliminated],
    timeLimitMs: sq.deadlineAt! - sq.startedAt!,
    startedAt: iso(sq.startedAt!),
    deadlineAt: iso(sq.deadlineAt!),
  };
}

function activate(sq: MockSessionQuestion, startAt: number): void {
  sq.status = 'ACTIVE';
  sq.startedAt = startAt;
  sq.deadlineAt = startAt + sq.question.timeLimitMs;
}

function owned(userId: string, sessionId: string): MockSession {
  const s = sessions.get(sessionId);
  if (!s) throw new MockApiError(404, 'NOT_FOUND', 'Partie introuvable');
  if (s.userId !== userId) throw new MockApiError(403, 'FORBIDDEN', 'Cette partie appartient à un autre joueur');
  return s;
}

function inProgress(s: MockSession): void {
  if (s.status !== 'IN_PROGRESS') throw new MockApiError(409, 'CONFLICT', 'La partie est terminée');
}

/** Termine une pause : la question active est décalée de la durée de la pause (30 s max). */
function endPause(s: MockSession, now: number): void {
  if (s.pausedAt === null) return;
  const shift = Math.min(MAX_PAUSE_MS, now - s.pausedAt);
  const sq = s.questions[s.currentIndex];
  if (sq?.status === 'ACTIVE' && sq.startedAt !== null && sq.deadlineAt !== null) {
    sq.startedAt += shift;
    sq.deadlineAt += shift;
  }
  s.pausedAt = null;
}

function settlePause(s: MockSession, now: number): void {
  if (s.pausedAt !== null && now - s.pausedAt >= MAX_PAUSE_MS) endPause(s, now);
}

function notPaused(s: MockSession): void {
  if (s.pausedAt !== null) throw new MockApiError(409, 'CONFLICT', 'La partie est en pause');
}

function detail(s: MockSession, now: number): SessionDetailResponse {
  const sq = s.status === 'IN_PROGRESS' ? s.questions[s.currentIndex] : undefined;
  return {
    session: sessionState(s),
    question: sq && sq.status === 'ACTIVE' ? publicQuestion(sq, s.questions.length) : null,
    serverNow: iso(now),
  };
}

export const game = {
  create(userId: string, mode: GameMode): CreateSessionResponse {
    const now = Date.now();
    for (const s of sessions.values()) {
      if (s.userId === userId && s.status === 'IN_PROGRESS') {
        s.status = 'ABANDONED';
        s.endedAt = now;
      }
    }
    const active = questions.filter((q) => q.isActive);
    const series: { question: AdminQuestion; zone: number }[] = [];
    listThemes().forEach((theme, i) => {
      const pool = active.filter((q) => q.themeId === theme.id && q.kind === 'STANDARD');
      if (pool.length < STANDARD_QUESTIONS_PER_ZONE) {
        throw new MockApiError(409, 'CONFLICT', `Pas assez de questions actives pour le thème « ${theme.name} »`);
      }
      for (const q of shuffle(pool).slice(0, STANDARD_QUESTIONS_PER_ZONE)) series.push({ question: q, zone: i + 1 });
    });
    const bossPool = active.filter((q) => q.kind === 'BOSS');
    if (bossPool.length < BOSS_QUESTION_COUNT)
      throw new MockApiError(409, 'CONFLICT', 'Pas assez de questions boss actives');
    for (const q of shuffle(bossPool).slice(0, BOSS_QUESTION_COUNT)) series.push({ question: q, zone: BOSS_ZONE });

    const session: MockSession = {
      id: newId('s'),
      userId,
      mode,
      status: 'IN_PROGRESS',
      score: 0,
      hp: STARTING_HP,
      combo: 0,
      currentIndex: 0,
      pausedAt: null,
      pausesUsed: 0,
      startedAt: now,
      endedAt: null,
      hub: null,
      questions: series.map(({ question, zone }, position) => ({
        id: newId('sq'),
        question,
        position,
        zone,
        status: 'PENDING',
        answerOrder: shuffle(question.answers.map((a) => a.id)),
        eliminated: [],
        startedAt: null,
        deadlineAt: null,
        resolvedAt: null,
        points: 0,
      })),
    };
    activate(session.questions[0]!, now + FIRST_QUESTION_DELAY_MS);
    sessions.set(session.id, session);
    return {
      session: sessionState(session),
      question: publicQuestion(session.questions[0]!, session.questions.length),
      serverNow: iso(now),
    };
  },

  get(userId: string, sessionId: string): SessionDetailResponse {
    const now = Date.now();
    const s = owned(userId, sessionId);
    if (s.status === 'IN_PROGRESS') settlePause(s, now);
    return detail(s, now);
  },

  summary(userId: string, sessionId: string): SessionSummary {
    const s = owned(userId, sessionId);
    let streak = 0;
    let bestCombo = 0;
    for (const q of s.questions) {
      if (q.status === 'CLEARED') bestCombo = Math.max(bestCombo, ++streak);
      else if (q.status === 'FAILED') streak = 0;
    }
    return {
      session: sessionState(s),
      cleared: s.questions.filter((q) => q.status === 'CLEARED').length,
      failed: s.questions.filter((q) => q.status === 'FAILED').length,
      bestCombo,
      startedAt: iso(s.startedAt),
      endedAt: s.endedAt === null ? null : iso(s.endedAt),
      hub: s.hub ?? { status: 'NOT_RANKED', result: null },
    };
  },

  shoot(userId: string, sessionId: string, answerId: string): ShotResponse {
    const now = Date.now();
    const s = owned(userId, sessionId);
    inProgress(s);
    settlePause(s, now);
    notPaused(s);
    const sq = s.questions[s.currentIndex]!;
    if (now < sq.startedAt!) throw new MockApiError(409, 'CONFLICT', 'La question n’a pas encore commencé');
    if (now >= sq.deadlineAt!) return closeQuestion(s, sq, 'TIMEOUT', false, TIMEOUT_PENALTY, now, null);

    const answers = displayed(sq);
    const answer = answers.find((a) => a.id === answerId);
    if (!answer) throw new MockApiError(400, 'VALIDATION', 'Cette réponse ne fait pas partie de la question en cours');
    if (sq.eliminated.includes(answerId)) throw new MockApiError(400, 'VALIDATION', 'Réponse déjà éliminée');
    if (answer.isCorrect) return closeQuestion(s, sq, 'HIT_CORRECT', false, HIT_CORRECT_PENALTY, now, null);

    sq.eliminated.push(answerId);
    const remaining = () => answers.filter((a) => !a.isCorrect && !sq.eliminated.includes(a.id));
    let bonus: ShotResponse['bonus'] = null;
    if (Math.random() < BONUS_DROP_CHANCE) {
      const options: ('REMOVE_WRONG' | 'SLOW_TIME' | 'HEAL')[] = [];
      if (remaining().length >= 2) options.push('REMOVE_WRONG');
      if (remaining().length >= 1) options.push('SLOW_TIME');
      if (s.mode === 'NORMAL' && s.hp < STARTING_HP) options.push('HEAL');
      const type = options[Math.floor(Math.random() * options.length)];
      if (type === 'REMOVE_WRONG') {
        const target = remaining()[Math.floor(Math.random() * remaining().length)]!;
        sq.eliminated.push(target.id);
        bonus = { type, removedAnswerId: target.id };
      } else if (type === 'SLOW_TIME') {
        sq.deadlineAt! += SLOW_TIME_BONUS_MS;
        bonus = { type, amount: SLOW_TIME_BONUS_MS };
      } else if (type === 'HEAL') {
        const healed = Math.min(STARTING_HP, s.hp + HEAL_AMOUNT);
        bonus = { type, amount: healed - s.hp };
        s.hp = healed;
      }
    }

    if (remaining().length === 0) return closeQuestion(s, sq, 'ELIMINATED_WRONG', true, 0, now, bonus);
    return {
      outcome: 'ELIMINATED_WRONG',
      elapsedMs: now - sq.startedAt!,
      session: sessionState(s),
      questionClosed: false,
      reveal: null,
      bonus,
      question: publicQuestion(sq, s.questions.length),
      nextQuestion: null,
      serverNow: iso(now),
    };
  },

  timeout(userId: string, sessionId: string): ShotResponse {
    const now = Date.now();
    const s = owned(userId, sessionId);
    inProgress(s);
    settlePause(s, now);
    notPaused(s);
    const sq = s.questions[s.currentIndex]!;
    if (now < sq.deadlineAt!) throw new MockApiError(409, 'CONFLICT', 'Le chrono n’est pas écoulé');
    return closeQuestion(s, sq, 'TIMEOUT', false, TIMEOUT_PENALTY, now, null);
  },

  pause(userId: string, sessionId: string): SessionDetailResponse {
    const now = Date.now();
    const s = owned(userId, sessionId);
    inProgress(s);
    settlePause(s, now);
    if (s.pausedAt !== null) throw new MockApiError(409, 'CONFLICT', 'La partie est déjà en pause');
    if (s.pausesUsed >= MAX_PAUSES) throw new MockApiError(409, 'CONFLICT', 'Plus de pause disponible');
    s.pausedAt = now;
    s.pausesUsed++;
    return detail(s, now);
  },

  resume(userId: string, sessionId: string): SessionDetailResponse {
    const now = Date.now();
    const s = owned(userId, sessionId);
    inProgress(s);
    if (s.pausedAt === null) throw new MockApiError(409, 'CONFLICT', 'La partie n’est pas en pause');
    endPause(s, now);
    return detail(s, now);
  },

  end(userId: string, sessionId: string) {
    const s = owned(userId, sessionId);
    inProgress(s);
    s.status = 'ABANDONED';
    s.endedAt = Date.now();
    s.pausedAt = null;
    return { session: sessionState(s) };
  },
};

function closeQuestion(
  s: MockSession,
  sq: MockSessionQuestion,
  outcome: ShotResponse['outcome'],
  cleared: boolean,
  penalty: number,
  now: number,
  bonus: ShotResponse['bonus'],
): ShotResponse {
  const elapsedMs = now - sq.startedAt!;
  const timeLimitMs = sq.deadlineAt! - sq.startedAt!;
  const points = cleared ? questionPoints(sq.question.basePoints, s.combo, elapsedMs, timeLimitMs) : 0;
  sq.status = cleared ? 'CLEARED' : 'FAILED';
  sq.resolvedAt = now;
  sq.points = points;
  if (s.mode === 'NORMAL') s.hp = Math.max(0, s.hp - penalty);
  s.score += points;
  s.combo = cleared ? s.combo + 1 : 0;

  const isLast = s.currentIndex + 1 >= s.questions.length;
  let nextQuestion: PublicQuestion | null = null;
  if (s.hp <= 0) {
    s.status = 'LOST';
    s.endedAt = now;
    s.hub = hub.sendScore(s);
  } else if (isLast) {
    s.status = 'WON';
    s.endedAt = now;
    s.hub = hub.sendScore(s);
  } else {
    s.currentIndex++;
    const next = s.questions[s.currentIndex]!;
    activate(next, now + INTER_QUESTION_DELAY_MS);
    nextQuestion = publicQuestion(next, s.questions.length);
  }

  const correct = displayed(sq).find((a) => a.isCorrect);
  return {
    outcome,
    elapsedMs,
    session: sessionState(s),
    questionClosed: true,
    reveal: {
      correctAnswerId: correct?.id ?? '',
      explanation: sq.question.explanation,
      mdnUrl: sq.question.mdnUrl,
      pointsAwarded: points,
    },
    bonus,
    question: null,
    nextQuestion,
    serverNow: iso(now),
  };
}

// --- Hub Full-Stack Quest (relais simulé de notre back) -----------------
// Contrat : contracts/integration-v1.yaml. Ici, c'est NOTRE back simulé qui « appelle » le hub ;
// le navigateur ne fait que transmettre le jeton à /hub/link.

type HubScoreRequest = HubComponents['schemas']['ScoreRequest'];

/** Identifiant de notre jeu sur le hub (celui du manifeste). */
export const GAME_ID = 'pan-mauvaise-reponse';
/** scoreMax déclaré au hub : l'XP est proportionnelle à score / scoreMax. */
const SCORE_MAX = 30_000;
const XP_MAX = 150;
const HUB_LINKS_KEY = 'msw:hub-links';

interface HubTokenClaims {
  sub: string;
  pseudo: string;
  level: number;
  game: string;
  exp: number;
  sandbox?: boolean;
}

const base64url = (text: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

function decodeBase64url(part: string): string {
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Fabrique un jeton de lancement de démonstration (non signé : le vrai est signé par le hub). */
export function makeLaunchToken(opts: { pseudo: string; level: number; expired?: boolean; sandbox?: boolean }): string {
  const claims: HubTokenClaims = {
    sub: 'p_42',
    pseudo: opts.pseudo,
    level: opts.level,
    game: GAME_ID,
    exp: Math.floor(Date.now() / 1000) + (opts.expired ? -60 : 2 * 3600),
    sandbox: opts.sandbox ?? false,
  };
  return `${base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${base64url(JSON.stringify(claims))}.signature-de-demo`;
}

interface StoredHubLink {
  player: HubPlayer;
  sandbox: boolean;
}

function readHubLinks(): Record<string, StoredHubLink> {
  try {
    return JSON.parse(localStorage.getItem(HUB_LINKS_KEY) ?? '{}') as Record<string, StoredHubLink>;
  } catch {
    return {};
  }
}

function writeHubLinks(links: Record<string, StoredHubLink>): void {
  try {
    localStorage.setItem(HUB_LINKS_KEY, JSON.stringify(links));
  } catch {
    // stockage indisponible : le lien au hub ne survivra pas au rechargement
  }
}

export const hub = {
  /** POST /hub/link : notre back vérifie le jeton auprès du hub (GET /api/v1/me). */
  link(userId: string, fsqToken: string): HubLink {
    console.info('[MSW] notre back → hub : GET /api/v1/me (Authorization: Bearer <fsq_token>)');
    if (activeScenario() === 'hub-down') {
      throw new MockApiError(502, 'INTERNAL', 'Hub Full-Stack Quest indisponible');
    }
    let claims: HubTokenClaims;
    try {
      const [, payload] = fsqToken.split('.');
      claims = JSON.parse(decodeBase64url(payload ?? '')) as HubTokenClaims;
    } catch {
      throw new MockApiError(400, 'VALIDATION', 'Le jeton du hub est invalide ou a expiré');
    }
    const valid =
      /^p_[0-9]+$/.test(claims.sub) &&
      claims.game === GAME_ID &&
      typeof claims.exp === 'number' &&
      claims.exp * 1000 > Date.now();
    if (!valid) throw new MockApiError(400, 'VALIDATION', 'Le jeton du hub est invalide ou a expiré');
    const player: HubPlayer = { playerId: claims.sub, pseudo: claims.pseudo, level: claims.level };
    writeHubLinks({ ...readHubLinks(), [userId]: { player, sandbox: claims.sandbox === true } });
    return { player };
  },
  /** GET /hub/me */
  me(userId: string): HubLink {
    const link = readHubLinks()[userId];
    if (!link) throw new MockApiError(404, 'NOT_FOUND', 'Aucun joueur du hub associé');
    return { player: link.player };
  },
  /** Fin de partie : notre back envoie le score au hub (POST /api/v1/scores, avec X-Game-Key). */
  sendScore(s: MockSession): HubScore {
    if (s.mode === 'TRAINING') return { status: 'NOT_RANKED', result: null };
    const link = readHubLinks()[s.userId];
    if (!link) return { status: 'NOT_LINKED', result: null };
    const request: HubScoreRequest = {
      gameId: GAME_ID,
      level: 1,
      score: Math.min(s.score, SCORE_MAX),
      durationMs: (s.endedAt ?? Date.now()) - s.startedAt,
    };
    console.info('[MSW] notre back → hub : POST /api/v1/scores (X-Game-Key côté serveur)', request);
    if (activeScenario() === 'hub-down') return { status: 'FAILED', result: null };
    const xpGained = link.sandbox ? 0 : Math.round((XP_MAX * request.score) / SCORE_MAX);
    return { status: 'SENT', result: { accepted: true, xpGained } };
  },
};

// --- Back-office --------------------------------------------------------

function validateQuestion(input: AdminQuestionInput): void {
  const details: { path: string; message: string }[] = [];
  if (!themes.some((t) => t.id === input.themeId)) details.push({ path: 'themeId', message: 'Thème inconnu' });
  if (input.statement.trim().length < 5) details.push({ path: 'statement', message: 'Énoncé trop court' });
  if (input.explanation.trim().length < 5) details.push({ path: 'explanation', message: 'Explication trop courte' });
  if (input.answers.length < 3) details.push({ path: 'answers', message: 'Au moins 3 réponses' });
  if (input.answers.filter((a) => a.isCorrect).length !== 1) {
    details.push({ path: 'answers', message: 'Exactement une bonne réponse' });
  }
  if (details.length) throw new MockApiError(400, 'VALIDATION', 'Requête invalide', details);
}

export const admin = {
  list(filter: { themeId?: string | null; kind?: string | null; includeInactive: boolean }): AdminQuestion[] {
    return questions.filter(
      (q) =>
        (!filter.themeId || q.themeId === filter.themeId) &&
        (!filter.kind || q.kind === filter.kind) &&
        (filter.includeInactive || q.isActive),
    );
  },
  get(id: string): AdminQuestion {
    const q = questions.find((x) => x.id === id);
    if (!q) throw new MockApiError(404, 'NOT_FOUND', 'Question introuvable');
    return q;
  },
  create(input: AdminQuestionInput): AdminQuestion {
    validateQuestion(input);
    const id = newId('q');
    const q: AdminQuestion = {
      id,
      themeId: input.themeId,
      themeSlug: themes.find((t) => t.id === input.themeId)!.slug,
      statement: input.statement,
      explanation: input.explanation,
      mdnUrl: input.mdnUrl,
      difficulty: input.difficulty,
      kind: input.kind,
      timeLimitMs: input.timeLimitMs,
      basePoints: input.basePoints,
      isActive: input.isActive ?? true,
      answers: input.answers.map((a, i) => ({ id: `${id}-a${i}`, text: a.text, isCorrect: a.isCorrect })),
    };
    questions.push(q);
    return q;
  },
  update(id: string, input: AdminQuestionInput): AdminQuestion {
    const q = admin.get(id);
    validateQuestion(input);
    Object.assign(q, {
      themeId: input.themeId,
      themeSlug: themes.find((t) => t.id === input.themeId)!.slug,
      statement: input.statement,
      explanation: input.explanation,
      mdnUrl: input.mdnUrl,
      difficulty: input.difficulty,
      kind: input.kind,
      timeLimitMs: input.timeLimitMs,
      basePoints: input.basePoints,
      isActive: input.isActive ?? q.isActive,
      answers: input.answers.map((a, i) => ({
        id: a.id ?? `${id}-n${Date.now()}-${i}`,
        text: a.text,
        isCorrect: a.isCorrect,
      })),
    });
    return q;
  },
  deactivate(id: string): void {
    admin.get(id).isActive = false;
  },
  /** Statistiques des parties jouées dans le navigateur, complétées par un historique fictif stable. */
  stats(): QuestionStat[] {
    return questions.map((q, i) => {
      const played = [...sessions.values()]
        .flatMap((s) => s.questions)
        .filter((sq) => sq.question.id === q.id && (sq.status === 'CLEARED' || sq.status === 'FAILED'));
      const baseAttempts = (i * 7) % 13;
      const baseCleared = Math.round(baseAttempts * (0.35 + ((i * 37) % 60) / 100));
      const attempts = baseAttempts + played.length;
      const cleared = baseCleared + played.filter((sq) => sq.status === 'CLEARED').length;
      const times = played.map((sq) => (sq.resolvedAt ?? 0) - (sq.startedAt ?? 0));
      const baseTime = 4000 + ((i * 911) % 9000);
      return {
        questionId: q.id,
        statement: q.statement,
        themeSlug: q.themeSlug,
        kind: q.kind,
        isActive: q.isActive,
        attempts,
        successRate: attempts > 0 ? cleared / attempts : null,
        averageElapsedMs:
          attempts > 0 ? Math.round((baseTime * baseAttempts + times.reduce((a, b) => a + b, 0)) / attempts) : null,
      };
    });
  },
};
