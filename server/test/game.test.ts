import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FIRST_QUESTION_DELAY_MS,
  HIT_CORRECT_PENALTY,
  INTER_QUESTION_DELAY_MS,
  SLOW_TIME_BONUS_MS,
  TIMEOUT_PENALTY,
  type CreateSessionResponse,
  type PublicQuestion,
  type ShotResponse,
} from '@fps/shared';
import { rng } from '../src/lib/clock.js';
import { app, bearer, freezeTime, prisma, registerPlayer, splitAnswers } from './helpers.js';

afterEach(() => {
  vi.restoreAllMocks();
});

async function start(token: string, mode: 'NORMAL' | 'TRAINING' = 'NORMAL') {
  const res = await request(app).post('/sessions').set(bearer(token)).send({ mode }).expect(201);
  return res.body as CreateSessionResponse;
}

async function shot(token: string, sessionId: string, answerId: string, status = 200) {
  const res = await request(app)
    .post(`/sessions/${sessionId}/shots`)
    .set(bearer(token))
    .send({ answerId })
    .expect(status);
  return res.body as ShotResponse;
}

/** Élimine toutes les mauvaises réponses ; renvoie la dernière réponse du serveur. */
async function clear(token: string, sessionId: string, question: PublicQuestion) {
  const { wrong } = await splitAnswers(question);
  let last!: ShotResponse;
  for (const id of wrong) last = await shot(token, sessionId, id);
  return last;
}

describe('création de partie', () => {
  it('tire 4 questions par zone puis 6 boss, sans jamais exposer isCorrect', async () => {
    const time = freezeTime();
    const player = await registerPlayer();
    const res = await request(app)
      .post('/sessions')
      .set(bearer(player.accessToken))
      .send({ mode: 'NORMAL' })
      .expect(201);
    const body = res.body as CreateSessionResponse;

    expect(JSON.stringify(body)).not.toMatch(/isCorrect/);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(body.session).toMatchObject({
      status: 'IN_PROGRESS',
      hp: 100,
      score: 0,
      combo: 0,
      multiplier: 1,
      total: 30,
    });
    expect(body.question).toMatchObject({ position: 0, zone: 1, themeSlug: 'http', kind: 'STANDARD' });
    expect(new Date(body.question.startedAt).getTime() - new Date(body.serverNow).getTime()).toBe(
      FIRST_QUESTION_DELAY_MS,
    );
    expect(body.question.answers).toHaveLength(4);

    const series = await prisma.sessionQuestion.findMany({
      where: { sessionId: body.session.id },
      include: { question: true },
      orderBy: { position: 'asc' },
    });
    const zones = series.map((s) => s.zone);
    expect(zones).toEqual([1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7, 7, 7]);
    expect(series.slice(24).every((s) => s.question.kind === 'BOSS')).toBe(true);
    expect(new Set(series.map((s) => s.questionId)).size).toBe(30);
    time.advance(0);
  });

  it('abandonne la partie précédente en cours', async () => {
    freezeTime();
    const player = await registerPlayer();
    const first = await start(player.accessToken);
    await start(player.accessToken);
    const old = await prisma.gameSession.findUniqueOrThrow({ where: { id: first.session.id } });
    expect(old.status).toBe('ABANDONED');
  });
});

