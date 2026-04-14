import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const inputPath = path.join(rootDir, 'reports', 'section_gap_plan.json');
const outputJsonPath = path.join(rootDir, 'reports', 'section_authoring_tranches.json');
const outputMdPath = path.join(rootDir, 'reports', 'section_authoring_tranches.md');

const { summary, rows } = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

const tranches = [
  {
    name: 'Tranche 1 - Critical And High Sections',
    priorities: new Set(['critical', 'high']),
  },
  {
    name: 'Tranche 2 - Medium Sections',
    priorities: new Set(['medium']),
  },
  {
    name: 'Tranche 3 - Low Sections',
    priorities: new Set(['low']),
  },
];

const trancheRows = tranches.map((tranche) => {
  const items = rows.filter((row) => row.gap > 0 && tranche.priorities.has(row.priority));
  return {
    name: tranche.name,
    sectionCount: items.length,
    newQuestions: items.reduce((sum, row) => sum + row.gap, 0),
    recommendedMix: items.reduce(
      (acc, row) => ({
        easy: acc.easy + row.recommendedNewQuestions.easy,
        medium: acc.medium + row.recommendedNewQuestions.medium,
        hard: acc.hard + row.recommendedNewQuestions.hard,
      }),
      { easy: 0, medium: 0, hard: 0 },
    ),
    items,
  };
});

const payload = {
  generatedAt: new Date().toISOString(),
  targetFloor: summary.targetFloor,
  totalNewQuestionsNeededToReachFloor: summary.totalNewQuestionsNeededToReachFloor,
  tranches: trancheRows,
};

const markdown = [
  '# Section Authoring Tranches',
  '',
  `- Generated: ${payload.generatedAt}`,
  `- Target minimum per section: ${payload.targetFloor}`,
  `- Total new questions needed: ${payload.totalNewQuestionsNeededToReachFloor}`,
  '',
  ...trancheRows.flatMap((tranche) => [
    `## ${tranche.name}`,
    '',
    `- Sections: ${tranche.sectionCount}`,
    `- New questions: ${tranche.newQuestions}`,
    `- Difficulty target: easy ${tranche.recommendedMix.easy}, medium ${tranche.recommendedMix.medium}, hard ${tranche.recommendedMix.hard}`,
    '',
    '| Section | Current | Gap | Priority | New Questions | Sample IDs |',
    '|---|---:|---:|---|---|---|',
    ...tranche.items.map(
      (item) =>
        `| ${item.section} | ${item.total} | ${item.gap} | ${item.priority} | easy ${item.recommendedNewQuestions.easy}, medium ${item.recommendedNewQuestions.medium}, hard ${item.recommendedNewQuestions.hard} | ${item.sampleIds.join(', ')} |`,
    ),
    '',
  ]),
];

fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
fs.writeFileSync(outputMdPath, markdown.join('\n'), 'utf8');

console.log(`Authoring tranche JSON written to ${path.relative(rootDir, outputJsonPath)}`);
console.log(`Authoring tranche Markdown written to ${path.relative(rootDir, outputMdPath)}`);
