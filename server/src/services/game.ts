/**
 * Arbitrage des parties. Le serveur est seul juge : tirage de la série, ordre des
 * réponses, horodatage, PV, score, combo et bonus. Chaque action verrouille la ligne
 * GameSession (SELECT … FOR UPDATE) pour que deux tirs simultanés ne comptent pas double.
 */
import type { Answer, GameSession, Prisma, Question, SessionQuestion, Theme } from '@prisma/client';
import {
  BONUS_DROP_CHANCE,
  BOSS_QUESTION_COUNT,
  BOSS_ZONE,
  FIRST_QUESTION_DELAY_MS,
  HEAL_AMOUNT,
  HIT_CORRECT_PENALTY,
  INTER_QUESTION_DELAY_MS,
  MAX_PAUSES,
  MAX_PAUSE_MS,
  SLOW_TIME_BONUS_MS,
  STANDARD_QUESTIONS_PER_ZONE,
  STARTING_HP,
  TIMEOUT_PENALTY,
  comboMultiplier,
  questionPoints,
  type BonusDrop,
  type BonusType,
  type CreateSessionResponse,
  type EndSessionResponse,
  type GameMode,
  type PublicQuestion,
  type SessionDetailResponse,
  type SessionStateDTO,
  type SessionSummaryDTO,
  type ShotOutcome,
  type ShotResponse,
} from '@fps/shared';
import { prisma } from '../db.js';
import { conflict, forbidden, notFound, badRequest, HttpError } from '../lib/errors.js';
import { clock, rng, shuffle } from '../lib/clock.js';

type Tx = Prisma.TransactionClient;
type LockedSession = GameSession & { total: number };
type ActiveQuestion = SessionQuestion & {
  startedAt: Date;
  deadlineAt: Date;
  question: Question & { answers: Answer[]; theme: Theme };
};

// --- Sérialisation ------------------------------------------------------

function toSessionState(s: GameSession, total: number): SessionStateDTO {
  return {
    id: s.id,
    mode: s.mode,
    status: s.status,
    score: s.score,
    hp: s.hp,
    combo: s.combo,
    multiplier: s.multiplier,
    currentIndex: s.currentIndex,
    total,
    paused: s.pausedAt !== null,
    pauseEndsAt: s.pausedAt ? new Date(s.pausedAt.getTime() + MAX_PAUSE_MS).toISOString() : null,
    pausesLeft: Math.max(0, MAX_PAUSES - s.pausesUsed),
  };
}

/** Réponses affichées : l'ordre tiré pour la partie, restreint à celles qui existent encore. */
function displayedAnswers(sq: ActiveQuestion): Answer[] {
  const byId = new Map(sq.question.answers.map((a) => [a.id, a]));
  return sq.answerOrder.map((id) => byId.get(id)).filter((a): a is Answer => a !== undefined);
}

function toPublicQuestion(sq: ActiveQuestion, total: number): PublicQuestion {
  return {
    id: sq.id,
    position: sq.position,
    total,
    zone: sq.zone,
    kind: sq.question.kind,
    themeSlug: sq.question.theme.slug,
    statement: sq.question.statement,
    answers: displayedAnswers(sq).map((a) => ({ id: a.id, text: a.text })),
    eliminatedAnswerIds: sq.eliminated,
    timeLimitMs: sq.deadlineAt.getTime() - sq.startedAt.getTime(),
    startedAt: sq.startedAt.toISOString(),
    deadlineAt: sq.deadlineAt.toISOString(),
  };
}

// --- Chargement verrouillé ---------------------------------------------

async function lockSession(tx: Tx, sessionId: string, userId: string): Promise<LockedSession> {
  await tx.$queryRaw`SELECT id FROM "GameSession" WHERE id = ${sessionId} FOR UPDATE`;
  const session = await tx.gameSession.findUnique({
    where: { id: sessionId },
    include: { _count: { select: { questions: true } } },
  });
  if (!session) throw notFound('Partie introuvable');
  if (session.userId !== userId) throw forbidden('Cette partie appartient à un autre joueur');
  const { _count, ...rest } = session;
  return { ...rest, total: _count.questions };
}

function assertInProgress(session: GameSession): void {
  if (session.status !== 'IN_PROGRESS') throw conflict('La partie est terminée');
}

// --- Pause --------------------------------------------------------------

