import { TRACK_PROFILES } from '../constants/examStrategy';
import type { EvaluationSummary, ExamResult, ExamTrack } from '../types/index';

export interface ReadinessInsights {
  focusAreas: string[];
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

export interface ReviewCoachingSummary {
  wrongCount: number;
  skippedCount: number;
  lossDrivers: Array<{ title: string; evidence: string }>;
  studyMap: Array<{ section: string; manual: string; sourceSection: string; missed: number; total: number; accuracy: number }>;
  misconceptionPatterns: Array<{ label: string; count: number; action: string }>;
  nextActions: Array<{ title: string; evidence: string; action: string }>;
  nextTest: { label: string; reason: string } | null;
}

export const getTrackProfile = (track: ExamTrack) => TRACK_PROFILES[track];

export function buildReadinessInsights(summary: EvaluationSummary): ReadinessInsights {
  const focusAreas: string[] = [];
  const totalAnswered = summary.correctCount + summary.incorrectCount + summary.skippedCount;

  if (summary.weakestTopic.topic !== 'N/A') {
    const weakestStats = summary.topicStats[summary.weakestTopic.topic];
    if (weakestStats) {
      focusAreas.push(
        `Repair ${summary.weakestTopic.topic}: ${weakestStats.correct}/${weakestStats.total} correct (${summary.weakestTopic.percentage}%).`,
      );
    }
  }

  if (summary.skippedCount >= Math.max(3, Math.round(totalAnswered * 0.08))) {
    focusAreas.push(`Cut skips under pressure: ${summary.skippedCount} question${summary.skippedCount === 1 ? '' : 's'} left unanswered.`);
  }

  const hardAccuracy =
    summary.difficultyStats.hard.total > 0
      ? Math.round((summary.difficultyStats.hard.correct / summary.difficultyStats.hard.total) * 100)
      : null;

  if (hardAccuracy !== null && hardAccuracy < 60) {
    focusAreas.push(`Raise hard-question control: ${summary.difficultyStats.hard.correct}/${summary.difficultyStats.hard.total} correct (${hardAccuracy}%).`);
  }

  if (summary.strongestTopic.topic !== 'N/A') {
    focusAreas.push(`Maintain ${summary.strongestTopic.topic} as a strength anchor (${summary.strongestTopic.percentage}%).`);
  }

  return {
    focusAreas: focusAreas.slice(0, 4),
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

  return {
    attemptCount: results.length,
    latestScore: latest.scorePercentage,
    bestScore,
    passRate,
    trendLabel,
    readinessHeadline: latest.examTrack ? TRACK_PROFILES[latest.examTrack].description : 'Performance summary from saved attempts.',
    priorityFocus,
  };
}

export function buildReviewCoachingSummary(
  items: Array<{
    correct: boolean;
    skipped: boolean;
    objective?: string;
    misconceptionTag?: string;
    domain?: string;
    sourceManual?: string;
    sourceSection?: string;
    difficulty?: 'easy' | 'medium' | 'hard' | 'unrated';
  }>,
  options: { scorePercentage?: number } = {},
): ReviewCoachingSummary {
  const normalizeLabel = (value: string | undefined) =>
    (value ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  const wrongItems = items.filter((item) => !item.correct && !item.skipped);
  const skippedItems = items.filter((item) => item.skipped);
  const misconceptionCounts = new Map<string, number>();
  const objectiveCounts = new Map<string, { count: number; manual?: string; sourceSection?: string }>();
  const domainStats = new Map<string, { wrong: number; skipped: number; total: number; correct: number }>();
  const studyMapStats = new Map<string, { section: string; manual: string; sourceSection: string; missed: number; total: number; correct: number }>();
  const hardStats = { wrong: 0, total: 0 };
  const scorePercentage = options.scorePercentage ?? 0;

  [...wrongItems, ...skippedItems].forEach((item) => {
    if (item.misconceptionTag) {
      misconceptionCounts.set(item.misconceptionTag, (misconceptionCounts.get(item.misconceptionTag) ?? 0) + 1);
    }
    if (item.objective) {
      const previous = objectiveCounts.get(item.objective) ?? { count: 0, manual: item.sourceManual, sourceSection: item.sourceSection };
      objectiveCounts.set(item.objective, {
        count: previous.count + 1,
        manual: previous.manual ?? item.sourceManual,
        sourceSection: previous.sourceSection ?? item.sourceSection,
      });
    }
  });

  items.forEach((item) => {
    if (item.domain) {
      const stats = domainStats.get(item.domain) ?? { wrong: 0, skipped: 0, total: 0, correct: 0 };
      stats.total += 1;
      if (item.correct) stats.correct += 1;
      else if (item.skipped) stats.skipped += 1;
      else stats.wrong += 1;
      domainStats.set(item.domain, stats);
    }
    const manual = item.sourceManual || 'Manual section mapping unavailable';
    const sourceSection = item.sourceSection || item.domain || 'Section mapping unavailable';
    const studyKey = `${item.domain || 'Unclassified'}__${manual}__${sourceSection}`;
    const studyStats = studyMapStats.get(studyKey) ?? {
      section: item.domain || 'Unclassified',
      manual,
      sourceSection,
      missed: 0,
      total: 0,
      correct: 0,
    };
    studyStats.total += 1;
    if (item.correct) studyStats.correct += 1;
    else studyStats.missed += 1;
    studyMapStats.set(studyKey, studyStats);

    if (item.difficulty === 'hard') {
      hardStats.total += 1;
      if (!item.correct) hardStats.wrong += 1;
    }
  });

  const objectiveMap = [...objectiveCounts.entries()]
    .sort((left, right) => right[1].count - left[1].count)
    .slice(0, 3)
    .map(([label, detail]) => ({
      label,
      count: detail.count,
      manual: detail.manual || 'Manual section mapping unavailable',
      sourceSection: detail.sourceSection || 'Section mapping unavailable',
      action: 'Rework the governing rule and then test yourself on when this objective applies versus the nearest look-alike concept.',
    }));

  const topSections = [...domainStats.entries()]
    .map(([label, stats]) => ({
      label,
      wrong: stats.wrong,
      skipped: stats.skipped,
      total: stats.total,
      accuracy: stats.total === 0 ? 0 : Math.round((stats.correct / stats.total) * 100),
    }))
    .sort((left, right) => (right.wrong + right.skipped) - (left.wrong + left.skipped) || left.accuracy - right.accuracy)
    .slice(0, 3);

  const studyMap = [...studyMapStats.values()]
    .map((item) => ({
      section: item.section,
      manual: item.manual,
      sourceSection: item.sourceSection,
      missed: item.missed,
      total: item.total,
      accuracy: item.total === 0 ? 0 : Math.round((item.correct / item.total) * 100),
    }))
    .filter((item) => item.missed > 0)
    .sort((left, right) => right.missed - left.missed || left.accuracy - right.accuracy)
    .slice(0, 4);
  const studyTokens = new Set(
    studyMap.flatMap((item) => [normalizeLabel(item.section), normalizeLabel(item.sourceSection)]).filter(Boolean),
  );
  const objectiveTokens = new Set(objectiveMap.map((item) => normalizeLabel(item.label)).filter(Boolean));
  const misconceptionPatterns = [...misconceptionCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .filter(([label]) => {
      const token = normalizeLabel(label);
      if (!token) return false;
      if (studyTokens.has(token) || objectiveTokens.has(token)) return false;
      return ![...studyTokens, ...objectiveTokens].some((existing) => existing.includes(token) || token.includes(existing));
    })
    .slice(0, 3)
    .map(([label, count]) => ({
      label,
      count,
      action: 'Contrast the correct rule against the look-alike distractor and write down the deciding condition.',
    }));

  const lossDrivers: Array<{ title: string; evidence: string }> = [];
  if (topSections[0]) {
    lossDrivers.push({
      title: `Section weakness: ${topSections[0].label}`,
      evidence: `${topSections[0].wrong} wrong and ${topSections[0].skipped} skipped answers came from this section at ${topSections[0].accuracy}% accuracy.`,
    });
  }
  if (misconceptionPatterns[0]) {
    lossDrivers.push({
      title: `Repeated misconception: ${misconceptionPatterns[0].label}`,
      evidence: `${misconceptionPatterns[0].count} mistakes followed the same misunderstanding pattern.`,
    });
  }
  if (skippedItems.length >= 3) {
    lossDrivers.push({
      title: 'Completion pressure',
      evidence: `${skippedItems.length} questions were left unanswered, which indicates time loss or low-confidence decision making.`,
    });
  } else if (hardStats.total > 0 && hardStats.wrong >= Math.ceil(hardStats.total / 2)) {
    lossDrivers.push({
      title: 'Hard-question judgement',
      evidence: `${hardStats.wrong} of ${hardStats.total} hard questions were missed or skipped.`,
    });
  }

  const nextActions: Array<{ title: string; evidence: string; action: string }> = [];
  if (studyMap[0]) {
    nextActions.push({
      title: `Study ${studyMap[0].section}`,
      evidence: `${studyMap[0].missed} missed or skipped questions map to ${studyMap[0].manual} -> ${studyMap[0].sourceSection}.`,
      action: 'Read this manual section first, then do a short drill focused on the same section before attempting another full mock.',
    });
  }
  if (objectiveMap[0] && normalizeLabel(objectiveMap[0].label) !== normalizeLabel(studyMap[0]?.section) && normalizeLabel(objectiveMap[0].label) !== normalizeLabel(studyMap[0]?.sourceSection)) {
    nextActions.push({
      title: `Repair objective: ${objectiveMap[0].label}`,
      evidence: `${objectiveMap[0].count} misses point back to ${objectiveMap[0].manual} -> ${objectiveMap[0].sourceSection}.`,
      action: objectiveMap[0].action,
    });
  }
  if (misconceptionPatterns[0]) {
    nextActions.push({
      title: `Fix misconception: ${misconceptionPatterns[0].label}`,
      evidence: `${misconceptionPatterns[0].count} questions were lost to the same distractor family.`,
      action: misconceptionPatterns[0].action,
    });
  }
  if (skippedItems.length >= 3) {
    nextActions.push({
      title: 'Reduce unanswered questions',
      evidence: `${skippedItems.length} question${skippedItems.length === 1 ? '' : 's'} were skipped.`,
      action: 'Run one timed recovery set and force a decision on every question within the first pass.',
    });
  } else if (hardStats.total > 0 && hardStats.wrong >= Math.ceil(hardStats.total / 2)) {
    nextActions.push({
      title: 'Strengthen hard-question judgement',
      evidence: `${hardStats.wrong} of ${hardStats.total} hard questions were missed or skipped.`,
      action: 'Prioritize harder workflow, architecture, configuration, and precedence questions before the next mock.',
    });
  }

  let nextTest: { label: string; reason: string } | null = null;
  const apiSignal =
    studyMap.some((item) => /api|method server|customization|service/i.test(item.section) || /api|service|method/i.test(item.sourceSection)) ||
    objectiveMap.some((item) => /api|service|method/i.test(item.label));
  if (apiSignal) {
    nextTest = {
      label: 'API 10 - Customization Sprint',
      reason: 'Your misses show Java API or service-level weakness. Use the short API sprint to isolate that gap before another full exam.',
    };
  } else if (skippedItems.length >= 3 || scorePercentage < 60) {
    nextTest = {
      label: 'Sprint 25 - Confidence Builder',
      reason: 'You need a shorter reset focused on completion and core fundamentals before taking another longer paper.',
    };
  } else if (hardStats.total > 0 && hardStats.wrong >= Math.ceil(hardStats.total / 2)) {
    nextTest = {
      label: scorePercentage >= 75 ? 'Summit 75 - Hardline Simulation' : 'Forge 50 - Expert Challenge',
      reason: 'Your main gap is judgement under harder questions, so the next test should deliberately keep that pressure on.',
    };
  } else if (scorePercentage >= 80) {
    nextTest = {
      label: 'Summit 75 - Full Preparation',
      reason: 'You are close enough to benefit from a broader long-form validation pass across more sections.',
    };
  } else {
    nextTest = {
      label: 'Forge 50 - Applied Readiness',
      reason: 'You need another balanced rehearsal that is longer than a sprint but not yet the hardest simulation.',
    };
  }

  return {
    wrongCount: wrongItems.length,
    skippedCount: skippedItems.length,
    lossDrivers: lossDrivers.slice(0, 3),
    studyMap,
    misconceptionPatterns,
    nextActions: nextActions.slice(0, 4),
    nextTest,
  };
}
