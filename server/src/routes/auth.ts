import { Router, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import type { AuthResponse } from '@fps/shared';
import { env } from '../env.js';
import { parse } from '../lib/validate.js';
import { requireTrustedOrigin } from '../middlewares/origin.js';
import * as auth from '../services/auth.js';

export const REFRESH_COOKIE = 'refresh_token';
const COOKIE_PATH = '/auth';

const registerSchema = z.object({
  pseudo: z
    .string()
    .trim()
    .min(3, 'Pseudo : 3 caractères minimum')
    .max(32, 'Pseudo : 32 caractères maximum')
    .regex(/^[\p{L}\p{N}_-]+$/u, 'Pseudo : lettres, chiffres, _ et - uniquement'),
  email: z.email('Email invalide').max(254),
  password: z.string().min(8, 'Mot de passe : 8 caractères minimum').max(128),
});

const loginSchema = z.object({
  email: z.email('Email invalide'),
  password: z.string().min(1).max(128),
});

function sendTokens(res: Response, status: number, issued: auth.IssuedTokens): void {
  res.cookie(REFRESH_COOKIE, issued.refreshToken, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    path: COOKIE_PATH,
    expires: issued.refreshExpiresAt,
  });
  res.setHeader('Cache-Control', 'no-store');
  const body: AuthResponse = { accessToken: issued.accessToken, user: issued.user };
  res.status(status).json(body);
}

const limiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 50,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  handler: (_req, res) => {
    res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Trop de tentatives, réessaie plus tard' } });
  },
});

export const authRouter = Router();

authRouter.post('/register', limiter, async (req, res) => {
  const input = parse(registerSchema, req.body);
  sendTokens(res, 201, await auth.register(input));
});

authRouter.post('/login', limiter, async (req, res) => {
  const input = parse(loginSchema, req.body);
  sendTokens(res, 200, await auth.login(input));
});

authRouter.post('/refresh', requireTrustedOrigin, async (req, res) => {
  try {
    sendTokens(res, 200, await auth.refresh(req.cookies?.[REFRESH_COOKIE]));
  } catch (err) {
    res.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
    throw err;
  }
});

authRouter.post('/logout', requireTrustedOrigin, async (req, res) => {
  await auth.logout(req.cookies?.[REFRESH_COOKIE]);
  res.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
  res.status(204).end();
});
