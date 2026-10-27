import type { NextFunction, Request, Response } from 'express';
import { env } from '../env.js';
import { forbidden } from '../lib/errors.js';

/**
 * Défense CSRF des routes qui s'appuient sur le cookie refresh : si le navigateur
 * annonce une origine, ce doit être celle du client. SameSite=Lax couvre le reste.
 */
export function requireTrustedOrigin(req: Request, _res: Response, next: NextFunction): void {
  const origin = req.get('origin');
  if (origin && origin !== env.CLIENT_ORIGIN) throw forbidden('Origine non autorisée');
  next();
}
