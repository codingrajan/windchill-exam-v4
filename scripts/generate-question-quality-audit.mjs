import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const dataDir = path.join(rootDir, 'public', 'data');
const reportsDir = path.join(rootDir, 'reports');
const outputJsonPath = path.join(reportsDir, 'question_quality_audit.json');
const outputMdPath = path.join(reportsDir, 'question_quality_audit.md');

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

const normalize = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const jaccard = (left, right) => {
  const leftSet = new Set(normalize(left).split(' ').filter(Boolean));
  const rightSet = new Set(normalize(right).split(' ').filter(Boolean));
  const intersection = [...leftSet].filter((token) => rightSet.has(token)).length;
  const union = new Set([...leftSet, ...rightSet]).size || 1;
  return intersection / union;
};

const duplicateOptions = [];
const similarOptions = [];
const multiAnswerMismatch = [];
const textHygiene = [];

for (const question of questions) {
  const options = Array.isArray(question.options) ? question.options : [];
  const stem = String(question.question || '').toLowerCase();
  const expectsMulti =
    /choose\s*2|choose\s*two|select\s*2|select\s*two|choose\s*3|choose\s*three|select\s*3|select\s*three/.test(stem);
  const isMulti = Array.isArray(question.correctAnswer);

  if (expectsMulti !== isMulti) {
    multiAnswerMismatch.push({
      id: question.id,
      file: question.__file,
      question: question.question,
    });
  }

  for (let index = 0; index < options.length; index += 1) {
    const option = options[index];
    if (/^\s|\s$|\s{2,}/.test(option)) {
      textHygiene.push({
        id: question.id,
        file: question.__file,
        issue: 'whitespace',
        optionIndex: index,
        option,
      });
    }

    for (let next = index + 1; next < options.length; next += 1) {
      const score = jaccard(option, options[next]);
      if (normalize(option) === normalize(options[next])) {
        duplicateOptions.push({
          id: question.id,
          file: question.__file,
          firstOption: index,
          secondOption: next,
          option,
        });
      } else if (score >= 0.72) {
        similarOptions.push({
          id: question.id,
          file: question.__file,
          score: Number(score.toFixed(2)),
          firstOption: index,
          secondOption: next,
          firstText: option,
          secondText: options[next],
          correctAnswer: question.correctAnswer,
          question: question.question,
        });
      }
    }
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  totalQuestions: questions.length,
  duplicateOptionPairs: duplicateOptions.length,
  similarOptionPairs: similarOptions.length,
  multiAnswerMismatch: multiAnswerMismatch.length,
  textHygieneIssues: textHygiene.length,
};

const payload = {
  summary,
  duplicateOptions,
  similarOptions,
  multiAnswerMismatch,
  textHygiene,
};

const markdown = [
  '# Question Quality Audit',
  '',
  `- Generated: ${summary.generatedAt}`,
  `- Total questions: ${summary.totalQuestions}`,
  `- Duplicate option pairs: ${summary.duplicateOptionPairs}`,
  `- Similar option pairs: ${summary.similarOptionPairs}`,
  `- Multi-answer mismatches: ${summary.multiAnswerMismatch}`,
  `- Text hygiene issues: ${summary.textHygieneIssues}`,
  '',
  '## Similar Option Pairs',
  '',
  '| ID | File | Score | Question | Pair |',
  '|---|---|---:|---|---|',
  ...similarOptions.map(
    (item) =>
      `| ${item.id} | ${item.file} | ${item.score} | ${item.question.replace(/\|/g, '\\|')} | ${item.firstText.replace(/\|/g, '\\|')} / ${item.secondText.replace(/\|/g, '\\|')} |`,
  ),
  '',
  '## Duplicate Option Pairs',
  '',
  '| ID | File | Option |',
  '|---|---|---|',
  ...duplicateOptions.map((item) => `| ${item.id} | ${item.file} | ${item.option.replace(/\|/g, '\\|')} |`),
  '',
  '## Multi-Answer Mismatches',
  '',
  '| ID | File | Question |',
  '|---|---|---|',
  ...multiAnswerMismatch.map((item) => `| ${item.id} | ${item.file} | ${item.question.replace(/\|/g, '\\|')} |`),
  '',
  '## Text Hygiene Issues',
  '',
  '| ID | File | Issue | Option |',
  '|---|---|---|---|',
  ...textHygiene.map((item) => `| ${item.id} | ${item.file} | ${item.issue} | ${item.option.replace(/\|/g, '\\|')} |`),
  '',
];

fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
fs.writeFileSync(outputMdPath, markdown.join('\n'), 'utf8');

console.log(`Question quality audit JSON written to ${path.relative(rootDir, outputJsonPath)}`);
console.log(`Question quality audit Markdown written to ${path.relative(rootDir, outputMdPath)}`);
