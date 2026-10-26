import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, bearer, registerPlayer } from './helpers.js';

const ORIGIN = 'http://localhost:43123';

describe('auth', () => {
  it('inscrit un joueur et pose un refresh token httpOnly restreint à /auth', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ pseudo: 'neo_1', email: 'Neo@Test.local', password: 'motdepasse-solide' })
      .expect(201);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ pseudo: 'neo_1', role: 'PLAYER' });
    expect(res.body.refreshToken).toBeUndefined();
    const cookie = res.headers['set-cookie']![0]!;
    expect(cookie).toMatch(/^refresh_token=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Path=\/auth/);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('refuse un email ou un pseudo déjà pris (409)', async () => {
    await request(app)
      .post('/auth/register')
      .send({ pseudo: 'trinity', email: 'trinity@test.local', password: 'motdepasse-solide' })
      .expect(201);
    const sameEmail = await request(app)
      .post('/auth/register')
      .send({ pseudo: 'autre', email: 'TRINITY@test.local', password: 'motdepasse-solide' })
      .expect(409);
    expect(sameEmail.body.error.code).toBe('CONFLICT');
    await request(app)
      .post('/auth/register')
      .send({ pseudo: 'Trinity', email: 'autre@test.local', password: 'motdepasse-solide' })
      .expect(409);
  });

  it('valide les entrées (400) et le JSON mal formé (400)', async () => {
    const res = await request(app).post('/auth/register').send({ pseudo: 'x', email: 'pas-un-email', password: '1' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
    expect(res.body.error.details.length).toBeGreaterThanOrEqual(3);

    const bad = await request(app).post('/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(bad.status).toBe(400);
  });

  it('refuse un mauvais mot de passe (401) sans révéler si le compte existe', async () => {
    const player = await registerPlayer();
    const email = `${player.user.pseudo}@test.local`;
    const wrong = await request(app).post('/auth/login').send({ email, password: 'mauvais' }).expect(401);
    const unknown = await request(app)
      .post('/auth/login')
      .send({ email: 'inconnu@test.local', password: 'mauvais' })
      .expect(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('fait tourner le refresh token et révoque la famille en cas de réutilisation', async () => {
    const player = await registerPlayer();
    const first = await request(app).post('/auth/refresh').set('Cookie', player.cookie).expect(200);
    expect(first.body.user.id).toBe(player.user.id);
    const rotated = first.headers['set-cookie']![0]!;
    expect(rotated).not.toBe(player.cookie);

    // Rejouer l'ancien jeton : vol présumé, toute la chaîne est révoquée.
    await request(app).post('/auth/refresh').set('Cookie', player.cookie).expect(401);
    await request(app).post('/auth/refresh').set('Cookie', rotated).expect(401);
  });

  it('logout révoque le refresh token', async () => {
    const player = await registerPlayer();
    await request(app).post('/auth/logout').set('Cookie', player.cookie).expect(204);
    await request(app).post('/auth/refresh').set('Cookie', player.cookie).expect(401);
  });

  it('refuse un refresh venant d’une autre origine (403)', async () => {
    const player = await registerPlayer();
    await request(app)
      .post('/auth/refresh')
      .set('Cookie', player.cookie)
      .set('Origin', 'https://evil.example')
      .expect(403);
    await request(app).post('/auth/refresh').set('Cookie', player.cookie).set('Origin', ORIGIN).expect(200);
  });

  it('rejette un jeton d’accès invalide (401) et un jeton alg=none', async () => {
    await request(app).post('/sessions').expect(401);
    await request(app).post('/sessions').set(bearer('abc.def.ghi')).expect(401);
    const header = Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url');
    const payload = Buffer.from('{"sub":"x","role":"ADMIN","pseudo":"x"}').toString('base64url');
    await request(app)
      .get('/admin/questions')
      .set(bearer(`${header}.${payload}.`))
      .expect(401);
  });
});

describe('http', () => {
  it('CORS : origine exacte, credentials et Vary: Origin', async () => {
    const res = await request(app)
      .options('/sessions')
      .set('Origin', ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,authorization');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers.vary).toMatch(/Origin/);
  });

  it('GET /themes renvoie les 6 thèmes dans l’ordre', async () => {
    const res = await request(app).get('/themes').expect(200);
    expect(res.body.map((t: { slug: string }) => t.slug)).toEqual([
      'http',
      'rest',
      'cors',
      'auth',
      'securite',
      'cache',
    ]);
  });

  it('404 au format ApiError pour une route inconnue', async () => {
    const res = await request(app).get('/nexiste-pas').expect(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Route inconnue' } });
  });
});
