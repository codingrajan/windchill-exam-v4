import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.join(process.cwd(), 'public', 'data');
const presetsPath = path.join(dataDir, 'built_in_presets.json');
const sessionsPath = path.join(dataDir, 'built_in_sessions.json');
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
  'System Administration, Utilities, and Monitoring',
  'Vaulting, Replication, and Data Maintenance',
  'Navigate and Role-Based Consumption',
];

const SCHEDULED_PRESETS = [
  {
    id: 'session-2026-04-13',
    name: 'Monday Readiness 01 - 13 Apr 2026',
    targetCount: 25,
    allowedDifficulties: ['easy', 'medium'],
    multiSelectRatio: 0.1,
    examTrack: 'exam_parity',
    difficultyProfile: 'easy_medium',
    difficultyLabel: 'Easy + Medium',
    showOnHome: false,
  },
  {
    id: 'session-2026-04-16',
    name: 'Thursday Challenge 01 - 16 Apr 2026',
    targetCount: 25,
    allowedDifficulties: ['medium', 'hard'],
    multiSelectRatio: 0.15,
    examTrack: 'hard_mode',
    difficultyProfile: 'medium_hard',
    difficultyLabel: 'Medium + Hard',
    showOnHome: false,
  },
  {
    id: 'session-2026-04-20',
    name: 'Monday Readiness 02 - 20 Apr 2026',
    targetCount: 25,
    allowedDifficulties: ['easy', 'medium'],
    multiSelectRatio: 0.1,
    examTrack: 'exam_parity',
    difficultyProfile: 'easy_medium',
    difficultyLabel: 'Easy + Medium',
    showOnHome: false,
  },
  {
    id: 'session-2026-04-23',
    name: 'Thursday Challenge 02 - 23 Apr 2026',
    targetCount: 25,
    allowedDifficulties: ['medium', 'hard'],
    multiSelectRatio: 0.15,
    examTrack: 'hard_mode',
    difficultyProfile: 'medium_hard',
    difficultyLabel: 'Medium + Hard',
    showOnHome: false,
  },
  {
    id: 'session-2026-04-27',
    name: 'Monday Readiness 03 - 27 Apr 2026',
    targetCount: 25,
    allowedDifficulties: ['easy', 'medium'],
    multiSelectRatio: 0.1,
    examTrack: 'exam_parity',
    difficultyProfile: 'easy_medium',
    difficultyLabel: 'Easy + Medium',
    showOnHome: false,
  },
  {
    id: 'session-2026-04-29-special',
    name: 'Final Stretch 75 - 29 Apr 2026',
    targetCount: 75,
    examTrack: 'hard_mode',
    difficultyLabel: 'Mixed - Elevated',
    multiSelectRatio: 0.15,
    showOnHome: false,
    difficultyQuotas: { easy: 11, medium: 38, hard: 26 },
  },
  {
    id: 'session-2026-05-04',
    name: 'Monday Readiness 04 - 04 May 2026',
    targetCount: 25,
    allowedDifficulties: ['easy', 'medium'],
    multiSelectRatio: 0.1,
    examTrack: 'exam_parity',
    difficultyProfile: 'easy_medium',
    difficultyLabel: 'Easy + Medium',
    showOnHome: false,
  },
  {
    id: 'session-2026-05-07',
    name: 'Thursday Challenge 03 - 07 May 2026',
    targetCount: 25,
    allowedDifficulties: ['medium', 'hard'],
    multiSelectRatio: 0.15,
    examTrack: 'hard_mode',
    difficultyProfile: 'medium_hard',
    difficultyLabel: 'Medium + Hard',
    showOnHome: false,
  },
  {
    id: 'session-2026-05-11',
    name: 'Monday Readiness 05 - 11 May 2026',
    targetCount: 25,
    allowedDifficulties: ['easy', 'medium'],
    multiSelectRatio: 0.1,
    examTrack: 'exam_parity',
    difficultyProfile: 'easy_medium',
    difficultyLabel: 'Easy + Medium',
    showOnHome: false,
  },
];

