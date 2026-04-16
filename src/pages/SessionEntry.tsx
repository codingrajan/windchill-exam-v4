import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { addDoc, collection, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { startSessionAttempt } from '../services/writeGateway';
import type { ExamSession, Preset } from '../types/index';
import { isValidEmail, normalizeEmail } from '../utils/email';

type PageState = 'loading' | 'ready' | 'invalid' | 'expired' | 'inactive' | 'not_open';

const ERROR_MESSAGES: Record<'invalid' | 'inactive' | 'expired' | 'not_open', { title: string; body: (session?: ExamSession) => string }> = {
  invalid: { title: 'Session Not Found', body: () => 'This exam link is invalid or has been removed. Please contact your administrator.' },
  inactive: { title: 'Session Inactive', body: () => 'This exam session has been deactivated. Please contact your administrator.' },
  expired: { title: 'Session Expired', body: () => 'This exam session has expired. Please contact your administrator.' },
  not_open: {
    title: 'Session Not Open Yet',
    body: (session) =>
      session?.startsAt
        ? `This session opens on ${new Date(session.startsAt).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })}.`
        : 'This session has not opened yet.',
  },
};

const useServerWrites = import.meta.env.VITE_ENABLE_SERVER_WRITES === 'true';

function getTimeLabel(count: number, timeLimitMinutes?: number) {
  if (timeLimitMinutes) return `${timeLimitMinutes} min`;
  if (count <= 25) return '15 min';
  if (count <= 50) return '35 min';
  if (count <= 75) return '60 min';
  return '75 min';
}

function getTimeLimitMinutes(count: number, timeLimitMinutes?: number) {
  if (timeLimitMinutes) return timeLimitMinutes;
  if (count <= 25) return 15;
  if (count <= 50) return 35;
  if (count <= 75) return 60;
  return 75;
}

function formatSessionDateTime(value?: string) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
}