describe('tirs', () => {
  it('refuse un tir avant le début de la question (409)', async () => {
    freezeTime();
    const player = await registerPlayer();
    const { session, question } = await start(player.accessToken);
    await shot(player.accessToken, session.id, question.answers[0]!.id, 409);
  });

  it('élimine les mauvaises réponses puis valide la question avec bonus de vitesse', async () => {
    const time = freezeTime();
    const player = await registerPlayer();
    const { session, question } = await start(player.accessToken);
    const { correct, wrong } = await splitAnswers(question);

    time.at(question, 0);
    const first = await shot(player.accessToken, session.id, wrong[0]!);
    expect(first).toMatchObject({ outcome: 'ELIMINATED_WRONG', questionClosed: false, reveal: null });
    expect(first.question!.eliminatedAnswerIds).toEqual([wrong[0]]);

    // Déjà éliminée : 400 ; réponse d'une autre question : 400.
    await shot(player.accessToken, session.id, wrong[0]!, 400);
    await shot(player.accessToken, session.id, 'inconnue', 400);

    await shot(player.accessToken, session.id, wrong[1]!);
    const last = await shot(player.accessToken, session.id, wrong[2]!);
    expect(last.questionClosed).toBe(true);
    expect(last.reveal).toMatchObject({ correctAnswerId: correct, pointsAwarded: 150 }); // 100 × 1 × 1,5 (instantané)
    expect(last.session).toMatchObject({ score: 150, combo: 1, multiplier: 1.25, hp: 100, currentIndex: 1 });
    expect(last.nextQuestion!.position).toBe(1);
    expect(new Date(last.nextQuestion!.startedAt).getTime() - new Date(last.serverNow).getTime()).toBe(
      INTER_QUESTION_DELAY_MS,
    );

    const log = await prisma.answerLog.findMany({ where: { sessionQuestion: { sessionId: session.id } } });
    expect(log).toHaveLength(3);
    expect(log.every((l) => l.outcome === 'ELIMINATED_WRONG' && l.elapsedMs === 0)).toBe(true);
  });

  it('applique le multiplicateur de combo et le bonus de vitesse à mi-temps', async () => {
    const time = freezeTime();
    const player = await registerPlayer();
    const { session, question } = await start(player.accessToken);
    time.at(question);
    const r1 = await clear(player.accessToken, session.id, question);

    const q2 = r1.nextQuestion!;
    time.at(q2, q2.timeLimitMs / 2);
    const r2 = await clear(player.accessToken, session.id, q2);
    // 100 × 1,25 (combo 1) × 1,25 (mi-temps)
    expect(r2.reveal!.pointsAwarded).toBe(156);
    expect(r2.session).toMatchObject({ combo: 2, multiplier: 1.5, score: 150 + 156 });
  });

  it('tirer sur la bonne réponse coûte 25 PV, rate la question et remet le combo à zéro', async () => {
    const time = freezeTime();
    const player = await registerPlayer();
    const { session, question } = await start(player.accessToken);
    time.at(question);
    const r1 = await clear(player.accessToken, session.id, question);
    const q2 = r1.nextQuestion!;
    time.at(q2, 1000);
    const { correct } = await splitAnswers(q2);
    const hit = await shot(player.accessToken, session.id, correct);
    expect(hit).toMatchObject({ outcome: 'HIT_CORRECT', questionClosed: true });
    expect(hit.reveal!.pointsAwarded).toBe(0);
    expect(hit.session).toMatchObject({ hp: 100 - HIT_CORRECT_PENALTY, combo: 0, multiplier: 1, currentIndex: 2 });
  });

  it('timeout : 409 avant l’échéance, puis −20 PV', async () => {
    const time = freezeTime();
    const player = await registerPlayer();
    const { session, question } = await start(player.accessToken);
    time.at(question, question.timeLimitMs - 1);
    await request(app).post(`/sessions/${session.id}/timeout`).set(bearer(player.accessToken)).expect(409);

    time.at(question, question.timeLimitMs);
    const res = await request(app).post(`/sessions/${session.id}/timeout`).set(bearer(player.accessToken)).expect(200);
    expect(res.body).toMatchObject({ outcome: 'TIMEOUT', questionClosed: true });
    expect(res.body.session.hp).toBe(100 - TIMEOUT_PENALTY);
  });

  it('un tir arrivé après l’échéance compte comme un timeout', async () => {
    const time = freezeTime();
    const player = await registerPlayer();
    const { session, question } = await start(player.accessToken);
    const { wrong } = await splitAnswers(question);
    time.at(question, question.timeLimitMs + 500);
    const res = await shot(player.accessToken, session.id, wrong[0]!);
    expect(res.outcome).toBe('TIMEOUT');
    expect(res.session.hp).toBe(80);
  });

  it('refuse d’agir sur la partie d’un autre joueur (403) ou inconnue (404)', async () => {
    freezeTime();
    const alice = await registerPlayer();
    const bob = await registerPlayer();
    const { session, question } = await start(alice.accessToken);
    await shot(bob.accessToken, session.id, question.answers[0]!.id, 403);
    await request(app).get(`/sessions/${session.id}`).set(bearer(bob.accessToken)).expect(403);
    await shot(bob.accessToken, 'inconnue', question.answers[0]!.id, 404);
  });

  it('deux tirs simultanés sur la dernière mauvaise réponse ne comptent qu’une fois', async () => {
    const time = freezeTime();
    const player = await registerPlayer();
    const { session, question } = await start(player.accessToken);
    const { wrong } = await splitAnswers(question);
    time.at(question);
    await shot(player.accessToken, session.id, wrong[0]!);
    await shot(player.accessToken, session.id, wrong[1]!);
    const results = await Promise.all([
      request(app).post(`/sessions/${session.id}/shots`).set(bearer(player.accessToken)).send({ answerId: wrong[2] }),
      request(app).post(`/sessions/${session.id}/shots`).set(bearer(player.accessToken)).send({ answerId: wrong[2] }),
    ]);
    // Le verrou sérialise les deux tirs : le second arrive sur la question suivante, pas encore commencée.
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const s = await prisma.gameSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(s.score).toBe(150);
  });
});

