import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const dataDir = path.join(rootDir, 'public', 'data');
const reportsDir = path.join(rootDir, 'reports');
const outputJsonPath = path.join(reportsDir, 'question_hardening_audit.json');
const outputMdPath = path.join(reportsDir, 'question_hardening_audit.md');

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

const wordCount = (value) =>
  String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

const singleAnswerQuestions = questions.filter((question) => Number.isInteger(question.correctAnswer));
const answerDistribution = [0, 0, 0, 0];
for (const question of singleAnswerQuestions) {
  answerDistribution[question.correctAnswer] += 1;
}

const snippetQuestions = questions.filter((question) => question.codeSnippet);
const thinExplanations = questions
  .map((question) => ({
    id: question.id,
    file: question.__file,
    difficulty: question.difficulty,
    topic: question.topic,
    question: question.question,
    explanationWordCount: wordCount(question.explanation),
  }))
  .filter((question) => question.explanationWordCount < 12)
  .sort((left, right) => left.explanationWordCount - right.explanationWordCount || left.id - right.id);

const hardReviewQueue = questions
  .filter((question) => question.difficulty === 'hard')
  .map((question) => ({
    id: question.id,
    file: question.__file,
    topic: question.topic,
    objective: question.objective,
    explanationWordCount: wordCount(question.explanation),
    question: question.question,
  }))
  .sort((left, right) => left.explanationWordCount - right.explanationWordCount || left.id - right.id)
  .slice(0, 50);

const snippetReviewQueue = snippetQuestions.map((question) => ({
  id: question.id,
  file: question.__file,
  topic: question.topic,
  difficulty: question.difficulty,
  question: question.question,
  explanationWordCount: wordCount(question.explanation),
  codeSnippetLineCount: String(question.codeSnippet).split('\n').length,
}));

const perFileAnswerDistribution = files.map((file) => {
  const fileQuestions = questions.filter((question) => question.__file === file && Number.isInteger(question.correctAnswer));
  const counts = [0, 0, 0, 0];
  for (const question of fileQuestions) counts[question.correctAnswer] += 1;
  return {
    file,
    totalSingleAnswerQuestions: fileQuestions.length,
    answerDistribution: {
      A: counts[0],
      B: counts[1],
      C: counts[2],
      D: counts[3],
    },
  };
});

const payload = {
  summary: {
    generatedAt: new Date().toISOString(),
    totalQuestions: questions.length,
    totalHardQuestions: questions.filter((question) => question.difficulty === 'hard').length,
    totalSnippetQuestions: snippetQuestions.length,
    thinExplanationCount: thinExplanations.length,
    singleAnswerDistribution: {
      A: answerDistribution[0],
      B: answerDistribution[1],
      C: answerDistribution[2],
      D: answerDistribution[3],
    },
  },
  thinExplanations,
  hardReviewQueue,
  snippetReviewQueue,
  perFileAnswerDistribution,
};

const markdown = [
  '# Question Hardening Audit',
  '',
  `- Generated: ${payload.summary.generatedAt}`,
  `- Total questions: ${payload.summary.totalQuestions}`,
  `- Hard questions: ${payload.summary.totalHardQuestions}`,
  `- Snippet questions: ${payload.summary.totalSnippetQuestions}`,
  `- Thin explanations (<12 words): ${payload.summary.thinExplanationCount}`,
  `- Single-answer distribution: A ${payload.summary.singleAnswerDistribution.A}, B ${payload.summary.singleAnswerDistribution.B}, C ${payload.summary.singleAnswerDistribution.C}, D ${payload.summary.singleAnswerDistribution.D}`,
  '',
  '## Thin Explanations',
  '',
  '| ID | File | Difficulty | Topic | Words | Question |',
  '|---|---|---|---|---:|---|',
  ...thinExplanations.map(
    (item) =>
      `| ${item.id} | ${item.file} | ${item.difficulty} | ${item.topic} | ${item.explanationWordCount} | ${item.question.replace(/\|/g, '\\|')} |`,
  ),
  '',
  '## Hard Review Queue',
  '',
  '| ID | File | Topic | Words | Question |',
  '|---|---|---|---:|---|',
  ...hardReviewQueue.map(
    (item) =>
      `| ${item.id} | ${item.file} | ${item.topic} | ${item.explanationWordCount} | ${item.question.replace(/\|/g, '\\|')} |`,
  ),
  '',
  '## Snippet Review Queue',
  '',
  '| ID | File | Topic | Difficulty | Snippet Lines | Words | Question |',
  '|---|---|---|---|---:|---:|---|',
  ...snippetReviewQueue.map(
    (item) =>
      `| ${item.id} | ${item.file} | ${item.topic} | ${item.difficulty} | ${item.codeSnippetLineCount} | ${item.explanationWordCount} | ${item.question.replace(/\|/g, '\\|')} |`,
  ),
  '',
];

fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
fs.writeFileSync(outputMdPath, markdown.join('\n'), 'utf8');

console.log(`Question hardening audit JSON written to ${path.relative(rootDir, outputJsonPath)}`);
console.log(`Question hardening audit Markdown written to ${path.relative(rootDir, outputMdPath)}`);
