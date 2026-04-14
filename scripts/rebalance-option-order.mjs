import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const targets = [
  'public/data/windchill_mock_test_7.json',
  'public/data/windchill_mock_test_8.json',
  'public/data/windchill_mock_test_9.json',
];

const rotateToIndex = (options, currentIndex, targetIndex) => {
  const length = options.length;
  const shift = ((targetIndex - currentIndex) % length + length) % length;
  const rotated = options.map((_, index) => options[(index - shift + length) % length]);
  return { rotated, newIndex: targetIndex };
};

let processed = 0;

for (const relativePath of targets) {
  const filePath = path.join(rootDir, relativePath);
  const questions = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  let singleIndex = 0;
  for (const question of questions) {
    if (!Number.isInteger(question.correctAnswer) || !Array.isArray(question.options) || question.options.length !== 4) {
      continue;
    }

    const targetIndex = singleIndex % 4;
    const { rotated, newIndex } = rotateToIndex(question.options, question.correctAnswer, targetIndex);
    question.options = rotated;
    question.correctAnswer = newIndex;
    singleIndex += 1;
    processed += 1;
  }

  fs.writeFileSync(filePath, `${JSON.stringify(questions, null, 2)}\n`, 'utf8');
}

console.log(`Rebalanced ${processed} single-answer questions across ${targets.length} files.`);
