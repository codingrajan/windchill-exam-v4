import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { Difficulty, Preset, Question, QuestionAdminOverride, QuestionKind } from '../../types/index';
import { fetchQuestionOverrides } from '../../services/questionCatalog';
import { setQuestionStatus, upsertQuestionOverride } from '../../services/writeGateway';
import { fetchBuiltInPresets, fetchFirestorePresets, mergePresetCatalog } from '../../services/presetCatalog';
import { findReplacementQuestion, getQuestionDomain, loadQuestionPool } from '../../utils/examLogic';
import DiffBadge from '../shared/DiffBadge';
import QuestionPrompt from '../shared/QuestionPrompt';

type StatusFilter = 'all' | 'active' | 'skipped' | 'deleted';
type EditorMode = 'view' | 'edit' | 'create';

type QuestionDraft = {
  questionId: number;
  domain: string;
  topic: string;
  difficulty: Difficulty;
  type: QuestionKind;
  question: string;
  codeSnippet: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  objective: string;
  sourceManual: string;
  sourceSection: string;
  misconceptionTag: string;
  releaseVersion: string;
  status: 'active' | 'skipped' | 'deleted';
};

const EMPTY_DRAFT = (nextId: number): QuestionDraft => ({
  questionId: nextId,
  domain: '',
  topic: '',
  difficulty: 'medium',
  type: 'single',
  question: '',
  codeSnippet: '',
  options: ['', '', '', ''],
  correctAnswer: 0,
  explanation: '',
  objective: '',
  sourceManual: '',
  sourceSection: '',
  misconceptionTag: '',
  releaseVersion: '2026.04',
  status: 'active',
});

const buildDraftFromQuestion = (question: Question): QuestionDraft => ({
  questionId: question.id,
  domain: question.domain ?? '',
  topic: question.topic,
  difficulty: question.difficulty,
  type: Array.isArray(question.correctAnswer) ? 'multiple' : 'single',
  question: question.question,
  codeSnippet: question.codeSnippet ?? '',
  options: [...question.options, ...Array(Math.max(0, 4 - question.options.length)).fill('')].slice(0, 6),
  correctAnswer: Array.isArray(question.correctAnswer) ? question.correctAnswer[0] ?? 0 : question.correctAnswer,
  explanation: question.explanation,
  objective: question.objective ?? '',
  sourceManual: question.sourceManual ?? '',
  sourceSection: question.sourceSection ?? '',
  misconceptionTag: question.misconceptionTag ?? '',
  releaseVersion: question.releaseVersion ?? '2026.04',
  status: question.status ?? 'active',
});

