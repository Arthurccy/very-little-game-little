import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_PAUSE_MS, MAX_PAUSES, type CreateSessionResponse, type SessionDetailResponse } from '@fps/shared';
import { app, bearer, freezeTime, registerPlayer, splitAnswers } from './helpers.js';

afterEach(() => {
  vi.restoreAllMocks();
});

async function start(token: string) {
  const res = await request(app).post('/sessions').set(bearer(token)).send({ mode: 'NORMAL' }).expect(201);
  return res.body as CreateSessionResponse;
}

const pause = (token: string, id: string, status = 200) =>
  request(app).post(`/sessions/${id}/pause`).set(bearer(token)).expect(status);
const resume = (token: string, id: string, status = 200) =>
  request(app).post(`/sessions/${id}/resume`).set(bearer(token)).expect(status);

describe('pause', () => {
  it('gèle le chrono : la reprise décale la question de la durée de la pause', async () => {
    const time = freezeTime();
    const player = await registerPlayer();
    const { session, question } = await start(player.accessToken);
    time.at(question, 5000);

    const paused = (await pause(player.accessToken, session.id)).body as SessionDetailResponse;
    expect(paused.session).toMatchObject({ paused: true, pausesLeft: MAX_PAUSES - 1 });

    // Tirs et timeout refusés pendant la pause.
    const { wrong } = await splitAnswers(question);
    await request(app)
      .post(`/sessions/${session.id}/shots`)
      .set(bearer(player.accessToken))
      .send({ answerId: wrong[0] })
      .expect(409);

    time.advance(12_000);
    const resumed = (await resume(player.accessToken, session.id)).body as SessionDetailResponse;
    expect(resumed.session.paused).toBe(false);
    const shift = Date.parse(resumed.question!.deadlineAt) - Date.parse(question.deadlineAt);
    expect(shift).toBe(12_000);
    // Le temps restant est le même qu'au moment de la pause.
    expect(Date.parse(resumed.question!.deadlineAt) - Date.parse(resumed.serverNow)).toBe(question.timeLimitMs - 5000);
  });

  it('une pause trop longue se termine d’elle-même au bout de MAX_PAUSE_MS', async () => {
    const time = freezeTime();
    const player = await registerPlayer();
    const { session, question } = await start(player.accessToken);
    time.at(question, 1000);
    await pause(player.accessToken, session.id);
    time.advance(MAX_PAUSE_MS + 60_000);

    const res = (await request(app).get(`/sessions/${session.id}`).set(bearer(player.accessToken)).expect(200))
      .body as SessionDetailResponse;
    expect(res.session.paused).toBe(false);
    expect(Date.parse(res.question!.deadlineAt) - Date.parse(question.deadlineAt)).toBe(MAX_PAUSE_MS);
    await resume(player.accessToken, session.id, 409);
  });

  it(`limite le nombre de pauses à ${MAX_PAUSES}`, async () => {
    freezeTime();
    const player = await registerPlayer();
    const { session } = await start(player.accessToken);
    for (let i = 0; i < MAX_PAUSES; i++) {
      await pause(player.accessToken, session.id);
      await pause(player.accessToken, session.id, 409); // déjà en pause
      await resume(player.accessToken, session.id);
    }
    const res = await pause(player.accessToken, session.id, 409);
    expect(res.body.error.message).toMatch(/Plus de pause/);
  });

  it('une pause pendant l’explication repousse le début de la question suivante', async () => {
    const time = freezeTime();
    const player = await registerPlayer();
    const { session, question } = await start(player.accessToken);
    time.at(question, question.timeLimitMs);
    const closed = await request(app)
      .post(`/sessions/${session.id}/timeout`)
      .set(bearer(player.accessToken))
      .expect(200);
    const next = closed.body.nextQuestion;

    await pause(player.accessToken, session.id);
    time.advance(4000);
    const resumed = (await resume(player.accessToken, session.id)).body as SessionDetailResponse;
    expect(Date.parse(resumed.question!.startedAt) - Date.parse(next.startedAt)).toBe(4000);
  });

  it('abandonner pendant une pause lève la pause', async () => {
    freezeTime();
    const player = await registerPlayer();
    const { session } = await start(player.accessToken);
    await pause(player.accessToken, session.id);
    const res = await request(app).post(`/sessions/${session.id}/end`).set(bearer(player.accessToken)).expect(200);
    expect(res.body.session).toMatchObject({ status: 'ABANDONED', paused: false });
  });
});
