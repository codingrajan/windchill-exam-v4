import type {
  AnswerMap,
  AnswerValue,
  Difficulty,
  ExamTrack,
  EvaluationSummary,
  Question,
  TopicStat,
} from '../types/index';
import { TRACK_PROFILES } from '../constants/examStrategy';

export const QUESTION_POOL_FILES = [
  '/data/windchill_mock_test_1.json',
  '/data/windchill_mock_test_2.json',
  '/data/windchill_mock_test_3.json',
  '/data/windchill_mock_test_4.json',
  '/data/windchill_mock_test_5.json',
  '/data/windchill_mock_test_6.json',
  '/data/windchill_mock_test_7.json',
  '/data/windchill_mock_test_8.json',
  '/data/windchill_mock_test_9.json',
] as const;

const EMPTY_TOPIC = 'Unclassified';

export const getQuestionDomain = (question: Pick<Question, 'domain' | 'topic'>): string =>
  question.topic?.trim() || question.domain?.trim() || EMPTY_TOPIC;

export const normalizeDifficulty = (raw: string | null | undefined): Difficulty => {
  const normalized = raw?.toLowerCase().trim();
  if (normalized === 'easy' || normalized === 'medium' || normalized === 'hard') {
    return normalized;
  }
  return 'unrated';
};

export const isMultiAnswerQuestion = (question: Question): boolean =>
  question.type === 'multiple' || Array.isArray(question.correctAnswer);

const normalizeAnswerValue = (value: unknown): AnswerValue | null => {
  if (Array.isArray(value)) {
    const normalized = value
      .filter((entry): entry is number => Number.isInteger(entry))
      .sort((left, right) => left - right);
    return normalized;
  }

  return Number.isInteger(value) ? (value as number) : null;
};

const normalizeQuestion = (raw: unknown, sourceFile?: string): Question | null => {
  if (!raw || typeof raw !== 'object') return null;

  const candidate = raw as Partial<Question>;
  const options = Array.isArray(candidate.options)
    ? candidate.options.filter((option): option is string => typeof option === 'string')
    : [];
  const correctAnswer = normalizeAnswerValue(candidate.correctAnswer);

  if (
    !Number.isInteger(candidate.id) ||
    typeof candidate.question !== 'string' ||
    typeof candidate.explanation !== 'string' ||
    (typeof candidate.topic !== 'string' && typeof candidate.domain !== 'string') ||
    options.length < 2 ||
    correctAnswer === null
  ) {
    return null;
  }

  const questionId = candidate.id as number;

  return {
    id: questionId,
    domain: typeof candidate.domain === 'string' ? candidate.domain.trim() || EMPTY_TOPIC : undefined,
    topic:
      (typeof candidate.topic === 'string' && candidate.topic.trim()) ||
      (typeof candidate.domain === 'string' && candidate.domain.trim()) ||
      EMPTY_TOPIC,
    difficulty: normalizeDifficulty(candidate.difficulty),
    objective: typeof candidate.objective === 'string' ? candidate.objective.trim() : undefined,
    type: Array.isArray(correctAnswer) ? 'multiple' : 'single',
    question: candidate.question.trim(),
    codeSnippet: typeof candidate.codeSnippet === 'string' ? candidate.codeSnippet : undefined,
    options,
    correctAnswer,
    explanation: candidate.explanation.trim(),
    sourceManual: typeof candidate.sourceManual === 'string' ? candidate.sourceManual.trim() : undefined,
    sourceSection: typeof candidate.sourceSection === 'string' ? candidate.sourceSection.trim() : sourceFile,
    misconceptionTag: typeof candidate.misconceptionTag === 'string' ? candidate.misconceptionTag.trim() : undefined,
    releaseVersion: typeof candidate.releaseVersion === 'string' ? candidate.releaseVersion.trim() : '2026.04',
  };
};

const extractQuestionArray = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object' && Array.isArray((payload as { questions?: unknown[] }).questions)) {
    return (payload as { questions: unknown[] }).questions;
  }
  return [];
};

export const shuffle = <T>(items: readonly T[]): T[] => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};

