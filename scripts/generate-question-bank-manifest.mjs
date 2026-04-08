import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.join(process.cwd(), 'public', 'data');
const reportsDir = path.join(process.cwd(), 'reports');
const manifestPath = path.join(reportsDir, 'question_bank_manifest.json');

const questionFiles = fs.readdirSync(dataDir).filter((file) => /^windchill_mock_test_.*\.json$/.test(file)).sort();
const sourceManuals = fs.readdirSync(dataDir).filter((file) => /\.pdf$/i.test(file)).sort();

const domainCounts = new Map();
const difficultyCounts = new Map();
const normalizedStemCounts = new Map();
const metadataCompleteness = {
  sourceManualTagged: 0,
  sourceSectionTagged: 0,
  objectiveTagged: 0,
  misconceptionTagged: 0,
  releaseVersionTagged: 0,
};

let totalQuestions = 0;
let multiResponseQuestions = 0;

const readQuestions = (file) => {
  const payload = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
  return Array.isArray(payload) ? payload : payload.questions ?? [];
};

for (const file of questionFiles) {
  const questions = readQuestions(file);
  totalQuestions += questions.length;

  for (const question of questions) {
    const domain = String(question.domain || question.topic || 'Unclassified').trim();
    const difficulty = String(question.difficulty || 'unrated').trim().toLowerCase();
    const normalizedStem = String(question.question || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim();

    domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
    difficultyCounts.set(difficulty, (difficultyCounts.get(difficulty) ?? 0) + 1);

    if (normalizedStem) {
      normalizedStemCounts.set(normalizedStem, (normalizedStemCounts.get(normalizedStem) ?? 0) + 1);
    }

    if (Array.isArray(question.correctAnswer)) multiResponseQuestions += 1;
    if (typeof question.sourceManual === 'string' && question.sourceManual.trim()) metadataCompleteness.sourceManualTagged += 1;
    if (typeof question.sourceSection === 'string' && question.sourceSection.trim()) metadataCompleteness.sourceSectionTagged += 1;
    if (typeof question.objective === 'string' && question.objective.trim()) metadataCompleteness.objectiveTagged += 1;
    if (typeof question.misconceptionTag === 'string' && question.misconceptionTag.trim()) metadataCompleteness.misconceptionTagged += 1;
    if (typeof question.releaseVersion === 'string' && question.releaseVersion.trim()) metadataCompleteness.releaseVersionTagged += 1;
  }
}

const potentialDuplicateStems = [...normalizedStemCounts.entries()]
  .filter(([, count]) => count > 1)
  .map(([stem, count]) => ({ stem, count }))
  .sort((left, right) => right.count - left.count)
  .slice(0, 20);

const manifest = {
  generatedAt: new Date().toISOString(),
  sourceManuals,
  questionFiles,
  totals: {
    questions: totalQuestions,
    questionFiles: questionFiles.length,
    sourceManuals: sourceManuals.length,
    multiResponseQuestions,
    singleResponseQuestions: totalQuestions - multiResponseQuestions,
  },
  distributions: {
    domains: Object.fromEntries([...domainCounts.entries()].sort((left, right) => right[1] - left[1])),
    difficulty: Object.fromEntries([...difficultyCounts.entries()].sort((left, right) => right[1] - left[1])),
  },
  metadataCompleteness,
  potentialDuplicateStems,
};

fs.mkdirSync(reportsDir, { recursive: true });
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`Question-bank manifest written to ${path.relative(process.cwd(), manifestPath)}`);
console.log(`Questions: ${totalQuestions}`);
console.log(`Potential duplicate stems tracked: ${potentialDuplicateStems.length}`);
