import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiError } from '@fps/shared';
import { HttpError, notFound } from '../lib/errors.js';

export const notFoundHandler: RequestHandler = () => {
  throw notFound('Route inconnue');
};

/** Point unique de conversion des erreurs en réponses `ApiError`. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let httpError: HttpError;
  if (err instanceof HttpError) {
    httpError = err;
  } else if (isBodyParserError(err)) {
    httpError =
      err.type === 'entity.too.large'
        ? new HttpError(413, 'VALIDATION', 'Corps de requête trop volumineux')
        : new HttpError(400, 'VALIDATION', 'Corps JSON invalide');
  } else {
    console.error(err);
    httpError = new HttpError(500, 'INTERNAL', 'Erreur interne');
  }

  const body: ApiError = { error: { code: httpError.code, message: httpError.message } };
  if (httpError.details !== undefined) body.error.details = httpError.details;
  res.status(httpError.status).json(body);
};

function isBodyParserError(err: unknown): err is { type: string } {
  return typeof err === 'object' && err !== null && 'type' in err && typeof (err as { type: unknown }).type === 'string'
    && (err as { type: string }).type.startsWith('entity.');
}