const BUILT_IN_SESSIONS = [
  {
    id: 'session-slot-2026-04-13',
    name: 'Monday Readiness 01 - 13 Apr 2026',
    presetId: 'session-2026-04-13',
    presetName: 'Monday Readiness 01 - 13 Apr 2026',
    accessCode: 'plural',
    isActive: true,
    maxRetakes: 1,
    startsAt: '2026-04-13T10:30:00+05:30',
    expiresAt: '2026-04-13T12:30:00+05:30',
    createdAt: '2026-04-09T00:00:00+05:30',
    isBuiltIn: true,
  },
  {
    id: 'session-slot-2026-04-16',
    name: 'Thursday Challenge 01 - 16 Apr 2026',
    presetId: 'session-2026-04-16',
    presetName: 'Thursday Challenge 01 - 16 Apr 2026',
    accessCode: 'plural',
    isActive: true,
    maxRetakes: 1,
    startsAt: '2026-04-16T10:30:00+05:30',
    expiresAt: '2026-04-16T12:30:00+05:30',
    createdAt: '2026-04-09T00:00:00+05:30',
    isBuiltIn: true,
  },
  {
    id: 'session-slot-2026-04-20',
    name: 'Monday Readiness 02 - 20 Apr 2026',
    presetId: 'session-2026-04-20',
    presetName: 'Monday Readiness 02 - 20 Apr 2026',
    accessCode: 'plural',
    isActive: true,
    maxRetakes: 1,
    startsAt: '2026-04-20T10:30:00+05:30',
    expiresAt: '2026-04-20T12:30:00+05:30',
    createdAt: '2026-04-09T00:00:00+05:30',
    isBuiltIn: true,
  },
  {
    id: 'session-slot-2026-04-23',
    name: 'Thursday Challenge 02 - 23 Apr 2026',
    presetId: 'session-2026-04-23',
    presetName: 'Thursday Challenge 02 - 23 Apr 2026',
    accessCode: 'plural',
    isActive: true,
    maxRetakes: 1,
    startsAt: '2026-04-23T10:30:00+05:30',
    expiresAt: '2026-04-23T12:30:00+05:30',
    createdAt: '2026-04-09T00:00:00+05:30',
    isBuiltIn: true,
  },
  {
    id: 'session-slot-2026-04-27',
    name: 'Monday Readiness 03 - 27 Apr 2026',
    presetId: 'session-2026-04-27',
    presetName: 'Monday Readiness 03 - 27 Apr 2026',
    accessCode: 'plural',
    isActive: true,
    maxRetakes: 1,
    startsAt: '2026-04-27T10:30:00+05:30',
    expiresAt: '2026-04-27T12:30:00+05:30',
    createdAt: '2026-04-09T00:00:00+05:30',
    isBuiltIn: true,
  },
  {
    id: 'session-slot-2026-04-29-special',
    name: 'Final Stretch 75 - 29 Apr 2026',
    presetId: 'session-2026-04-29-special',
    presetName: 'Final Stretch 75 - 29 Apr 2026',
    accessCode: 'plural',
    isActive: true,
    maxRetakes: 1,
    startsAt: '2026-04-29T10:30:00+05:30',
    expiresAt: '2026-04-29T12:30:00+05:30',
    createdAt: '2026-04-09T00:00:00+05:30',
    isBuiltIn: true,
  },
  {
    id: 'session-slot-2026-05-04',
    name: 'Monday Readiness 04 - 04 May 2026',
    presetId: 'session-2026-05-04',
    presetName: 'Monday Readiness 04 - 04 May 2026',
    accessCode: 'plural',
    isActive: true,
    maxRetakes: 1,
    startsAt: '2026-05-04T10:30:00+05:30',
    expiresAt: '2026-05-04T12:30:00+05:30',
    createdAt: '2026-04-09T00:00:00+05:30',
    isBuiltIn: true,
  },
  {
    id: 'session-slot-2026-05-07',
    name: 'Thursday Challenge 03 - 07 May 2026',
    presetId: 'session-2026-05-07',
    presetName: 'Thursday Challenge 03 - 07 May 2026',
    accessCode: 'plural',
    isActive: true,
    maxRetakes: 1,
    startsAt: '2026-05-07T10:30:00+05:30',
    expiresAt: '2026-05-07T12:30:00+05:30',
    createdAt: '2026-04-09T00:00:00+05:30',
    isBuiltIn: true,
  },
  {
    id: 'session-slot-2026-05-11',
    name: 'Monday Readiness 05 - 11 May 2026',
    presetId: 'session-2026-05-11',
    presetName: 'Monday Readiness 05 - 11 May 2026',
    accessCode: 'plural',
    isActive: true,
    maxRetakes: 1,
    startsAt: '2026-05-11T10:30:00+05:30',
    expiresAt: '2026-05-11T12:30:00+05:30',
    createdAt: '2026-04-09T00:00:00+05:30',
    isBuiltIn: true,
  },
];

const stableWeight = (seed, id) =>
  [...`${seed}:${id}`].reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 3), 0);

const sortDeterministic = (questions, seed) =>
  [...questions].sort((left, right) => stableWeight(seed, left.id) - stableWeight(seed, right.id) || left.id - right.id);

const takeRoundRobin = (questions, count, seed, excludeIds) => {
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
    const domainIndex = cursor % activeDomains.length;
    const domain = activeDomains[domainIndex];
    const bucket = grouped.get(domain);
    const next = bucket.shift();

    if (next) {
      selected.push(next);
      excludeIds.add(next.id);
    }

    if (bucket.length === 0) {
      activeDomains.splice(domainIndex, 1);
      continue;
    }

    cursor += 1;
  }

  return selected;
};

