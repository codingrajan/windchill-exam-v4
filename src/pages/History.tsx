import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { TRACK_PROFILES } from '../constants/examStrategy';
import { buildCertificateHTML } from '../utils/certificate';
import { buildHistoryInsights } from '../utils/examInsights';
import type { ExamResult } from '../types/index';
import { isValidEmail, normalizeEmail } from '../utils/email';

interface HistoryRecord extends ExamResult {
  docId: string;
}

export default function History() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [results, setResults] = useState<HistoryRecord[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const insights = buildHistoryInsights(results);

  const dedupeRecords = (items: HistoryRecord[]): HistoryRecord[] => {
    const seen = new Map<string, HistoryRecord>();
    items.forEach((item) => {
      const fingerprint = [
        item.attemptId ?? 'no-attempt',
        item.sessionId ?? 'no-session',
        item.participantId ?? 'no-participant',
        item.candidateEmail ?? item.examineeName,
        item.scorePercentage,
        item.totalQuestions,
        item.examDate,
      ].join('::');
      if (!seen.has(fingerprint)) seen.set(fingerprint, item);
    });
    return [...seen.values()];
  };

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = normalizeEmail(email);

    if (!trimmed) {
      setError('Please enter your email address.');
      return;
    }
    if (!isValidEmail(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'exam_results'), where('candidateEmail', '==', trimmed)),
      );
      const list: HistoryRecord[] = [];
      snap.forEach((entry) => list.push({ ...(entry.data() as ExamResult), docId: entry.id }));
      list.sort((left, right) => right.examDate.localeCompare(left.examDate));
      setResults(dedupeRecords(list));
      setSearched(true);
    } catch (err) {
      console.error('History fetch error:', err);
      setError('Could not load results. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openCertificate = (result: HistoryRecord) => {
    const win = window.open('', '_blank', 'width=920,height=680');
    if (!win) return;

    const origin = window.location.origin;
    const html = buildCertificateHTML({
      name: result.examineeName,
      score: result.scorePercentage,
      date: new Date(result.examDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
      examTitle: result.sessionName ?? 'PTC x Plural Mock Exam',
      totalQuestions: result.totalQuestions,
      correct: result.questionsAnsweredCorrectly,
      ptcLogoUrl: `${origin}/images/ptc_logo.png`,
      pluralLogoUrl: `${origin}/images/plural_logo.jpg`,
    });

    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 600);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-3xl mx-auto py-6 px-2"
    >
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-50 border border-indigo-100 rounded-2xl mb-4">
          <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">My Result History</h2>
        <p className="text-zinc-500 text-sm font-medium mt-1">Look up past exam results by email</p>
      </div>

      <div className="bg-white border border-zinc-100 rounded-3xl shadow-sm p-8 mb-5">
        <form onSubmit={(e) => void handleSearch(e)} className="flex gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            inputMode="email"
            autoComplete="email"
            required
            autoFocus
            className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 font-medium outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all placeholder:text-zinc-300"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all disabled:opacity-60 flex-shrink-0"
          >
            {loading ? '...' : 'Look Up'}
          </button>
        </form>
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-xs font-semibold text-red-500 text-center mt-3"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {searched && (
        <div className="space-y-5">
          {insights && (
            <div className="bg-white border border-zinc-100 rounded-3xl shadow-sm p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
                <div>
                  <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider mb-1">Performance Dashboard</p>
                  <h3 className="text-lg font-bold text-zinc-900">Attempt trend for {email.trim().toLowerCase()}</h3>
                  <p className="text-sm text-zinc-500 mt-1">{insights.readinessHeadline}</p>
                </div>
                <span className={`text-[11px] font-semibold px-3 py-1 rounded-full border ${
                  insights.trendLabel === 'improving'
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                    : insights.trendLabel === 'declining'
                      ? 'bg-red-50 text-red-600 border-red-200'
                      : 'bg-zinc-50 text-zinc-600 border-zinc-200'
                }`}>
                  Trend: {insights.trendLabel}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-4">
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Attempts</p>
                  <p className="text-2xl font-bold text-zinc-900">{insights.attemptCount}</p>
                </div>
                <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-4">
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Latest</p>
                  <p className="text-2xl font-bold text-zinc-900">{insights.latestScore}%</p>
                </div>
                <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-4">
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Best</p>
                  <p className="text-2xl font-bold text-zinc-900">{insights.bestScore}%</p>
                </div>
                <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-4">
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Pass Rate</p>
                  <p className="text-2xl font-bold text-zinc-900">{insights.passRate}%</p>
                </div>
              </div>
              {insights.priorityFocus.length > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                  <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-2">Priority Focus</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {insights.priorityFocus.map((focus) => (
                      <div key={focus} className="text-sm font-medium text-zinc-700 bg-white/80 border border-amber-100 rounded-xl px-4 py-3">
                        {focus}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm overflow-hidden">
            {results.length === 0 ? (
              <div className="text-center py-16 px-6">
                <p className="text-zinc-400 text-sm font-medium">No results found for this email.</p>
                <p className="text-zinc-300 text-xs mt-1">Results are only tracked when an email is provided during the exam.</p>
              </div>
            ) : (
              <>
                <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-100">
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                    {results.length} result{results.length !== 1 ? 's' : ''} found
                  </p>
                </div>
                <div className="divide-y divide-zinc-50">
                  {results.map((result) => {
                    const date = new Date(result.examDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                    const time = new Date(result.examDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                    const mins = Math.floor(result.timeTakenSeconds / 60);
                    const secs = result.timeTakenSeconds % 60;
                    const label = result.sessionName
                      ?? (result.examMode === 'preset'
                        ? 'Preset Exam'
                        : result.examMode === 'remediation'
                          ? 'Remediation Quiz'
                          : 'Random Exam');

                    return (
                      <div key={result.docId} className="px-5 py-4 flex items-center gap-4 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-zinc-800 truncate">{label}</p>
                          <p className="text-[11px] text-zinc-400 mt-0.5">
                            {date} at {time} · {mins}m {secs}s
                            {result.examTrack ? ` · ${TRACK_PROFILES[result.examTrack].shortLabel}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap justify-end flex-shrink-0">
                          <span className="text-lg font-bold text-zinc-800">{result.scorePercentage}%</span>
                          <span className={`text-[11px] font-semibold px-3 py-1 rounded-full border ${
                            result.passed ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'
                          }`}>
                            {result.passed ? 'Passed' : 'Failed'}
                          </span>
                          {result.examMode === 'preset' && (
                            <span className={`text-[11px] font-semibold px-3 py-1 rounded-full border ${
                              result.passed
                                ? 'bg-blue-50 text-blue-600 border-blue-200'
                                : 'bg-zinc-50 text-zinc-500 border-zinc-200'
                            }`}>
                              {result.passed ? 'Certificate Available' : 'Certificate Locked'}
                            </span>
                          )}
                          <button
                            onClick={() => navigate(`/result/${result.docId}`)}
                            className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            View Report
                          </button>
                          {result.passed && result.examMode === 'preset' && (
                            <button
                              onClick={() => openCertificate(result)}
                              className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Certificate
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="mt-5 text-center">
        <button
          onClick={() => navigate('/')}
          className="text-[11px] font-medium text-zinc-400 hover:text-indigo-500 border border-zinc-200 hover:border-indigo-200 hover:bg-indigo-50 px-5 py-2 rounded-full transition-all"
        >
          Back to Home
        </button>
      </div>
    </motion.div>
  );
}
