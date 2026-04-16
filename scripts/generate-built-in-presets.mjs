import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.join(process.cwd(), 'public', 'data');
const outputPath = path.join(dataDir, 'built_in_presets.json');
const questionFiles = fs.readdirSync(dataDir).filter((file) => /^windchill_mock_test_.*\.json$/.test(file)).sort();
const API_SOURCE_MANUAL = 'Windchill Java API Practice Set';

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
  const apiQuestions = allowed.filter((question) => question.sourceManual === API_SOURCE_MANUAL);
  const nonApiQuestions = allowed.filter((question) => question.sourceManual !== API_SOURCE_MANUAL);
  const selectedIds = new Set();
  const multiTarget = Math.round(config.targetCount * config.multiSelectRatio);
  const apiTarget = Math.min(
    config.apiTargetCount ?? 0,
    config.targetCount,
    apiQuestions.length,
  );

  const selected = [];
  const apiMultiQuestions = apiQuestions.filter((question) => Array.isArray(question.correctAnswer));
  const apiSingleQuestions = apiQuestions.filter((question) => !Array.isArray(question.correctAnswer));
  const nonApiMultiQuestions = nonApiQuestions.filter((question) => Array.isArray(question.correctAnswer));
  const nonApiSingleQuestions = nonApiQuestions.filter((question) => !Array.isArray(question.correctAnswer));
  const allowMulti = config.allowMulti !== false;

  const apiMultiTarget = allowMulti
    ? Math.min(apiMultiQuestions.length, Math.min(multiTarget, Math.max(1, Math.round(apiTarget * 0.2))))
    : 0;
  selected.push(...takeRoundRobin(apiMultiQuestions, apiMultiTarget, `${config.id}:api-multi`, selectedIds));
  selected.push(...takeRoundRobin(apiSingleQuestions, apiTarget - selected.length, `${config.id}:api-single`, selectedIds));

  const nonApiMultiTarget = allowMulti
    ? Math.max(0, multiTarget - selected.filter((question) => Array.isArray(question.correctAnswer)).length)
    : 0;
  selected.push(...takeRoundRobin(nonApiMultiQuestions, nonApiMultiTarget, `${config.id}:multi`, selectedIds));
  selected.push(...takeRoundRobin(nonApiSingleQuestions, config.targetCount - selected.length, `${config.id}:single`, selectedIds));

  if (selected.length < config.targetCount) {
    const fallbackCount = config.targetCount - selected.length;
    selected.push(...takeRoundRobin(
      [
        ...nonApiSingleQuestions,
        ...apiSingleQuestions,
        ...(allowMulti ? [...nonApiMultiQuestions, ...apiMultiQuestions] : []),
      ].filter((question) => !selectedIds.has(question.id)),
      fallbackCount,
      `${config.id}:fallback`,
      selectedIds,
    ));
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
    ...(config.timeLimitMinutes ? { timeLimitMinutes: config.timeLimitMinutes } : {}),
    isBuiltIn: true,
    assessmentType: config.assessmentType ?? 'mock',
    ...(config.roleFocus ? { roleFocus: config.roleFocus } : {}),
  };
};

const presetsConfig = [
  {
    id: 'builtin-10-api',
    name: 'API 10 - Customization Sprint',
    targetCount: 10,
    allowedDifficulties: ['easy', 'medium'],
    multiSelectRatio: 0,
    examTrack: 'exam_parity',
    difficultyLabel: 'Java API Focus',
    timeLimitMinutes: 5,
    apiTargetCount: 10,
    allowMulti: false,
  },
  {
    id: 'builtin-25-core',
    name: 'Sprint 25 - Confidence Builder',
    targetCount: 25,
    allowedDifficulties: ['easy', 'medium'],
    multiSelectRatio: 0.1,
    examTrack: 'exam_parity',
    difficultyProfile: 'easy_medium',
    difficultyLabel: 'Easy + Medium',
    apiTargetCount: 2,
    allowMulti: true,
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
    apiTargetCount: 2,
    allowMulti: true,
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
    apiTargetCount: 5,
    allowMulti: true,
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
    apiTargetCount: 5,
    allowMulti: true,
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
    apiTargetCount: 8,
    allowMulti: true,
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
    apiTargetCount: 8,
    allowMulti: true,
  },
];

const hiddenInterviewPresetsConfig = [
  {
    id: 'builtin-int-15-foundation',
    name: 'Interview 15 - Foundation Screen',
    targetCount: 15,
    allowedDifficulties: ['easy', 'medium'],
    multiSelectRatio: 0,
    examTrack: 'exam_parity',
    difficultyLabel: 'Interview · Fundamentals',
    timeLimitMinutes: 12,
    apiTargetCount: 0,
    allowMulti: false,
    assessmentType: 'interview',
    roleFocus: 'functional',
    showOnHome: false,
  },
  {
    id: 'builtin-int-20-core',
    name: 'Interview 20 - Practitioner Core',
    targetCount: 20,
    allowedDifficulties: ['medium', 'hard'],
    multiSelectRatio: 0,
    examTrack: 'hard_mode',
    difficultyLabel: 'Interview · Core Judgement',
    timeLimitMinutes: 18,
    apiTargetCount: 2,
    allowMulti: false,
    assessmentType: 'interview',
    roleFocus: 'mixed',
    showOnHome: false,
  },
  {
    id: 'builtin-int-25-tech',
    name: 'Interview 25 - Technical Deep Dive',
    targetCount: 25,
    allowedDifficulties: ['medium', 'hard'],
    multiSelectRatio: 0,
    examTrack: 'hard_mode',
    difficultyLabel: 'Interview · Technical',
    timeLimitMinutes: 22,
    apiTargetCount: 6,
    allowMulti: false,
    assessmentType: 'interview',
    roleFocus: 'technical',
    showOnHome: false,
  },
  {
    id: 'builtin-int-10-api',
    name: 'Interview 10 - API Screen',
    targetCount: 10,
    allowedDifficulties: ['easy', 'medium'],
    multiSelectRatio: 0,
    examTrack: 'exam_parity',
    difficultyLabel: 'Interview · Java API',
    timeLimitMinutes: 10,
    apiTargetCount: 10,
    allowMulti: false,
    assessmentType: 'interview',
    roleFocus: 'technical',
    showOnHome: false,
  },
];

const questions = loadQuestions();
const presets = presetsConfig.map((config) => buildPreset(questions, config));
const interviewPresets = hiddenInterviewPresetsConfig.map((config) => ({
  ...buildPreset(questions, config),
  showOnHome: false,
}));
const existingHiddenPresets = fs.existsSync(outputPath)
  ? JSON.parse(fs.readFileSync(outputPath, 'utf8')).filter((preset) => preset.showOnHome === false && !hiddenInterviewPresetsConfig.some((config) => config.id === preset.id))
  : [];

fs.writeFileSync(outputPath, `${JSON.stringify([...presets.map((preset) => ({ ...preset, showOnHome: true })), ...interviewPresets, ...existingHiddenPresets], null, 2)}\n`, 'utf8');
console.log(`Built-in presets written to ${path.relative(process.cwd(), outputPath)}`);