export const loadQuestionPool = async (): Promise<Question[]> => {
  const payloads = await Promise.all(
    QUESTION_POOL_FILES.map(async (file) => {
      try {
        const response = await fetch(file);
        if (!response.ok) return [];
        const questions = extractQuestionArray(await response.json());
        return questions.map((question) => ({ question, sourceFile: file.replace('/data/', '') }));
      } catch {
        return [];
      }
    }),
  );

  const byId = new Map<number, Question>();
  for (const payload of payloads.flat()) {
    const normalized = normalizeQuestion(payload.question, payload.sourceFile);
    if (!normalized || byId.has(normalized.id)) continue;
    byId.set(normalized.id, normalized);
  }

  return [...byId.values()].sort((left, right) => left.id - right.id);
};

const allocateCounts = (targetCount: number, track: ExamTrack) => {
  const profile = TRACK_PROFILES[track];
  let easyNeeded = Math.round(targetCount * profile.difficultyTargets.easy);
  let medNeeded = Math.round(targetCount * profile.difficultyTargets.medium);
  let hardNeeded = Math.round(targetCount * profile.difficultyTargets.hard);
  let unratedNeeded = targetCount - easyNeeded - medNeeded - hardNeeded;

  if (targetCount <= 25 && track === 'exam_parity') {
    easyNeeded = Math.max(easyNeeded, 4);
    medNeeded = Math.max(medNeeded, 10);
    hardNeeded = Math.max(hardNeeded, 6);
    unratedNeeded = Math.max(0, targetCount - easyNeeded - medNeeded - hardNeeded);
  }

  return {
    easyNeeded,
    medNeeded,
    hardNeeded,
    unratedNeeded,
    multiNeeded: Math.round(targetCount * profile.multiSelectRatio),
  };
};

export const buildRandomExam = (
  pool: Question[],
  targetCount: number,
  options: { track?: ExamTrack } = {},
): Question[] => {
  const track = options.track ?? 'hard_mode';
  const allocation = allocateCounts(targetCount, track);
  const { multiNeeded } = allocation;
  let { easyNeeded, medNeeded, hardNeeded, unratedNeeded } = allocation;
  const multiPool = pool.filter(isMultiAnswerQuestion);
  const singlePool = pool.filter((question) => !isMultiAnswerQuestion(question));
  const selectedQuestions: Question[] = [];

  for (const question of shuffle(multiPool).slice(0, multiNeeded)) {
    selectedQuestions.push(question);
    const difficulty = normalizeDifficulty(question.difficulty);
    if (difficulty === 'easy') easyNeeded -= 1;
    if (difficulty === 'medium') medNeeded -= 1;
    if (difficulty === 'hard') hardNeeded -= 1;
    if (difficulty === 'unrated') unratedNeeded -= 1;
  }

  const easyPool = shuffle(singlePool.filter((question) => normalizeDifficulty(question.difficulty) === 'easy'));
  const mediumPool = shuffle(singlePool.filter((question) => normalizeDifficulty(question.difficulty) === 'medium'));
  const hardPool = shuffle(singlePool.filter((question) => normalizeDifficulty(question.difficulty) === 'hard'));
  const unratedPool = shuffle(singlePool.filter((question) => normalizeDifficulty(question.difficulty) === 'unrated'));

  const draw = (source: Question[], count: number) => {
    if (count <= 0) return;
    selectedQuestions.push(...source.splice(0, count));
  };

  draw(easyPool, easyNeeded);
  draw(mediumPool, medNeeded);
  draw(hardPool, hardNeeded);
  draw(unratedPool, unratedNeeded);

  if (selectedQuestions.length < targetCount) {
    const spilloverPool = [...easyPool, ...mediumPool, ...hardPool, ...unratedPool];
    draw(spilloverPool, targetCount - selectedQuestions.length);
  }

  return shuffle(selectedQuestions).slice(0, targetCount);
};

export const buildRemediationExam = (
  pool: Question[],
  missedQuestionIds: number[],
  weakestDomain: string | null,
  targetCount: number,
): Question[] => {
  const missedIdSet = new Set(missedQuestionIds);
  const directMisses = shuffle(pool.filter((question) => missedIdSet.has(question.id)));
  const weakestDomainPool =
    weakestDomain && weakestDomain !== 'N/A'
      ? shuffle(pool.filter((question) => getQuestionDomain(question) === weakestDomain && !missedIdSet.has(question.id)))
      : [];

  const selected: Question[] = [];
  const seenIds = new Set<number>();

  const drawUnique = (source: Question[], count: number) => {
    for (const question of source) {
      if (selected.length >= count || seenIds.has(question.id)) continue;
      selected.push(question);
      seenIds.add(question.id);
    }
  };

  drawUnique(directMisses, Math.min(targetCount, Math.max(8, Math.round(targetCount * 0.6))));
  drawUnique(weakestDomainPool, targetCount);

  if (selected.length < targetCount) {
    drawUnique(shuffle(pool), targetCount);
  }

  return shuffle(selected).slice(0, targetCount);
};

