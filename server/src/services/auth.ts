import argon2 from 'argon2';
import type { User } from '@prisma/client';
import type { AuthResponse, PublicUser } from '@fps/shared';
import { prisma } from '../db.js';
import { durationToMs, env } from '../env.js';
import { conflict, unauthenticated } from '../lib/errors.js';
import { clock } from '../lib/clock.js';
import { generateRefreshToken, hashRefreshToken, signAccessToken } from '../lib/tokens.js';

/** Hash factice pour que login prenne le même temps, que l'email existe ou non. */
const DUMMY_HASH = argon2.hash('dummy-password-for-timing', { type: argon2.argon2id });

export interface IssuedTokens extends AuthResponse {
  refreshToken: string;
  refreshExpiresAt: Date;
}

export const toPublicUser = (u: Pick<User, 'id' | 'pseudo' | 'role'>): PublicUser => ({
  id: u.id,
  pseudo: u.pseudo,
  role: u.role,
});

async function issueTokens(user: User): Promise<IssuedTokens> {
  const refreshToken = generateRefreshToken();
  const refreshExpiresAt = new Date(clock.now().getTime() + durationToMs(env.JWT_REFRESH_TTL));
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: hashRefreshToken(refreshToken), expiresAt: refreshExpiresAt },
  });
  const accessToken = await signAccessToken({ sub: user.id, role: user.role, pseudo: user.pseudo });
  return { accessToken, user: toPublicUser(user), refreshToken, refreshExpiresAt };
}

export async function register(input: { pseudo: string; email: string; password: string }): Promise<IssuedTokens> {
  const email = input.email.toLowerCase();
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { pseudo: { equals: input.pseudo, mode: 'insensitive' } }] },
  });
  if (existing) throw conflict(existing.email === email ? 'Email déjà utilisé' : 'Pseudo déjà pris');

  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
  const user = await prisma.user.create({ data: { email, pseudo: input.pseudo, passwordHash } });
  return issueTokens(user);
}

export async function login(input: { email: string; password: string }): Promise<IssuedTokens> {
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  const valid = await argon2.verify(user?.passwordHash ?? (await DUMMY_HASH), input.password);
  if (!user || !valid) throw unauthenticated('Email ou mot de passe incorrect');
  return issueTokens(user);
}

/**
 * Rotation : le jeton présenté est révoqué et remplacé. Présenter un jeton déjà
 * remplacé signale un vol : toute la famille de jetons de l'utilisateur est révoquée.
 */
export async function refresh(token: string | undefined): Promise<IssuedTokens> {
  if (!token) throw unauthenticated('Session expirée');
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(token) },
    include: { user: true },
  });
  if (!stored) throw unauthenticated('Session expirée');

  const now = clock.now();
  if (stored.revokedAt) {
    if (stored.replacedBy) {
      await prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: now },
      });
    }
    throw unauthenticated('Session expirée');
  }
  if (stored.expiresAt <= now) throw unauthenticated('Session expirée');

  const issued = await issueTokens(stored.user);
  const replacement = await prisma.refreshToken.findUniqueOrThrow({
    where: { tokenHash: hashRefreshToken(issued.refreshToken) },
  });
  // Révocation conditionnelle : deux refresh concurrents ne peuvent pas réussir tous les deux.
  const { count } = await prisma.refreshToken.updateMany({
    where: { id: stored.id, revokedAt: null },
    data: { revokedAt: now, replacedBy: replacement.id },
  });
  if (count === 0) {
    await prisma.refreshToken.update({ where: { id: replacement.id }, data: { revokedAt: now } });
    throw unauthenticated('Session expirée');
  }
  return issued;
}

export async function logout(token: string | undefined): Promise<void> {
  if (!token) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashRefreshToken(token), revokedAt: null },
    data: { revokedAt: clock.now() },
  });
}
