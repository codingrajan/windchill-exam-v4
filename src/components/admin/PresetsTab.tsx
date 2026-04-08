import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { motion } from 'framer-motion';
import type { Preset, Question } from '../../types/index';
import { removePreset, upsertPreset } from '../../services/writeGateway';
import { getQuestionDomain, loadQuestionPool } from '../../utils/examLogic';
import { fetchBuiltInPresets, fetchFirestorePresets, mergePresetCatalog, syncBuiltInPresetsToFirestore } from '../../services/presetCatalog';
import DiffBadge from '../shared/DiffBadge';
import LiteCheckbox from '../shared/LiteCheckbox';

type ActiveView = { kind: 'new' } | { kind: 'edit'; preset: Preset };

export default function PresetsTab() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [poolLoading, setPoolLoading] = useState(true);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(true);

  const [activeView, setActiveView] = useState<ActiveView | null>(null);
  const [presetName, setPresetName] = useState('');
  const [targetCount, setTargetCount] = useState(25);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    void loadQuestionPool().then((pool) => { setQuestions(pool); setPoolLoading(false); });
  }, []);

  const loadPresets = async (seedBuiltIns = false) => {
    try {
      const [firestorePresets, builtInPresets] = await Promise.all([
        fetchFirestorePresets().catch(() => [] as Preset[]),
        fetchBuiltInPresets().catch(() => [] as Preset[]),
      ]);

      if (seedBuiltIns && builtInPresets.length > 0) {
        try {
          const syncResult = await syncBuiltInPresetsToFirestore(builtInPresets, firestorePresets);
          if (syncResult.syncedIds.length > 0) {
            setMessage(`Synced ${syncResult.syncedIds.length} built-in preset${syncResult.syncedIds.length !== 1 ? 's' : ''} to Firestore.`);
          } else if (syncResult.failedIds.length > 0) {
            setMessage('Built-in presets loaded from fallback. Firestore sync was blocked.');
          }
        } catch (error) {
          console.error('Built-in preset sync error:', error);
          setMessage('Built-in presets loaded from fallback. Firestore sync failed.');
        }
      }

      const refreshedFirestorePresets = await fetchFirestorePresets().catch(() => firestorePresets);
      const merged = mergePresetCatalog(refreshedFirestorePresets, builtInPresets);
      setPresets(merged);
    } finally {
      setPresetsLoading(false);
    }
  };

  useEffect(() => {
    void loadPresets(true);
  }, []);

  const openNew = () => {
    setActiveView({ kind: 'new' });
    setPresetName('');
    setTargetCount(25);
    setSelected(new Set());
    setMessage('');
  };

  const openEdit = (preset: Preset) => {
    setActiveView({ kind: 'edit', preset });
    setPresetName(preset.name);
    setTargetCount(preset.targetCount);
    setSelected(new Set(preset.questions));
    setMessage('');
  };

  const topics = useMemo(() => [...new Set(questions.map((q) => getQuestionDomain(q)))].sort(), [questions]);
  const filtered = useMemo(() => questions.filter((q) =>
    (!search || q.question.toLowerCase().includes(search.toLowerCase()))
    && (!topic || getQuestionDomain(q) === topic)
    && (!difficulty || q.difficulty?.toLowerCase() === difficulty)
  ), [questions, search, topic, difficulty]);
  const allFiltered = filtered.length > 0 && filtered.every((q) => selected.has(q.id));

  const toggleAll = () => setSelected((prev) => {
    const next = new Set(prev);
    filtered.forEach((q) => allFiltered ? next.delete(q.id) : next.add(q.id));
    return next;
  });

  const savePreset = async (e: FormEvent) => {
    e.preventDefault();
    if (!presetName.trim() || selected.size !== targetCount) return;
    setSaving(true); setMessage('');
    try {
      const payload = { name: presetName.trim(), questions: [...selected], targetCount, updatedAt: new Date().toISOString() };
      if (activeView?.kind === 'edit') {
        const id = activeView.preset.id;
        const updated = await upsertPreset(payload, id);
        setPresets((prev) => mergePresetCatalog(prev.map((p) => p.id === id ? updated : p), []));
        setActiveView({ kind: 'edit', preset: updated });
        setMessage('Preset updated successfully.');
      } else {
        const created = await upsertPreset(payload);
        setPresets((prev) => mergePresetCatalog([...prev, created], []));
        setActiveView({ kind: 'edit', preset: created });
        setMessage('Preset created successfully.');
      }
    } catch (err) {
      console.error('Save error:', err);
      setMessage('Error saving preset.');
    } finally { setSaving(false); }
  };

  const deletePreset = async () => {
    if (activeView?.kind !== 'edit') return;
    const { preset } = activeView;
    if (!window.confirm(`Delete "${preset.name}"? Exam sessions using this preset will be affected.`)) return;
    setDeleting(true);
    try {
      await removePreset(preset);
      setPresets((prev) => prev.filter((p) => p.id !== preset.id));
      setActiveView(null);
      setPresetName(''); setSelected(new Set()); setMessage('');
    } catch (err) { console.error('Delete error:', err); setMessage('Error deleting preset.'); }
    finally { setDeleting(false); }
  };

  const isEditingId = activeView?.kind === 'edit' ? activeView.preset.id : null;
  const canSave = presetName.trim().length > 0 && selected.size === targetCount && targetCount > 0;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      {/* Left panel — preset list + editor */}
      <div className="xl:col-span-1 space-y-4">
        {/* Preset list */}
        <div className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Saved Presets</p>
            <button
              onClick={openNew}
              className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-3 py-1 rounded-lg transition-all"
            >
              + New Preset
            </button>
          </div>
          {presetsLoading ? (
            <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          ) : presets.length === 0 ? (
            <p className="text-sm text-zinc-400">No presets yet. Create your first one.</p>
          ) : (
            <div className="space-y-2">
              {presets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => openEdit(p)}
                  className={`w-full flex items-start justify-between gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${isEditingId === p.id ? 'border-indigo-400 bg-indigo-50' : 'border-zinc-100 bg-zinc-50 hover:border-indigo-200'}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold leading-snug break-words ${isEditingId === p.id ? 'text-indigo-700' : 'text-zinc-700'}`}>{p.name}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-zinc-400">{p.targetCount}Q</span>
                      {p.isBuiltIn && <span className="text-[10px] font-semibold text-indigo-500 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">Built-In</span>}
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full whitespace-nowrap">{p.difficultyLabel ?? 'Active'}</span>
                </button>
              ))}
            </div>
          )}
          {message && !activeView && (
            <p className={`mt-3 text-[12px] font-medium ${message.includes('blocked') || message.includes('failed') || message.includes('Error') ? 'text-amber-600' : 'text-emerald-600'}`}>
              {message}
            </p>
          )}
        </div>

        {/* Editor panel */}
        {activeView && (
          <div className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                {activeView.kind === 'new' ? 'New Preset' : 'Edit Preset'}
              </p>
              {activeView.kind === 'edit' && (
                <button onClick={() => void deletePreset()} disabled={deleting} className="text-[11px] font-semibold text-red-500 hover:text-red-600 disabled:opacity-50">
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              )}
            </div>
            <form onSubmit={(e) => void savePreset(e)} className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Preset Name</label>
                <input
                  type="text"
                  placeholder="e.g. Week 3 Mock Exam"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-zinc-300"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Question Count</label>
                <input
                  type="number"
                  min={1}
                  max={questions.length || 999}
                  value={targetCount}
                  onChange={(e) => { setTargetCount(Math.max(1, Number(e.target.value))); setSelected(new Set()); }}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                />
              </div>
              <div className={`rounded-xl px-4 py-3 border text-center ${selected.size === targetCount ? 'bg-emerald-50 border-emerald-100' : 'bg-zinc-50 border-zinc-100'}`}>
                <span className={`text-sm font-bold ${selected.size === targetCount ? 'text-emerald-600' : 'text-zinc-500'}`}>{selected.size} / {targetCount} selected</span>
                {selected.size !== targetCount && <p className="text-[11px] text-zinc-400 mt-0.5">Select exactly {targetCount} questions from the pool</p>}
              </div>
              <button
                type="submit"
                disabled={!canSave || saving}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
              >
                {saving ? 'Saving...' : activeView.kind === 'new' ? 'Create Preset' : 'Update Preset'}
              </button>
              {message && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`text-[12px] font-medium text-center ${message.includes('Error') ? 'text-red-500' : 'text-emerald-600'}`}>
                  {message}
                </motion.p>
              )}
            </form>
          </div>
        )}
      </div>

      {/* Right panel — question pool */}
      <div className="xl:col-span-2 space-y-4">
        {activeView ? (
          <>
            <div className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm">
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">Filter Question Pool</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Search questions..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-zinc-300"
                />
                <select value={topic} onChange={(e) => setTopic(e.target.value)} className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 transition-all">
                  <option value="">All Topics</option>
                  {topics.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 transition-all">
                  <option value="">All Difficulties</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>

            <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm overflow-hidden">
              {poolLoading ? (
                <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /></div>
              ) : (
                <>
                  <div className="flex items-center gap-3 px-4 py-3 bg-zinc-50 border-b border-zinc-100">
                    <LiteCheckbox checked={allFiltered} onChange={toggleAll} />
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{filtered.length} question{filtered.length !== 1 ? 's' : ''} shown</span>
                  </div>
                  <div className="max-h-[520px] overflow-y-auto divide-y divide-zinc-50">
                    {filtered.map((q) => (
                      <div
                        key={q.id}
                        onClick={() => setSelected((prev) => { const next = new Set(prev); next.has(q.id) ? next.delete(q.id) : next.add(q.id); return next; })}
                        className={`flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors ${selected.has(q.id) ? 'bg-indigo-50/50' : 'hover:bg-zinc-50'}`}
                      >
                        <LiteCheckbox
                          checked={selected.has(q.id)}
                          onChange={() => setSelected((prev) => { const next = new Set(prev); next.has(q.id) ? next.delete(q.id) : next.add(q.id); return next; })}
                        />
                        <div className="flex-grow min-w-0">
                          <p className="text-[13px] font-medium text-zinc-700 leading-snug line-clamp-2">{q.question}</p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-[10px] font-medium bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full">{getQuestionDomain(q)}</span>
                            <DiffBadge level={q.difficulty} />
                            {Array.isArray(q.correctAnswer) && <span className="text-[10px] font-medium bg-indigo-50 text-indigo-500 border border-indigo-100 px-2 py-0.5 rounded-full">Multi</span>}
                            <span className="text-[10px] text-zinc-300 font-medium ml-auto">#{q.id}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="bg-white border border-zinc-100 rounded-2xl p-10 shadow-sm">
            <p className="text-zinc-400 text-sm font-medium">Select a preset to edit or create a new one.</p>
          </div>
        )}
      </div>
    </div>
  );
}
