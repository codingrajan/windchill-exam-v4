import { EXPERIENCE_LABELS, TRACK_PROFILES } from '../constants/examStrategy';
import type { EvaluationSummary, ExamResult, ExamTrack, ExperienceBand } from '../types/index';

export interface ReadinessInsights {
  readinessBand: 'high' | 'borderline' | 'developing';
  benchmarkMessage: string;
  scoreInterpretation: string;
  focusAreas: string[];
  summaryNote: string;
}

export interface HistoryInsights {
  attemptCount: number;
  latestScore: number;
  bestScore: number;
  passRate: number;
  trendLabel: 'improving' | 'steady' | 'declining';
  readinessHeadline: string;
  priorityFocus: string[];
}

export const getTrackProfile = (track: ExamTrack) => TRACK_PROFILES[track];

export function buildReadinessInsights(
  summary: EvaluationSummary,
  track: ExamTrack,
  experienceBand?: ExperienceBand,
): ReadinessInsights {
  const benchmarkMessage = TRACK_PROFILES[track].benchmarkMessage;
  const scoreInterpretation =
    track === 'hard_mode'
      ? summary.percentage >= 80
        ? 'Hard Mode score is already above the live-exam pass mark. Treat this as strong readiness.'
        : summary.percentage >= 72
          ? 'Hard Mode score is below 80%, but it is still within a credible live-exam readiness band.'
          : 'Hard Mode score is materially below live-exam readiness. Use recovery drills before the next full mock.'
      : summary.percentage >= 80
        ? 'Exam-Parity score is above the live-exam pass mark. Maintain depth and avoid careless misses.'
        : 'Exam-Parity score is below the live-exam pass mark. Close the gap before relying on exam readiness.';
  const threshold = track === 'hard_mode' ? 72 : 80;
  const readinessBand =
    summary.percentage >= threshold + 8
      ? 'high'
      : summary.percentage >= threshold
        ? 'borderline'
        : 'developing';

  const focusAreas = new Set<string>();

  if (summary.weakestTopic.topic !== 'N/A') {
    focusAreas.add(`Rework ${summary.weakestTopic.topic} first.`);
  }

  if (summary.skippedCount >= Math.max(3, Math.round((summary.correctCount + summary.incorrectCount + summary.skippedCount) * 0.08))) {
    focusAreas.add('Run a timed drill to reduce skips under pressure.');
  }

  const hardAccuracy =
    summary.difficultyStats.hard.total > 0
      ? Math.round((summary.difficultyStats.hard.correct / summary.difficultyStats.hard.total) * 100)
      : null;

  if (hardAccuracy !== null && hardAccuracy < 60) {
    focusAreas.add('Prioritize hard questions around architecture, OIR precedence, and workflow nuance.');
  }

  if (summary.strongestTopic.topic !== 'N/A') {
    focusAreas.add(`Use ${summary.strongestTopic.topic} as a confidence-maintenance domain, not a revision sink.`);
  }

  const experienceNote = experienceBand ? `Profile: ${EXPERIENCE_LABELS[experienceBand]}.` : 'Profile: experience not specified.';
  const summaryNote =
    readinessBand === 'high'
      ? `${experienceNote} You are operating above the target readiness band for this track.`
      : readinessBand === 'borderline'
        ? `${experienceNote} You are near the target band; tighten weak domains before the live exam.`
        : `${experienceNote} You need another focused cycle before treating yourself as exam-ready.`;

  return {
    readinessBand,
    benchmarkMessage,
    scoreInterpretation,
    focusAreas: [...focusAreas].slice(0, 4),
    summaryNote,
  };
}

export function buildHistoryInsights(results: ExamResult[]): HistoryInsights | null {
  if (results.length === 0) return null;

  const latest = results[0];
  const bestScore = Math.max(...results.map((result) => result.scorePercentage));
  const passRate = Math.round((results.filter((result) => result.passed).length / results.length) * 100);
  const recentWindow = results.slice(0, Math.min(3, results.length));
  const priorWindow = results.slice(3, 6);
  const recentAverage = Math.round(recentWindow.reduce((sum, result) => sum + result.scorePercentage, 0) / recentWindow.length);
  const priorAverage =
    priorWindow.length > 0
      ? Math.round(priorWindow.reduce((sum, result) => sum + result.scorePercentage, 0) / priorWindow.length)
      : recentAverage;

  const delta = recentAverage - priorAverage;
  const trendLabel = delta >= 4 ? 'improving' : delta <= -4 ? 'declining' : 'steady';

  const weakestCounts = new Map<string, number>();
  const focusCounts = new Map<string, number>();

  results.forEach((result) => {
    if (result.weakestDomain && result.weakestDomain !== 'N/A') {
      weakestCounts.set(result.weakestDomain, (weakestCounts.get(result.weakestDomain) ?? 0) + 1);
    }
    (result.recommendedFocus ?? []).forEach((focus) => {
      focusCounts.set(focus, (focusCounts.get(focus) ?? 0) + 1);
    });
  });

  const priorityFocus = [...focusCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([focus]) => focus);

  if (priorityFocus.length === 0) {
    const repeatedWeakest = [...weakestCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 2)
      .map(([domain]) => `Rework ${domain} before your next full mock.`);
    priorityFocus.push(...repeatedWeakest);
  }

  const readinessHeadline =
    latest.readinessBand === 'high'
      ? 'Live-exam readiness is strong. Protect the floor and avoid regression.'
      : latest.readinessBand === 'borderline'
        ? 'You are close to the target band. Tighten weak domains before the live exam.'
        : 'Readiness is not stable yet. Use shorter recovery drills before another full attempt.';

  return {
    attemptCount: results.length,
    latestScore: latest.scorePercentage,
    bestScore,
    passRate,
    trendLabel,
    readinessHeadline: latest.scoreInterpretation ?? readinessHeadline,
    priorityFocus,
  };
}
