import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { buildCertificateHTML } from '../utils/certificate';
import { buildReportSummaryHTML } from '../utils/reportSummary';
import { buildReviewCoachingSummary, getTrackProfile } from '../utils/examInsights';
import { getQuestionDomain, loadQuestionPool } from '../utils/examLogic';
import type { AnswerValue, ExamResult, Question, QuestionResult } from '../types/index';
import { useContentProtection } from '../hooks/useContentProtection';
import QuestionPrompt from '../components/shared/QuestionPrompt';

function DiffBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    easy: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    medium: 'bg-amber-50 text-amber-600 border-amber-100',
    hard: 'bg-red-50 text-red-600 border-red-100',
  };

  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${styles[level?.toLowerCase()] ?? 'bg-zinc-100 text-zinc-500 border-zinc-200'}`}>
      {level}
    </span>
  );
}

function StatBox({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-4 text-center">
      <div className={`text-2xl font-bold mb-1 ${color}`}>{value}</div>
      <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{label}</div>
    </div>
  );
}

function ReviewRow({
  index,
  question,
  result,
  answer,
}: {
  index: number;
  question: Question;
  result?: QuestionResult;
  answer?: AnswerValue | null;
}) {
  const [open, setOpen] = useState(false);
  const isMulti = Array.isArray(question.correctAnswer);
  const status = result?.correct ? 'correct' : result?.skipped ? 'skipped' : 'wrong';

  const isSelected = (optionIndex: number) => {
    if (Array.isArray(answer)) return answer.includes(optionIndex);
    return answer === optionIndex;
  };

  const isCorrectOption = (optionIndex: number) =>
    Array.isArray(question.correctAnswer) ? question.correctAnswer.includes(optionIndex) : question.correctAnswer === optionIndex;

  return (
    <div className={`border rounded-2xl overflow-hidden ${status === 'correct' ? 'border-emerald-200' : status === 'skipped' ? 'border-zinc-200' : 'border-red-200'}`}>
      <button onClick={() => setOpen((previous) => !previous)} className="w-full flex items-start gap-4 p-4 text-left hover:bg-zinc-50 transition-colors">
        <span className={`w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center text-xs font-bold mt-0.5 ${
          status === 'correct' ? 'text-emerald-600 bg-emerald-50' : status === 'skipped' ? 'text-zinc-400 bg-zinc-50' : 'text-red-600 bg-red-50'
        }`}>
          {status === 'correct' ? 'OK' : status === 'skipped' ? '--' : 'NO'}
        </span>
        <div className="flex-grow min-w-0">
          <div className="mb-1.5">
            <QuestionPrompt question={question} index={index} compact />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] font-medium bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full">{getQuestionDomain(question)}</span>
            <DiffBadge level={question.difficulty} />
            {isMulti && <span className="text-[10px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-full">Multiple Response</span>}
          </div>
        </div>
        <span className="text-zinc-300 font-bold text-lg flex-shrink-0">{open ? '-' : '+'}</span>
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-zinc-100 pt-4 bg-zinc-50/50">
          <div className="space-y-2 mb-4">
            {question.codeSnippet && (
              <pre className="overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-950 px-4 py-3 text-[12px] leading-6 text-zinc-100">
                <code>{question.codeSnippet}</code>
              </pre>
            )}
            {question.options.map((option, optionIndex) => {
              const correct = isCorrectOption(optionIndex);
              const selected = isSelected(optionIndex);
              let cls = 'border-zinc-200 bg-white text-zinc-600';
              if (correct) cls = 'border-emerald-300 bg-emerald-50 text-emerald-800 font-semibold';
              else if (selected) cls = 'border-red-200 bg-red-50 text-red-700';
              return (
                <div key={optionIndex} className={`flex gap-3 p-3 rounded-xl border text-sm ${cls}`}>
                  <span className="font-bold flex-shrink-0">{String.fromCharCode(65 + optionIndex)}.</span>
                  <span>{option}</span>
                </div>
              );
            })}
          </div>
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
            <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider mb-1.5">Explanation</p>
            <p className="text-sm text-zinc-700 leading-relaxed">{question.explanation}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {question.objective && <span className="text-[10px] font-medium bg-white border border-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full">Objective: {question.objective}</span>}
              {question.sourceSection && <span className="text-[10px] font-medium bg-white border border-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full">Source: {question.sourceSection}</span>}
              {question.misconceptionTag && <span className="text-[10px] font-medium bg-white border border-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full">Misconception: {question.misconceptionTag}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResultReport() {
  const { resultId } = useParams<{ resultId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<ExamResult | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'wrong' | 'skipped'>('all');
  useContentProtection(true);

  useEffect(() => {
    if (!resultId) return;
    const load = async () => {
      try {
        const [pool, snap] = await Promise.all([
          loadQuestionPool(),
          getDoc(doc(db, 'exam_results', resultId)),
        ]);

        if (!snap.exists()) {
          setRecord(null);
          setQuestions([]);
          return;
        }

        const result = { ...(snap.data() as ExamResult), docId: snap.id };
        const poolById = new Map(pool.map((question) => [question.id, question]));
        const orderedQuestions = (result.questionResults ?? [])
          .map((entry) => poolById.get(entry.questionId))
          .filter((question): question is Question => Boolean(question));

        setRecord(result);
        setQuestions(orderedQuestions);
      } catch (error) {
        console.error('Result report load error:', error);
        setRecord(null);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [resultId]);

  const reviewRows = useMemo(() => {
    if (!record?.questionResults?.length) return [];
    const byId = new Map(questions.map((question) => [question.id, question]));
    return record.questionResults
      .map((entry) => ({
        result: entry,
        question: byId.get(entry.questionId),
        answer: record.submittedAnswers?.[String(entry.questionId)] ?? null,
      }))
      .filter((entry): entry is { result: QuestionResult; question: Question; answer: AnswerValue | null } => Boolean(entry.question));
  }, [questions, record]);

  const visibleRows = useMemo(
    () =>
      reviewRows.filter((entry) => {
        if (reviewFilter === 'wrong') return !entry.result.correct && !entry.result.skipped;
        if (reviewFilter === 'skipped') return entry.result.skipped;
        return true;
      }),
    [reviewFilter, reviewRows],
  );
  const coachingSummary = useMemo(
    () =>
      buildReviewCoachingSummary(
        reviewRows.map((entry) => ({
          correct: entry.result.correct,
          skipped: entry.result.skipped,
          objective: entry.question.objective,
          misconceptionTag: entry.question.misconceptionTag,
          domain: getQuestionDomain(entry.question),
        })),
      ),
    [reviewRows],
  );

  const openCertificate = () => {
    if (!record) return;
    const win = window.open('', '_blank', 'width=920,height=680');
    if (!win) return;
    const origin = window.location.origin;
    const html = buildCertificateHTML({
      name: record.examineeName,
      score: record.scorePercentage,
      date: new Date(record.examDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
      examTitle: record.sessionName ?? 'PTC x Plural Mock Exam',
      totalQuestions: record.totalQuestions,
      correct: record.questionsAnsweredCorrectly,
      ptcLogoUrl: `${origin}/images/ptc_logo.png`,
      pluralLogoUrl: `${origin}/images/plural_logo.jpg`,
    });
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 600);
  };

  const openSummaryPdf = () => {
    if (!record) return;
    const win = window.open('', '_blank', 'width=920,height=680');
    if (!win) return;
    const html = buildReportSummaryHTML({
      name: record.examineeName,
      score: record.scorePercentage,
      passed: record.passed,
      date: new Date(record.examDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
      examTitle: record.sessionName ?? 'PTC x Plural Mock Exam',
      trackLabel,
      totalQuestions: record.totalQuestions,
      correct: record.questionsAnsweredCorrectly,
      timeTakenLabel: `${Math.floor(record.timeTakenSeconds / 60)}m ${record.timeTakenSeconds % 60}s`,
      strongestDomain: record.strongestDomain,
      weakestDomain: record.weakestDomain,
      focusAreas: record.recommendedFocus,
    });
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 600);
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="w-7 h-7 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!record) {
    return (
      <div className="text-center py-20 text-zinc-400 font-medium">
        Report not found.
        <div className="mt-4">
          <button onClick={() => navigate(-1)} className="text-indigo-500 underline">Go back</button>
        </div>
      </div>
    );
  }

  const trackLabel = record.examMode === 'preset' ? 'Preset Exam' : record.examMode === 'remediation' ? 'Remediation' : (record.examTrack ? getTrackProfile(record.examTrack).shortLabel : 'Random');

  return (
    <div className="max-w-5xl mx-auto py-6 px-2">
      <div className="bg-white border border-zinc-100 rounded-3xl shadow-sm p-8 md:p-12">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-8">
          <div>
            <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider mb-1">Stored Result Report</p>
            <h1 className="text-2xl font-bold text-zinc-900">{record.examineeName}</h1>
            <p className="text-sm text-zinc-500 mt-1">
              {new Date(record.examDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} · {trackLabel}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {record.passed && record.examMode === 'preset' && (
              <button onClick={openCertificate} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">
                Download Certificate
              </button>
            )}
            <button onClick={openSummaryPdf} className="bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">
              Download Summary PDF
            </button>
            <button onClick={() => navigate(-1)} className="bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">
              Back
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatBox label="Score" value={`${record.scorePercentage}%`} color={record.passed ? 'text-emerald-600' : 'text-red-500'} />
          <StatBox label="Correct" value={record.questionsAnsweredCorrectly} color="text-emerald-600" />
          <StatBox label="Questions" value={record.totalQuestions} color="text-zinc-800" />
          <StatBox label="Time" value={`${Math.floor(record.timeTakenSeconds / 60)}m ${record.timeTakenSeconds % 60}s`} color="text-zinc-700" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
            <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-1">Strongest Domain</p>
            <p className="text-sm font-semibold text-zinc-800">{record.strongestDomain}</p>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
            <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-1">Weakest Domain</p>
            <p className="text-sm font-semibold text-zinc-800">{record.weakestDomain}</p>
          </div>
        </div>

        {record.recommendedFocus && record.recommendedFocus.length > 0 && (
          <div className="mb-8 bg-amber-50 border border-amber-100 rounded-2xl p-5">
            <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-3">Improvement Focus</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {record.recommendedFocus.map((focus) => (
                <div key={focus} className="text-sm font-medium text-zinc-700 bg-white/70 border border-amber-100 rounded-xl px-4 py-3">
                  {focus}
                </div>
              ))}
            </div>
          </div>
        )}

        {(coachingSummary.topMisconceptions.length > 0 || coachingSummary.topObjectives.length > 0) && (
          <div className="mb-8 bg-white border border-zinc-100 rounded-2xl p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
              <div>
                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Coaching Summary</p>
                <p className="text-sm font-medium text-zinc-700">
                  {coachingSummary.wrongCount} wrong and {coachingSummary.skippedCount} skipped answers drove this attempt.
                </p>
              </div>
              <span className="text-[11px] font-semibold px-3 py-1 rounded-full border bg-red-50 text-red-600 border-red-100">
                Review Driver
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-4">
                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Top Misconceptions</p>
                {coachingSummary.topMisconceptions.length > 0 ? (
                  <div className="space-y-2">
                    {coachingSummary.topMisconceptions.map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-zinc-700">{item.label}</span>
                        <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">{item.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400">No repeated misconception cluster detected.</p>
                )}
              </div>
              <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-4">
                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Objectives To Revisit</p>
                {coachingSummary.topObjectives.length > 0 ? (
                  <div className="space-y-2">
                    {coachingSummary.topObjectives.map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-zinc-700">{item.label}</span>
                        <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">{item.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400">No repeated objective weakness detected.</p>
                )}
              </div>
            </div>
            {coachingSummary.coachingActions.length > 0 && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider mb-2">Next Coaching Actions</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {coachingSummary.coachingActions.map((action) => (
                    <div key={action} className="text-sm font-medium text-zinc-700 bg-white/80 border border-indigo-100 rounded-xl px-4 py-3">
                      {action}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="border-t border-zinc-100 pt-8">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">Question Review</h2>
            <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl">
              {[
                { key: 'all', label: `All (${reviewRows.length})` },
                { key: 'wrong', label: `Wrong (${reviewRows.filter((entry) => !entry.result.correct && !entry.result.skipped).length})` },
                { key: 'skipped', label: `Skipped (${reviewRows.filter((entry) => entry.result.skipped).length})` },
              ].map((entry) => (
                <button
                  key={entry.key}
                  onClick={() => setReviewFilter(entry.key as 'all' | 'wrong' | 'skipped')}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                    reviewFilter === entry.key ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-500'
                  }`}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </div>
          {reviewRows.length === 0 ? (
            <p className="text-sm text-zinc-400">Detailed question review is not available for this older result.</p>
          ) : (
            <div className="space-y-3">
              {visibleRows.map((entry, index) => (
                <ReviewRow key={`${entry.question.id}-${index}`} index={index} question={entry.question} result={entry.result} answer={entry.answer} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
