import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { AnswerMap, ExamConfig, Question } from '../types/index';
import { buildRandomExam, getQuestionDomain, isQuestionAnswered, loadQuestionPool, shuffle } from '../utils/examLogic';

function getTimeLimit(count: number): number {
  if (count <= 25) return 900;
  if (count <= 50) return 2100;
  if (count <= 75) return 3600;
  return 4500;
}

function DiffBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    easy: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    medium: 'bg-amber-50 text-amber-600 border-amber-100',
    hard: 'bg-red-50 text-red-600 border-red-100',
  };
  const cls = styles[level?.toLowerCase()] ?? 'bg-zinc-100 text-zinc-500 border-zinc-200';
  return (
    <span className={`text-[11px] font-medium border px-2.5 py-0.5 rounded-full ${cls}`}>
      {level}
    </span>
  );
}

export default function Quiz() {
  const location = useLocation();
  const navigate = useNavigate();
  const config = location.state as ExamConfig | undefined;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [flagged, setFlagged] = useState<Record<number, boolean>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  const hasSubmitted = useRef(false);

  useEffect(() => {
    if (!config) {
      navigate('/');
      return;
    }

    const init = async () => {
      const rawPool = await loadQuestionPool();
      let finalSet: Question[] = [];

      if (config.mode === 'preset' && Array.isArray(config.presetQuestionIds)) {
        const presetIds = new Set<number>(config.presetQuestionIds);
        const matched = rawPool.filter((question) => presetIds.has(question.id));
        finalSet = shuffle(matched);
      } else {
        finalSet = buildRandomExam(rawPool, config.targetCount);
      }

      setQuestions(finalSet);
      setTimeLeft(getTimeLimit(finalSet.length || config.targetCount));
      setIsLoaded(true);
    };

    void init();
  }, [config, navigate]);

  useEffect(() => {
    if (!config || !isLoaded) return;

    if (timeLeft <= 0) {
      if (!hasSubmitted.current) {
        hasSubmitted.current = true;
        navigate('/results', {
          state: {
            questions,
            answers,
            timeTaken: getTimeLimit(questions.length || config.targetCount),
            examineeName: config.examineeName,
            examMode: config.mode,
            sessionId: config.sessionId,
            sessionName: config.sessionName,
          },
        });
      }
      return;
    }

    const timer = window.setInterval(() => setTimeLeft((previous) => previous - 1), 1000);
    return () => window.clearInterval(timer);
  }, [answers, config, isLoaded, navigate, questions, timeLeft]);

  const submitExam = () => {
    const answered = Object.keys(answers).length;
    if (
      !window.confirm(
        `Ready to submit?\n\nAnswered: ${answered} / ${questions.length}\nUnanswered: ${questions.length - answered}`,
      )
    ) {
      return;
    }
    if (!config || hasSubmitted.current) return;

    hasSubmitted.current = true;
    navigate('/results', {
      state: {
        questions,
        answers,
        timeTaken: getTimeLimit(questions.length || config.targetCount) - timeLeft,
        examineeName: config.examineeName,
        examMode: config.mode,
        sessionId: config.sessionId,
        sessionName: config.sessionName,
      },
    });
  };

  const handleOptionClick = (optionIndex: number) => {
    const currentQuestion = questions[currentIdx];
    setAnswers((previous) => {
      if (Array.isArray(currentQuestion.correctAnswer)) {
        const nextAnswer = Array.isArray(previous[currentIdx]) ? [...(previous[currentIdx] as number[])] : [];
        const existingIndex = nextAnswer.indexOf(optionIndex);
        if (existingIndex >= 0) {
          nextAnswer.splice(existingIndex, 1);
        } else {
          nextAnswer.push(optionIndex);
        }
        return { ...previous, [currentIdx]: nextAnswer.sort((left, right) => left - right) };
      }
      return { ...previous, [currentIdx]: optionIndex };
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

  const question = questions[currentIdx];
  const isMulti = Array.isArray(question.correctAnswer);
  const mins = Math.floor(timeLeft / 60);
  const secs = String(timeLeft % 60).padStart(2, '0');
  const isUrgent = timeLeft < 300;
  const progress = questions.length === 0 ? 0 : ((currentIdx + 1) / questions.length) * 100;

  return (
    <div className="flex flex-col lg:flex-row gap-5 w-full max-w-7xl mx-auto py-2">
      <aside className="w-full lg:w-60 flex-shrink-0">
        <div className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm sticky top-20">
          <div
            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 mb-5 transition-colors ${
              isUrgent ? 'bg-red-50 border border-red-100' : 'bg-zinc-50 border border-zinc-100'
            }`}
          >
            <span className="text-sm select-none">T</span>
            <span
              className={`font-mono text-xl font-bold tabular-nums tracking-tight ${
                isUrgent ? 'text-red-500 animate-pulse' : 'text-zinc-800'
              }`}
            >
              {mins}:{secs}
            </span>
          </div>

          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Navigator</p>
          <div className="grid grid-cols-5 gap-1 mb-5">
            {questions.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIdx(index)}
                className={`h-8 rounded-lg text-[11px] font-semibold transition-all ${
                  index === currentIdx
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : isQuestionAnswered(answers[index])
                      ? 'bg-zinc-200 text-zinc-600'
                      : 'bg-zinc-50 border border-zinc-200 text-zinc-400 hover:border-indigo-300'
                } ${flagged[index] ? 'ring-2 ring-amber-400 ring-offset-1' : ''}`}
              >
                {index + 1}
              </button>
            ))}
          </div>

          <div className="space-y-1 text-[10px] text-zinc-400 font-medium border-t border-zinc-100 pt-3 mb-4">
            {[
              { cls: 'bg-indigo-600 rounded', label: 'Current' },
              { cls: 'bg-zinc-200 rounded', label: 'Answered' },
              { cls: 'ring-2 ring-amber-400 ring-offset-1 rounded bg-zinc-50 border border-zinc-200', label: 'Flagged' },
            ].map((legend) => (
              <div key={legend.label} className="flex items-center gap-2">
                <span className={`w-3 h-3 inline-block flex-shrink-0 ${legend.cls}`} />
                {legend.label}
              </div>
            ))}
          </div>

          <button
            onClick={submitExam}
            className="w-full py-2.5 rounded-xl bg-red-50 border border-red-100 text-red-500 text-xs font-semibold hover:bg-red-100 transition-colors"
          >
            Submit Exam
          </button>
        </div>
      </aside>

      <main className="flex-grow min-w-0">
        <div className="mb-4 bg-zinc-100 rounded-full h-1 overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentIdx}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="bg-white border border-zinc-100 rounded-3xl p-7 md:p-10 shadow-sm"
          >
            <div className="flex items-center flex-wrap gap-2 mb-6">
              <span className="text-xs font-semibold text-zinc-400">
                Q {currentIdx + 1} <span className="text-zinc-300">/</span> {questions.length}
              </span>
              <div className="h-3 w-px bg-zinc-200" />
              <span className="text-[11px] font-medium bg-zinc-100 text-zinc-600 px-2.5 py-0.5 rounded-full">
                {getQuestionDomain(question)}
              </span>
              <DiffBadge level={question.difficulty} />
              {isMulti && (
                <span className="text-[11px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100 px-2.5 py-0.5 rounded-full">
                  Select Multiple
                </span>
              )}
              <button
                onClick={() => setFlagged((previous) => ({ ...previous, [currentIdx]: !previous[currentIdx] }))}
                className={`ml-auto text-[11px] font-semibold px-3 py-1 rounded-full border transition-all ${
                  flagged[currentIdx]
                    ? 'bg-amber-50 border-amber-200 text-amber-600'
                    : 'border-zinc-200 text-zinc-400 hover:border-amber-300 hover:text-amber-500'
                }`}
              >
                {flagged[currentIdx] ? 'Flagged' : 'Flag'}
              </button>
            </div>

            <h2 className="text-lg font-semibold text-zinc-900 mb-7 leading-relaxed">{question.question}</h2>

            <div className="space-y-3">
              {question.options.map((option, optionIndex) => {
                const isSelected = isMulti
                  ? ((answers[currentIdx] as number[] | undefined) ?? []).includes(optionIndex)
                  : answers[currentIdx] === optionIndex;
                return (
                  <button
                    key={optionIndex}
                    onClick={() => handleOptionClick(optionIndex)}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${
                      isSelected
                        ? 'border-indigo-400 bg-indigo-50'
                        : 'border-zinc-100 bg-zinc-50 hover:border-indigo-200 hover:bg-indigo-50/40'
                    }`}
                  >
                    <span
                      className={`w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center text-sm font-bold transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white border border-zinc-200 text-zinc-500'
                      }`}
                    >
                      {String.fromCharCode(65 + optionIndex)}
                    </span>
                    <span className={`text-sm font-medium leading-snug ${isSelected ? 'text-indigo-900' : 'text-zinc-700'}`}>
                      {option}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-8 flex items-center justify-between border-t border-zinc-100 pt-6">
              <button
                onClick={() => setCurrentIdx((previous) => Math.max(0, previous - 1))}
                disabled={currentIdx === 0}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-zinc-500 border border-zinc-200 hover:border-zinc-300 hover:text-zinc-700 disabled:opacity-30 transition-all"
              >
                Previous
              </button>
              <span className="text-xs text-zinc-400 font-medium hidden sm:block">
                {Object.values(answers).filter((answer) => isQuestionAnswered(answer)).length} of {questions.length} answered
              </span>
              <button
                onClick={() => {
                  if (currentIdx < questions.length - 1) {
                    setCurrentIdx((previous) => previous + 1);
                    return;
                  }
                  submitExam();
                }}
                className="px-8 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
              >
                {currentIdx === questions.length - 1 ? 'Finish' : 'Next'}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