/**
 * Termine la pause : la question active (ou celle qui va démarrer) est décalée de la durée
 * de la pause, plafonnée à MAX_PAUSE_MS. Le temps restant et le bonus de vitesse sont préservés.
 */
async function endPause(tx: Tx, session: LockedSession, now: Date): Promise<LockedSession> {
  if (!session.pausedAt) return session;
  const pausedMs = Math.min(MAX_PAUSE_MS, now.getTime() - session.pausedAt.getTime());
  const active = await tx.sessionQuestion.findUnique({
    where: { sessionId_position: { sessionId: session.id, position: session.currentIndex } },
  });
  if (active?.status === 'ACTIVE' && active.startedAt && active.deadlineAt) {
    await tx.sessionQuestion.update({
      where: { id: active.id },
      data: {
        startedAt: new Date(active.startedAt.getTime() + pausedMs),
        deadlineAt: new Date(active.deadlineAt.getTime() + pausedMs),
      },
    });
  }
  const updated = await tx.gameSession.update({ where: { id: session.id }, data: { pausedAt: null } });
  return { ...updated, total: session.total };
}

/** Une pause qui a dépassé sa durée maximale se termine d'elle-même à la prochaine action. */
async function settlePause(tx: Tx, session: LockedSession, now: Date): Promise<LockedSession> {
  if (session.pausedAt && now.getTime() - session.pausedAt.getTime() >= MAX_PAUSE_MS) {
    return endPause(tx, session, now);
  }
  return session;
}

function assertNotPaused(session: GameSession): void {
  if (session.pausedAt) throw conflict('La partie est en pause');
}

async function detail(tx: Tx, session: LockedSession, now: Date): Promise<SessionDetailResponse> {
  const sq = session.status === 'IN_PROGRESS' ? await loadQuestionAt(tx, session.id, session.currentIndex) : null;
  return {
    session: toSessionState(session, session.total),
    question: sq ? toPublicQuestion(sq, session.total) : null,
    serverNow: now.toISOString(),
  };
}

export async function pauseSession(userId: string, sessionId: string): Promise<SessionDetailResponse> {
  return prisma.$transaction(async (tx) => {
    const now = clock.now();
    let session = await lockSession(tx, sessionId, userId);
    assertInProgress(session);
    session = await settlePause(tx, session, now);
    if (session.pausedAt) throw conflict('La partie est déjà en pause');
    if (session.pausesUsed >= MAX_PAUSES) throw conflict('Plus de pause disponible');
    const updated = await tx.gameSession.update({
      where: { id: session.id },
      data: { pausedAt: now, pausesUsed: { increment: 1 } },
    });
    return detail(tx, { ...updated, total: session.total }, now);
  });
}

export async function resumeSession(userId: string, sessionId: string): Promise<SessionDetailResponse> {
  return prisma.$transaction(async (tx) => {
    const now = clock.now();
    const session = await lockSession(tx, sessionId, userId);
    assertInProgress(session);
    if (!session.pausedAt) throw conflict('La partie n’est pas en pause');
    return detail(tx, await endPause(tx, session, now), now);
  });
}

async function loadQuestionAt(tx: Tx, sessionId: string, position: number): Promise<ActiveQuestion | null> {
  const sq = await tx.sessionQuestion.findUnique({
    where: { sessionId_position: { sessionId, position } },
    include: { question: { include: { answers: true, theme: true } } },
  });
  if (!sq || sq.status !== 'ACTIVE' || !sq.startedAt || !sq.deadlineAt) return null;
  return sq as ActiveQuestion;
}

async function loadActive(tx: Tx, session: LockedSession): Promise<ActiveQuestion> {
  const sq = await loadQuestionAt(tx, session.id, session.currentIndex);
  if (!sq) throw new HttpError(500, 'INTERNAL', 'Aucune question active pour cette partie');
  return sq;
}

// --- Création -----------------------------------------------------------

