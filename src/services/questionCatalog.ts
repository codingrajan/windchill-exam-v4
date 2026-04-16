import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import type { Question, QuestionAdminOverride } from '../types/index';

const normalizeArray = (value: unknown): number[] | null => {
  if (!Array.isArray(value)) return null;
  const normalized = value.filter((entry): entry is number => Number.isInteger(entry)).sort((left, right) => left - right);
  return normalized;
};

const normalizeOverride = (id: string, raw: Record<string, unknown>): QuestionAdminOverride | null => {
  const questionId = Number(raw.questionId);
  if (!Number.isInteger(questionId)) return null;

  const normalizedCorrect =
    Number.isInteger(raw.correctAnswer)
      ? (raw.correctAnswer as number)
      : normalizeArray(raw.correctAnswer);

  return {
    id,
    questionId,
    status:
      raw.status === 'active' || raw.status === 'skipped' || raw.status === 'deleted'
        ? raw.status
        : undefined,
    domain: typeof raw.domain === 'string' ? raw.domain : undefined,
    objective: typeof raw.objective === 'string' ? raw.objective : undefined,
    sourceManual: typeof raw.sourceManual === 'string' ? raw.sourceManual : undefined,
    sourceSection: typeof raw.sourceSection === 'string' ? raw.sourceSection : undefined,
    misconceptionTag: typeof raw.misconceptionTag === 'string' ? raw.misconceptionTag : undefined,
    releaseVersion: typeof raw.releaseVersion === 'string' ? raw.releaseVersion : undefined,
    topic: typeof raw.topic === 'string' ? raw.topic : undefined,
    difficulty: raw.difficulty === 'easy' || raw.difficulty === 'medium' || raw.difficulty === 'hard' || raw.difficulty === 'unrated'
      ? raw.difficulty
      : undefined,
    type: raw.type === 'single' || raw.type === 'multiple' ? raw.type : undefined,
    question: typeof raw.question === 'string' ? raw.question : undefined,
    codeSnippet: typeof raw.codeSnippet === 'string' ? raw.codeSnippet : undefined,
    options: Array.isArray(raw.options) ? raw.options.filter((entry): entry is string => typeof entry === 'string') : undefined,
    correctAnswer: normalizedCorrect ?? undefined,
    explanation: typeof raw.explanation === 'string' ? raw.explanation : undefined,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
    createdBy: typeof raw.createdBy === 'string' ? raw.createdBy : undefined,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
    updatedBy: typeof raw.updatedBy === 'string' ? raw.updatedBy : undefined,
  };
};

export async function fetchQuestionOverrides(): Promise<QuestionAdminOverride[]> {
  const snap = await getDocs(collection(db, 'question_overrides'));
  const overrides: QuestionAdminOverride[] = [];
  snap.forEach((entry) => {
    const normalized = normalizeOverride(entry.id, entry.data() as Record<string, unknown>);
    if (normalized) overrides.push(normalized);
  });
  return overrides.sort((left, right) => left.questionId - right.questionId);
}

export function applyQuestionOverrides(
  baseQuestions: Question[],
  overrides: QuestionAdminOverride[],
  options: { includeSkipped?: boolean } = {},
): Question[] {
  const byId = new Map<number, Question>(baseQuestions.map((question) => [question.id, question]));

  for (const override of overrides) {
    const base = byId.get(override.questionId);
    const nextQuestion: Question = {
      ...(base ?? {
        id: override.questionId,
        topic: override.topic ?? override.domain ?? 'Unclassified',
        difficulty: override.difficulty ?? 'unrated',
        question: override.question ?? '',
        options: override.options ?? [],
        correctAnswer: override.correctAnswer ?? 0,
        explanation: override.explanation ?? '',
      }),
      ...(override.domain !== undefined ? { domain: override.domain } : {}),
      ...(override.objective !== undefined ? { objective: override.objective } : {}),
      ...(override.sourceManual !== undefined ? { sourceManual: override.sourceManual } : {}),
      ...(override.sourceSection !== undefined ? { sourceSection: override.sourceSection } : {}),
      ...(override.misconceptionTag !== undefined ? { misconceptionTag: override.misconceptionTag } : {}),
      ...(override.releaseVersion !== undefined ? { releaseVersion: override.releaseVersion } : {}),
      ...(override.topic !== undefined ? { topic: override.topic } : {}),
      ...(override.difficulty !== undefined ? { difficulty: override.difficulty } : {}),
      ...(override.type !== undefined ? { type: override.type } : {}),
      ...(override.question !== undefined ? { question: override.question } : {}),
      ...(override.codeSnippet !== undefined ? { codeSnippet: override.codeSnippet } : {}),
      ...(override.options !== undefined ? { options: override.options } : {}),
      ...(override.correctAnswer !== undefined ? { correctAnswer: override.correctAnswer } : {}),
      ...(override.explanation !== undefined ? { explanation: override.explanation } : {}),
      status: override.status ?? base?.status ?? 'active',
      isOverride: true,
      baseQuestionId: base?.id ?? override.questionId,
    };

    byId.set(override.questionId, nextQuestion);
  }

  return [...byId.values()]
    .filter((question) => options.includeSkipped || (question.status ?? 'active') === 'active')
    .sort((left, right) => left.id - right.id);
}