export default function QuestionBankTab() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [overrides, setOverrides] = useState<Record<number, QuestionAdminOverride>>({});
  const [loading, setLoading] = useState(true);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>('view');
  const [draft, setDraft] = useState<QuestionDraft | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const [pool, rawOverrides] = await Promise.all([
        loadQuestionPool({ includeSkipped: true }),
        fetchQuestionOverrides().catch(() => [] as QuestionAdminOverride[]),
      ]);
      const overrideMap = Object.fromEntries(rawOverrides.map((entry) => [entry.questionId, entry]));
      setOverrides(overrideMap);
      setQuestions(pool);
      setSelectedId((current) => current ?? pool[0]?.id ?? null);
      const [firestorePresets, builtInPresets] = await Promise.all([
        fetchFirestorePresets().catch(() => [] as Preset[]),
        fetchBuiltInPresets().catch(() => [] as Preset[]),
      ]);
      setPresets(mergePresetCatalog(firestorePresets, builtInPresets));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const topics = useMemo(
    () => [...new Set(questions.map((question) => getQuestionDomain(question)))].sort(),
    [questions],
  );

  const filtered = useMemo(() => questions.filter((question) => {
    const normalizedStatus = question.status ?? 'active';
    if (statusFilter !== 'all' && normalizedStatus !== statusFilter) return false;
    if (topic && getQuestionDomain(question) !== topic) return false;
    if (difficulty && question.difficulty !== difficulty) return false;
    if (!search) return true;
    const haystack = [
      question.question,
      question.explanation,
      question.objective ?? '',
      question.sourceSection ?? '',
      question.sourceManual ?? '',
    ].join(' ').toLowerCase();
    return haystack.includes(search.toLowerCase());
  }), [questions, statusFilter, topic, difficulty, search]);

  const selectedQuestion = filtered.find((question) => question.id === selectedId) ?? filtered[0] ?? null;

  const impactedPresets = useMemo(() => {
    if (!selectedQuestion) return [];
    return presets.filter((preset) => preset.questions.includes(selectedQuestion.id));
  }, [presets, selectedQuestion]);

  const replacementPreview = useMemo(() => {
    if (!selectedQuestion) return null;
    const usedIds = new Set<number>([selectedQuestion.id]);
    return findReplacementQuestion(questions, usedIds, selectedQuestion.id);
  }, [questions, selectedQuestion]);

  useEffect(() => {
    if (editorMode !== 'view') return;
    if (!selectedQuestion) {
      setDraft(null);
      return;
    }
    setDraft(buildDraftFromQuestion(selectedQuestion));
  }, [editorMode, selectedQuestion]);

  const nextCustomQuestionId = useMemo(
    () => Math.max(2001, ...questions.map((question) => question.id + 1)),
    [questions],
  );

  const startCreate = () => {
    setEditorMode('create');
    setDraft(EMPTY_DRAFT(nextCustomQuestionId));
    setSelectedId(null);
    setMessage('');
  };

  const startEdit = () => {
    if (!selectedQuestion) return;
    setEditorMode('edit');
    setDraft(buildDraftFromQuestion(selectedQuestion));
    setMessage('');
  };

  const cancelEdit = () => {
    setEditorMode('view');
    setDraft(selectedQuestion ? buildDraftFromQuestion(selectedQuestion) : null);
  };

  const updateStatus = async (question: Question, status: 'active' | 'skipped' | 'deleted') => {
    setSavingId(question.id);
    setMessage('');
    try {
      const saved = await setQuestionStatus(question.id, status, overrides[question.id]);
      setOverrides((prev) => ({ ...prev, [question.id]: saved }));
      setQuestions((prev) => prev.map((entry) => (
        entry.id === question.id
          ? { ...entry, status, isOverride: true }
          : entry
      )));
      setDraft((prev) => prev && prev.questionId === question.id ? { ...prev, status } : prev);
      setMessage(`Question #${question.id} marked ${status}.`);
    } catch (error) {
      console.error('Question status update error:', error);
      setMessage(`Error updating question #${question.id}.`);
    } finally {
      setSavingId(null);
    }
  };

  const saveDraft = async () => {
    if (!draft) return;
    if (!draft.question.trim() || draft.options.filter((entry) => entry.trim()).length < 2 || !draft.explanation.trim() || !draft.topic.trim()) {
      setMessage('Question, topic, explanation, and at least two options are required.');
      return;
    }
    if (editorMode === 'create' && questions.some((question) => question.id === draft.questionId)) {
      setMessage(`Question id ${draft.questionId} already exists. Use a different id.`);
      return;
    }
    if (draft.correctAnswer < 0 || draft.correctAnswer >= draft.options.map((entry) => entry.trim()).filter(Boolean).length) {
      setMessage('Correct answer index does not match the current options.');
      return;
    }

    setSavingId(draft.questionId);
    setMessage('');
    try {
      const payload = {
        questionId: draft.questionId,
        domain: draft.domain.trim() || draft.topic.trim(),
        topic: draft.topic.trim(),
        difficulty: draft.difficulty,
        type: draft.type,
        question: draft.question.trim(),
        ...(draft.codeSnippet.trim() ? { codeSnippet: draft.codeSnippet } : {}),
        options: draft.options.map((entry) => entry.trim()).filter(Boolean),
        correctAnswer: draft.correctAnswer,
        explanation: draft.explanation.trim(),
        ...(draft.objective.trim() ? { objective: draft.objective.trim() } : {}),
        ...(draft.sourceManual.trim() ? { sourceManual: draft.sourceManual.trim() } : {}),
        ...(draft.sourceSection.trim() ? { sourceSection: draft.sourceSection.trim() } : {}),
        ...(draft.misconceptionTag.trim() ? { misconceptionTag: draft.misconceptionTag.trim() } : {}),
        ...(draft.releaseVersion.trim() ? { releaseVersion: draft.releaseVersion.trim() } : {}),
        status: draft.status,
      } satisfies Omit<QuestionAdminOverride, 'id' | 'updatedAt' | 'updatedBy' | 'createdAt' | 'createdBy'>;

      const saved = await upsertQuestionOverride(payload, overrides[draft.questionId]?.id);
      setOverrides((prev) => ({ ...prev, [draft.questionId]: saved }));
      await refresh();
      setSelectedId(draft.questionId);
      setEditorMode('view');
      setMessage(`Question #${draft.questionId} saved.`);
    } catch (error) {
      console.error('Question save error:', error);
      setMessage(`Error saving question #${draft.questionId}.`);
    } finally {
      setSavingId(null);
    }
  };

  const answerLabel = (question: Question): string => {
    if (Array.isArray(question.correctAnswer)) {
      return question.correctAnswer.map((index) => `${String.fromCharCode(65 + index)}. ${question.options[index]}`).join(' | ');
    }
    return `${String.fromCharCode(65 + question.correctAnswer)}. ${question.options[question.correctAnswer]}`;
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_1.45fr] gap-5">
      <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-zinc-100">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Question Bank Controls</p>
            <button
              type="button"
              onClick={startCreate}
              className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-3 py-1 rounded-lg transition-all"
            >
              + New Question
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search prompt, explanation, objective..."
              className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-zinc-300"
            />
            <select value={topic} onChange={(event) => setTopic(event.target.value)} className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 transition-all">
              <option value="">All Sections</option>
              {topics.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
            </select>
            <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 transition-all">
              <option value="">All Difficulties</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
              <option value="unrated">Unrated</option>
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 transition-all">
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="skipped">Skipped</option>
              <option value="deleted">Deleted</option>
            </select>
          </div>
          {message && (
            <p className={`mt-3 text-[12px] font-medium ${message.startsWith('Error') ? 'text-red-500' : 'text-emerald-600'}`}>
              {message}
            </p>
          )}
        </div>
        <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-100 text-[11px] font-semibold text-zinc-500">
          {loading ? 'Loading questions...' : `${filtered.length} questions in current view`}
        </div>
        <div className="max-h-[760px] overflow-y-auto divide-y divide-zinc-50">
          {filtered.map((question) => {
            const status = question.status ?? 'active';
            return (
              <button
                key={question.id}
                type="button"
                onClick={() => {
                  setSelectedId(question.id);
                  setEditorMode('view');
                }}
                className={`w-full text-left px-4 py-3 transition-colors ${selectedQuestion?.id === question.id && editorMode === 'view' ? 'bg-indigo-50/60' : 'hover:bg-zinc-50'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-zinc-800 line-clamp-2">{question.question}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="text-[10px] font-medium bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full">{getQuestionDomain(question)}</span>
                      <DiffBadge level={question.difficulty} />
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        status === 'active'
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          : status === 'skipped'
                            ? 'bg-amber-50 text-amber-600 border-amber-100'
                            : 'bg-red-50 text-red-600 border-red-100'
                      }`}>
                        {status}
                      </span>
                      {question.isOverride && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-600 border-indigo-100">Override</span>}
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-zinc-400">#{question.id}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm overflow-hidden">
        {draft ? (
          <>
            <div className="p-5 border-b border-zinc-100">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    {editorMode === 'create' ? `New Question #${draft.questionId}` : `Question #${draft.questionId}`}
                  </span>
                  <span className="text-[10px] font-medium bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full">{draft.topic || 'Unclassified'}</span>
                  <DiffBadge level={draft.difficulty} />
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    draft.status === 'active'
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                      : draft.status === 'skipped'
                        ? 'bg-amber-50 text-amber-600 border-amber-100'
                        : 'bg-red-50 text-red-600 border-red-100'
                  }`}>
                    {draft.status}
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {editorMode === 'view' ? (
                    <button type="button" onClick={startEdit} className="px-4 py-2 rounded-xl text-sm font-semibold border border-indigo-200 bg-indigo-50 text-indigo-600">
                      Edit Question
                    </button>
                  ) : (
                    <>
                      <button type="button" onClick={cancelEdit} className="px-4 py-2 rounded-xl text-sm font-semibold border border-zinc-200 bg-white text-zinc-600">
                        Cancel
                      </button>
                      <button type="button" onClick={() => void saveDraft()} disabled={savingId === draft.questionId} className="px-4 py-2 rounded-xl text-sm font-semibold border border-indigo-200 bg-indigo-50 text-indigo-600 disabled:opacity-50">
                        {savingId === draft.questionId ? 'Saving...' : 'Save'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {editorMode === 'view' && selectedQuestion ? (
                <>
                  <QuestionPrompt question={selectedQuestion} />
                  {selectedQuestion.codeSnippet && (
                    <pre className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-950 px-4 py-4 text-[12px] leading-6 text-zinc-100">
                      <code>{selectedQuestion.codeSnippet}</code>
                    </pre>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  <input
                    type="text"
                    value={draft.question}
                    onChange={(event) => setDraft((prev) => prev ? { ...prev, question: event.target.value } : prev)}
                    placeholder="Scenario-based question prompt"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 font-medium outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                  <textarea
                    value={draft.codeSnippet}
                    onChange={(event) => setDraft((prev) => prev ? { ...prev, codeSnippet: event.target.value } : prev)}
                    placeholder="Optional Java snippet"
                    rows={6}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 font-medium outline-none focus:border-indigo-400"
                  />
                </div>
              )}
            </div>

            <div className="p-5 space-y-5">
              {editorMode === 'view' && selectedQuestion ? (
                <>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">Options</div>
                    <div className="space-y-2">
                      {selectedQuestion.options.map((option, index) => {
                        const isCorrect = Array.isArray(selectedQuestion.correctAnswer)
                          ? selectedQuestion.correctAnswer.includes(index)
                          : selectedQuestion.correctAnswer === index;
                        return (
                          <div key={`${selectedQuestion.id}-${index}`} className={`rounded-xl border px-4 py-3 text-sm ${isCorrect ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-zinc-200 bg-zinc-50 text-zinc-700'}`}>
                            <span className="font-semibold mr-2">{String.fromCharCode(65 + index)}.</span>{option}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">Correct Answer</div>
                      <p className="text-sm font-semibold text-zinc-800">{answerLabel(selectedQuestion)}</p>
                    </div>
                    <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">Metadata</div>
                      <div className="space-y-1 text-sm text-zinc-600">
                        <p><span className="font-semibold text-zinc-700">Objective:</span> {selectedQuestion.objective ?? '—'}</p>
                        <p><span className="font-semibold text-zinc-700">Manual:</span> {selectedQuestion.sourceManual ?? '—'}</p>
                        <p><span className="font-semibold text-zinc-700">Section:</span> {selectedQuestion.sourceSection ?? '—'}</p>
                        <p><span className="font-semibold text-zinc-700">Misconception:</span> {selectedQuestion.misconceptionTag ?? '—'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">Preset Impact</div>
                      {impactedPresets.length > 0 ? (
                        <div className="space-y-1 text-sm text-zinc-700">
                          <p className="font-semibold">{impactedPresets.length} preset{impactedPresets.length === 1 ? '' : 's'} currently reference this question.</p>
                          {impactedPresets.slice(0, 5).map((preset) => (
                            <p key={preset.id} className="text-zinc-600">{preset.name}</p>
                          ))}
                          {impactedPresets.length > 5 && <p className="text-zinc-400">+{impactedPresets.length - 5} more</p>}
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-500">No current preset references this question.</p>
                      )}
                    </div>
                    <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">Replacement Preview If Skipped</div>
                      {replacementPreview ? (
                        <div className="space-y-1 text-sm text-zinc-700">
                          <p className="font-semibold">#{replacementPreview.id} · {replacementPreview.topic}</p>
                          <p className="text-zinc-600">{replacementPreview.question}</p>
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-500">No compatible replacement currently available.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">Explanation</div>
                    <p className="text-sm leading-6 text-zinc-700">{selectedQuestion.explanation}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="number" value={draft.questionId} onChange={(event) => setDraft((prev) => prev ? { ...prev, questionId: Number(event.target.value) || 0 } : prev)} placeholder="Question ID" className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm" disabled={editorMode === 'edit'} />
                    <input type="text" value={draft.domain} onChange={(event) => setDraft((prev) => prev ? { ...prev, domain: event.target.value } : prev)} placeholder="Domain" className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm" />
                    <input type="text" value={draft.topic} onChange={(event) => setDraft((prev) => prev ? { ...prev, topic: event.target.value } : prev)} placeholder="Section / Topic" className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm" />
                    <select value={draft.difficulty} onChange={(event) => setDraft((prev) => prev ? { ...prev, difficulty: event.target.value as Difficulty } : prev)} className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm">
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                      <option value="unrated">Unrated</option>
                    </select>
                    <select value={draft.status} onChange={(event) => setDraft((prev) => prev ? { ...prev, status: event.target.value as 'active' | 'skipped' | 'deleted' } : prev)} className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm">
                      <option value="active">Active</option>
                      <option value="skipped">Skipped</option>
                      <option value="deleted">Deleted</option>
                    </select>
                    <input type="text" value={draft.objective} onChange={(event) => setDraft((prev) => prev ? { ...prev, objective: event.target.value } : prev)} placeholder="Objective" className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm md:col-span-2" />
                    <input type="text" value={draft.sourceManual} onChange={(event) => setDraft((prev) => prev ? { ...prev, sourceManual: event.target.value } : prev)} placeholder="Source manual" className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm" />
                    <input type="text" value={draft.sourceSection} onChange={(event) => setDraft((prev) => prev ? { ...prev, sourceSection: event.target.value } : prev)} placeholder="Source section" className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm" />
                    <input type="text" value={draft.misconceptionTag} onChange={(event) => setDraft((prev) => prev ? { ...prev, misconceptionTag: event.target.value } : prev)} placeholder="Misconception tag" className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm" />
                    <input type="text" value={draft.releaseVersion} onChange={(event) => setDraft((prev) => prev ? { ...prev, releaseVersion: event.target.value } : prev)} placeholder="Release version" className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm" />
                  </div>

                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">Options</div>
                    <div className="space-y-2">
                      {draft.options.map((option, index) => (
                        <div key={`draft-option-${index}`} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setDraft((prev) => prev ? { ...prev, correctAnswer: index } : prev)}
                            className={`w-9 h-9 rounded-lg border text-[11px] font-semibold ${draft.correctAnswer === index ? 'border-emerald-300 bg-emerald-50 text-emerald-600' : 'border-zinc-200 bg-white text-zinc-500'}`}
                          >
                            {String.fromCharCode(65 + index)}
                          </button>
                          <input
                            type="text"
                            value={option}
                            onChange={(event) => setDraft((prev) => prev ? {
                              ...prev,
                              options: prev.options.map((entry, optionIndex) => optionIndex === index ? event.target.value : entry),
                            } : prev)}
                            placeholder={`Option ${String.fromCharCode(65 + index)}`}
                            className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <textarea
                    value={draft.explanation}
                    onChange={(event) => setDraft((prev) => prev ? { ...prev, explanation: event.target.value } : prev)}
                    placeholder="Explanation"
                    rows={7}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm"
                  />
                </>
              )}

              {editorMode === 'view' && selectedQuestion && (
                <div className="flex flex-wrap gap-2">
                  {(['active', 'skipped', 'deleted'] as const).map((status) => (
                    <motion.button
                      key={status}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => void updateStatus(selectedQuestion, status)}
                      disabled={savingId === selectedQuestion.id || (selectedQuestion.status ?? 'active') === status}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all disabled:opacity-40 ${
                        status === 'active'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                          : status === 'skipped'
                            ? 'border-amber-200 bg-amber-50 text-amber-600'
                            : 'border-red-200 bg-red-50 text-red-600'
                      }`}
                    >
                      {savingId === selectedQuestion.id && (selectedQuestion.status ?? 'active') !== status ? 'Saving...' : `Mark ${status}`}
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="p-10 text-sm font-medium text-zinc-400">No question matches the current filters.</div>
        )}
      </div>
    </div>
  );
}
