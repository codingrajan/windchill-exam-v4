import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { assertAdminEmail, clearAdminSession, persistAdminSession } from '../services/authz';
import ReportsTab from '../components/admin/ReportsTab';
import PresetsTab from '../components/admin/PresetsTab';
import SessionsTab from '../components/admin/SessionsTab';
import AnalyticsTab from '../components/admin/AnalyticsTab';
import CohortCompareTab from '../components/admin/CohortCompareTab';
import AuditLogTab from '../components/admin/AuditLogTab';
import ContentIntelligenceTab from '../components/admin/ContentIntelligenceTab';
import QuestionBankTab from '../components/admin/QuestionBankTab';

type ActiveTab = 'reports' | 'presets' | 'sessions' | 'live' | 'analytics' | 'compare' | 'audit' | 'content' | 'questions';
const ADMIN_TAB_KEY = 'windchill:admin:tab';

const TABS = [
  { key: 'reports', label: 'Exam Reports' },
  { key: 'presets', label: 'Preset Manager' },
  { key: 'sessions', label: 'Exam Sessions' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'compare', label: 'Cohort Compare' },
  { key: 'content', label: 'Content Intel' },
  { key: 'questions', label: 'Question Bank' },
  { key: 'audit', label: 'Audit Trail' },
] as const;

export default function Admin() {
  const [authed, setAuthed] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [tab, setTab] = useState<ActiveTab>(() => {
    try {
      const stored = window.localStorage.getItem(ADMIN_TAB_KEY) as ActiveTab | null;
      return stored && ['reports', 'presets', 'sessions', 'analytics', 'compare', 'audit', 'content', 'questions'].includes(stored) ? stored : 'reports';
    } catch {
      return 'reports';
    }
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => onAuthStateChanged(auth, async (user) => {
    if (!user) {
      clearAdminSession();
      setAuthed(false);
      setAuthLoading(false);
      return;
    }

    try {
      assertAdminEmail(user.email);
      persistAdminSession({ email: String(user.email).trim().toLowerCase() });
      setAuthed(true);
      setError('');
    } catch {
      setAuthed(false);
      setError('This account is not approved for admin access.');
      clearAdminSession();
      await signOut(auth);
    } finally {
      setAuthLoading(false);
    }
  }), []);

  useEffect(() => {
    if (!authed) return;
    const resetTimer = () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      inactivityTimer.current = setTimeout(() => {
        clearAdminSession();
        void signOut(auth).catch(() => undefined);
        setAuthed(false);
      }, 120_000);
    };
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'] as const;
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [authed]);

  useEffect(() => {
    try {
      window.localStorage.setItem(ADMIN_TAB_KEY, tab);
    } catch {
      return;
    }
  }, [tab]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(''); setLoggingIn(true);
    try {
      const credentials = await signInWithEmailAndPassword(auth, email.trim(), password);
      assertAdminEmail(credentials.user.email);
      persistAdminSession({ email: String(credentials.user.email).trim().toLowerCase() });
      setAuthed(true);
      setError('');
    } catch (err) {
      console.error('Admin login error:', err);
      setError('Use a valid Firebase Authentication admin email and password.');
      clearAdminSession();
      await signOut(auth).catch(() => undefined);
    } finally { setLoggingIn(false); }
  };

  if (authLoading) return <div className="flex h-64 items-center justify-center"><div className="w-7 h-7 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /></div>;

  if (!authed) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex items-center justify-center min-h-[70vh] px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-50 border border-indigo-100 rounded-2xl mb-4">
              <span className="text-lg font-bold text-indigo-600 select-none">A</span>
            </div>
            <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Admin Console</h2>
            <p className="text-zinc-500 text-sm font-medium mt-1">Windchill Exam Administration</p>
          </div>
          <div className="bg-white border border-zinc-100 rounded-3xl shadow-sm p-8">
            <form onSubmit={handleLogin} className="space-y-4">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin email" required className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 font-medium outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all placeholder:text-zinc-300" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 font-medium outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all placeholder:text-zinc-300" />
              <AnimatePresence>{error && <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-xs font-semibold text-red-500 text-center">{error}</motion.p>}</AnimatePresence>
              <button type="submit" disabled={loggingIn} className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm tracking-wide shadow-sm shadow-indigo-100 transition-all disabled:opacity-60">{loggingIn ? 'Signing in...' : 'Sign In ->'}</button>
            </form>
          </div>
        </div>
      </motion.div>
    );
  }

  const tabComponents: Record<ActiveTab, React.ReactNode> = {
    reports: <ReportsTab />,
    presets: <PresetsTab />,
    sessions: <SessionsTab />,
    live: <SessionsTab />,
    analytics: <AnalyticsTab />,
    compare: <CohortCompareTab />,
    content: <ContentIntelligenceTab />,
    questions: <QuestionBankTab />,
    audit: <AuditLogTab />,
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="max-w-7xl mx-auto py-4 px-2">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Admin Command Center</h1>
          <p className="text-sm text-zinc-500 font-medium mt-0.5">Exam Reports, Presets, Sessions &amp; Analytics</p>
        </div>
        <button onClick={() => { clearAdminSession(); void signOut(auth).catch(() => undefined); setAuthed(false); }} className="text-xs font-semibold text-zinc-500 border border-zinc-200 hover:border-red-200 hover:text-red-500 hover:bg-red-50 px-4 py-2 rounded-full transition-all">Sign Out</button>
      </div>

      <div className="flex gap-1 bg-zinc-100 p-1 rounded-xl w-fit mb-6 flex-wrap">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${tab === t.key ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}>{t.label}</button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
          {tabComponents[tab]}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
