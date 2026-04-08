import type { Difficulty, ExamTrack, ExperienceBand } from '../types/index';

export interface TrackProfile {
  id: ExamTrack;
  label: string;
  shortLabel: string;
  description: string;
  benchmarkMessage: string;
  difficultyTargets: Record<Difficulty, number>;
  multiSelectRatio: number;
}

export const TRACK_PROFILES: Record<ExamTrack, TrackProfile> = {
  exam_parity: {
    id: 'exam_parity',
    label: 'Exam-Parity Simulation',
    shortLabel: 'Exam-Parity',
    description: 'Balanced distribution for realistic certification rehearsal.',
    benchmarkMessage: 'Benchmarked to resemble expected certification pacing and mix.',
    difficultyTargets: { easy: 0.22, medium: 0.48, hard: 0.2, unrated: 0.1 },
    multiSelectRatio: 0.1,
  },
  hard_mode: {
    id: 'hard_mode',
    label: 'Hard-Mode Readiness',
    shortLabel: 'Hard Mode',
    description: 'Intentionally tougher mix to overprepare candidates before the actual exam.',
    benchmarkMessage: 'Harder-than-exam benchmark. Lower scores can still indicate near-ready status.',
    difficultyTargets: { easy: 0.08, medium: 0.44, hard: 0.38, unrated: 0.1 },
    multiSelectRatio: 0.14,
  },
};

export const EXPERIENCE_LABELS: Record<ExperienceBand, string> = {
  '2_5': '2-5 Years',
  '6_10': '6-10 Years',
  '11_15': '11-15 Years',
};

export const EXAM_DOMAIN_BLUEPRINT = [
  { domain: 'Architecture, Installation, and Integration', weight: 0.1 },
  { domain: 'Contexts, Preferences, and Business Administration', weight: 0.12 },
  { domain: 'Data Model, Types, and Attributes', weight: 0.1 },
  { domain: 'Lifecycle, Workflow, and Object Initialization', weight: 0.18 },
  { domain: 'Access Control, Teams, and Security', weight: 0.1 },
  { domain: 'Change and Release Management', weight: 0.1 },
  { domain: 'Configuration Management and Product Structures', weight: 0.08 },
  { domain: 'CAD Data Management and Visualization', weight: 0.09 },
  { domain: 'System Administration, Vaulting, and Performance', weight: 0.09 },
  { domain: 'PLM Strategy and Foundations', weight: 0.04 },
  { domain: 'Navigate and Role-Based Consumption', weight: 0.04 },
] as const;
