import type { Answer, Question, Theme } from '@prisma/client';
import type { AdminQuestionDTO, AdminQuestionInput, QuestionKind } from '@fps/shared';
import { prisma } from '../db.js';
import { badRequest, notFound } from '../lib/errors.js';

type FullQuestion = Question & { answers: Answer[]; theme: Theme };

function toDTO(q: FullQuestion): AdminQuestionDTO {
  return {
    id: q.id,
    themeId: q.themeId,
    themeSlug: q.theme.slug,
    statement: q.statement,
    explanation: q.explanation,
    mdnUrl: q.mdnUrl,
    difficulty: q.difficulty,
    kind: q.kind,
    timeLimitMs: q.timeLimitMs,
    basePoints: q.basePoints,
    isActive: q.isActive,
    answers: q.answers.map((a) => ({ id: a.id, text: a.text, isCorrect: a.isCorrect })),
  };
}

const include = { answers: { orderBy: { id: 'asc' } }, theme: true } as const;

export async function listQuestions(filter: { themeId?: string; kind?: QuestionKind; includeInactive: boolean }) {
  const questions = await prisma.question.findMany({
    where: {
      themeId: filter.themeId,
      kind: filter.kind,
      isActive: filter.includeInactive ? undefined : true,
    },
    include,
    orderBy: [{ theme: { order: 'asc' } }, { kind: 'asc' }, { createdAt: 'asc' }],
  });
  return questions.map(toDTO);
}

export async function getQuestion(id: string): Promise<AdminQuestionDTO> {
  const q = await prisma.question.findUnique({ where: { id }, include });
  if (!q) throw notFound('Question introuvable');
  return toDTO(q);
}

async function assertTheme(themeId: string): Promise<void> {
  const theme = await prisma.theme.findUnique({ where: { id: themeId } });
  if (!theme) throw badRequest('Thème inconnu');
}

export async function createQuestion(input: AdminQuestionInput): Promise<AdminQuestionDTO> {
  await assertTheme(input.themeId);
  const q = await prisma.question.create({
    data: {
      themeId: input.themeId,
      statement: input.statement,
      explanation: input.explanation,
      mdnUrl: input.mdnUrl,
      difficulty: input.difficulty,
      kind: input.kind,
      timeLimitMs: input.timeLimitMs,
      basePoints: input.basePoints,
      isActive: input.isActive ?? true,
      answers: { create: input.answers.map((a) => ({ text: a.text, isCorrect: a.isCorrect })) },
    },
    include,
  });
  return toDTO(q);
}

/**
 * Les réponses portant un `id` sont modifiées sur place (les parties en cours gardent
 * leurs identifiants), les autres sont créées, et celles qui manquent sont supprimées.
 */
export async function updateQuestion(id: string, input: AdminQuestionInput): Promise<AdminQuestionDTO> {
  await assertTheme(input.themeId);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.question.findUnique({ where: { id }, include: { answers: true } });
    if (!existing) throw notFound('Question introuvable');

    const existingIds = new Set(existing.answers.map((a) => a.id));
    for (const a of input.answers) {
      if (a.id && !existingIds.has(a.id)) throw badRequest(`Réponse ${a.id} inconnue pour cette question`);
    }
    const keptIds = new Set(input.answers.flatMap((a) => (a.id ? [a.id] : [])));

    await tx.answer.deleteMany({ where: { questionId: id, id: { notIn: [...keptIds] } } });
    for (const a of input.answers) {
      if (a.id) await tx.answer.update({ where: { id: a.id }, data: { text: a.text, isCorrect: a.isCorrect } });
      else await tx.answer.create({ data: { questionId: id, text: a.text, isCorrect: a.isCorrect } });
    }

    const q = await tx.question.update({
      where: { id },
      data: {
        themeId: input.themeId,
        statement: input.statement,
        explanation: input.explanation,
        mdnUrl: input.mdnUrl,
        difficulty: input.difficulty,
        kind: input.kind,
        timeLimitMs: input.timeLimitMs,
        basePoints: input.basePoints,
        isActive: input.isActive ?? existing.isActive,
      },
      include,
    });
    return toDTO(q);
  });
}

/** Suppression douce : la question disparaît des tirages mais reste dans l'historique. */
export async function deactivateQuestion(id: string): Promise<void> {
  const { count } = await prisma.question.updateMany({ where: { id }, data: { isActive: false } });
  if (count === 0) throw notFound('Question introuvable');
}
