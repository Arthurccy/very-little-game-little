import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@fps/shared';
import { forbidden, unauthenticated } from '../lib/errors.js';
import { verifyAccessToken, type AccessClaims } from '../lib/tokens.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessClaims;
    }
  }
}

/** Exige un `Authorization: Bearer <jwt>` valide. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.get('authorization');
  const match = header?.match(/^Bearer (.+)$/i);
  if (!match) throw unauthenticated();
  try {
    req.user = await verifyAccessToken(match[1]!);
  } catch {
    throw unauthenticated('Jeton invalide ou expiré');
  }
  next();
}

export function requireRole(role: Role) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw unauthenticated();
    if (req.user.role !== role) throw forbidden('Rôle insuffisant');
    next();
  };
}

/** Utilisateur authentifié de la requête (après requireAuth). */
export function currentUser(req: Request): AccessClaims {
  if (!req.user) throw unauthenticated();
  return req.user;
}
