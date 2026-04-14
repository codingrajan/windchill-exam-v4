import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type {
  AnswerMap,
  EvaluatedQuestion,
  ExamMode,
  ExamResult,
  ExamTrack,
  Question,
  QuestionResult,
  RecentAttemptSnapshot,
} from '../types/index';
import { buildReadinessInsights, buildReviewCoachingSummary, getTrackProfile } from '../utils/examInsights';
import { buildCertificateHTML } from '../utils/certificate';
import { buildReportSummaryHTML } from '../utils/reportSummary';
import {
  buildRemediationExam,
  buildWeakDomainExam,
  buildWrongOnlyExam,
  evaluateExam,
  getQuestionDomain,
  loadQuestionPool,
} from '../utils/examLogic';
import { submitExamResult } from '../services/writeGateway';
import { useContentProtection } from '../hooks/useContentProtection';
import QuestionPrompt from '../components/shared/QuestionPrompt';

function DiffBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    easy: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    medium: 'bg-amber-50 text-amber-600 border-amber-100',
    hard: 'bg-red-50 text-red-600 border-red-100',
  };
  return (
    <span
      className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
        styles[level?.toLowerCase()] ?? 'bg-zinc-100 text-zinc-500 border-zinc-200'
      }`}
    >
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

function ReviewItem({
  question,
  index,
  userAnswer,
}: {
  question: Question;
  index: number;
  userAnswer: number | number[] | undefined;
}) {
  const [open, setOpen] = useState(false);
  const evaluated = evaluateExam([question], { 0: userAnswer } as AnswerMap);
  const review = evaluated.evaluatedQuestions[0];
  const isMulti = Array.isArray(question.correctAnswer);

  const statusIcon = review.isCorrect ? 'OK' : review.isSkipped ? '--' : 'NO';
  const borderColor = review.isCorrect
    ? 'border-emerald-200'
    : review.isSkipped
      ? 'border-zinc-200'
      : 'border-red-200';
  const iconColor = review.isCorrect
    ? 'text-emerald-600 bg-emerald-50'
    : review.isSkipped
      ? 'text-zinc-400 bg-zinc-50'
      : 'text-red-600 bg-red-50';

  return (
    <div className={`border rounded-2xl overflow-hidden transition-shadow ${borderColor} hover:shadow-sm`}>
      <button
        onClick={() => setOpen((previous) => !previous)}
        className="w-full flex items-start gap-4 p-4 text-left hover:bg-zinc-50 transition-colors"
      >
        <span className={`w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center text-xs font-bold mt-0.5 ${iconColor}`}>
          {statusIcon}
        </span>
        <div className="flex-grow min-w-0">
          <div className="mb-1.5">
            <QuestionPrompt question={question} index={index} compact />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] font-medium bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full">
              {getQuestionDomain(question)}
            </span>
            <DiffBadge level={question.difficulty ?? 'unrated'} />
            {isMulti && (
              <span className="text-[10px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-full">
                Multiple Response
              </span>
            )}
          </div>
        </div>
        <span className="text-zinc-300 font-bold text-lg flex-shrink-0">{open ? '-' : '+'}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-zinc-100 pt-4 bg-zinc-50/50">
              <div className="space-y-2 mb-4">
                {question.codeSnippet && (
                  <pre className="overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-950 px-4 py-3 text-[12px] leading-6 text-zinc-100">
                    <code>{question.codeSnippet}</code>
                  </pre>
                )}
                {question.options.map((option, optionIndex) => {
                  const isOptionCorrect = Array.isArray(question.correctAnswer)
                    ? question.correctAnswer.includes(optionIndex)
                    : question.correctAnswer === optionIndex;
                  const didSelect = Array.isArray(userAnswer)
                    ? userAnswer.includes(optionIndex)
                    : userAnswer === optionIndex;
                  let cls = 'border-zinc-200 bg-white text-zinc-600';
                  if (isOptionCorrect) cls = 'border-emerald-300 bg-emerald-50 text-emerald-800 font-semibold';
                  else if (didSelect && !review.isCorrect) cls = 'border-red-200 bg-red-50 text-red-700 line-through';
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
                  {question.objective && (
                    <span className="text-[10px] font-medium bg-white border border-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full">
                      Objective: {question.objective}
                    </span>
                  )}
                  {question.sourceSection && (
                    <span className="text-[10px] font-medium bg-white border border-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full">
                      Source: {question.sourceSection}
                    </span>
                  )}
                  {question.misconceptionTag && (
                    <span className="text-[10px] font-medium bg-white border border-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full">
                      Misconception: {question.misconceptionTag}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type RecoveryMode = 'blended' | 'wrong_only' | 'weak_domain' | 'timed_recovery';
type ReviewFilter = 'all' | 'wrong' | 'skipped';
const SUBMITTED_ATTEMPTS_KEY = 'wc_submitted_attempts';

export default function Results() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state ?? {}) as {
    questions?: Question[];
    answers?: AnswerMap;
    timeTaken?: number;
    examineeName?: string;
    examMode?: ExamMode;
    examTrack?: ExamTrack;
    sessionId?: string;
    sessionName?: string;
    candidateEmail?: string;
    participantId?: string;
    resultAttemptId?: string;
    questionTimings?: Record<number, number>;
    presetLabel?: string;
  };

  const hasSaved = useRef(false);
  const questions = state.questions ?? [];
  const answers = state.answers ?? {};
  const timeTaken = state.timeTaken ?? 0;
  const examineeName = state.examineeName ?? 'Anonymous';
  const examMode = state.examMode ?? 'random';
  const examTrack = state.examTrack ?? 'hard_mode';
  const sessionId = state.sessionId;
  const sessionName = state.sessionName;
  const candidateEmail = state.candidateEmail?.trim().toLowerCase();
  const participantId = state.participantId;
  const resultAttemptId = state.resultAttemptId;
  const questionTimings = useMemo(() => state.questionTimings ?? {}, [state.questionTimings]);
  const presetLabel = state.presetLabel;
  const summary = evaluateExam(questions, answers);
  const trackProfile = getTrackProfile(examTrack);
  const displayExamLabel = examMode === 'preset' ? presetLabel ?? 'Preset Exam' : examMode === 'remediation' ? 'Remediation' : trackProfile.shortLabel;
    const insights = buildReadinessInsights(summary);
  const [startingRemediation, setStartingRemediation] = useState(false);
  const [resultDocId, setResultDocId] = useState('');
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  useContentProtection(true);
  const coachingSummary = buildReviewCoachingSummary(
    summary.evaluatedQuestions.map((entry) => ({
      correct: entry.isCorrect,
      skipped: entry.isSkipped,
      objective: entry.question.objective,
      misconceptionTag: entry.question.misconceptionTag,
      domain: getQuestionDomain(entry.question),
      sourceManual: entry.question.sourceManual,
      sourceSection: entry.question.sourceSection,
      difficulty: entry.question.difficulty,
    })),
    { scorePercentage: summary.percentage },
  );
  const recommendedActions = useMemo(
    () =>
      coachingSummary.nextActions.length > 0
        ? coachingSummary.nextActions.map((item) => `${item.title}: ${item.action}`)
        : insights.focusAreas,
    [coachingSummary.nextActions, insights.focusAreas],
  );
  const lossDriverSummaries = useMemo(
    () => coachingSummary.lossDrivers.map((item) => `${item.title}: ${item.evidence}`),
    [coachingSummary.lossDrivers],
  );
  const questionResults = useMemo<QuestionResult[]>(
    () =>
      summary.evaluatedQuestions.map((eq: EvaluatedQuestion, idx: number) => ({
        questionId: eq.question.id,
        correct: eq.isCorrect,
        skipped: eq.isSkipped,
        timeTaken: questionTimings[idx] ?? 0,
      })),
    [questionTimings, summary.evaluatedQuestions],
  );

  useEffect(() => {
    if (questions.length === 0 || hasSaved.current) return;
    if (!resultAttemptId) return;

    try {
      const submittedAttempts = JSON.parse(window.sessionStorage.getItem(SUBMITTED_ATTEMPTS_KEY) ?? '[]') as string[];
      if (submittedAttempts.includes(resultAttemptId)) {
        hasSaved.current = true;
        return;
      }
    } catch {
      // noop
    }

    hasSaved.current = true;

    const submittedAt = new Date().toISOString();

    const payload: ExamResult = {
      attemptId: resultAttemptId,
      examineeName,
      examMode,
      examTrack,
      scorePercentage: summary.percentage,
      questionsAnsweredCorrectly: summary.correctCount,
      totalQuestions: questions.length,
      passed: summary.passed,
      strongestDomain: summary.strongestTopic.topic,
      weakestDomain: summary.weakestTopic.topic,
      recommendedFocus: recommendedActions,
      timeTakenSeconds: timeTaken,
      examDate: submittedAt,
      questionResults,
      submittedAnswers: summary.evaluatedQuestions.reduce<Record<string, number | number[] | null>>((acc, entry) => {
        acc[String(entry.question.id)] = entry.answer ?? null;
        return acc;
      }, {}),
      ...(sessionId ? { sessionId } : {}),
      ...(sessionName ? { sessionName } : {}),
      ...(candidateEmail ? { candidateEmail } : {}),
      ...(participantId ? { participantId } : {}),
    };

    if (candidateEmail) {
      const recentAttempt: RecentAttemptSnapshot = {
        examineeName,
        examDate: submittedAt,
        scorePercentage: summary.percentage,
        passed: summary.passed,
        examTrack,
        weakestDomain: summary.weakestTopic.topic,
        strongestDomain: summary.strongestTopic.topic,
        recommendedFocus: recommendedActions,
      };

      try {
        window.localStorage.setItem(`windchill:lastAttempt:${candidateEmail}`, JSON.stringify(recentAttempt));
      } catch (error) {
        console.error('Local snapshot save error:', error);
      }
    }

    void submitExamResult(payload, participantId)
      .then((docId) => {
        setResultDocId(docId);
        try {
          const submittedAttempts = JSON.parse(window.sessionStorage.getItem(SUBMITTED_ATTEMPTS_KEY) ?? '[]') as string[];
          if (!submittedAttempts.includes(resultAttemptId)) {
            submittedAttempts.push(resultAttemptId);
            window.sessionStorage.setItem(SUBMITTED_ATTEMPTS_KEY, JSON.stringify(submittedAttempts));
          }
        } catch {
          // noop
        }
      })
      .catch((error: unknown) => {
        console.error('Result save error:', error);
      });
  }, [
    examMode,
    examTrack,
    examineeName,
    candidateEmail,
    insights.focusAreas,
    participantId,
    resultAttemptId,
    recommendedActions,
    questions.length,
    questionTimings,
    sessionId,
    sessionName,
    summary.correctCount,
    summary.evaluatedQuestions,
    summary.passed,
    summary.percentage,
    summary.strongestTopic.topic,
    summary.weakestTopic.topic,
    questionResults,
    timeTaken,
  ]);

  const openCertificate = () => {
    const win = window.open('', '_blank', 'width=920,height=680');
    if (!win) return;
    const origin = window.location.origin;
    const html = buildCertificateHTML({
      name: examineeName,
      score: summary.percentage,
      date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
      examTitle: sessionName ?? 'PTC \u00d7 Plural Mock Exam',
      totalQuestions: questions.length,
      correct: summary.correctCount,
      ptcLogoUrl: `${origin}/images/ptc_logo.png`,
      pluralLogoUrl: `${origin}/images/plural_logo.jpg`,
    });
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 600);
  };

  const openSummaryPdf = () => {
    const win = window.open('', '_blank', 'width=920,height=680');
    if (!win) return;
    const html = buildReportSummaryHTML({
      name: examineeName,
      score: summary.percentage,
      passed: summary.passed,
      date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
      examTitle: sessionName ?? 'PTC x Plural Mock Exam',
      trackLabel: displayExamLabel,
      totalQuestions: questions.length,
      correct: summary.correctCount,
      timeTakenLabel: `${Math.floor(timeTaken / 60)}m ${timeTaken % 60}s`,
      strongestDomain: summary.strongestTopic.topic,
      weakestDomain: summary.weakestTopic.topic,
      lossDrivers: lossDriverSummaries,
      studyMap: coachingSummary.studyMap.map((item) => ({
        section: item.section,
        manual: item.manual,
        sourceSection: item.sourceSection,
        missed: item.missed,
      })),
      actions: recommendedActions,
      nextTest: coachingSummary.nextTest,
    });
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 600);
  };

  const launchRemediation = async (mode: RecoveryMode) => {
    setStartingRemediation(true);
    try {
      const pool = await loadQuestionPool();
      const missedQuestionIds = summary.evaluatedQuestions
        .filter((entry) => !entry.isCorrect)
        .map((entry) => entry.question.id);
      const targetCount =
        mode === 'timed_recovery'
          ? Math.min(15, Math.max(10, missedQuestionIds.length || 10))
          : Math.min(questions.length, Math.max(10, Math.min(25, missedQuestionIds.length + 5)));
      const remediationQuestions =
        mode === 'wrong_only'
          ? buildWrongOnlyExam(pool, missedQuestionIds, targetCount)
          : mode === 'weak_domain'
            ? buildWeakDomainExam(pool, summary.weakestTopic.topic, targetCount)
            : buildRemediationExam(pool, missedQuestionIds, summary.weakestTopic.topic, targetCount);

      navigate('/quiz', {
        state: {
          examineeName,
          mode: 'remediation',
          track: examTrack,
          presetLabel: 'Recovery Quiz',
          targetCount: remediationQuestions.length,
          presetId: null,
          presetQuestionIds: remediationQuestions.map((question) => question.id),
          candidateEmail,
          sessionName:
            mode === 'wrong_only'
              ? 'Recovery Quiz · Wrong Answers'
              : mode === 'weak_domain'
                ? `Recovery Quiz · ${summary.weakestTopic.topic}`
                : mode === 'timed_recovery'
                  ? 'Recovery Quiz · Timed 15'
                  : 'Recovery Quiz · Blended',
        },
      });
    } catch (error) {
      console.error('Remediation launch error:', error);
      alert('Could not start the remediation quiz. Please try again.');
    } finally {
      setStartingRemediation(false);
    }
  };

  if (questions.length === 0) {
    return (
      <div className="text-center py-20 text-zinc-400 font-medium">
        No exam data found.{' '}
        {!sessionId && (
          <button onClick={() => navigate('/')} className="text-indigo-500 underline">
            Return home
          </button>
        )}
      </div>
    );
  }

  const passColor = summary.passed ? 'text-emerald-600' : 'text-red-500';
  const filteredQuestions = questions.filter((_, index) => {
    const evaluated = summary.evaluatedQuestions[index];
    if (!evaluated) return false;
    if (reviewFilter === 'wrong') return !evaluated.isCorrect && !evaluated.isSkipped;
    if (reviewFilter === 'skipped') return evaluated.isSkipped;
    return true;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-5xl mx-auto py-6 px-2"
    >
        <div className="bg-white border border-zinc-100 rounded-3xl shadow-sm p-8 md:p-12">
        <div className="flex flex-col md:flex-row gap-8 items-center mb-10 pb-10 border-b border-zinc-100">
          <div className="relative w-40 h-40 flex-shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
              <circle cx="80" cy="80" r="68" fill="none" stroke="#f4f4f5" strokeWidth="12" />
              <circle
                cx="80"
                cy="80"
                r="68"
                fill="none"
                stroke={summary.passed ? '#059669' : '#ef4444'}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${427.26 * (summary.percentage / 100)} 427.26`}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-4xl font-bold ${passColor}`}>{summary.percentage}%</span>
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mt-1">Score</span>
            </div>
          </div>

          <div className="flex-grow w-full">
            <div className="flex items-center gap-3 mb-4">
              <h2 className={`text-2xl font-bold uppercase tracking-wide ${passColor}`}>
                {summary.passed ? 'Passed' : 'Failed'}
              </h2>
              <span
                className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                  summary.passed ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'
                }`}
              >
                {summary.passed ? 'Above threshold' : 'Below 80%'}
              </span>
              <span className="text-xs font-semibold px-3 py-1 rounded-full border bg-blue-50 text-blue-600 border-blue-200">
                {displayExamLabel}
              </span>
            </div>
            <p className="text-sm text-zinc-500 mb-4">
              Candidate: <span className="font-semibold text-zinc-800">{examineeName}</span>
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatBox label="Correct" value={summary.correctCount} color="text-emerald-600" />
              <StatBox label="Incorrect" value={summary.incorrectCount} color="text-red-500" />
              <StatBox label="Skipped" value={summary.skippedCount} color="text-zinc-400" />
              <StatBox label="Time Taken" value={`${Math.floor(timeTaken / 60)}m ${timeTaken % 60}s`} color="text-zinc-700" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
            <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-0.5">Strongest Domain</p>
            <p className="text-sm font-semibold text-zinc-800">
              {summary.strongestTopic.topic} <span className="text-emerald-600">({summary.strongestTopic.percentage}%)</span>
            </p>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
            <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-0.5">Weakest Domain</p>
            <p className="text-sm font-semibold text-zinc-800">
              {summary.weakestTopic.topic} <span className="text-amber-600">({summary.weakestTopic.percentage}%)</span>
            </p>
          </div>
        </div>

        {(coachingSummary.lossDrivers.length > 0 || coachingSummary.studyMap.length > 0 || coachingSummary.nextActions.length > 0) && (
          <div className="mb-10 bg-white border border-zinc-100 rounded-2xl p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
              <div>
                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Post-Exam Coaching</p>
                <p className="text-sm font-medium text-zinc-700">
                  {coachingSummary.wrongCount} wrong and {coachingSummary.skippedCount} skipped answers were reduced into a study guide. Start with the loss drivers, then work through where to study and the recommended actions.
                </p>
              </div>
              <span className="text-[11px] font-semibold px-3 py-1 rounded-full border bg-red-50 text-red-600 border-red-100">
                Coaching Layer
              </span>
            </div>
            {coachingSummary.lossDrivers.length > 0 && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-4">
                <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wider mb-2">What Hurt Your Score</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {coachingSummary.lossDrivers.map((item) => (
                    <div key={item.title} className="bg-white/80 border border-red-100 rounded-xl px-4 py-3">
                      <p className="text-sm font-semibold text-zinc-800">{item.title}</p>
                      <p className="text-[12px] text-zinc-600 mt-1">{item.evidence}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-4">
                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Where To Study</p>
                {coachingSummary.studyMap.length > 0 ? (
                  <div className="space-y-2">
                    {coachingSummary.studyMap.map((item) => (
                      <div key={`${item.section}-${item.sourceSection}`} className="text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-zinc-700">{item.section}</span>
                          <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">{item.missed} miss</span>
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-1">{item.manual}</p>
                        <p className="text-[11px] text-zinc-500">{item.sourceSection} · {item.accuracy}% accuracy</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400">No study hotspot detected.</p>
                )}
              </div>
              <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-4">
                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Misconception Patterns</p>
                {coachingSummary.misconceptionPatterns.length > 0 ? (
                  <div className="space-y-2">
                    {coachingSummary.misconceptionPatterns.map((item) => (
                      <div key={item.label} className="text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-zinc-700">{item.label}</span>
                          <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">{item.count}</span>
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-1">{item.action}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400">No repeated misconception cluster detected.</p>
                )}
              </div>
            </div>
            {coachingSummary.nextActions.length > 0 && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider mb-2">Recommended Actions</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  {coachingSummary.nextActions.map((item) => (
                    <div key={item.title} className="bg-white/80 border border-indigo-100 rounded-xl px-4 py-3">
                      <p className="text-sm font-semibold text-zinc-800">{item.title}</p>
                      <p className="text-[11px] text-zinc-500 mt-1">{item.evidence}</p>
                      <p className="text-[12px] font-medium text-zinc-700 mt-2">{item.action}</p>
                    </div>
                  ))}
                </div>
                {coachingSummary.nextTest && (
                  <div className="bg-white/80 border border-indigo-100 rounded-xl px-4 py-3">
                    <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider mb-1">Recommended Next Test</p>
                    <p className="text-sm font-semibold text-zinc-800">{coachingSummary.nextTest.label}</p>
                    <p className="text-[12px] text-zinc-600 mt-1">{coachingSummary.nextTest.reason}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <div className="lg:col-span-2">
            <h3 className="text-sm font-semibold text-zinc-700 uppercase tracking-wider mb-4">Section Analysis</h3>
            <div className="space-y-3">
              {Object.entries(summary.topicStats).map(([topic, stats]) => {
                const pct = stats.total === 0 ? 0 : Math.round((stats.correct / stats.total) * 100);
                return (
                  <div key={topic} className="bg-zinc-50 border border-zinc-100 rounded-xl p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-semibold text-zinc-600 truncate pr-3">{topic}</span>
                      <span className={`text-xs font-bold flex-shrink-0 ${pct >= 80 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {stats.correct}/{stats.total} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${pct >= 80 ? 'bg-emerald-500' : 'bg-red-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-zinc-700 uppercase tracking-wider mb-4">Difficulty Matrix</h3>
            <div className="space-y-3">
              {(['easy', 'medium', 'hard', 'unrated'] as const).map((level) => {
                const stats = summary.difficultyStats[level];
                if (stats.total === 0) return null;
                const pct = Math.round((stats.correct / stats.total) * 100);
                return (
                  <div key={level} className="bg-zinc-50 border border-zinc-100 rounded-xl p-4 flex items-center justify-between">
                    <DiffBadge level={level} />
                    <div className="text-right">
                      <span className="text-sm font-bold text-zinc-900">{stats.correct}</span>
                      <span className="text-zinc-400 text-xs font-medium"> / {stats.total}</span>
                      <div className={`text-[10px] font-bold mt-0.5 ${pct >= 80 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {pct}% accuracy
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="border-t border-zinc-100 pt-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <h3 className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">Detailed Question Review</h3>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl">
                {[
                  { key: 'all', label: `All (${questions.length})` },
                  { key: 'wrong', label: `Wrong (${summary.incorrectCount})` },
                  { key: 'skipped', label: `Skipped (${summary.skippedCount})` },
                ].map((entry) => (
                  <button
                    key={entry.key}
                    onClick={() => setReviewFilter(entry.key as ReviewFilter)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                      reviewFilter === entry.key ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-500'
                    }`}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
              {examMode === 'random' && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => void launchRemediation('blended')}
                  disabled={startingRemediation}
                  className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm disabled:opacity-60"
                >
                  {startingRemediation ? 'Preparing...' : 'Recovery · Blended'}
                </button>
                <button
                  onClick={() => void launchRemediation('wrong_only')}
                  disabled={startingRemediation}
                  className="bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
                >
                  Wrong Only
                </button>
                <button
                  onClick={() => void launchRemediation('weak_domain')}
                  disabled={startingRemediation}
                  className="bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
                >
                  Weakest Domain
                </button>
                <button
                  onClick={() => void launchRemediation('timed_recovery')}
                  disabled={startingRemediation}
                  className="bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
                >
                  Timed 15
                </button>
              </div>
              )}
              {summary.passed && examMode === 'preset' && (
                <button
                  onClick={openCertificate}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                  Download Certificate
                </button>
              )}
              <button
                onClick={openSummaryPdf}
                className="bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              >
                Download Summary PDF
              </button>
              {resultDocId && (
                <button
                  onClick={() => navigate(`/result/${resultDocId}`)}
                  className="bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                >
                  Open Saved Report
                </button>
              )}
              {sessionId ? (
                <p className="text-sm text-zinc-400 font-medium">Your results have been recorded.</p>
              ) : (
                <button
                  onClick={() => navigate('/')}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm w-full sm:w-auto"
                >
                  Return Home
                </button>
              )}
            </div>
          </div>
          <div className="space-y-3">
            {filteredQuestions.map((question) => {
              const index = questions.findIndex((entry) => entry.id === question.id);
              return <ReviewItem key={`${question.id}-${index}`} question={question} index={index} userAnswer={answers[index]} />;
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
