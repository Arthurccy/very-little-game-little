import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { parse } from '../lib/validate.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import * as admin from '../services/admin.js';
import { questionStats } from '../services/leaderboard.js';

const idParam = z.object({ id: z.string().min(1).max(64) });

const answerSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  text: z.string().trim().min(1, 'Texte de réponse requis').max(300),
  isCorrect: z.boolean(),
});

const questionSchema = z
  .object({
    themeId: z.string().min(1),
    statement: z.string().trim().min(5).max(500),
    explanation: z.string().trim().min(5).max(1000),
    mdnUrl: z.url().max(500).nullable().default(null),
    difficulty: z.number().int().min(1).max(3),
    kind: z.enum(['STANDARD', 'BOSS']),
    timeLimitMs: z.number().int().min(5000).max(120_000),
    basePoints: z.number().int().min(10).max(1000),
    isActive: z.boolean().optional(),
    answers: z.array(answerSchema).min(3, 'Au moins 3 réponses').max(6, '6 réponses maximum'),
  })
  .superRefine((q, ctx) => {
    const correct = q.answers.filter((a) => a.isCorrect).length;
    if (correct !== 1) ctx.addIssue({ code: 'custom', path: ['answers'], message: 'Exactement une bonne réponse' });
    const texts = q.answers.map((a) => a.text.toLowerCase());
    if (new Set(texts).size !== texts.length) {
      ctx.addIssue({ code: 'custom', path: ['answers'], message: 'Réponses en double' });
    }
  });

const listQuery = z.object({
  themeId: z.string().optional(),
  kind: z.enum(['STANDARD', 'BOSS']).optional(),
  includeInactive: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
});

const adminOnly = [
  requireAuth,
  requireRole('ADMIN'),
  (_req: Request, res: Response, next: NextFunction) => {
    res.set('Cache-Control', 'no-store');
    next();
  },
];

/** Monté sous /admin. */
export const adminRouter = Router();
adminRouter.use(adminOnly);

adminRouter.get('/questions', async (req, res) => {
  res.json(await admin.listQuestions(parse(listQuery, req.query)));
});

adminRouter.get('/questions/:id', async (req, res) => {
  res.json(await admin.getQuestion(parse(idParam, req.params).id));
});

adminRouter.post('/questions', async (req, res) => {
  res.status(201).json(await admin.createQuestion(parse(questionSchema, req.body)));
});

adminRouter.put('/questions/:id', async (req, res) => {
  const { id } = parse(idParam, req.params);
  res.json(await admin.updateQuestion(id, parse(questionSchema, req.body)));
});

adminRouter.delete('/questions/:id', async (req, res) => {
  await admin.deactivateQuestion(parse(idParam, req.params).id);
  res.status(204).end();
});

/** Monté sous /stats. */
export const statsRouter = Router();
statsRouter.use(adminOnly);

statsRouter.get('/questions', async (_req, res) => {
  res.json(await questionStats());
});
