import type { z } from 'zod';
import { badRequest } from './errors.js';

/** Valide une entrée avec Zod ; lève une 400 détaillée en cas d'échec. */
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    throw badRequest('Requête invalide', details);
  }
  return result.data;
}
