import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { ExamResult, Question, QuestionResult } from '../../types/index';
import { getQuestionDomain, loadQuestionPool } from '../../utils/examLogic';
import DiffBadge from '../shared/DiffBadge';

interface QuestionStat {
  questionId: number;
  attempts: number;
  correct: number;
  skipped: number;
  totalTime: number;
}

export default function AnalyticsTab() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [stats, setStats] = useState<Map<number, QuestionStat>>(new Map());
  const [loading, setLoading] = useState(true);
  const [diffFilter, setDiffFilter] = useState('');
  const [domainFilter, setDomainFilter] = useState('');

  useEffect(() => {
    const load = async () => {
      const [pool, snap] = await Promise.all([
        loadQuestionPool(),
        getDocs(collection(db, 'exam_results')),
      ]);
      setQuestions(pool);

      const map = new Map<number, QuestionStat>();
      snap.forEach((d) => {
        const result = d.data() as ExamResult;
        if (!result.questionResults?.length) return;
        result.questionResults.forEach((qr: QuestionResult) => {
          const entry = map.get(qr.questionId) ?? { questionId: qr.questionId, attempts: 0, correct: 0, skipped: 0, totalTime: 0 };
          entry.attempts++;
          if (qr.correct) entry.correct++;
          if (qr.skipped) entry.skipped++;
          entry.totalTime += qr.timeTaken;
          map.set(qr.questionId, entry);
        });
      });
      setStats(map);
      setLoading(false);
    };
    void load();
  }, []);

  const domains = useMemo(() => [...new Set(questions.map((q) => getQuestionDomain(q)))].sort(), [questions]);

  const rows = useMemo(() => {
    return questions
      .filter((q) => stats.has(q.id))
      .filter((q) => !diffFilter || q.difficulty === diffFilter)
      .filter((q) => !domainFilter || getQuestionDomain(q) === domainFilter)
      .map((q) => {
        const s = stats.get(q.id)!;
        const accuracy = s.attempts > 0 ? Math.round((s.correct / s.attempts) * 100) : 0;
        const avgTime = s.attempts > 0 ? Math.round(s.totalTime / s.attempts) : 0;
        return { q, s, accuracy, avgTime };
      })
      .sort((a, b) => a.accuracy - b.accuracy); // hardest first
  }, [questions, stats, diffFilter, domainFilter]);

  const accuracyColor = (acc: number) => acc >= 60 ? 'bg-emerald-500' : acc >= 40 ? 'bg-amber-500' : 'bg-red-500';
  const accuracyText = (acc: number) => acc >= 60 ? 'text-emerald-600' : acc >= 40 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="space-y-5">
      <div className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Question Bank Analytics</p>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-zinc-400">{stats.size} questions with data</span>
          </div>
        </div>
        <div className="mb-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
          <p className="text-[11px] font-medium text-amber-700">
            Analytics are derived live from saved exam reports. Delete reports from the Exam Reports tab only when you intentionally want analytics to change too.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
          <select value={diffFilter} onChange={(e) => setDiffFilter(e.target.value)} className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 transition-all">
            <option value="">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
          <select value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)} className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 transition-all">
            <option value="">All Domains</option>
            {domains.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /></div>
        ) : stats.size === 0 ? (
          <div className="text-center py-16 px-6">
            <p className="text-zinc-400 text-sm font-medium">No per-question data yet.</p>
            <p className="text-zinc-300 text-xs mt-1">Analytics appear here once candidates complete exams. Results are tracked automatically going forward.</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-zinc-400 text-sm">No questions match the selected filters.</div>
        ) : (
          <>
            <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-100">
              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{rows.length} questions — sorted hardest first</p>
            </div>
            <div className="divide-y divide-zinc-50 max-h-[600px] overflow-y-auto">
              {rows.map(({ q, s, accuracy, avgTime }) => (
                <div key={q.id} className="px-5 py-4 hover:bg-zinc-50/60 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-zinc-700 leading-snug line-clamp-2 mb-2">{q.question}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-medium bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full">{getQuestionDomain(q)}</span>
                        <DiffBadge level={q.difficulty} />
                        <span className="text-[10px] text-zinc-400">#{q.id}</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right min-w-[120px]">
                      <span className={`text-lg font-bold ${accuracyText(accuracy)}`}>{accuracy}%</span>
                      <p className="text-[10px] text-zinc-400">accuracy</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">{s.attempts} attempts · {avgTime}s avg</p>
                    </div>
                  </div>
                  {/* Accuracy bar */}
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex-1 bg-zinc-100 rounded-full h-1.5 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${accuracyColor(accuracy)}`} style={{ width: `${accuracy}%` }} />
                    </div>
                    <div className="flex gap-3 text-[10px] text-zinc-400 flex-shrink-0">
                      <span className="text-emerald-600 font-semibold">{s.correct} correct</span>
                      <span className="text-red-500">{s.attempts - s.correct - s.skipped} wrong</span>
                      <span className="text-zinc-400">{s.skipped} skipped</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
