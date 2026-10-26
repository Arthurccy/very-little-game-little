import request from 'supertest';
import { vi } from 'vitest';
import type { AuthResponse, PublicQuestion } from '@fps/shared';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { clock, rng } from '../src/lib/clock.js';

export const app = createApp();
export { prisma };

let counter = 0;

export async function registerPlayer(): Promise<AuthResponse & { cookie: string }> {
  counter++;
  const suffix = `${Date.now().toString(36)}${counter}`;
  const res = await request(app)
    .post('/auth/register')
    .send({ pseudo: `joueur_${suffix}`, email: `joueur_${suffix}@test.local`, password: 'motdepasse-solide' })
    .expect(201);
  return { ...(res.body as AuthResponse), cookie: res.headers['set-cookie']![0]! };
}

export async function loginAdmin(): Promise<string> {
  const res = await request(app)
    .post('/auth/login')
    .send({ email: 'admin@test.local', password: 'admin-password-123' })
    .expect(200);
  return (res.body as AuthResponse).accessToken;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/**
 * Horloge figée pilotable. Par défaut, le hasard renvoie 0,99 : aucun bonus ne tombe
 * et les mélanges gardent l'ordre d'origine.
 */
export function freezeTime(start = Date.now()) {
  let now = start;
  vi.spyOn(clock, 'now').mockImplementation(() => new Date(now));
  vi.spyOn(rng, 'next').mockReturnValue(0.99);
  return {
    advance: (ms: number) => {
      now += ms;
    },
    /** Se place `offsetMs` après le début de la question. */
    at: (question: PublicQuestion, offsetMs = 0) => {
      now = new Date(question.startedAt).getTime() + offsetMs;
    },
  };
}

export async function splitAnswers(question: PublicQuestion) {
  const answers = await prisma.answer.findMany({ where: { id: { in: question.answers.map((a) => a.id) } } });
  const correct = answers.find((a) => a.isCorrect)!.id;
  const wrong = question.answers.map((a) => a.id).filter((id) => id !== correct);
  return { correct, wrong };
}