export const buildWrongOnlyExam = (
  pool: Question[],
  missedQuestionIds: number[],
  targetCount: number,
): Question[] => {
  const missedIdSet = new Set(missedQuestionIds);
  const directMisses = shuffle(pool.filter((question) => missedIdSet.has(question.id)));
  return directMisses.slice(0, targetCount);
};

export const buildWeakDomainExam = (
  pool: Question[],
  weakestDomain: string | null,
  targetCount: number,
): Question[] => {
  if (!weakestDomain || weakestDomain === 'N/A') {
    return shuffle(pool).slice(0, targetCount);
  }

  const domainPool = shuffle(pool.filter((question) => getQuestionDomain(question) === weakestDomain));
  if (domainPool.length >= targetCount) {
    return domainPool.slice(0, targetCount);
  }

  const remainder = shuffle(pool.filter((question) => getQuestionDomain(question) !== weakestDomain));
  return shuffle([...domainPool, ...remainder]).slice(0, targetCount);
};

export const isQuestionAnswered = (answer: AnswerValue | undefined): boolean =>
  Array.isArray(answer) ? answer.length > 0 : answer !== undefined;

export const isAnswerCorrect = (question: Question, answer: AnswerValue | undefined): boolean => {
  if (Array.isArray(question.correctAnswer)) {
    if (!Array.isArray(answer) || answer.length !== question.correctAnswer.length) return false;
    const normalizedAnswer = [...answer].sort((left, right) => left - right);
    return question.correctAnswer.every((value, index) => value === normalizedAnswer[index]);
  }

  return answer === question.correctAnswer;
};

const createEmptyTopicStat = (): TopicStat => ({ correct: 0, total: 0 });

export const evaluateExam = (questions: Question[], answers: AnswerMap): EvaluationSummary => {
  const topicStats: Record<string, TopicStat> = {};
  const difficultyStats: Record<Difficulty, TopicStat> = {
    easy: createEmptyTopicStat(),
    medium: createEmptyTopicStat(),
    hard: createEmptyTopicStat(),
    unrated: createEmptyTopicStat(),
  };

  let correctCount = 0;
  let incorrectCount = 0;
  let skippedCount = 0;

  const evaluatedQuestions = questions.map((question, index) => {
    const answer = answers[index];
    const isSkipped = !isQuestionAnswered(answer);
    const isCorrect = !isSkipped && isAnswerCorrect(question, answer);

    const topic = getQuestionDomain(question);
    topicStats[topic] ??= createEmptyTopicStat();
    topicStats[topic].total += 1;

    const difficulty = normalizeDifficulty(question.difficulty);
    difficultyStats[difficulty].total += 1;

    if (isSkipped) {
      skippedCount += 1;
    } else if (isCorrect) {
      correctCount += 1;
      topicStats[topic].correct += 1;
      difficultyStats[difficulty].correct += 1;
    } else {
      incorrectCount += 1;
    }

    return { question, answer, isCorrect, isSkipped };
  });

  const percentage = questions.length === 0 ? 0 : Math.round((correctCount / questions.length) * 100);
  let strongestTopic = { topic: 'N/A', percentage: 0 };
  let weakestTopic = { topic: 'N/A', percentage: 0 };

  for (const [topic, stats] of Object.entries(topicStats)) {
    const topicPercentage = stats.total === 0 ? 0 : Math.round((stats.correct / stats.total) * 100);
    if (strongestTopic.topic === 'N/A' || topicPercentage > strongestTopic.percentage) {
      strongestTopic = { topic, percentage: topicPercentage };
    }
    if (weakestTopic.topic === 'N/A' || topicPercentage < weakestTopic.percentage) {
      weakestTopic = { topic, percentage: topicPercentage };
    }
  }

  return {
    correctCount,
    incorrectCount,
    skippedCount,
    percentage,
    passed: percentage >= 80,
    topicStats,
    difficultyStats,
    strongestTopic,
    weakestTopic,
    evaluatedQuestions,
  };
};