export async function createSession(userId: string, mode: GameMode): Promise<CreateSessionResponse> {
  const themes = await prisma.theme.findMany({
    orderBy: { order: 'asc' },
    include: { questions: { where: { isActive: true, kind: 'STANDARD' }, select: { id: true } } },
  });
  if (themes.length === 0) throw conflict('Aucun thème disponible');

  const series: { questionId: string; zone: number }[] = [];
  themes.forEach((theme, i) => {
    if (theme.questions.length < STANDARD_QUESTIONS_PER_ZONE) {
      throw conflict(`Pas assez de questions actives pour le thème « ${theme.name} »`);
    }
    for (const q of shuffle(theme.questions).slice(0, STANDARD_QUESTIONS_PER_ZONE)) {
      series.push({ questionId: q.id, zone: i + 1 });
    }
  });

  const bossPool = await prisma.question.findMany({ where: { isActive: true, kind: 'BOSS' }, select: { id: true } });
  if (bossPool.length < BOSS_QUESTION_COUNT) throw conflict('Pas assez de questions boss actives');
  for (const q of shuffle(bossPool).slice(0, BOSS_QUESTION_COUNT)) series.push({ questionId: q.id, zone: BOSS_ZONE });

  const answers = await prisma.answer.findMany({
    where: { questionId: { in: series.map((s) => s.questionId) } },
    select: { id: true, questionId: true },
  });
  const answersByQuestion = new Map<string, string[]>();
  for (const a of answers) answersByQuestion.set(a.questionId, [...(answersByQuestion.get(a.questionId) ?? []), a.id]);

  return prisma.$transaction(async (tx) => {
    const now = clock.now();
    // Une seule partie en cours par joueur : les précédentes sont abandonnées.
    await tx.gameSession.updateMany({
      where: { userId, status: 'IN_PROGRESS' },
      data: { status: 'ABANDONED', endedAt: now },
    });

    const session = await tx.gameSession.create({
      data: {
        userId,
        mode,
        hp: STARTING_HP,
        startedAt: now,
        questions: {
          create: series.map((s, position) => ({
            questionId: s.questionId,
            position,
            zone: s.zone,
            answerOrder: shuffle(answersByQuestion.get(s.questionId) ?? []),
          })),
        },
      },
    });

    const first = await tx.sessionQuestion.findUniqueOrThrow({
      where: { sessionId_position: { sessionId: session.id, position: 0 } },
      include: { question: true },
    });
    const startedAt = new Date(now.getTime() + FIRST_QUESTION_DELAY_MS);
    await tx.sessionQuestion.update({
      where: { id: first.id },
      data: {
        status: 'ACTIVE',
        startedAt,
        deadlineAt: new Date(startedAt.getTime() + first.question.timeLimitMs),
      },
    });

    const active = await loadActive(tx, { ...session, total: series.length });
    return {
      session: toSessionState(session, series.length),
      question: toPublicQuestion(active, series.length),
      serverNow: now.toISOString(),
    };
  });
}

// --- Lecture ------------------------------------------------------------

export async function getSession(userId: string, sessionId: string): Promise<SessionDetailResponse> {
  return prisma.$transaction(async (tx) => {
    const now = clock.now();
    let session = await lockSession(tx, sessionId, userId);
    if (session.status === 'IN_PROGRESS') session = await settlePause(tx, session, now);
    return detail(tx, session, now);
  });
}

export async function getSummary(userId: string, sessionId: string): Promise<SessionSummaryDTO> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: { questions: { orderBy: { position: 'asc' }, select: { status: true } } },
  });
  if (!session) throw notFound('Partie introuvable');
  if (session.userId !== userId) throw forbidden('Cette partie appartient à un autre joueur');

  let cleared = 0;
  let failed = 0;
  let streak = 0;
  let bestCombo = 0;
  for (const q of session.questions) {
    if (q.status === 'CLEARED') {
      cleared++;
      bestCombo = Math.max(bestCombo, ++streak);
    } else if (q.status === 'FAILED') {
      failed++;
      streak = 0;
    }
  }
  const { questions, ...rest } = session;
  return {
    session: toSessionState(rest, questions.length),
    cleared,
    failed,
    bestCombo,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt?.toISOString() ?? null,
  };
}

// --- Tirs ---------------------------------------------------------------

