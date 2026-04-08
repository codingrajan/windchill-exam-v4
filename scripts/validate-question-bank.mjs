import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.join(process.cwd(), 'public', 'data');
const files = fs.readdirSync(dataDir).filter((file) => /^windchill_mock_test_.*\.json$/.test(file)).sort();
const domainCounts = new Map();
const difficultyCounts = new Map();
const questionIds = new Set();
const normalizedStems = new Map();
const issues = [];

const readQuestions = (file) => {
  const payload = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
  return Array.isArray(payload) ? payload : payload.questions ?? [];
};

for (const file of files) {
  const questions = readQuestions(file);
  for (const question of questions) {
    const domain = String(question.domain || question.topic || 'Unclassified').trim();
    const difficulty = String(question.difficulty || 'unrated').trim().toLowerCase();
    const options = Array.isArray(question.options) ? question.options : [];
    const answer = question.correctAnswer;
    const normalizedStem = String(question.question || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim();

    domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
    difficultyCounts.set(difficulty, (difficultyCounts.get(difficulty) || 0) + 1);
    if (normalizedStem) {
      normalizedStems.set(normalizedStem, (normalizedStems.get(normalizedStem) || 0) + 1);
    }

    if (questionIds.has(question.id)) {
      issues.push(`${file} #${question.id}: duplicate id`);
    } else {
      questionIds.add(question.id);
    }

    if (!Number.isInteger(question.id)) issues.push(`${file}: non-integer question id`);
    if (typeof question.question !== 'string' || !question.question.trim()) issues.push(`${file} #${question.id}: blank question`);
    if (typeof question.explanation !== 'string' || !question.explanation.trim()) issues.push(`${file} #${question.id}: blank explanation`);
    if (options.length < 2) issues.push(`${file} #${question.id}: fewer than 2 options`);

    if (Array.isArray(answer)) {
      if (answer.length === 0) issues.push(`${file} #${question.id}: empty multi-answer key`);
      if (!answer.every((entry) => Number.isInteger(entry) && entry >= 0 && entry < options.length)) {
        issues.push(`${file} #${question.id}: multi-answer index out of range`);
      }
    } else if (!(Number.isInteger(answer) && answer >= 0 && answer < options.length)) {
      issues.push(`${file} #${question.id}: single-answer index out of range`);
    }
  }
}

for (const [stem, count] of normalizedStems.entries()) {
  if (count > 2) {
    issues.push(`potential duplicate stem repeated ${count} times: ${stem.slice(0, 120)}`);
  }
}

console.log(`Validated files: ${files.length}`);
console.log(`Total questions: ${questionIds.size}`);
console.log('');
console.log('Domain distribution:');
for (const [domain, count] of [...domainCounts.entries()].sort((left, right) => right[1] - left[1])) {
  console.log(`- ${domain}: ${count}`);
}
console.log('');
console.log('Difficulty distribution:');
for (const [difficulty, count] of [...difficultyCounts.entries()].sort((left, right) => right[1] - left[1])) {
  console.log(`- ${difficulty}: ${count}`);
}
console.log('');

if (issues.length > 0) {
  console.error(`Validation failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log('Validation passed with no structural issues.');