const fillWithPool = (selected, pool, count, seed, excludeIds) => {
  const roundRobin = takeRoundRobin(pool, count, seed, excludeIds);
  selected.push(...roundRobin);
  return selected;
};

const buildStandardPreset = (questions, config, usedIds) => {
  const allowed = questions.filter((question) => config.allowedDifficulties.includes(String(question.difficulty).toLowerCase()));
  const selected = [];
  const multiTarget = Math.round(config.targetCount * config.multiSelectRatio);
  const multiQuestions = allowed.filter((question) => Array.isArray(question.correctAnswer));
  const singleQuestions = allowed.filter((question) => !Array.isArray(question.correctAnswer));

  fillWithPool(selected, multiQuestions, Math.min(multiTarget, multiQuestions.length), `${config.id}:multi`, usedIds);
  fillWithPool(selected, singleQuestions, config.targetCount - selected.length, `${config.id}:single`, usedIds);

  if (selected.length < config.targetCount) {
    fillWithPool(
      selected,
      multiQuestions.filter((question) => !usedIds.has(question.id)),
      config.targetCount - selected.length,
      `${config.id}:fallback`,
      usedIds,
    );
  }

  if (selected.length !== config.targetCount) {
    throw new Error(`Could not build preset ${config.id} with ${config.targetCount} unique questions.`);
  }

  return {
    id: config.id,
    name: config.name,
    targetCount: config.targetCount,
    questions: selected.map((question) => question.id),
    updatedAt: '2026-04-09T00:00:00.000Z',
    examTrack: config.examTrack,
    difficultyProfile: config.difficultyProfile,
    difficultyLabel: config.difficultyLabel,
    multiSelectRatio: config.multiSelectRatio,
    isBuiltIn: true,
    showOnHome: config.showOnHome,
  };
};

const buildMixedPreset = (questions, config, usedIds) => {
  const selected = [];
  const multiTarget = Math.round(config.targetCount * config.multiSelectRatio);
  const multiPool = questions.filter((question) => Array.isArray(question.correctAnswer));

  fillWithPool(selected, multiPool, Math.min(multiTarget, multiPool.length), `${config.id}:multi`, usedIds);

  for (const [difficulty, quota] of Object.entries(config.difficultyQuotas)) {
    const remainingForDifficulty = Math.max(0, quota - selected.filter((question) => question.difficulty === difficulty).length);
    if (remainingForDifficulty === 0) continue;
    const pool = questions.filter(
      (question) =>
        String(question.difficulty).toLowerCase() === difficulty
        && !usedIds.has(question.id),
    );
    fillWithPool(selected, pool, remainingForDifficulty, `${config.id}:${difficulty}`, usedIds);
  }

  if (selected.length < config.targetCount) {
    fillWithPool(
      selected,
      questions.filter((question) => !usedIds.has(question.id)),
      config.targetCount - selected.length,
      `${config.id}:topoff`,
      usedIds,
    );
  }

  if (selected.length !== config.targetCount) {
    throw new Error(`Could not build mixed preset ${config.id} with ${config.targetCount} unique questions.`);
  }

  return {
    id: config.id,
    name: config.name,
    targetCount: config.targetCount,
    questions: selected.map((question) => question.id),
    updatedAt: '2026-04-09T00:00:00.000Z',
    examTrack: config.examTrack,
    difficultyLabel: config.difficultyLabel,
    multiSelectRatio: config.multiSelectRatio,
    isBuiltIn: true,
    showOnHome: config.showOnHome,
  };
};

const questions = loadQuestions();
const publicBuilt = JSON.parse(fs.readFileSync(presetsPath, 'utf8'));
const publicPresets = publicBuilt
  .filter((preset) => preset.showOnHome !== false)
  .map((preset) => ({ ...preset, showOnHome: true }));
const publicUsedIds = new Set(publicPresets.flatMap((preset) => preset.questions));
const scheduleQuestionPool = questions.filter((question) => !publicUsedIds.has(question.id));
const scheduledUsedIds = new Set();

const scheduledPresets = SCHEDULED_PRESETS.map((config) =>
  config.difficultyQuotas
    ? buildMixedPreset(scheduleQuestionPool, config, scheduledUsedIds)
    : buildStandardPreset(scheduleQuestionPool, config, scheduledUsedIds),
);

const allBuiltInPresets = [...publicPresets, ...scheduledPresets];

fs.writeFileSync(presetsPath, `${JSON.stringify(allBuiltInPresets, null, 2)}\n`, 'utf8');
fs.writeFileSync(sessionsPath, `${JSON.stringify(BUILT_IN_SESSIONS, null, 2)}\n`, 'utf8');

console.log(`Built-in presets written to ${path.relative(process.cwd(), presetsPath)}`);
console.log(`Built-in sessions written to ${path.relative(process.cwd(), sessionsPath)}`);
console.log(`Scheduled unique question count: ${scheduledUsedIds.size}`);