describe('bonus', () => {
  it('SLOW_TIME repousse l’échéance ; le serveur choisit le bonus', async () => {
    const time = freezeTime();
    const player = await registerPlayer();
    const { session, question } = await start(player.accessToken);
    const { wrong } = await splitAnswers(question);
    time.at(question);
    // Drop (0,01 < 15 %), puis choix parmi [REMOVE_WRONG, SLOW_TIME] : 0,6 → SLOW_TIME.
    vi.spyOn(rng, 'next').mockReturnValueOnce(0.01).mockReturnValueOnce(0.6);
    const res = await shot(player.accessToken, session.id, wrong[0]!);
    expect(res.bonus).toEqual({ type: 'SLOW_TIME', amount: SLOW_TIME_BONUS_MS });
    expect(new Date(res.question!.deadlineAt).getTime() - new Date(question.deadlineAt).getTime()).toBe(
      SLOW_TIME_BONUS_MS,
    );
    const log = await prisma.answerLog.findFirstOrThrow({ where: { sessionQuestionId: question.id } });
    expect(log.bonus).toBe('SLOW_TIME');
  });

  it('REMOVE_WRONG retire une mauvaise réponse supplémentaire', async () => {
    const time = freezeTime();
    const player = await registerPlayer();
    const { session, question } = await start(player.accessToken);
    const { correct, wrong } = await splitAnswers(question);
    time.at(question);
    vi.spyOn(rng, 'next').mockReturnValueOnce(0.01).mockReturnValueOnce(0.1).mockReturnValueOnce(0);
    const res = await shot(player.accessToken, session.id, wrong[0]!);
    expect(res.bonus!.type).toBe('REMOVE_WRONG');
    expect(res.bonus!.removedAnswerId).not.toBe(correct);
    expect(res.question!.eliminatedAnswerIds).toHaveLength(2);
  });

  it('HEAL rend des PV sans dépasser 100', async () => {
    const time = freezeTime();
    const player = await registerPlayer();
    const { session, question } = await start(player.accessToken);
    time.at(question, question.timeLimitMs);
    const r1 = await request(app).post(`/sessions/${session.id}/timeout`).set(bearer(player.accessToken)).expect(200);
    const q2 = (r1.body as ShotResponse).nextQuestion!;
    const { wrong } = await splitAnswers(q2);
    time.at(q2);
    // Options : [REMOVE_WRONG, SLOW_TIME, HEAL] → 0,9 choisit HEAL.
    vi.spyOn(rng, 'next').mockReturnValueOnce(0.01).mockReturnValueOnce(0.9);
    const res = await shot(player.accessToken, session.id, wrong[0]!);
    expect(res.bonus).toEqual({ type: 'HEAL', amount: 15 });
    expect(res.session.hp).toBe(95);
  });
});

