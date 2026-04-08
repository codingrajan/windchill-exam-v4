import type { ExamTrack, StudyPlanSnapshot } from '../types/index';

export function buildStudyPlan(input: {
  examineeName: string;
  examTrack: ExamTrack;
  readinessBand?: 'high' | 'borderline' | 'developing';
  weakestDomain: string;
  strongestDomain: string;
  focusAreas: string[];
  scoreInterpretation?: string;
}): StudyPlanSnapshot {
  const headline =
    input.readinessBand === 'high'
      ? 'Protect the pass line. Focus on weak-domain precision and pressure handling.'
      : input.readinessBand === 'borderline'
        ? 'Close the final gap with targeted drills before another full mock.'
        : 'Rebuild readiness through short cycles before attempting another full simulation.';

  const focusOne = input.focusAreas[0] ?? `Rework ${input.weakestDomain} first.`;
  const focusTwo = input.focusAreas[1] ?? 'Run a timed drill to reduce skips and hesitation.';
  const focusThree = input.focusAreas[2] ?? `Use ${input.strongestDomain} as a confidence-maintenance block.`;

  return {
    generatedAt: new Date().toISOString(),
    examineeName: input.examineeName,
    examTrack: input.examTrack,
    readinessBand: input.readinessBand,
    headline,
    weakestDomain: input.weakestDomain,
    scoreInterpretation: input.scoreInterpretation,
    days: [
      {
        title: 'Day 1',
        focus: input.weakestDomain,
        action: focusOne,
      },
      {
        title: 'Day 2',
        focus: 'Timed Recovery',
        action: focusTwo,
      },
      {
        title: 'Day 3',
        focus: input.strongestDomain,
        action: focusThree,
      },
      {
        title: 'Day 4',
        focus: input.weakestDomain,
        action: `Run a weak-domain-only quiz for ${input.weakestDomain} and review every miss in detail.`,
      },
      {
        title: 'Day 5',
        focus: input.examTrack === 'hard_mode' ? 'Hard Questions' : 'Exam Parity',
        action:
          input.examTrack === 'hard_mode'
            ? 'Take a timed 15-question recovery set with a hard-question mindset.'
            : 'Take a parity-style mixed quiz and focus on clean execution.',
      },
      {
        title: 'Day 6',
        focus: 'Wrong Answer Repair',
        action: 'Retry wrong-only questions and confirm why each distractor is wrong.',
      },
      {
        title: 'Day 7',
        focus: 'Final Check',
        action: 'Sit one fresh full mock only after the earlier recovery steps are complete.',
      },
    ],
  };
}
