import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import type { Role } from '@fps/shared';
import { env } from '../env.js';

const ISSUER = 'fps-edu-api';
const AUDIENCE = 'fps-edu-client';
const accessKey = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

export interface AccessClaims {
  sub: string;
  role: Role;
  pseudo: string;
}

export async function signAccessToken(claims: AccessClaims): Promise<string> {
  return new SignJWT({ role: claims.role, pseudo: claims.pseudo })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_TTL)
    .sign(accessKey);
}

/** Lève si le jeton est invalide, expiré, ou signé avec un autre algorithme que HS256. */
export async function verifyAccessToken(token: string): Promise<AccessClaims> {
  const { payload } = await jwtVerify(token, accessKey, {
    algorithms: ['HS256'],
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  const role = payload.role;
  if (
    typeof payload.sub !== 'string' ||
    (role !== 'PLAYER' && role !== 'ADMIN') ||
    typeof payload.pseudo !== 'string'
  ) {
    throw new Error('Claims invalides');
  }
  return { sub: payload.sub, role, pseudo: payload.pseudo };
}

/** Refresh token opaque : 256 bits aléatoires ; seule son empreinte SHA-256 est stockée. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
