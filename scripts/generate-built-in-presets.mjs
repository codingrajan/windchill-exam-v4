import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.join(process.cwd(), 'public', 'data');
const outputPath = path.join(dataDir, 'built_in_presets.json');
const questionFiles = fs.readdirSync(dataDir).filter((file) => /^windchill_mock_test_.*\.json$/.test(file)).sort();

const loadQuestions = () =>
  questionFiles.flatMap((file) => JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8')));

const domainOrder = [
  'PLM Strategy and Foundations',
  'Architecture, Installation, and Integration',
  'Contexts, Preferences, and Business Administration',
  'Data Model, Types, and Attributes',
  'Lifecycle, Workflow, and Object Initialization',
  'Access Control, Teams, and Security',
  'Change and Release Management',
  'Configuration Management and Product Structures',
  'CAD Data Management and Visualization',
  'System Administration, Vaulting, and Performance',
  'Navigate and Role-Based Consumption',
];

const stableWeight = (seed, id) =>
  [...`${seed}:${id}`].reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 3), 0);

const sortDeterministic = (questions, seed) =>
  [...questions].sort((left, right) => stableWeight(seed, left.id) - stableWeight(seed, right.id) || left.id - right.id);

const takeRoundRobin = (questions, count, seed, excludeIds = new Set()) => {
  const grouped = new Map();
  domainOrder.forEach((domain) => grouped.set(domain, []));

  sortDeterministic(
    questions.filter((question) => !excludeIds.has(question.id)),
    seed,
  ).forEach((question) => {
    const key = question.domain || 'PLM Strategy and Foundations';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(question);
  });

  const selected = [];
  const activeDomains = [...grouped.keys()].filter((domain) => grouped.get(domain).length > 0);
  let cursor = 0;

  while (selected.length < count && activeDomains.length > 0) {
    const domain = activeDomains[cursor % activeDomains.length];
    const bucket = grouped.get(domain);
    const next = bucket.shift();
    if (next) {
      selected.push(next);
      excludeIds.add(next.id);
    }
    if (bucket.length === 0) {
      activeDomains.splice(cursor % activeDomains.length, 1);
      if (activeDomains.length === 0) break;
      continue;
    }
    cursor += 1;
  }

  return selected;
};

const buildPreset = (questions, config) => {
  const allowed = questions.filter((question) => config.allowedDifficulties.includes(String(question.difficulty).toLowerCase()));
  const selectedIds = new Set();
  const multiTarget = Math.round(config.targetCount * config.multiSelectRatio);
  const multiQuestions = allowed.filter((question) => Array.isArray(question.correctAnswer));
  const singleQuestions = allowed.filter((question) => !Array.isArray(question.correctAnswer));

  const selected = [
    ...takeRoundRobin(multiQuestions, Math.min(multiTarget, multiQuestions.length), `${config.id}:multi`, selectedIds),
  ];

  const remainingCount = config.targetCount - selected.length;
  selected.push(...takeRoundRobin(singleQuestions, remainingCount, `${config.id}:single`, selectedIds));

  if (selected.length < config.targetCount) {
    const fallbackCount = config.targetCount - selected.length;
    selected.push(
      ...takeRoundRobin(
        multiQuestions.filter((question) => !selectedIds.has(question.id)),
        fallbackCount,
        `${config.id}:fallback`,
        selectedIds,
      ),
    );
  }

  if (selected.length !== config.targetCount) {
    throw new Error(`Preset ${config.id} could not reach ${config.targetCount} questions.`);
  }

  return {
    id: config.id,
    name: config.name,
    targetCount: config.targetCount,
    questions: selected.map((question) => question.id),
    updatedAt: '2026-04-08T00:00:00.000Z',
    examTrack: config.examTrack,
    difficultyProfile: config.difficultyProfile,
    difficultyLabel: config.difficultyLabel,
    multiSelectRatio: config.multiSelectRatio,
    isBuiltIn: true,
  };
};

const presetsConfig = [
  {
    id: 'builtin-25-core',
    name: 'Sprint 25 - Confidence Builder',
    targetCount: 25,
    allowedDifficulties: ['easy', 'medium'],
    multiSelectRatio: 0.1,
    examTrack: 'exam_parity',
    difficultyProfile: 'easy_medium',
    difficultyLabel: 'Easy + Medium',
  },
  {
    id: 'builtin-25-challenge',
    name: 'Sprint 25 - Pressure Test',
    targetCount: 25,
    allowedDifficulties: ['medium', 'hard'],
    multiSelectRatio: 0.15,
    examTrack: 'hard_mode',
    difficultyProfile: 'medium_hard',
    difficultyLabel: 'Medium + Hard',
  },
  {
    id: 'builtin-50-core',
    name: 'Forge 50 - Applied Readiness',
    targetCount: 50,
    allowedDifficulties: ['easy', 'medium'],
    multiSelectRatio: 0.1,
    examTrack: 'exam_parity',
    difficultyProfile: 'easy_medium',
    difficultyLabel: 'Easy + Medium',
  },
  {
    id: 'builtin-50-challenge',
    name: 'Forge 50 - Expert Challenge',
    targetCount: 50,
    allowedDifficulties: ['medium', 'hard'],
    multiSelectRatio: 0.15,
    examTrack: 'hard_mode',
    difficultyProfile: 'medium_hard',
    difficultyLabel: 'Medium + Hard',
  },
  {
    id: 'builtin-75-core',
    name: 'Summit 75 - Full Preparation',
    targetCount: 75,
    allowedDifficulties: ['easy', 'medium'],
    multiSelectRatio: 0.1,
    examTrack: 'exam_parity',
    difficultyProfile: 'easy_medium',
    difficultyLabel: 'Easy + Medium',
  },
  {
    id: 'builtin-75-challenge',
    name: 'Summit 75 - Hardline Simulation',
    targetCount: 75,
    allowedDifficulties: ['medium', 'hard'],
    multiSelectRatio: 0.15,
    examTrack: 'hard_mode',
    difficultyProfile: 'medium_hard',
    difficultyLabel: 'Medium + Hard',
  },
];

const questions = loadQuestions();
const presets = presetsConfig.map((config) => buildPreset(questions, config));

fs.writeFileSync(outputPath, `${JSON.stringify(presets, null, 2)}\n`, 'utf8');
console.log(`Built-in presets written to ${path.relative(process.cwd(), outputPath)}`);
