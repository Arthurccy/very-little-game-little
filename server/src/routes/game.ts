import { Router } from 'express';
import { z } from 'zod';
import type { ThemeDTO } from '@fps/shared';
import { prisma } from '../db.js';
import { parse } from '../lib/validate.js';
import { currentUser, requireAuth } from '../middlewares/auth.js';
import * as game from '../services/game.js';
import { leaderboard } from '../services/leaderboard.js';

const idParam = z.object({ id: z.string().min(1).max(64) });
const createSchema = z.object({ mode: z.enum(['NORMAL', 'TRAINING']).default('NORMAL') });
const shotSchema = z.object({ answerId: z.string().min(1).max(64) });
const leaderboardQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) });

export const gameRouter = Router();

gameRouter.get('/themes', async (_req, res) => {
  const themes = await prisma.theme.findMany({ orderBy: { order: 'asc' } });
  const body: ThemeDTO[] = themes.map((t) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    scenery: t.scenery,
    order: t.order,
    intro: t.intro,
  }));
  res.set('Cache-Control', 'public, max-age=300').json(body);
});

gameRouter.get('/leaderboard', async (req, res) => {
  const { limit } = parse(leaderboardQuery, req.query);
  res.set('Cache-Control', 'no-cache').json(await leaderboard(limit));
});

// Toutes les routes de partie sont privées et jamais mises en cache.
const sessions = Router();
sessions.use(requireAuth, (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

sessions.post('/', async (req, res) => {
  const { mode } = parse(createSchema, req.body ?? {});
  res.status(201).json(await game.createSession(currentUser(req).sub, mode));
});

sessions.get('/:id', async (req, res) => {
  const { id } = parse(idParam, req.params);
  res.json(await game.getSession(currentUser(req).sub, id));
});

sessions.get('/:id/summary', async (req, res) => {
  const { id } = parse(idParam, req.params);
  res.json(await game.getSummary(currentUser(req).sub, id));
});

sessions.post('/:id/shots', async (req, res) => {
  const { id } = parse(idParam, req.params);
  const { answerId } = parse(shotSchema, req.body);
  res.json(await game.shoot(currentUser(req).sub, id, answerId));
});

sessions.post('/:id/timeout', async (req, res) => {
  const { id } = parse(idParam, req.params);
  res.json(await game.timeout(currentUser(req).sub, id));
});

sessions.post('/:id/end', async (req, res) => {
  const { id } = parse(idParam, req.params);
  res.json(await game.endSession(currentUser(req).sub, id));
});

gameRouter.use('/sessions', sessions);
