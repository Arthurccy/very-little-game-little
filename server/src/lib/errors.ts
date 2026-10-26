import type { ApiError } from '@fps/shared';

export type ErrorCode = ApiError['error']['code'];

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, 'VALIDATION', message, details);
export const unauthenticated = (message = 'Authentification requise') => new HttpError(401, 'UNAUTHENTICATED', message);
export const forbidden = (message = 'Accès refusé') => new HttpError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Ressource introuvable') => new HttpError(404, 'NOT_FOUND', message);
export const conflict = (message: string) => new HttpError(409, 'CONFLICT', message);
