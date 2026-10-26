import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { app, bearer, loginAdmin, prisma, registerPlayer } from './helpers.js';

let adminToken: string;
let themeId: string;

beforeAll(async () => {
  adminToken = await loginAdmin();
  themeId = (await prisma.theme.findUniqueOrThrow({ where: { slug: 'cors' } })).id;
});

const input = () => ({
  themeId,
  statement: 'Question de test sur CORS ?',
  explanation: 'Une explication suffisante.',
  mdnUrl: 'https://developer.mozilla.org/fr/docs/Web/HTTP/CORS',
  difficulty: 2,
  kind: 'STANDARD' as const,
  timeLimitMs: 20000,
  basePoints: 100,
  answers: [
    { text: 'Bonne', isCorrect: true },
    { text: 'Mauvaise A', isCorrect: false },
    { text: 'Mauvaise B', isCorrect: false },
  ],
});

describe('back-office', () => {
  it('refuse un joueur (403) et un anonyme (401)', async () => {
    const player = await registerPlayer();
    await request(app).get('/admin/questions').set(bearer(player.accessToken)).expect(403);
    await request(app).get('/stats/questions').set(bearer(player.accessToken)).expect(403);
    await request(app).get('/admin/questions').expect(401);
  });

  it('liste les questions avec isCorrect pour l’admin', async () => {
    const res = await request(app).get('/admin/questions').set(bearer(adminToken)).expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(71);
    expect(res.body[0].answers[0]).toHaveProperty('isCorrect');
  });

  it('exige exactement une bonne réponse et au moins trois réponses', async () => {
    const twoCorrect = input();
    twoCorrect.answers[1]!.isCorrect = true;
    await request(app).post('/admin/questions').set(bearer(adminToken)).send(twoCorrect).expect(400);
    const tooFew = { ...input(), answers: input().answers.slice(0, 2) };
    await request(app).post('/admin/questions').set(bearer(adminToken)).send(tooFew).expect(400);
  });

  it('crée, modifie (réponses gardées par id) et désactive une question', async () => {
    const created = await request(app).post('/admin/questions').set(bearer(adminToken)).send(input()).expect(201);
    const q = created.body;
    expect(q.answers).toHaveLength(3);

    const keptId = q.answers.find((a: { isCorrect: boolean }) => a.isCorrect).id;
    const update = {
      ...input(),
      statement: 'Question modifiée ?',
      answers: [
        { id: keptId, text: 'Bonne (modifiée)', isCorrect: true },
        { text: 'Nouvelle mauvaise', isCorrect: false },
        { text: 'Encore une mauvaise', isCorrect: false },
        { text: 'Et une autre', isCorrect: false },
      ],
    };
    const updated = await request(app).put(`/admin/questions/${q.id}`).set(bearer(adminToken)).send(update).expect(200);
    expect(updated.body.statement).toBe('Question modifiée ?');
    expect(updated.body.answers).toHaveLength(4);
    expect(updated.body.answers.find((a: { id: string }) => a.id === keptId).text).toBe('Bonne (modifiée)');

    await request(app).delete(`/admin/questions/${q.id}`).set(bearer(adminToken)).expect(204);
    const after = await request(app).get(`/admin/questions/${q.id}`).set(bearer(adminToken)).expect(200);
    expect(after.body.isActive).toBe(false);
    const active = await request(app).get('/admin/questions?includeInactive=false').set(bearer(adminToken)).expect(200);
    expect(active.body.find((x: { id: string }) => x.id === q.id)).toBeUndefined();
    await request(app).delete('/admin/questions/inconnue').set(bearer(adminToken)).expect(404);
  });

  it('GET /stats/questions renvoie une ligne par question', async () => {
    const res = await request(app).get('/stats/questions').set(bearer(adminToken)).expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(71);
    expect(res.body[0]).toEqual(
      expect.objectContaining({ questionId: expect.any(String), attempts: expect.any(Number) }),
    );
  });
});
