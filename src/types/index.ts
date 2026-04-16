// src/types/index.ts

export type Difficulty = 'easy' | 'medium' | 'hard' | 'unrated';
export type ExamMode = 'preset' | 'random' | 'remediation';
export type ExamTrack = 'exam_parity' | 'hard_mode';
export type ExperienceBand = '2_5' | '6_10' | '11_15';
export type QuestionKind = 'single' | 'multiple';
export type AnswerValue = number | number[];
export type AnswerMap = Record<number, AnswerValue>;
export type StoredAnswerMap = Record<string, AnswerValue | null>;

export interface Question {
  id: number;
  domain?: string;
  objective?: string;
  sourceManual?: string;
  sourceSection?: string;
  misconceptionTag?: string;
  releaseVersion?: string;
  topic: string;
  difficulty: Difficulty;
  type?: QuestionKind;
  question: string;
  codeSnippet?: string;
  options: string[];
  correctAnswer: AnswerValue;
  explanation: string;
  status?: 'active' | 'skipped' | 'deleted';
  isOverride?: boolean;
  baseQuestionId?: number;
}

export interface QuestionAdminOverride {
  id: string;
  questionId: number;
  status?: 'active' | 'skipped' | 'deleted';
  domain?: string;
  objective?: string;
  sourceManual?: string;
  sourceSection?: string;
  misconceptionTag?: string;
  releaseVersion?: string;
  topic?: string;
  difficulty?: Difficulty;
  type?: QuestionKind;
  question?: string;
  codeSnippet?: string;
  options?: string[];
  correctAnswer?: AnswerValue;
  explanation?: string;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface QuestionResult {
  questionId: number;
  correct: boolean;
  skipped: boolean;
  timeTaken: number; // seconds
}

export interface SessionParticipant {
  id?: string;
  sessionId: string;
  sessionName: string;
  candidateName: string;
  candidateEmail?: string;
  startedAt: string;
  submittedAt?: string;
  status: 'in_progress' | 'completed' | 'timed_out';
  retakeNumber: number;
  score?: number;
  passed?: boolean;
}

export interface ExamResult {
  docId?: string;
  attemptId?: string;
  examineeName: string;
  examMode: ExamMode;
  examTrack?: ExamTrack;
  experienceBand?: ExperienceBand;
  scorePercentage: number;
  questionsAnsweredCorrectly: number;
  totalQuestions: number;
  passed: boolean;
  strongestDomain: string;
  weakestDomain: string;
  readinessBand?: 'high' | 'borderline' | 'developing';
  benchmarkMessage?: string;
  scoreInterpretation?: string;
  recommendedFocus?: string[];
  timeTakenSeconds: number;
  examDate: string;
  sessionId?: string;
  sessionName?: string;
  candidateEmail?: string;
  participantId?: string;
  questionResults?: QuestionResult[];
  submittedAnswers?: StoredAnswerMap;
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
  startsAt?: string;
  maxRetakes?: number;
  allowedCandidates?: string[];
  isBuiltIn?: boolean;
}

export interface Preset {
  id: string;
  name: string;
  targetCount: number;
  questions: number[];
  updatedAt: string;
  timeLimitMinutes?: number;
  examTrack?: ExamTrack;
  difficultyProfile?: 'easy_medium' | 'medium_hard';
  difficultyLabel?: string;
  multiSelectRatio?: number;
  isBuiltIn?: boolean;
  showOnHome?: boolean;
  assessmentType?: 'mock' | 'interview';
  roleFocus?: 'functional' | 'technical' | 'architect' | 'mixed';
}

export interface ExamConfig {
  examineeName: string;
  mode: ExamMode;
  track: ExamTrack;
  resultAttemptId?: string;
  presetLabel?: string;
  targetCount: number;
  timeLimitMinutes?: number;
  presetId?: string | null;
  presetQuestionIds?: number[] | null;
  experienceBand?: ExperienceBand;
  sessionId?: string;
  sessionName?: string;
  candidateEmail?: string;
  participantId?: string;
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

export interface AuditLogEntry {
  id?: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  actorEmail?: string;
  createdAt: string;
  details?: Record<string, unknown>;
}

export interface RecentAttemptSnapshot {
  examineeName: string;
  examDate: string;
  scorePercentage: number;
  passed: boolean;
  examTrack: ExamTrack;
  readinessBand?: 'high' | 'borderline' | 'developing';
  benchmarkMessage?: string;
  scoreInterpretation?: string;
  weakestDomain: string;
  strongestDomain: string;
  recommendedFocus?: string[];
}

export interface StudyPlanSnapshot {
  generatedAt: string;
  examineeName: string;
  examTrack: ExamTrack;
  readinessBand?: 'high' | 'borderline' | 'developing';
  headline: string;
  weakestDomain: string;
  scoreInterpretation?: string;
  days: Array<{
    title: string;
    focus: string;
    action: string;
  }>;
}
