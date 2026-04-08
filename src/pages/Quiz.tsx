import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { AnswerMap, ExamConfig, Question } from '../types/index';
import { getTrackProfile } from '../utils/examInsights';
import { buildRandomExam, getQuestionDomain, isQuestionAnswered, loadQuestionPool, shuffle } from '../utils/examLogic';

const SESSION_KEY = 'wc_exam_session';

function buildAttemptId(config: ExamConfig, questions: Question[]): string {
  const questionFingerprint = questions.map((question) => question.id).join('-');
  const candidateKey = (config.candidateEmail ?? config.examineeName).trim().toLowerCase().replace(/\s+/g, '_');
  return [
    config.sessionId ?? config.presetId ?? config.mode,
    config.participantId ?? 'no-participant',
    candidateKey,
    questionFingerprint,
    Date.now().toString(36),
  ].join('::');
}

function getTimeLimit(count: number): number {
  if (count <= 25) return 900;
  if (count <= 50) return 2100;
  if (count <= 75) return 3600;
  return 4500;
}

export default function Quiz() {
  const location = useLocation();
  const navigate = useNavigate();

  // Prefer router state; fall back to sessionStorage for back-button recovery
  const routerConfig = location.state as ExamConfig | undefined;
  const savedRaw = sessionStorage.getItem(SESSION_KEY);
  const savedSession = savedRaw ? JSON.parse(savedRaw) as { config: ExamConfig; questions: Question[]; answers: AnswerMap; timeLeft: number } : null;
  const config: ExamConfig | undefined = routerConfig ?? savedSession?.config;

  const [questions, setQuestions] = useState<Question[]>(savedSession?.questions ?? []);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>(savedSession?.answers ?? {});
  const [flagged, setFlagged] = useState<Record<number, boolean>>({});
  const [timeLeft, setTimeLeft] = useState(savedSession?.timeLeft ?? 0);
  const [isLoaded, setIsLoaded] = useState(savedSession !== null && !!routerConfig === false ? true : false);
  const [showResumeCue, setShowResumeCue] = useState(savedSession !== null && !routerConfig);

  const hasSubmitted = useRef(false);
  const questionTimings = useRef<Record<number, number>>({});
  const questionStartTime = useRef<number>(Date.now());

  // Record time spent on a question before navigating away
  const recordCurrentTime = (idx: number) => {
    const elapsed = Math.floor((Date.now() - questionStartTime.current) / 1000);
    questionTimings.current[idx] = (questionTimings.current[idx] ?? 0) + elapsed;
    questionStartTime.current = Date.now();
  };

  const navigateTo = (newIdx: number) => {
    recordCurrentTime(currentIdx);
    setCurrentIdx(newIdx);
  };

  // Block browser back button — use go(1) to undo the pop without pushing new state
  useEffect(() => {
    if (!isLoaded) return;
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      if (!hasSubmitted.current) {
        window.history.go(1);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isLoaded]);

  // Block browser refresh / tab close
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isLoaded && !hasSubmitted.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isLoaded]);

  // Persist to sessionStorage on every answer / timeLeft change (for back-button recovery)
  useEffect(() => {
    if (!isLoaded || !config) return;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ config, questions, answers, timeLeft }));
  }, [answers, timeLeft, isLoaded, config, questions]);

  useEffect(() => {
    if (!config) { navigate('/'); return; }
    if (isLoaded) return; // Already restored from sessionStorage

    const init = async () => {
      const rawPool = await loadQuestionPool();
      let finalSet: Question[] = [];
      if ((config.mode === 'preset' || config.mode === 'remediation') && Array.isArray(config.presetQuestionIds)) {
        const presetIds = new Set<number>(config.presetQuestionIds);
        finalSet = shuffle(rawPool.filter((q) => presetIds.has(q.id)));
      } else {
        finalSet = buildRandomExam(rawPool, config.targetCount, { track: config.track });
      }
      setQuestions(finalSet);
      setTimeLeft(getTimeLimit(finalSet.length || config.targetCount));
      setIsLoaded(true);
    };
    void init();
  }, [config, navigate, isLoaded]);

  useEffect(() => {
    if (!config || !isLoaded) return;
    if (timeLeft <= 0) {
      if (!hasSubmitted.current) {
        hasSubmitted.current = true;
        recordCurrentTime(currentIdx);
        sessionStorage.removeItem(SESSION_KEY);
        const resultAttemptId = buildAttemptId(config, questions);
        navigate('/results', {
          state: {
            questions, answers,
            timeTaken: getTimeLimit(questions.length || config.targetCount),
            resultAttemptId,
            examineeName: config.examineeName,
            examMode: config.mode,
            examTrack: config.track,
            experienceBand: config.experienceBand,
            sessionId: config.sessionId,
            sessionName: config.sessionName,
            candidateEmail: config.candidateEmail,
            participantId: config.participantId,
            questionTimings: questionTimings.current,
          },
        });
      }
      return;
    }
    const timer = window.setInterval(() => setTimeLeft((p) => p - 1), 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, timeLeft]);

  const submitExam = () => {
    const answered = Object.keys(answers).length;
    if (!window.confirm(`Ready to submit?\n\nAnswered: ${answered} / ${questions.length}\nUnanswered: ${questions.length - answered}`)) return;
    if (!config || hasSubmitted.current) return;
    hasSubmitted.current = true;
    recordCurrentTime(currentIdx);
    sessionStorage.removeItem(SESSION_KEY);
    const resultAttemptId = buildAttemptId(config, questions);
    navigate('/results', {
      state: {
        questions, answers,
        timeTaken: getTimeLimit(questions.length || config.targetCount) - timeLeft,
        resultAttemptId,
        examineeName: config.examineeName,
        examMode: config.mode,
        examTrack: config.track,
        experienceBand: config.experienceBand,
        sessionId: config.sessionId,
        sessionName: config.sessionName,
        candidateEmail: config.candidateEmail,
        participantId: config.participantId,
        questionTimings: questionTimings.current,
      },
    });
  };

  const handleOptionClick = (optionIndex: number) => {
    const q = questions[currentIdx];
    setAnswers((prev) => {
      if (Array.isArray(q.correctAnswer)) {
        const arr = Array.isArray(prev[currentIdx]) ? [...(prev[currentIdx] as number[])] : [];
        const i = arr.indexOf(optionIndex);
        if (i >= 0) arr.splice(i, 1); else arr.push(optionIndex);
        return { ...prev, [currentIdx]: arr.sort((a, b) => a - b) };
      }
      return { ...prev, [currentIdx]: optionIndex };
    });
  };

  if (!isLoaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-zinc-500">Compiling your exam...</p>
        </div>
      </div>
    );
  }

  if (!config) {
    return null;
  }

  const question = questions[currentIdx];
  const isMulti = Array.isArray(question.correctAnswer);
  const mins = Math.floor(timeLeft / 60);
  const secs = String(timeLeft % 60).padStart(2, '0');
  const isUrgent = timeLeft < 300;
  const progress = questions.length === 0 ? 0 : ((currentIdx + 1) / questions.length) * 100;
  const trackProfile = getTrackProfile(config.track);
  const answeredCount = Object.values(answers).filter((answer) => isQuestionAnswered(answer)).length;
  const flaggedCount = Object.values(flagged).filter(Boolean).length;
  const remainingCount = questions.length - answeredCount;
  const modeLabel =
    config.mode === 'remediation'
      ? 'Remediation'
      : config.mode === 'preset'
        ? config.presetLabel ?? 'Preset Exam'
        : trackProfile.shortLabel;

  return (
    <div className="flex flex-col lg:flex-row gap-5 w-full max-w-7xl mx-auto py-2">
      <aside className="w-full lg:w-60 flex-shrink-0">
        <div className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm sticky top-20">
          {showResumeCue && (
            <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-3 py-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">Resumed Attempt</p>
                  <p className="text-[11px] font-medium text-zinc-700">
                    Restored on this device. Continue from question {currentIdx + 1}.
                  </p>
                </div>
                <button
                  onClick={() => setShowResumeCue(false)}
                  className="text-[11px] font-semibold text-blue-600"
                >
                  x
                </button>
              </div>
            </div>
          )}
          <div className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 mb-5 transition-colors ${isUrgent ? 'bg-red-50 border border-red-100' : 'bg-zinc-50 border border-zinc-100'}`}>
            <span className="text-sm select-none">T</span>
            <span className={`font-mono text-xl font-bold tabular-nums tracking-tight ${isUrgent ? 'text-red-500 animate-pulse' : 'text-zinc-800'}`}>{mins}:{secs}</span>
          </div>

          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Navigator</p>
          <div className="grid grid-cols-5 gap-1 mb-5">
            {questions.map((_, index) => (
              <button key={index} onClick={() => navigateTo(index)}
                className={`h-8 rounded-lg text-[11px] font-semibold transition-all ${index === currentIdx ? 'bg-indigo-600 text-white shadow-sm' : isQuestionAnswered(answers[index]) ? 'bg-zinc-200 text-zinc-600' : 'bg-zinc-50 border border-zinc-200 text-zinc-400 hover:border-indigo-300'} ${flagged[index] ? 'ring-2 ring-amber-400 ring-offset-1' : ''}`}>
                {index + 1}
              </button>
            ))}
          </div>

          <div className="space-y-1 text-[10px] text-zinc-400 font-medium border-t border-zinc-100 pt-3 mb-4">
            {[{ cls: 'bg-indigo-600 rounded', label: 'Current' }, { cls: 'bg-zinc-200 rounded', label: 'Answered' }, { cls: 'ring-2 ring-amber-400 ring-offset-1 rounded bg-zinc-50 border border-zinc-200', label: 'Flagged' }].map((l) => (
              <div key={l.label} className="flex items-center gap-2"><span className={`w-3 h-3 inline-block flex-shrink-0 ${l.cls}`} />{l.label}</div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: 'Answered', value: answeredCount, tone: 'text-emerald-600' },
              { label: 'Left', value: remainingCount, tone: 'text-zinc-700' },
              { label: 'Flagged', value: flaggedCount, tone: 'text-amber-600' },
            ].map((item) => (
              <div key={item.label} className="bg-zinc-50 border border-zinc-100 rounded-xl px-2 py-2 text-center">
                <div className={`text-sm font-bold ${item.tone}`}>{item.value}</div>
                <div className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400">{item.label}</div>
              </div>
            ))}
          </div>

          <div className="space-y-2 mb-4">
            <button
              onClick={() => {
                const nextUnanswered = questions.findIndex((_, index) => !isQuestionAnswered(answers[index]));
                if (nextUnanswered >= 0) navigateTo(nextUnanswered);
              }}
              disabled={remainingCount === 0}
              className="w-full py-2 rounded-xl text-[11px] font-semibold border border-zinc-200 text-zinc-600 hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-40 transition-all"
            >
              Jump To Unanswered
            </button>
            <button
              onClick={() => {
                const nextFlagged = questions.findIndex((_, index) => flagged[index]);
                if (nextFlagged >= 0) navigateTo(nextFlagged);
              }}
              disabled={flaggedCount === 0}
              className="w-full py-2 rounded-xl text-[11px] font-semibold border border-zinc-200 text-zinc-600 hover:border-amber-300 hover:text-amber-700 disabled:opacity-40 transition-all"
            >
              Jump To Flagged
            </button>
          </div>

          <button onClick={submitExam} className="w-full py-2.5 rounded-xl bg-red-50 border border-red-100 text-red-500 text-xs font-semibold hover:bg-red-100 transition-colors">Submit Exam</button>
        </div>
      </aside>

      <main className="flex-grow min-w-0">
        <div className="mb-4 bg-zinc-100 rounded-full h-1 overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={currentIdx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className="bg-white border border-zinc-100 rounded-3xl p-7 md:p-10 shadow-sm">
            <div className="flex items-center flex-wrap gap-2 mb-6">
              <span className="text-xs font-semibold text-zinc-400">Q {currentIdx + 1} <span className="text-zinc-300">/</span> {questions.length}</span>
              <div className="h-3 w-px bg-zinc-200" />
              <span className="text-[11px] font-medium bg-zinc-100 text-zinc-600 px-2.5 py-0.5 rounded-full">{getQuestionDomain(question)}</span>
              <span className="text-[11px] font-medium bg-blue-50 text-blue-600 border border-blue-100 px-2.5 py-0.5 rounded-full">
                {modeLabel}
              </span>
              {isMulti && <span className="text-[11px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100 px-2.5 py-0.5 rounded-full">Select Multiple</span>}
              <button onClick={() => setFlagged((p) => ({ ...p, [currentIdx]: !p[currentIdx] }))} className={`ml-auto text-[11px] font-semibold px-3 py-1 rounded-full border transition-all ${flagged[currentIdx] ? 'bg-amber-50 border-amber-200 text-amber-600' : 'border-zinc-200 text-zinc-400 hover:border-amber-300 hover:text-amber-500'}`}>
                {flagged[currentIdx] ? 'Flagged' : 'Flag'}
              </button>
            </div>

            <h2 className="text-lg font-semibold text-zinc-900 mb-7 leading-relaxed">{question.question}</h2>

            <div className="space-y-3">
              {question.options.map((option, oi) => {
                const isSelected = isMulti ? ((answers[currentIdx] as number[] | undefined) ?? []).includes(oi) : answers[currentIdx] === oi;
                return (
                  <button key={oi} onClick={() => handleOptionClick(oi)} className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${isSelected ? 'border-indigo-400 bg-indigo-50' : 'border-zinc-100 bg-zinc-50 hover:border-indigo-200 hover:bg-indigo-50/40'}`}>
                    <span className={`w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center text-sm font-bold transition-all ${isSelected ? 'bg-indigo-600 text-white' : 'bg-white border border-zinc-200 text-zinc-500'}`}>{String.fromCharCode(65 + oi)}</span>
                    <span className={`text-sm font-medium leading-snug ${isSelected ? 'text-indigo-900' : 'text-zinc-700'}`}>{option}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-8 flex items-center justify-between border-t border-zinc-100 pt-6">
              <button onClick={() => navigateTo(Math.max(0, currentIdx - 1))} disabled={currentIdx === 0} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-zinc-500 border border-zinc-200 hover:border-zinc-300 hover:text-zinc-700 disabled:opacity-30 transition-all">Previous</button>
              <span className="text-xs text-zinc-400 font-medium hidden sm:block">{answeredCount} of {questions.length} answered</span>
              <button onClick={() => { if (currentIdx < questions.length - 1) { navigateTo(currentIdx + 1); return; } submitExam(); }} className="px-8 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all">
                {currentIdx === questions.length - 1 ? 'Finish' : 'Next'}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
