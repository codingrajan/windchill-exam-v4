// src/types/index.ts

export type Difficulty = 'easy' | 'medium' | 'hard' | 'unrated';
export type ExamMode = 'preset' | 'random';
export type QuestionKind = 'single' | 'multiple';
export type AnswerValue = number | number[];
export type AnswerMap = Record<number, AnswerValue>;

export interface Question {
  id: number;
  domain?: string;
  objective?: string;
  topic: string;
  difficulty: Difficulty;
  type?: QuestionKind;
  question: string;
  options: string[];
  correctAnswer: AnswerValue;
  explanation: string;
}

export interface ExamResult {
  examineeName: string;
  examMode: ExamMode;
  scorePercentage: number;
  questionsAnsweredCorrectly: number;
  totalQuestions: number;
  passed: boolean;
  strongestDomain: string;
  weakestDomain: string;
  timeTakenSeconds: number;
  examDate: string;
  sessionId?: string;
  sessionName?: string;
}

export interface ExamSession {
  id: string;
  name: string;
  presetId: string;
  presetName: string;
  accessCode: string;
  isActive: boolean;
  createdAt: string;
  expiresAt?: string;
}

export interface Preset {
  id: string;
  name: string;
  targetCount: number;
  questions: number[];
  updatedAt: string;
}

export interface ExamConfig {
  examineeName: string;
  mode: ExamMode;
  targetCount: number;
  presetId?: string | null;
  presetQuestionIds?: number[] | null;
  sessionId?: string;
  sessionName?: string;
}

export interface EvaluatedQuestion {
  question: Question;
  answer: AnswerValue | undefined;
  isCorrect: boolean;
  isSkipped: boolean;
}

export interface TopicStat {
  correct: number;
  total: number;
}

export interface EvaluationSummary {
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  percentage: number;
  passed: boolean;
  topicStats: Record<string, TopicStat>;
  difficultyStats: Record<Difficulty, TopicStat>;
  strongestTopic: { topic: string; percentage: number };
  weakestTopic: { topic: string; percentage: number };
  evaluatedQuestions: EvaluatedQuestion[];
}
