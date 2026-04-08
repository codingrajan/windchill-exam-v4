import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.join(process.cwd(), 'public', 'data');
const reportDir = path.join(process.cwd(), 'reports');
const reportPath = path.join(reportDir, 'taxonomy_audit.json');
const files = fs.readdirSync(dataDir).filter((file) => /^windchill_mock_test_.*\.json$/.test(file)).sort();

const questions = files.flatMap((file) => {
  const filePath = path.join(dataDir, file);
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return payload.map((question) => ({ ...question, __file: file }));
});

const domainMap = new Map();
const objectiveMap = new Map();
const manualMap = new Map();
const misconceptionMap = new Map();

for (const question of questions) {
  const domain = String(question.domain || question.topic || 'Unclassified').trim();
  const objective = String(question.objective || 'Unspecified objective').trim();
  const sourceManual = String(question.sourceManual || 'Unspecified manual').trim();
  const misconceptionTag = String(question.misconceptionTag || 'Unspecified misconception').trim();

  if (!domainMap.has(domain)) {
    domainMap.set(domain, {
      questionCount: 0,
      objectives: new Map(),
      manuals: new Map(),
      misconceptions: new Map(),
      questionIds: [],
    });
  }

  const domainEntry = domainMap.get(domain);
  domainEntry.questionCount += 1;
  domainEntry.questionIds.push(question.id);
  domainEntry.objectives.set(objective, (domainEntry.objectives.get(objective) ?? 0) + 1);
  domainEntry.manuals.set(sourceManual, (domainEntry.manuals.get(sourceManual) ?? 0) + 1);
  domainEntry.misconceptions.set(misconceptionTag, (domainEntry.misconceptions.get(misconceptionTag) ?? 0) + 1);

  objectiveMap.set(objective, (objectiveMap.get(objective) ?? 0) + 1);
  manualMap.set(sourceManual, (manualMap.get(sourceManual) ?? 0) + 1);
  misconceptionMap.set(misconceptionTag, (misconceptionMap.get(misconceptionTag) ?? 0) + 1);
}

const sortedDomains = [...domainMap.entries()]
  .map(([domain, entry]) => {
    const objectives = [...entry.objectives.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([objective, count]) => ({ objective, count }));
    const manuals = [...entry.manuals.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([manual, count]) => ({ manual, count }));
    const misconceptions = [...entry.misconceptions.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([tag, count]) => ({ tag, count }));

    return {
      domain,
      questionCount: entry.questionCount,
      objectiveCount: objectives.length,
      dominantObjective: objectives[0]?.objective ?? null,
      dominantObjectiveShare: objectives[0] ? Number((objectives[0].count / entry.questionCount).toFixed(2)) : 0,
      objectives,
      manuals,
      misconceptions,
      flags: [
        ...(entry.questionCount >= 80 ? ['domain-too-broad'] : []),
        ...(objectives.length <= 2 ? ['objective-too-shallow'] : []),
        ...(objectives[0] && objectives[0].count / entry.questionCount >= 0.6 ? ['dominant-objective-heavy'] : []),
      ],
      sampleQuestionIds: entry.questionIds.slice(0, 12),
    };
  })
  .sort((left, right) => right.questionCount - left.questionCount);

const report = {
  generatedAt: new Date().toISOString(),
  questionCount: questions.length,
  domainCount: sortedDomains.length,
  objectiveCount: objectiveMap.size,
  manualCount: manualMap.size,
  misconceptionCount: misconceptionMap.size,
  flaggedDomains: sortedDomains.filter((domain) => domain.flags.length > 0).map((domain) => ({
    domain: domain.domain,
    flags: domain.flags,
    questionCount: domain.questionCount,
    objectiveCount: domain.objectiveCount,
  })),
  lowCoverageObjectives: [...objectiveMap.entries()]
    .filter(([, count]) => count <= 3)
    .sort((left, right) => left[1] - right[1])
    .map(([objective, count]) => ({ objective, count })),
  domains: sortedDomains,
};

fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(`Taxonomy audit written to ${path.relative(process.cwd(), reportPath)}`);