export default function SessionEntry() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [session, setSession] = useState<ExamSession | null>(null);
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [preset, setPreset] = useState<Preset | null>(null);
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());

  useEffect(() => {
    if (!sessionId) return;

    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'exam_sessions', sessionId));
        if (!snap.exists()) {
          setPageState('invalid');
          return;
        }

        const data = { ...(snap.data() as ExamSession), id: snap.id };
        if (!data.isActive) {
          setPageState('inactive');
          return;
        }
        if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
          setPageState('expired');
          return;
        }
        if (data.startsAt && new Date(data.startsAt) > new Date()) {
          setSession(data);
          setPageState('not_open');
          return;
        }

        const presetSnap = await getDoc(doc(db, 'exam_presets', data.presetId));
        if (!presetSnap.exists()) {
          setPageState('invalid');
          return;
        }

        setPreset(presetSnap.data() as Preset);
        setSession(data);
        setPageState('ready');
      } catch (loadError) {
        console.error('Session load error:', loadError);
        setPageState('invalid');
      }
    };

    void load();
  }, [sessionId]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowTimestamp(Date.now());
    }, 30000);

    return () => window.clearInterval(interval);
  }, []);

  const handleStart = async (event: FormEvent) => {
    event.preventDefault();
    if (!session || !preset) return;

    setError('');
    if (!candidateName.trim()) {
      setError('Please enter your name.');
      return;
    }
    const normalizedEmail = normalizeEmail(candidateEmail);
    if (normalizedEmail && !isValidEmail(normalizedEmail)) {
      setError('Enter a valid email address for result history.');
      return;
    }
    if (accessCode.trim() !== session.accessCode) {
      setError('Incorrect access code. Please try again.');
      return;
    }

    if (session.allowedCandidates && session.allowedCandidates.length > 0) {
      const normalized = session.allowedCandidates.map((name) => name.trim().toLowerCase());
      if (!normalized.includes(candidateName.trim().toLowerCase())) {
        setError('You are not registered for this session. Contact your administrator.');
        return;
      }
    }

    setStarting(true);
    try {
      if (useServerWrites) {
        const response = await startSessionAttempt({
          sessionId: session.id,
          candidateName: candidateName.trim(),
          candidateEmail: normalizedEmail || undefined,
          accessCode: accessCode.trim(),
        });

        navigate('/quiz', {
          state: {
            examineeName: candidateName.trim(),
            mode: 'preset',
            track: preset.examTrack ?? 'exam_parity',
            presetLabel: preset.difficultyLabel ?? 'Preset Exam',
            targetCount: preset.targetCount,
            timeLimitMinutes: preset.timeLimitMinutes,
            presetId: session.presetId,
            presetQuestionIds: preset.questions,
            sessionId: session.id,
            sessionName: session.name,
            candidateEmail: normalizedEmail || undefined,
            participantId: response.participantId,
          },
        });
        return;
      }

      const participantRef = await addDoc(collection(db, 'session_participants'), {
        sessionId: session.id,
        sessionName: session.name,
        candidateName: candidateName.trim(),
        ...(normalizedEmail ? { candidateEmail: normalizedEmail } : {}),
        startedAt: new Date().toISOString(),
        status: 'in_progress',
        retakeNumber: 1,
      });

      navigate('/quiz', {
        state: {
          examineeName: candidateName.trim(),
          mode: 'preset',
          track: preset.examTrack ?? 'exam_parity',
          presetLabel: preset.difficultyLabel ?? 'Preset Exam',
          targetCount: preset.targetCount,
          timeLimitMinutes: preset.timeLimitMinutes,
          presetId: session.presetId,
          presetQuestionIds: preset.questions,
          sessionId: session.id,
          sessionName: session.name,
          candidateEmail: normalizedEmail || undefined,
          participantId: participantRef.id,
        },
      });
    } catch (startError) {
      console.error('Session start error:', startError);
      setError(startError instanceof Error ? startError.message : 'Could not start the session. Please try again.');
      setStarting(false);
    }
  };

  if (pageState === 'loading') {
    return <div className="flex h-64 items-center justify-center"><div className="w-7 h-7 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!sessionId) {
    const message = ERROR_MESSAGES.invalid;
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex items-center justify-center min-h-[70vh] px-4">
        <div className="text-center max-w-sm">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-red-50 border border-red-100 rounded-2xl mb-4">
            <span className="text-2xl">&#x26A0;</span>
          </div>
          <h2 className="text-xl font-bold text-zinc-900 mb-2">{message.title}</h2>
          <p className="text-sm text-zinc-500 font-medium">{message.body()}</p>
        </div>
      </motion.div>
    );
  }

  if (pageState !== 'ready') {
    const message = ERROR_MESSAGES[pageState as keyof typeof ERROR_MESSAGES];
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex items-center justify-center min-h-[70vh] px-4">
        <div className="text-center max-w-sm">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-red-50 border border-red-100 rounded-2xl mb-4">
            <span className="text-2xl">&#x26A0;</span>
          </div>
          <h2 className="text-xl font-bold text-zinc-900 mb-2">{message.title}</h2>
          <p className="text-sm text-zinc-500 font-medium">{message.body(session ?? undefined)}</p>
        </div>
      </motion.div>
    );
  }

  if (!session || !preset) {
    return <div className="flex h-64 items-center justify-center"><div className="w-7 h-7 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const maxRetakes = session.maxRetakes ?? 0;
  const timeLimitMinutes = getTimeLimitMinutes(preset.targetCount, preset.timeLimitMinutes);
  const startsAtLabel = formatSessionDateTime(session.startsAt);
  const expiresAtLabel = formatSessionDateTime(session.expiresAt);
  const remainingSessionMinutes = session.expiresAt
    ? Math.floor((new Date(session.expiresAt).getTime() - nowTimestamp) / 60000)
    : null;
  const showStartSoonWarning =
    remainingSessionMinutes !== null &&
    remainingSessionMinutes > timeLimitMinutes &&
    remainingSessionMinutes <= timeLimitMinutes + 10;
  const showOverrunWarning =
    remainingSessionMinutes !== null &&
    remainingSessionMinutes > 0 &&
    remainingSessionMinutes <= timeLimitMinutes;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex items-center justify-center min-h-[70vh] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-50 border border-indigo-100 rounded-2xl mb-4">
            <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">{session.name}</h2>
          <p className="text-zinc-500 text-sm font-medium mt-1">
            {preset.targetCount} Questions &middot; Secured Exam
            {maxRetakes > 0 && <> &middot; Max {maxRetakes} attempt{maxRetakes > 1 ? 's' : ''}</>}
          </p>
        </div>

        <div className="bg-white border border-zinc-100 rounded-3xl shadow-sm p-8">
          <div className="grid grid-cols-3 gap-2 mb-5">
            <div className="bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-3 text-center">
              <div className="text-base font-bold text-zinc-900">{preset.targetCount}</div>
              <div className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400">Questions</div>
            </div>
            <div className="bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-3 text-center">
              <div className="text-base font-bold text-zinc-900">{getTimeLabel(preset.targetCount, preset.timeLimitMinutes)}</div>
              <div className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400">Time Limit</div>
            </div>
            <div className="bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-3 text-center">
              <div className="text-base font-bold text-zinc-900">{preset.difficultyLabel ?? 'Preset'}</div>
              <div className="text-[9px] font-semibold uppercase tracking-wider text-zinc-400">Profile</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-5">
            <div className="bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Available From</div>
              <div className="text-[12px] font-semibold text-zinc-700">{startsAtLabel}</div>
            </div>
            <div className="bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Available Until</div>
              <div className="text-[12px] font-semibold text-zinc-700">{expiresAtLabel}</div>
            </div>
          </div>

          {showStartSoonWarning && (
            <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] font-medium text-amber-700">
              Start soon. Only about {remainingSessionMinutes} minutes remain before this session window closes, which leaves less than a 10-minute buffer over the exam duration.
            </div>
          )}

          {showOverrunWarning && (
            <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] font-medium text-rose-700">
              This session window closes in about {remainingSessionMinutes} minutes. If you start now, the session link will expire before your personal exam timer ends.
            </div>
          )}

          <div className="mb-5 flex flex-wrap gap-2">
            {typeof preset.multiSelectRatio === 'number' && (
              <span className="text-[10px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100 px-2.5 py-1 rounded-full">
                {Math.round(preset.multiSelectRatio * 100)}% multiple response
              </span>
            )}
            <span className="text-[10px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-100 px-2.5 py-1 rounded-full">
              80% pass threshold
            </span>
            {maxRetakes > 0 && (
              <span className="text-[10px] font-medium bg-amber-50 text-amber-600 border border-amber-100 px-2.5 py-1 rounded-full">
                Max {maxRetakes} attempt{maxRetakes > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="mb-5 bg-zinc-50 border border-zinc-100 rounded-2xl p-4">
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Session Instructions</p>
            <ul className="space-y-2 text-[12px] text-zinc-600">
              <li>1. Use your exact registered name if a candidate roster is enforced for this session.</li>
              <li>2. Keep the access code private and do not share exam content or screenshots.</li>
              <li>3. Do not refresh, copy, or print while the exam is active. The attempt stays locked to this device until submission.</li>
              <li>4. Add a valid email if you want to retrieve the saved report later from result history.</li>
            </ul>
          </div>

          <form onSubmit={handleStart} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Your Full Name</label>
              <input type="text" value={candidateName} onChange={(event) => setCandidateName(event.target.value)} placeholder="e.g. Rajan Agarwal" required autoFocus className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 font-medium outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all placeholder:text-zinc-300" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                Email <span className="text-zinc-300 normal-case font-normal">(optional but recommended - required for result history)</span>
              </label>
              <input type="email" value={candidateEmail} onChange={(event) => setCandidateEmail(event.target.value)} placeholder="your@email.com" inputMode="email" autoComplete="email" className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 font-medium outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all placeholder:text-zinc-300" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Access Code</label>
              <input type="password" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} placeholder="Enter the code provided to you" required className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 font-medium outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all placeholder:text-zinc-300" />
            </div>
            <AnimatePresence>
              {error && <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-xs font-semibold text-red-500 text-center">{error}</motion.p>}
            </AnimatePresence>
            <button type="submit" disabled={starting} className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm tracking-wide shadow-sm shadow-indigo-100 transition-all disabled:opacity-60">
              {starting ? 'Starting...' : 'Start Exam ->'}
            </button>
          </form>
        </div>
        <p className="text-center text-[11px] text-zinc-400 mt-5 font-medium">Once started, the exam timer cannot be paused and home access stays locked until submission.</p>
      </div>
    </motion.div>
  );
}
