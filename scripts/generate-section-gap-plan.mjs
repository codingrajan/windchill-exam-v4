import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const dataDir = path.join(rootDir, 'public', 'data');
const reportsDir = path.join(rootDir, 'reports');
const outputJsonPath = path.join(reportsDir, 'section_gap_plan.json');
const outputMdPath = path.join(reportsDir, 'section_gap_plan.md');

const TARGET_FLOOR = 8;
const BASE_DIFFICULTY_TARGET = { easy: 0.4, medium: 0.4, hard: 0.2 };

const files = fs
  .readdirSync(dataDir)
  .filter((file) => /^windchill_mock_test_\d+\.json$/.test(file))
  .sort();

const questions = files.flatMap((file) =>
  JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8')).map((question) => ({
    ...question,
    __file: file,
  })),
);

const bySection = new Map();

for (const question of questions) {
  const section = String(question.topic || question.domain || 'Unclassified').trim();
  const difficulty = String(question.difficulty || 'unrated').toLowerCase();

  if (!bySection.has(section)) {
    bySection.set(section, {
      section,
      total: 0,
      easy: 0,
      medium: 0,
      hard: 0,
      unrated: 0,
      sampleIds: [],
      sourceManuals: new Set(),
    });
  }

  const bucket = bySection.get(section);
  bucket.total += 1;
  if (difficulty === 'easy' || difficulty === 'medium' || difficulty === 'hard') bucket[difficulty] += 1;
  else bucket.unrated += 1;
  if (bucket.sampleIds.length < 5) bucket.sampleIds.push(question.id);
  if (question.sourceManual) bucket.sourceManuals.add(question.sourceManual);
}

const rows = [...bySection.values()]
  .sort((left, right) => left.total - right.total || left.section.localeCompare(right.section))
  .map((row) => {
    const gap = Math.max(0, TARGET_FLOOR - row.total);
    const difficultyRatios = row.total
      ? {
          easy: row.easy / row.total,
          medium: row.medium / row.total,
          hard: row.hard / row.total,
        }
      : BASE_DIFFICULTY_TARGET;

    const recommendedMix =
      gap === 0
        ? { easy: 0, medium: 0, hard: 0 }
        : {
            easy: Math.max(1, Math.round(gap * Math.max(BASE_DIFFICULTY_TARGET.easy, 1 - difficultyRatios.easy))),
            medium: Math.max(1, Math.round(gap * Math.max(BASE_DIFFICULTY_TARGET.medium, 1 - difficultyRatios.medium))),
            hard: 0,
          };

    const allocated = recommendedMix.easy + recommendedMix.medium;
    recommendedMix.hard = Math.max(0, gap - allocated);

    while (recommendedMix.easy + recommendedMix.medium + recommendedMix.hard > gap) {
      if (recommendedMix.medium >= recommendedMix.easy && recommendedMix.medium > 0) recommendedMix.medium -= 1;
      else if (recommendedMix.easy > 0) recommendedMix.easy -= 1;
      else break;
    }

    while (recommendedMix.easy + recommendedMix.medium + recommendedMix.hard < gap) {
      if (recommendedMix.medium <= recommendedMix.easy) recommendedMix.medium += 1;
      else recommendedMix.easy += 1;
    }

    const priority =
      row.total <= 2 ? 'critical' :
      row.total <= 4 ? 'high' :
      row.total <= 6 ? 'medium' :
      gap > 0 ? 'low' :
      'stable';

    return {
      section: row.section,
      total: row.total,
      gap,
      priority,
      currentDifficulty: {
        easy: row.easy,
        medium: row.medium,
        hard: row.hard,
        unrated: row.unrated,
      },
      recommendedNewQuestions: recommendedMix,
      sampleIds: row.sampleIds,
      sourceManuals: [...row.sourceManuals],
    };
  });

const summary = {
  generatedAt: new Date().toISOString(),
  totalQuestions: questions.length,
  totalSections: rows.length,
  targetFloor: TARGET_FLOOR,
  sectionsBelowFloor: rows.filter((row) => row.gap > 0).length,
  totalNewQuestionsNeededToReachFloor: rows.reduce((sum, row) => sum + row.gap, 0),
};

const topPriority = rows.filter((row) => row.gap > 0);

const markdown = [
  '# Section Gap Plan',
  '',
  `- Generated: ${summary.generatedAt}`,
  `- Total questions: ${summary.totalQuestions}`,
  `- Total sections: ${summary.totalSections}`,
  `- Target minimum per section: ${summary.targetFloor}`,
  `- Sections below target: ${summary.sectionsBelowFloor}`,
  `- New questions needed to reach floor: ${summary.totalNewQuestionsNeededToReachFloor}`,
  '',
  '## Priority Sections',
  '',
  '| Priority | Section | Current | Gap To Floor | Recommended New Questions | Sample IDs |',
  '|---|---|---:|---:|---|---|',
  ...topPriority.map((row) =>
    `| ${row.priority} | ${row.section} | ${row.total} | ${row.gap} | easy ${row.recommendedNewQuestions.easy}, medium ${row.recommendedNewQuestions.medium}, hard ${row.recommendedNewQuestions.hard} | ${row.sampleIds.join(', ')} |`,
  ),
  '',
  '## Stable Sections',
  '',
  '| Section | Current |',
  '|---|---:|',
  ...rows.filter((row) => row.gap === 0).map((row) => `| ${row.section} | ${row.total} |`),
  '',
];

fs.writeFileSync(outputJsonPath, `${JSON.stringify({ summary, rows }, null, 2)}\n`, 'utf8');
fs.writeFileSync(outputMdPath, markdown.join('\n'), 'utf8');

console.log(`Section gap JSON written to ${path.relative(rootDir, outputJsonPath)}`);
console.log(`Section gap Markdown written to ${path.relative(rootDir, outputMdPath)}`);
