import type { LeaderboardEntry, QuestionStatDTO } from '@fps/shared';
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';

/** Meilleure partie NORMAL terminée (gagnée ou perdue) de chaque joueur. */
export async function leaderboard(limit: number): Promise<LeaderboardEntry[]> {
  const rows = await prisma.$queryRaw<{ pseudo: string; score: number; endedAt: Date }[]>`
    SELECT DISTINCT ON (s."userId") u.pseudo, s.score, s."endedAt"
    FROM "GameSession" s
    JOIN "User" u ON u.id = s."userId"
    WHERE s.mode = 'NORMAL' AND s.status IN ('WON', 'LOST') AND s."endedAt" IS NOT NULL
    ORDER BY s."userId", s.score DESC, s."endedAt" ASC
  `;
  return rows
    .sort((a, b) => b.score - a.score || a.endedAt.getTime() - b.endedAt.getTime())
    .slice(0, limit)
    .map((r, i) => ({ rank: i + 1, pseudo: r.pseudo, score: r.score, endedAt: r.endedAt.toISOString() }));
}

/** Taux de réussite et temps moyen par question, sur les questions closes (réussies ou ratées). */
export async function questionStats(): Promise<QuestionStatDTO[]> {
  const rows = await prisma.$queryRaw<
    {
      questionId: string;
      statement: string;
      themeSlug: string;
      kind: 'STANDARD' | 'BOSS';
      isActive: boolean;
      attempts: bigint;
      cleared: bigint;
      avgMs: Prisma.Decimal | number | null;
    }[]
  >`
    SELECT q.id AS "questionId", q.statement, t.slug AS "themeSlug", q.kind, q."isActive",
           COUNT(sq.id) AS attempts,
           COUNT(sq.id) FILTER (WHERE sq.status = 'CLEARED') AS cleared,
           AVG(EXTRACT(EPOCH FROM (sq."resolvedAt" - sq."startedAt")) * 1000) AS "avgMs"
    FROM "Question" q
    JOIN "Theme" t ON t.id = q."themeId"
    LEFT JOIN "SessionQuestion" sq
      ON sq."questionId" = q.id AND sq.status IN ('CLEARED', 'FAILED') AND sq."resolvedAt" IS NOT NULL
    GROUP BY q.id, t.slug, t."order"
    ORDER BY t."order", q.kind, q."createdAt"
  `;
  return rows.map((r) => {
    const attempts = Number(r.attempts);
    return {
      questionId: r.questionId,
      statement: r.statement,
      themeSlug: r.themeSlug,
      kind: r.kind,
      isActive: r.isActive,
      attempts,
      successRate: attempts > 0 ? Number(r.cleared) / attempts : null,
      averageElapsedMs: r.avgMs === null ? null : Math.round(Number(r.avgMs)),
    };
  });
}