export async function shoot(userId: string, sessionId: string, answerId: string): Promise<ShotResponse> {
  return prisma.$transaction(async (tx) => {
    const now = clock.now();
    let session = await lockSession(tx, sessionId, userId);
    assertInProgress(session);
    session = await settlePause(tx, session, now);
    assertNotPaused(session);
    const sq = await loadActive(tx, session);

    if (now < sq.startedAt) throw conflict('La question n’a pas encore commencé');
    if (now >= sq.deadlineAt) return resolveTimeout(tx, session, sq, now);

    const displayed = displayedAnswers(sq);
    const answer = displayed.find((a) => a.id === answerId);
    if (!answer) throw badRequest('Cette réponse ne fait pas partie de la question en cours');
    if (sq.eliminated.includes(answerId)) throw badRequest('Réponse déjà éliminée');

    const elapsedMs = now.getTime() - sq.startedAt.getTime();

    if (answer.isCorrect) {
      await tx.answerLog.create({
        data: { sessionQuestionId: sq.id, answerId, outcome: 'HIT_CORRECT', elapsedMs },
      });
      return closeQuestion(tx, session, sq, {
        outcome: 'HIT_CORRECT',
        cleared: false,
        penalty: HIT_CORRECT_PENALTY,
        elapsedMs,
        now,
      });
    }

    // Mauvaise réponse éliminée : la question continue, sauf si c'était la dernière.
    const eliminated = [...sq.eliminated, answerId];
    const remainingWrong = () => displayed.filter((a) => !a.isCorrect && !eliminated.includes(a.id));
    let deadlineAt = sq.deadlineAt;
    let hp = session.hp;
    let bonus: BonusDrop | null = null;

    const bonusType = rollBonus(session, hp, remainingWrong().length);
    if (bonusType === 'REMOVE_WRONG') {
      const candidates = remainingWrong();
      const removed = candidates[Math.floor(rng.next() * candidates.length)]!;
      eliminated.push(removed.id);
      bonus = { type: bonusType, removedAnswerId: removed.id };
    } else if (bonusType === 'SLOW_TIME') {
      deadlineAt = new Date(deadlineAt.getTime() + SLOW_TIME_BONUS_MS);
      bonus = { type: bonusType, amount: SLOW_TIME_BONUS_MS };
    } else if (bonusType === 'HEAL') {
      const healed = Math.min(STARTING_HP, hp + HEAL_AMOUNT);
      bonus = { type: bonusType, amount: healed - hp };
      hp = healed;
    }

    await tx.answerLog.create({
      data: { sessionQuestionId: sq.id, answerId, outcome: 'ELIMINATED_WRONG', elapsedMs, bonus: bonusType },
    });

    const updatedSession = { ...session, hp };
    const updatedSq: ActiveQuestion = { ...sq, eliminated, deadlineAt };

    if (remainingWrong().length === 0) {
      return closeQuestion(tx, updatedSession, updatedSq, {
        outcome: 'ELIMINATED_WRONG',
        cleared: true,
        penalty: 0,
        elapsedMs,
        now,
        bonus,
      });
    }

    await tx.sessionQuestion.update({ where: { id: sq.id }, data: { eliminated, deadlineAt } });
    if (hp !== session.hp) await tx.gameSession.update({ where: { id: session.id }, data: { hp } });

    return {
      outcome: 'ELIMINATED_WRONG',
      elapsedMs,
      session: toSessionState(updatedSession, session.total),
      questionClosed: false,
      reveal: null,
      bonus,
      question: toPublicQuestion(updatedSq, session.total),
      nextQuestion: null,
      serverNow: now.toISOString(),
    };
  });
}

/** Le serveur décide seul du drop, parmi les bonus qui ont un effet dans la situation. */
function rollBonus(session: GameSession, hp: number, remainingWrong: number): BonusType | null {
  if (rng.next() >= BONUS_DROP_CHANCE) return null;
  const options: BonusType[] = [];
  if (remainingWrong >= 2) options.push('REMOVE_WRONG');
  if (remainingWrong >= 1) options.push('SLOW_TIME');
  if (session.mode === 'NORMAL' && hp < STARTING_HP) options.push('HEAL');
  if (options.length === 0) return null;
  return options[Math.floor(rng.next() * options.length)]!;
}

export async function timeout(userId: string, sessionId: string): Promise<ShotResponse> {
  return prisma.$transaction(async (tx) => {
    const now = clock.now();
    let session = await lockSession(tx, sessionId, userId);
    assertInProgress(session);
    session = await settlePause(tx, session, now);
    assertNotPaused(session);
    const sq = await loadActive(tx, session);
    if (now < sq.deadlineAt) throw conflict('Le chrono n’est pas écoulé');
    return resolveTimeout(tx, session, sq, now);
  });
}

