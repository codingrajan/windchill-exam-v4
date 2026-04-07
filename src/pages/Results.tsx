import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { AnswerMap, ExamMode, ExamResult, Question } from '../types/index';
import { evaluateExam, getQuestionDomain } from '../utils/examLogic';

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
          <p className="text-sm font-semibold text-zinc-800 leading-snug line-clamp-2 mb-1.5">
            <span className="text-zinc-400 mr-1">Q{index + 1}.</span>
            {question.question}
          </p>
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
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Results() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state ?? {}) as {
    questions?: Question[];
    answers?: AnswerMap;
    timeTaken?: number;
    examineeName?: string;
    examMode?: ExamMode;
  };

  const hasSaved = useRef(false);
  const questions = state.questions ?? [];
  const answers = state.answers ?? {};
  const timeTaken = state.timeTaken ?? 0;
  const examineeName = state.examineeName ?? 'Anonymous';
  const examMode = state.examMode ?? 'random';
  const summary = evaluateExam(questions, answers);

  useEffect(() => {
    if (questions.length === 0 || hasSaved.current) return;
    hasSaved.current = true;

    const payload: ExamResult = {
      examineeName,
      examMode,
      scorePercentage: summary.percentage,
      questionsAnsweredCorrectly: summary.correctCount,
      totalQuestions: questions.length,
      passed: summary.passed,
      strongestDomain: summary.strongestTopic.topic,
      weakestDomain: summary.weakestTopic.topic,
      timeTakenSeconds: timeTaken,
      examDate: new Date().toISOString(),
    };

    void addDoc(collection(db, 'exam_results'), payload).catch((error: unknown) => {
      console.error('Result save error:', error);
    });
  }, [examMode, examineeName, questions.length, summary.correctCount, summary.passed, summary.percentage, summary.strongestTopic.topic, summary.weakestTopic.topic, timeTaken]);

  if (questions.length === 0) {
    return (
      <div className="text-center py-20 text-zinc-400 font-medium">
        No exam data found.{' '}
        <button onClick={() => navigate('/')} className="text-indigo-500 underline">
          Return home
        </button>
      </div>
    );
  }

  const passColor = summary.passed ? 'text-emerald-600' : 'text-red-500';

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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <div className="lg:col-span-2">
            <h3 className="text-sm font-semibold text-zinc-700 uppercase tracking-wider mb-4">Domain Analysis</h3>
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
            <button
              onClick={() => navigate('/')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm w-full sm:w-auto"
            >
              Return Home
            </button>
          </div>
          <div className="space-y-3">
            {questions.map((question, index) => (
              <ReviewItem key={question.id} question={question} index={index} userAnswer={answers[index]} />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
