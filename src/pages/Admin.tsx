import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import type { ExamResult, Preset, Question } from '../types/index';
import { getQuestionDomain, loadQuestionPool } from '../utils/examLogic';

interface ExamResultDoc extends ExamResult {
  docId: string;
}

type ActiveTab = 'reports' | 'presets';
type FilterScore = 'all' | 'pass' | 'fail';
const PRESET_SLOTS = [
  { id: 'preset_1', label: 'Slot A', targetCount: 25 },
  { id: 'preset_2', label: 'Slot B', targetCount: 50 },
  { id: 'preset_3', label: 'Slot C', targetCount: 75 },
] as const;
type SlotId = (typeof PRESET_SLOTS)[number]['id'];

function LiteCheckbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      aria-checked={checked}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className="w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all"
      style={{
        background: checked ? '#4F46E5' : '#FFF',
        borderColor: checked ? '#4F46E5' : '#D4D4D8',
        boxShadow: checked ? '0 0 0 3px rgba(79,70,229,0.15)' : 'none',
      }}
    >
      {checked && (
        <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

function DifficultyBadge({ level }: { level: string }) {
  const tones: Record<string, string> = {
    easy: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    medium: 'bg-amber-50 text-amber-600 border-amber-100',
    hard: 'bg-red-50 text-red-600 border-red-100',
  };
  return <span className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${tones[level?.toLowerCase()] ?? 'bg-zinc-100 text-zinc-500 border-zinc-200'}`}>{level}</span>;
}

function ReportsTab() {
  const [records, setRecords] = useState<ExamResultDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [scoreFilter, setScoreFilter] = useState<FilterScore>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const fetchRecords = () => {
    setLoading(true);
    getDocs(query(collection(db, 'exam_results'), orderBy('examDate', 'desc')))
      .then((snap) => {
        const next: ExamResultDoc[] = [];
        snap.forEach((item) => next.push({ ...(item.data() as ExamResult), docId: item.id }));
        setRecords(next);
      })
      .catch((err) => console.error('Fetch error:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const filtered = useMemo(() => records.filter((record) => {
    const date = record.examDate ? new Date(record.examDate) : null;
    return (!name || record.examineeName.toLowerCase().includes(name.toLowerCase()))
      && (scoreFilter === 'all' || (scoreFilter === 'pass' ? record.passed : !record.passed))
      && (!from || (date && date >= new Date(from)))
      && (!to || (date && date <= new Date(`${to}T23:59:59`)));
  }), [records, name, scoreFilter, from, to]);

  const allSelected = filtered.length > 0 && filtered.every((record) => selected.has(record.docId));
  const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '--');
  const fmtTime = (seconds?: number) => (seconds || seconds === 0 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : '--');

  const toggleAll = () => setSelected((prev) => {
    const next = new Set(prev);
    filtered.forEach((record) => (allSelected ? next.delete(record.docId) : next.add(record.docId)));
    return next;
  });

  const handleDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Permanently delete ${selected.size} record(s)? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await Promise.all([...selected].map((id) => deleteDoc(doc(db, 'exam_results', id))));
      setSelected(new Set());
      fetchRecords();
    } catch (err) {
      console.error('Delete error:', err);
      alert('Some records could not be deleted. Check console.');
    } finally {
      setDeleting(false);
    }
  };

  const exportCSV = () => {
    const rows = [['Name', 'Mode', 'Score %', 'Correct', 'Total', 'Passed', 'Strongest Domain', 'Weakest Domain', 'Time (s)', 'Date'], ...filtered.map((r) => [r.examineeName, r.examMode, r.scorePercentage, r.questionsAnsweredCorrectly, r.totalQuestions, r.passed ? 'Yes' : 'No', r.strongestDomain ?? '', r.weakestDomain ?? '', r.timeTakenSeconds, r.examDate])];
    const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `exam_results_${Date.now()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm">
        <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">Filter Records</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input type="text" placeholder="Search by name..." value={name} onChange={(e) => setName(e.target.value)} className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-zinc-300" />
          <select value={scoreFilter} onChange={(e) => setScoreFilter(e.target.value as FilterScore)} className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 transition-all">
            <option value="all">All Results</option>
            <option value="pass">Passed Only</option>
            <option value="fail">Failed Only</option>
          </select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 transition-all" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 transition-all" />
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-zinc-600">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
          {selected.size > 0 && <div className="flex items-center gap-2"><span className="text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">{selected.size} selected</span><button onClick={handleDelete} disabled={deleting} className="text-xs font-semibold text-red-500 bg-red-50 border border-red-100 hover:bg-red-100 px-3 py-1 rounded-full transition-colors disabled:opacity-50">{deleting ? 'Deleting...' : 'Delete Selected'}</button></div>}
        </div>
        <button onClick={exportCSV} disabled={filtered.length === 0} className="text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 px-4 py-2 rounded-xl transition-colors disabled:opacity-40">Export CSV</button>
      </div>

      <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm overflow-hidden">
        {loading ? <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /></div> : filtered.length === 0 ? <div className="text-center py-16 text-zinc-400 text-sm font-medium">No records match your filters.</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-zinc-50 border-b border-zinc-100"><th className="px-4 py-3 text-left"><LiteCheckbox checked={allSelected} onChange={toggleAll} /></th>{['Examinee', 'Mode', 'Score', 'Result', 'Time', 'Strongest Domain', 'Date'].map((header) => <th key={header} className="px-4 py-3 text-left text-[10px] font-semibold text-zinc-400 uppercase tracking-wider whitespace-nowrap">{header}</th>)}</tr></thead>
              <tbody>{filtered.map((record, index) => <tr key={record.docId} className={`border-b border-zinc-50 hover:bg-zinc-50/60 transition-colors ${selected.has(record.docId) ? 'bg-indigo-50/40' : index % 2 === 0 ? 'bg-white' : 'bg-zinc-50/30'}`}><td className="px-4 py-3"><LiteCheckbox checked={selected.has(record.docId)} onChange={() => setSelected((prev) => { const next = new Set(prev); if (next.has(record.docId)) next.delete(record.docId); else next.add(record.docId); return next; })} /></td><td className="px-4 py-3 font-semibold text-zinc-800 whitespace-nowrap">{record.examineeName}</td><td className="px-4 py-3"><span className="text-[11px] font-medium text-zinc-500 capitalize bg-zinc-100 px-2.5 py-1 rounded-full">{record.examMode}</span></td><td className="px-4 py-3"><span className={`text-sm font-bold ${record.scorePercentage >= 80 ? 'text-emerald-600' : 'text-red-500'}`}>{record.scorePercentage}%</span><span className="text-[11px] text-zinc-400 ml-1">({record.questionsAnsweredCorrectly}/{record.totalQuestions})</span></td><td className="px-4 py-3"><span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${record.passed ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-500 border-red-100'}`}>{record.passed ? 'PASS' : 'FAIL'}</span></td><td className="px-4 py-3 text-zinc-500 font-medium whitespace-nowrap">{fmtTime(record.timeTakenSeconds)}</td><td className="px-4 py-3 text-zinc-500 font-medium text-[12px] max-w-[140px] truncate">{record.strongestDomain ?? '--'}</td><td className="px-4 py-3 text-zinc-400 text-[12px] whitespace-nowrap">{fmtDate(record.examDate)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function PresetsTab() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSlot, setActiveSlot] = useState<SlotId>('preset_1');
  const [presets, setPresets] = useState<Partial<Record<SlotId, Preset>>>({});
  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [presetName, setPresetName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState('');
  const slot = PRESET_SLOTS.find((item) => item.id === activeSlot)!;

  useEffect(() => { void loadQuestionPool().then((pool) => { setQuestions(pool); setLoading(false); }); }, []);
  useEffect(() => { PRESET_SLOTS.forEach((item) => { void getDoc(doc(db, 'exam_presets', item.id)).then((snapshot) => { if (snapshot.exists()) setPresets((prev) => ({ ...prev, [item.id]: snapshot.data() as Preset })); }).catch((err) => console.error(`Preset load error for ${item.id}:`, err)); }); }, []);
  useEffect(() => { const current = presets[activeSlot]; setPresetName(current?.name ?? ''); setSelected(new Set(current?.questions ?? [])); }, [activeSlot, presets]);

  const topics = useMemo(() => [...new Set(questions.map((question) => getQuestionDomain(question)))].sort(), [questions]);
  const filtered = useMemo(() => questions.filter((question) => (!search || question.question.toLowerCase().includes(search.toLowerCase())) && (!topic || getQuestionDomain(question) === topic) && (!difficulty || question.difficulty?.toLowerCase() === difficulty)), [questions, search, topic, difficulty]);
  const allFiltered = filtered.length > 0 && filtered.every((question) => selected.has(question.id));

  const toggleAll = () => setSelected((prev) => {
    const next = new Set(prev);
    filtered.forEach((question) => (allFiltered ? next.delete(question.id) : next.add(question.id)));
    return next;
  });

  const savePreset = async (e: FormEvent) => {
    e.preventDefault();
    if (selected.size !== slot.targetCount || !presetName.trim()) return;
    setSaving(true);
    setMessage('');
    try {
      const payload: Preset = { id: activeSlot, name: presetName.trim(), questions: [...selected], targetCount: slot.targetCount, updatedAt: new Date().toISOString() };
      await setDoc(doc(db, 'exam_presets', activeSlot), payload);
      setPresets((prev) => ({ ...prev, [activeSlot]: payload }));
      setMessage('Preset saved successfully.');
    } catch (err) {
      console.error('Save error:', err);
      setMessage('Error saving preset.');
    } finally {
      setSaving(false);
    }
  };

  const deletePreset = async () => {
    if (!confirm(`Delete the preset in ${slot.label}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'exam_presets', activeSlot));
      setPresets((prev) => { const next = { ...prev }; delete next[activeSlot]; return next; });
      setPresetName('');
      setSelected(new Set());
      setMessage('Preset deleted.');
    } catch (err) {
      console.error('Delete error:', err);
      setMessage('Error deleting preset.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      <div className="xl:col-span-1 space-y-4">
        <div className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">Preset Slots</p>
          <div className="space-y-2">{PRESET_SLOTS.map((item) => <button key={item.id} onClick={() => setActiveSlot(item.id)} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left ${activeSlot === item.id ? 'border-indigo-400 bg-indigo-50' : 'border-zinc-100 bg-zinc-50 hover:border-indigo-200'}`}><div><span className={`text-sm font-semibold ${activeSlot === item.id ? 'text-indigo-700' : 'text-zinc-700'}`}>{item.label}</span><span className="text-[11px] text-zinc-400 ml-2">{item.targetCount}Q</span></div>{presets[item.id] ? <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">Active</span> : <span className="text-[10px] font-medium text-zinc-400">Empty</span>}</button>)}</div>
        </div>

        <div className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{slot.label} - {slot.targetCount} Questions</p>
            {presets[activeSlot] && <button onClick={deletePreset} disabled={deleting} className="text-[11px] font-semibold text-red-500 hover:text-red-600 transition-colors disabled:opacity-50">{deleting ? 'Deleting...' : 'Delete Preset'}</button>}
          </div>
          <form onSubmit={savePreset} className="space-y-4">
            <input type="text" placeholder="e.g. Week 3 Mock Exam" value={presetName} onChange={(e) => setPresetName(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-zinc-300" />
            <div className={`rounded-xl px-4 py-3 border text-center ${selected.size === slot.targetCount ? 'bg-emerald-50 border-emerald-100' : 'bg-zinc-50 border-zinc-100'}`}><span className={`text-sm font-bold ${selected.size === slot.targetCount ? 'text-emerald-600' : 'text-zinc-500'}`}>{selected.size} / {slot.targetCount} selected</span>{selected.size !== slot.targetCount && <p className="text-[11px] text-zinc-400 mt-0.5">Select exactly {slot.targetCount} questions to save</p>}</div>
            <button type="submit" disabled={selected.size !== slot.targetCount || !presetName.trim() || saving} className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-100">{saving ? 'Saving...' : `Save ${slot.label} Preset`}</button>
            {message && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`text-[12px] font-medium text-center ${message.includes('Error') ? 'text-red-500' : 'text-emerald-600'}`}>{message}</motion.p>}
          </form>
        </div>
      </div>

      <div className="xl:col-span-2 space-y-4">
        <div className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">Filter Question Pool</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input type="text" placeholder="Search questions..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-zinc-300" />
            <select value={topic} onChange={(e) => setTopic(e.target.value)} className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 transition-all"><option value="">All Topics</option>{topics.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 transition-all"><option value="">All Difficulties</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select>
          </div>
        </div>

        <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm overflow-hidden">
          {loading ? <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /></div> : <>
            <div className="flex items-center gap-3 px-4 py-3 bg-zinc-50 border-b border-zinc-100"><LiteCheckbox checked={allFiltered} onChange={toggleAll} /><span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{filtered.length} question{filtered.length !== 1 ? 's' : ''} shown</span></div>
            <div className="max-h-[520px] overflow-y-auto divide-y divide-zinc-50">{filtered.map((question) => <div key={question.id} onClick={() => setSelected((prev) => { const next = new Set(prev); if (next.has(question.id)) next.delete(question.id); else next.add(question.id); return next; })} className={`flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors ${selected.has(question.id) ? 'bg-indigo-50/50' : 'hover:bg-zinc-50'}`}><LiteCheckbox checked={selected.has(question.id)} onChange={() => setSelected((prev) => { const next = new Set(prev); if (next.has(question.id)) next.delete(question.id); else next.add(question.id); return next; })} /><div className="flex-grow min-w-0"><p className="text-[13px] font-medium text-zinc-700 leading-snug line-clamp-2">{question.question}</p><div className="flex items-center gap-2 mt-1.5 flex-wrap"><span className="text-[10px] font-medium bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full">{getQuestionDomain(question)}</span><DifficultyBadge level={question.difficulty} />{Array.isArray(question.correctAnswer) && <span className="text-[10px] font-medium bg-indigo-50 text-indigo-500 border border-indigo-100 px-2 py-0.5 rounded-full">Multi</span>}<span className="text-[10px] text-zinc-300 font-medium ml-auto">#{question.id}</span></div></div></div>)}</div>
          </>}
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [tab, setTab] = useState<ActiveTab>('reports');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => onAuthStateChanged(auth, (user) => { setAuthed(!!user); setAuthLoading(false); }), []);
  useEffect(() => {
    if (!authed) return;
    const resetTimer = () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      inactivityTimer.current = setTimeout(() => void signOut(auth), 120_000);
    };
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'] as const;
    events.forEach((eventName) => window.addEventListener(eventName, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      events.forEach((eventName) => window.removeEventListener(eventName, resetTimer));
    };
  }, [authed]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoggingIn(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setError('Invalid credentials. Please try again.');
    } finally {
      setLoggingIn(false);
    }
  };

  if (authLoading) return <div className="flex h-64 items-center justify-center"><div className="w-7 h-7 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /></div>;

  if (!authed) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex items-center justify-center min-h-[70vh] px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-50 border border-indigo-100 rounded-2xl mb-4"><span className="text-lg font-bold text-indigo-600 select-none">A</span></div>
            <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Admin Console</h2>
            <p className="text-zinc-500 text-sm font-medium mt-1">Windchill Exam Administration</p>
          </div>
          <div className="bg-white border border-zinc-100 rounded-3xl shadow-sm p-8">
            <form onSubmit={handleLogin} className="space-y-4">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" required className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 font-medium outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all placeholder:text-zinc-300" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 font-medium outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all placeholder:text-zinc-300" />
              <AnimatePresence>{error && <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-xs font-semibold text-red-500 text-center">{error}</motion.p>}</AnimatePresence>
              <button type="submit" disabled={loggingIn} className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm tracking-wide shadow-sm shadow-indigo-100 transition-all disabled:opacity-60">{loggingIn ? 'Signing in...' : 'Sign In ->'}</button>
            </form>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="max-w-7xl mx-auto py-4 px-2">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Admin Command Center</h1><p className="text-sm text-zinc-500 font-medium mt-0.5">Exam Reports and Preset Management</p></div>
        <button onClick={() => void signOut(auth)} className="text-xs font-semibold text-zinc-500 border border-zinc-200 hover:border-red-200 hover:text-red-500 hover:bg-red-50 px-4 py-2 rounded-full transition-all">Sign Out</button>
      </div>
      <div className="flex gap-1 bg-zinc-100 p-1 rounded-xl w-fit mb-6">{([{ key: 'reports', label: 'Exam Reports' }, { key: 'presets', label: 'Preset Manager' }] as const).map((item) => <button key={item.key} onClick={() => setTab(item.key)} className={`px-5 py-2 rounded-lg text-xs font-semibold transition-all ${tab === item.key ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}>{item.label}</button>)}</div>
      <AnimatePresence mode="wait"><motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>{tab === 'reports' ? <ReportsTab /> : <PresetsTab />}</motion.div></AnimatePresence>
    </motion.div>
  );
}
