// src/pages/SessionEntry.tsx
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { ExamSession, Preset } from '../types/index';

type PageState = 'loading' | 'ready' | 'invalid' | 'expired' | 'inactive';

export default function SessionEntry() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [session, setSession] = useState<ExamSession | null>(null);
  const [candidateName, setCandidateName] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const preset = useRef<Preset | null>(null);

  useEffect(() => {
    if (!sessionId) { setPageState('invalid'); return; }

    const load = async () => {
      try {
        const sessionSnap = await getDoc(doc(db, 'exam_sessions', sessionId));
        if (!sessionSnap.exists()) { setPageState('invalid'); return; }

        const data = sessionSnap.data() as ExamSession;

        if (!data.isActive) { setPageState('inactive'); return; }

        if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
          setPageState('expired');
          return;
        }

        // Load the linked preset
        const presetSnap = await getDoc(doc(db, 'exam_presets', data.presetId));
        if (!presetSnap.exists()) { setPageState('invalid'); return; }
        preset.current = presetSnap.data() as Preset;

        setSession(data);
        setPageState('ready');
      } catch (err) {
        console.error('Session load error:', err);
        setPageState('invalid');
      }
    };

    void load();
  }, [sessionId]);

  const handleStart = (e: FormEvent) => {
    e.preventDefault();
    if (!session || !preset.current) return;
    setError('');

    if (accessCode.trim() !== session.accessCode) {
      setError('Incorrect access code. Please try again.');
      return;
    }

    if (!candidateName.trim()) {
      setError('Please enter your name.');
      return;
    }

    setStarting(true);
    navigate('/quiz', {
      state: {
        examineeName: candidateName.trim(),
        mode: 'preset',
        targetCount: preset.current.targetCount,
        presetId: session.presetId,
        presetQuestionIds: preset.current.questions,
        sessionId: session.id,
        sessionName: session.name,
      },
    });
  };

  if (pageState === 'loading') {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="w-7 h-7 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (pageState === 'invalid' || pageState === 'inactive' || pageState === 'expired') {
    const messages: Record<'invalid' | 'inactive' | 'expired', { title: string; body: string }> = {
      invalid: { title: 'Session Not Found', body: 'This exam link is invalid or has been removed. Please contact your administrator.' },
      inactive: { title: 'Session Inactive', body: 'This exam session has been deactivated. Please contact your administrator.' },
      expired: { title: 'Session Expired', body: 'This exam session has expired. Please contact your administrator.' },
    };
    const msg = messages[pageState as 'invalid' | 'inactive' | 'expired'];
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-center min-h-[70vh] px-4"
      >
        <div className="text-center max-w-sm">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-red-50 border border-red-100 rounded-2xl mb-4">
            <span className="text-2xl">&#x26A0;</span>
          </div>
          <h2 className="text-xl font-bold text-zinc-900 mb-2">{msg.title}</h2>
          <p className="text-sm text-zinc-500 font-medium">{msg.body}</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex items-center justify-center min-h-[70vh] px-4"
    >
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-50 border border-indigo-100 rounded-2xl mb-4">
            <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">{session!.name}</h2>
          <p className="text-zinc-500 text-sm font-medium mt-1">
            {preset.current!.targetCount} Questions &middot; Secured Exam
          </p>
        </div>

        {/* Form card */}
        <div className="bg-white border border-zinc-100 rounded-3xl shadow-sm p-8">
          <form onSubmit={handleStart} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                Your Full Name
              </label>
              <input
                type="text"
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                placeholder="e.g. Rajan Agarwal"
                required
                autoFocus
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 font-medium outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all placeholder:text-zinc-300"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                Access Code
              </label>
              <input
                type="password"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="Enter the code provided to you"
                required
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 font-medium outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all placeholder:text-zinc-300"
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-xs font-semibold text-red-500 text-center"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={starting}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm tracking-wide shadow-sm shadow-indigo-100 transition-all disabled:opacity-60"
            >
              {starting ? 'Starting...' : 'Start Exam \u2192'}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-zinc-400 mt-5 font-medium">
          Once started, the exam timer cannot be paused.
        </p>
      </div>
    </motion.div>
  );
}
