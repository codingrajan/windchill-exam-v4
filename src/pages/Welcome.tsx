import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TRACK_PROFILES } from '../constants/examStrategy';
import { fetchBuiltInPresets, fetchFirestorePresets, mergePresetCatalog } from '../services/presetCatalog';
import type { ExamConfig, ExamTrack, Preset } from '../types/index';
import { isValidEmail, normalizeEmail } from '../utils/email';

const ACTIVE_SESSION_KEY = 'wc_exam_session';
const API_PRESET_ID = 'builtin-10-api';
const SCENARIO_PRESET_ID = 'builtin-scn-30-lab';
const DEFAULT_PRESET_ID = 'builtin-25-core';
const PUBLIC_PRESET_ORDER = [
  'builtin-25-core',
  'builtin-25-challenge',
  'builtin-50-core',
  'builtin-50-challenge',
  'builtin-75-core',
  'builtin-75-challenge',
  'builtin-scn-30-lab',
  'builtin-10-api',
] as const;

const ALL_DOMAINS = [
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

const TIME_LABELS: Record<number, string> = {
  25: '15 min',
  50: '35 min',
  75: '60 min',
  100: '75 min',
};

function getPresetTimeLabel(preset: Preset) {
  if (preset.timeLimitMinutes) return `${preset.timeLimitMinutes} min`;
  return TIME_LABELS[preset.targetCount] ?? '--';
}

function isSpecialistPreset(presetId: string) {
  return presetId === API_PRESET_ID || presetId === SCENARIO_PRESET_ID;
}

function getPublicPresetOrderIndex(presetId: string) {
  const index = PUBLIC_PRESET_ORDER.indexOf(presetId as (typeof PUBLIC_PRESET_ORDER)[number]);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function getStoredActiveSessionConfig(): ExamConfig | null {
  try {
    const raw = window.localStorage.getItem(ACTIVE_SESSION_KEY) ?? window.sessionStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { config?: ExamConfig };
    return parsed.config?.sessionId ? parsed.config : null;
  } catch (error) {
    console.error('Active session restore error:', error);
    return null;
  }
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div className="bg-white border border-zinc-100 rounded-2xl p-5 text-center shadow-sm">
      <div className="text-2xl mb-2 select-none">{icon}</div>
      <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-xl font-bold text-zinc-900">{value}</div>
    </div>
  );
}

export default function Welcome() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'preset' | 'random'>('preset');
  const [track, setTrack] = useState<ExamTrack>('hard_mode');
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [randomCount, setRandomCount] = useState<25 | 50 | 75 | 100>(25);
  const [examineeName, setExamineeName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeSessionConfig] = useState<ExamConfig | null>(() => getStoredActiveSessionConfig());

  useEffect(() => {
    Promise.all([
      fetchFirestorePresets().catch(() => [] as Preset[]),
      fetchBuiltInPresets().catch(() => [] as Preset[]),
    ])
      .then(([firestorePresets, builtInPresets]) => {
        const merged = mergePresetCatalog(firestorePresets, builtInPresets);
        const homeVisible = merged
          .filter((preset) => preset.showOnHome !== false)
          .sort((left, right) => {
            const leftIndex = getPublicPresetOrderIndex(left.id);
            const rightIndex = getPublicPresetOrderIndex(right.id);
            if (leftIndex !== rightIndex) return leftIndex - rightIndex;
            if (left.targetCount !== right.targetCount) return left.targetCount - right.targetCount;
            return left.name.localeCompare(right.name);
          });
        setPresets(homeVisible);
        if (homeVisible.length > 0) {
          const defaultPreset = homeVisible.find((preset) => preset.id === DEFAULT_PRESET_ID);
          setSelectedPresetId(defaultPreset?.id ?? homeVisible[0].id);
        }
        else setMode('random');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const selectedPreset = presets.find((preset) => preset.id === selectedPresetId);
  const hasOddPresetCount = presets.length % 2 === 1;
  const effectiveTrack = mode === 'preset' ? (selectedPreset?.examTrack ?? 'exam_parity') : track;
  const qCount = mode === 'random' ? randomCount : (selectedPreset?.targetCount ?? 0);
  const timeLabel =
    mode === 'preset' && selectedPreset?.timeLimitMinutes
      ? `${selectedPreset.timeLimitMinutes} min`
      : TIME_LABELS[qCount] ?? '--';
  const isValid = examineeName.trim().length >= 3 && (mode === 'random' || !!selectedPreset);

  const handleStart = () => {
    const normalizedEmail = normalizeEmail(candidateEmail);
    if (normalizedEmail && !isValidEmail(normalizedEmail)) {
      window.alert('Enter a valid email address to enable result history.');
      return;
    }

    const nextConfig: ExamConfig = {
      examineeName: examineeName.trim(),
      mode,
      track: effectiveTrack,
      ...(mode === 'preset' && selectedPreset?.difficultyLabel ? { presetLabel: selectedPreset.difficultyLabel } : {}),
      targetCount: qCount,
      presetId: mode === 'preset' ? selectedPresetId : null,
      presetQuestionIds: mode === 'preset' ? (selectedPreset?.questions ?? null) : null,
      ...(mode === 'preset' && selectedPreset?.timeLimitMinutes ? { timeLimitMinutes: selectedPreset.timeLimitMinutes } : {}),
      ...(mode === 'preset' && selectedPreset ? { sessionName: selectedPreset.name } : {}),
      ...(normalizedEmail ? { candidateEmail: normalizedEmail } : {}),
    };

    navigate('/quiz', { state: nextConfig });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="max-w-4xl mx-auto py-6 px-2"
    >
      <div className="text-center mb-8">
        <span className="inline-block text-[10px] font-semibold uppercase tracking-widest text-indigo-600 bg-indigo-50 border border-indigo-100 px-4 py-1.5 rounded-full mb-4">
          {mode === 'preset' ? 'Windchill Implementation Practitioner' : 'Windchill Practice Arena'}
        </span>
        <h1 className="text-4xl font-bold text-zinc-900 tracking-tight mb-2">PTC x Plural Mock Exam</h1>
        <p className="text-zinc-500 font-medium">
          {mode === 'preset' ? 'Professional certification preparation environment' : 'Flexible practice environment for targeted revision'}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard icon="Q" label="Questions" value={qCount || '--'} />
        <StatCard icon="T" label="Time Limit" value={qCount ? timeLabel : '--'} />
        <StatCard icon="P" label={mode === 'preset' ? 'Pass Score' : 'Practice Mode'} value={mode === 'preset' ? '80%' : 'Open'} />
      </div>

      <div className="bg-white border border-zinc-100 rounded-3xl shadow-sm p-8 md:p-10">
        {activeSessionConfig?.sessionId ? (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 text-center">
            <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-2">Active Session Locked</p>
            <p className="text-sm font-semibold text-zinc-800 mb-2">{activeSessionConfig.sessionName ?? 'Session Exam In Progress'}</p>
            <p className="text-sm text-zinc-600 mb-5">
              A secured session exam is already in progress on this device. Resume that attempt before starting any other exam.
            </p>
            <button
              onClick={() => navigate('/quiz')}
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all"
            >
              Resume Session Exam
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="space-y-5">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                  Examinee Name
                </label>
                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={examineeName}
                  onChange={(event) => setExamineeName(event.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all placeholder:text-zinc-300"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                  Email <span className="normal-case font-normal text-zinc-300">(optional but recommended - required for result history)</span>
                </label>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={candidateEmail}
                  onChange={(event) => setCandidateEmail(event.target.value)}
                  inputMode="email"
                  autoComplete="email"
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all placeholder:text-zinc-300"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                  Exam Mode
                </label>
                <div className="grid grid-cols-2 gap-1 bg-zinc-100 p-1 rounded-xl">
                  {(['preset', 'random'] as const).map((entry) => (
                    <button
                      key={entry}
                      type="button"
                      onClick={() => setMode(entry)}
                      className={`py-2.5 rounded-lg text-xs font-semibold transition-all ${
                        mode === entry ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                      }`}
                    >
                      {entry === 'preset' ? 'Preset' : 'Random'}
                    </button>
                  ))}
                </div>
              </div>

              {mode === 'random' && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                      Exam Track
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {Object.values(TRACK_PROFILES).map((profile) => (
                        <button
                          key={profile.id}
                          type="button"
                          onClick={() => setTrack(profile.id)}
                          className={`rounded-2xl border p-4 text-left transition-all ${
                            track === profile.id
                              ? 'border-indigo-300 bg-indigo-50 shadow-sm'
                              : 'border-zinc-200 bg-zinc-50 hover:border-indigo-200'
                          }`}
                        >
                          <p className={`text-sm font-semibold ${track === profile.id ? 'text-indigo-700' : 'text-zinc-800'}`}>
                            {profile.label}
                          </p>
                          <p className="mt-1 text-[11px] font-medium text-zinc-500">{profile.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                </>
              )}

              <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-4">
                {mode === 'preset' ? (
                  <>
                    <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                      Preset Library
                    </label>
                    {isLoading ? (
                      <p className="text-zinc-300 text-sm animate-pulse">Loading presets...</p>
                    ) : presets.length > 0 ? (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                          {presets.map((preset, index) => {
                            const isLastOddCard = hasOddPresetCount && index === presets.length - 1;
                            return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => setSelectedPresetId(preset.id)}
                              className={`rounded-2xl border px-4 py-4 text-left transition-all ${isLastOddCard ? 'sm:col-span-2' : ''} ${
                                selectedPresetId === preset.id
                                  ? 'border-indigo-300 bg-indigo-50 shadow-sm'
                                  : 'border-zinc-200 bg-white hover:border-indigo-200'
                              }`}
                            >
                              <div className={`flex h-full gap-3 ${isLastOddCard ? 'sm:items-start sm:justify-between' : 'flex-col'}`}>
                                <div className={`min-w-0 ${isLastOddCard ? 'sm:max-w-[52%]' : ''}`}>
                                  <p className="text-[15px] font-semibold text-zinc-800 leading-snug break-words">
                                    {preset.name}
                                  </p>
                                </div>
                                <div className={`flex flex-wrap gap-1.5 ${isLastOddCard ? 'sm:justify-end' : 'mt-auto'}`}>
                                  <span className="text-[10px] font-medium bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full">
                                    {preset.targetCount}Q
                                  </span>
                                  <span className="text-[10px] font-medium bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full">
                                    {getPresetTimeLabel(preset)}
                                  </span>
                                  {preset.difficultyLabel && (
                                    <span className="text-[10px] font-medium bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full">
                                      {preset.difficultyLabel}
                                    </span>
                                  )}
                                  {preset.roleFocus && (
                                    <span className="text-[10px] font-medium bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full capitalize">
                                      {preset.roleFocus}
                                    </span>
                                  )}
                                  {isSpecialistPreset(preset.id) && (
                                    <span className="text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full">
                                      Specialist Track
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                            );
                          })}
                        </div>
                        {selectedPreset && (
                          <div className="mt-3 space-y-2">
                            <div className="flex flex-wrap gap-1.5">
                              <span className="text-[10px] font-medium bg-white border border-zinc-200 text-zinc-600 px-2.5 py-1 rounded-full">
                                {selectedPreset.difficultyLabel ?? 'Preset'}
                              </span>
                              {typeof selectedPreset.multiSelectRatio === 'number' && (
                                <span className="text-[10px] font-medium bg-white border border-zinc-200 text-zinc-600 px-2.5 py-1 rounded-full">
                                  {Math.round(selectedPreset.multiSelectRatio * 100)}% multiple response
                                </span>
                              )}
                              {selectedPreset.isBuiltIn && (
                                <span className="text-[10px] font-medium bg-indigo-50 border border-indigo-100 text-indigo-600 px-2.5 py-1 rounded-full">
                                  Built-In
                                </span>
                              )}
                              <span className="text-[10px] font-medium bg-white border border-zinc-200 text-zinc-600 px-2.5 py-1 rounded-full">
                                Certificate eligible on pass
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-500">
                              Preset mode fixes the difficulty profile automatically. Track and experience settings stay off, and passed preset attempts can unlock a certificate.
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-red-500 text-xs font-semibold">
                        No presets found. Switch to Random or ask admin to create one.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                      Question Volume
                    </label>
                    <select
                      value={randomCount}
                      onChange={(event) => setRandomCount(Number(event.target.value) as 25 | 50 | 75 | 100)}
                      className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2.5 text-zinc-800 text-sm font-medium outline-none focus:border-indigo-400 transition-all"
                    >
                      <option value={25}>25 Questions - Focused (15 min)</option>
                      <option value={50}>50 Questions - Comprehensive (35 min)</option>
                      <option value={75}>75 Questions - Full Simulation (60 min)</option>
                      <option value={100}>100 Questions - Complete Practice (75 min)</option>
                    </select>
                  </>
                )}
              </div>

              <button
                disabled={!isValid}
                onClick={handleStart}
                className={`w-full py-3.5 rounded-xl font-semibold text-sm tracking-wide transition-all ${
                  isValid
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-100 cursor-pointer'
                    : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                }`}
              >
                Start Exam {'->'}
              </button>
            </div>

            <div>
              <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                Curriculum Coverage
              </h4>
              <div className="flex flex-wrap gap-1.5 mb-6">
                {ALL_DOMAINS.map((domain) => (
                  <span
                    key={domain}
                    className="text-[11px] font-medium bg-zinc-50 border border-zinc-200 text-zinc-600 px-3 py-1.5 rounded-lg"
                  >
                    {domain}
                  </span>
                ))}
              </div>
              <div className="border-t border-zinc-100 pt-5">
                <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                  Exam Regulations
                </h4>
                <ul className="space-y-2.5">
                  {[
                    <>Passing threshold is strictly <strong className="text-zinc-700 font-semibold">80%</strong></>,
                    <>
                      {mode === 'preset' && selectedPreset ? (
                        <>Preset profile: <strong className="text-zinc-700 font-semibold">{selectedPreset.difficultyLabel ?? 'Preset'}</strong></>
                      ) : effectiveTrack === 'hard_mode' ? (
                        <>Hard Mode intentionally pushes a tougher medium / hard mix than the live exam</>
                      ) : (
                        <>Exam-Parity keeps the mix closer to the live certification profile</>
                      )}
                    </>,
                    <>
                      Approximately <strong className="text-zinc-700 font-semibold">
                        {Math.round((mode === 'preset' ? (selectedPreset?.multiSelectRatio ?? TRACK_PROFILES[effectiveTrack].multiSelectRatio) : TRACK_PROFILES[track].multiSelectRatio) * 100)}%
                      </strong>{' '}
                      of questions are multiple response
                    </>,
                    <>Session timeout applies based on question volume</>,
                    <>Results are logged to the admin console</>,
                  ].map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-[12px] text-zinc-500 list-none">
                      <span className="text-indigo-400 mt-px select-none">{'>'}</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {!activeSessionConfig?.sessionId && (
        <div className="mt-5 flex items-center justify-center gap-3 flex-wrap">
          <button
            onClick={() => navigate('/history')}
            className="text-[11px] font-medium text-zinc-400 hover:text-indigo-500 border border-zinc-200 hover:border-indigo-200 hover:bg-indigo-50 px-5 py-2 rounded-full transition-all"
          >
            My Result History
          </button>
          <button
            onClick={() => navigate('/admin')}
            className="text-[11px] font-medium text-zinc-400 hover:text-indigo-500 border border-zinc-200 hover:border-indigo-200 hover:bg-indigo-50 px-5 py-2 rounded-full transition-all"
          >
            Admin Command Center
          </button>
        </div>
      )}
    </motion.div>
  );
}