async function resolveTimeout(tx: Tx, session: LockedSession, sq: ActiveQuestion, now: Date): Promise<ShotResponse> {
  const elapsedMs = now.getTime() - sq.startedAt.getTime();
  await tx.answerLog.create({ data: { sessionQuestionId: sq.id, outcome: 'TIMEOUT', elapsedMs } });
  return closeQuestion(tx, session, sq, {
    outcome: 'TIMEOUT',
    cleared: false,
    penalty: TIMEOUT_PENALTY,
    elapsedMs,
    now,
  });
}

interface CloseParams {
  outcome: ShotOutcome;
  cleared: boolean;
  penalty: number;
  elapsedMs: number;
  now: Date;
  bonus?: BonusDrop | null;
}

/** Clôt la question active, met à jour PV/score/combo et active la suivante (ou termine la partie). */
async function closeQuestion(
  tx: Tx,
  session: LockedSession,
  sq: ActiveQuestion,
  p: CloseParams,
): Promise<ShotResponse> {
  const training = session.mode === 'TRAINING';
  const hp = training ? session.hp : Math.max(0, session.hp - p.penalty);
  const timeLimitMs = sq.deadlineAt.getTime() - sq.startedAt.getTime();
  const points = p.cleared ? questionPoints(sq.question.basePoints, session.combo, p.elapsedMs, timeLimitMs) : 0;
  const combo = p.cleared ? session.combo + 1 : 0;

  await tx.sessionQuestion.update({
    where: { id: sq.id },
    data: {
      status: p.cleared ? 'CLEARED' : 'FAILED',
      resolvedAt: p.now,
      pointsAwarded: points,
      eliminated: sq.eliminated,
      deadlineAt: sq.deadlineAt,
    },
  });

  const isLast = session.currentIndex + 1 >= session.total;
  const status = hp <= 0 ? 'LOST' : isLast ? 'WON' : 'IN_PROGRESS';
  const nextIndex = status === 'IN_PROGRESS' ? session.currentIndex + 1 : session.currentIndex;

  const updated = await tx.gameSession.update({
    where: { id: session.id },
    data: {
      hp,
      score: session.score + points,
      combo,
      multiplier: comboMultiplier(combo),
      currentIndex: nextIndex,
      status,
      endedAt: status === 'IN_PROGRESS' ? null : p.now,
    },
  });

  let nextQuestion: PublicQuestion | null = null;
  if (status === 'IN_PROGRESS') {
    const next = await tx.sessionQuestion.findUniqueOrThrow({
      where: { sessionId_position: { sessionId: session.id, position: nextIndex } },
      include: { question: true },
    });
    // La suivante démarre après un délai de lecture de l'explication.
    const startedAt = new Date(p.now.getTime() + INTER_QUESTION_DELAY_MS);
    await tx.sessionQuestion.update({
      where: { id: next.id },
      data: { status: 'ACTIVE', startedAt, deadlineAt: new Date(startedAt.getTime() + next.question.timeLimitMs) },
    });
    const active = await loadQuestionAt(tx, session.id, nextIndex);
    nextQuestion = active ? toPublicQuestion(active, session.total) : null;
  }

  const correct = displayedAnswers(sq).find((a) => a.isCorrect);
  return {
    outcome: p.outcome,
    elapsedMs: p.elapsedMs,
    session: toSessionState(updated, session.total),
    questionClosed: true,
    reveal: {
      correctAnswerId: correct?.id ?? '',
      explanation: sq.question.explanation,
      mdnUrl: sq.question.mdnUrl,
      pointsAwarded: points,
    },
    bonus: p.bonus ?? null,
    question: null,
    nextQuestion,
    serverNow: p.now.toISOString(),
  };
}

// --- Fin ----------------------------------------------------------------

export async function endSession(userId: string, sessionId: string): Promise<EndSessionResponse> {
  return prisma.$transaction(async (tx) => {
    const session = await lockSession(tx, sessionId, userId);
    assertInProgress(session);
    const now = clock.now();
    await tx.sessionQuestion.updateMany({
      where: { sessionId: session.id, status: 'ACTIVE' },
      data: { status: 'PENDING', startedAt: null, deadlineAt: null },
    });
    const updated = await tx.gameSession.update({
      where: { id: session.id },
      data: { status: 'ABANDONED', endedAt: now, pausedAt: null },
    });
    return { session: toSessionState(updated, session.total) };
  });
}