describe('fin de partie', () => {
  it('perd la partie à 0 PV et l’inscrit au classement', async () => {
    const time = freezeTime();
    const player = await registerPlayer();
    let { session, question } = await start(player.accessToken);
    time.at(question);
    const r = await clear(player.accessToken, session.id, question);
    let q: PublicQuestion | null = r.nextQuestion;
    let last!: ShotResponse;
    for (let i = 0; i < 4 && q; i++) {
      time.at(q, 100);
      const { correct } = await splitAnswers(q);
      last = await shot(player.accessToken, session.id, correct);
      q = last.nextQuestion;
    }
    expect(last.session).toMatchObject({ status: 'LOST', hp: 0, score: 150 });
    expect(last.nextQuestion).toBeNull();
    await shot(player.accessToken, session.id, question.answers[0]!.id, 409);

    const board = await request(app).get('/leaderboard').expect(200);
    expect(board.body).toContainEqual(expect.objectContaining({ pseudo: player.user.pseudo, score: 150 }));

    const summary = await request(app)
      .get(`/sessions/${session.id}/summary`)
      .set(bearer(player.accessToken))
      .expect(200);
    expect(summary.body).toMatchObject({ cleared: 1, failed: 4, bestCombo: 1 });
    session = summary.body.session;
  });

  it('gagne une partie complète de 30 questions', async () => {
    const time = freezeTime();
    const player = await registerPlayer();
    const created = await start(player.accessToken);
    let q: PublicQuestion | null = created.question;
    let last!: ShotResponse;
    let count = 0;
    while (q) {
      time.at(q);
      last = await clear(player.accessToken, created.session.id, q);
      q = last.nextQuestion;
      count++;
    }
    expect(count).toBe(30);
    expect(last.session).toMatchObject({ status: 'WON', hp: 100, combo: 30, multiplier: 4 });
  });

  it('le mode entraînement ne fait pas perdre de PV et reste hors classement', async () => {
    const time = freezeTime();
    const player = await registerPlayer();
    const { session, question } = await start(player.accessToken, 'TRAINING');
    time.at(question);
    const { correct } = await splitAnswers(question);
    const res = await shot(player.accessToken, session.id, correct);
    expect(res.session).toMatchObject({ mode: 'TRAINING', hp: 100, combo: 0 });

    await request(app).post(`/sessions/${session.id}/end`).set(bearer(player.accessToken)).expect(200);
    const board = await request(app).get('/leaderboard').expect(200);
    expect(board.body.find((e: { pseudo: string }) => e.pseudo === player.user.pseudo)).toBeUndefined();
  });

  it('abandon : statut ABANDONED, puis 409 sur une partie close', async () => {
    freezeTime();
    const player = await registerPlayer();
    const { session } = await start(player.accessToken);
    const res = await request(app).post(`/sessions/${session.id}/end`).set(bearer(player.accessToken)).expect(200);
    expect(res.body.session.status).toBe('ABANDONED');
    await request(app).post(`/sessions/${session.id}/end`).set(bearer(player.accessToken)).expect(409);
  });

  it('GET /sessions/:id permet de reprendre la question en cours', async () => {
    freezeTime();
    const player = await registerPlayer();
    const { session, question } = await start(player.accessToken);
    const res = await request(app).get(`/sessions/${session.id}`).set(bearer(player.accessToken)).expect(200);
    expect(res.body.question.id).toBe(question.id);
    expect(JSON.stringify(res.body)).not.toMatch(/isCorrect/);
  });
});
