import { z } from 'zod';

const duration = z.string().regex(/^\d+[smhd]$/, 'Durée attendue au format 30s, 15m, 12h ou 7d');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  API_PORT: z.coerce.number().int().positive().default(43124),
  CLIENT_ORIGIN: z.url().default('http://localhost:43123'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET doit faire au moins 32 caractères'),
  JWT_ACCESS_TTL: duration.default('15m'),
  JWT_REFRESH_TTL: duration.default('7d'),
  /** Cookie refresh en Secure : activé d'office en production. */
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

export type Env = z.infer<typeof schema> & { COOKIE_SECURE: boolean };

function loadEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuration invalide :\n${issues}`);
  }
  const data = parsed.data;
  return { ...data, COOKIE_SECURE: data.COOKIE_SECURE ?? data.NODE_ENV === 'production' };
}

export const env = loadEnv();

/** Convertit « 15m », « 7d »… en millisecondes. */
export function durationToMs(value: string): number {
  const unit = value.slice(-1);
  const amount = Number(value.slice(0, -1));
  const factor = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit];
  if (!factor || !Number.isFinite(amount)) throw new Error(`Durée invalide : ${value}`);
  return amount * factor;
}
