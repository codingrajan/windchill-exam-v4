import { useEffect, useState } from 'react';
import { collection, getDocs, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { ExamSession, SessionParticipant } from '../../types/index';

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white border border-zinc-100 rounded-2xl p-4 text-center shadow-sm">
      <div className={`text-2xl font-bold mb-1 ${color}`}>{value}</div>
      <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{label}</div>
    </div>
  );
}

export default function LiveMonitorTab() {
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [indexError, setIndexError] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);

  useEffect(() => {
    getDocs(query(collection(db, 'exam_sessions'), orderBy('createdAt', 'desc')))
      .then((snap) => {
        const list: ExamSession[] = [];
        snap.forEach((d) => list.push({ ...(d.data() as ExamSession), id: d.id }));
        setSessions(list);
        if (list.length > 0) setSelectedId(list[0].id);
      })
      .finally(() => setLoadingSessions(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const q = query(collection(db, 'session_participants'), where('sessionId', '==', selectedId), orderBy('startedAt', 'desc'));
    const unsub = onSnapshot(q,
      (snap) => {
        setIndexError(false);
        const list: SessionParticipant[] = [];
        snap.forEach((d) => list.push({ ...(d.data() as SessionParticipant), id: d.id }));
        setParticipants(list);
      },
      (err) => {
        console.error('Live monitor error:', err);
        setIndexError(true);
      }
    );
    return () => unsub();
  }, [selectedId]);

  const inProgress = participants.filter((p) => p.status === 'in_progress').length;
  const completed = participants.filter((p) => p.status === 'completed').length;
  const passed = participants.filter((p) => p.passed === true).length;
  const passRate = completed > 0 ? Math.round((passed / completed) * 100) : 0;

  const fmtTime = (iso?: string) => {
    if (!iso) return '--';
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const elapsed = (start?: string, end?: string) => {
    if (!start || !end) return '--';
    const s = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000);
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  return (
    <div className="space-y-5">
      {/* Session selector */}
      <div className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm">
        <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">Select Session to Monitor</p>
        {loadingSessions ? (
          <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        ) : sessions.length === 0 ? (
          <p className="text-sm text-zinc-400">No sessions found.</p>
        ) : (
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full max-w-sm bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 transition-all">
            {sessions.map((s) => <option key={s.id} value={s.id}>{s.name} {!s.isActive ? '(inactive)' : ''}</option>)}
          </select>
        )}
      </div>

      {/* Stats */}
      {selectedId && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Total Started" value={participants.length} color="text-zinc-800" />
            <StatCard label="In Progress" value={inProgress} color="text-indigo-600" />
            <StatCard label="Completed" value={completed} color="text-emerald-600" />
            <StatCard label="Pass Rate" value={completed > 0 ? `${passRate}%` : '--'} color={passRate >= 80 ? 'text-emerald-600' : passRate > 0 ? 'text-amber-500' : 'text-zinc-400'} />
          </div>

          {indexError ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
              <p className="text-sm font-semibold text-amber-700 mb-1">Firestore index building...</p>
              <p className="text-xs text-amber-600">Check the browser console for a link to create the required index, then refresh this tab.</p>
            </div>
          ) : (
            <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-zinc-50 border-b border-zinc-100">
                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Participants - Live</p>
                <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                  Real-time
                </span>
              </div>
              {participants.length === 0 ? (
                <div className="py-16 px-5 text-zinc-400 text-sm font-medium">No participants yet for this session.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-100">
                        {['Candidate', 'Email', 'Retake #', 'Started', 'Status', 'Score', 'Time Taken'].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-zinc-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {participants.map((p, i) => (
                        <tr key={p.id} className={`border-b border-zinc-50 hover:bg-zinc-50/60 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-zinc-50/30'}`}>
                          <td className="px-4 py-3 font-semibold text-zinc-800 whitespace-nowrap">{p.candidateName}</td>
                          <td className="px-4 py-3 text-zinc-500 text-[12px]">{p.candidateEmail ?? '--'}</td>
                          <td className="px-4 py-3 text-center"><span className="text-[11px] font-bold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">#{p.retakeNumber}</span></td>
                          <td className="px-4 py-3 text-zinc-500 text-[12px] whitespace-nowrap">{fmtTime(p.startedAt)}</td>
                          <td className="px-4 py-3">
                            {p.status === 'in_progress' ? (
                              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse inline-block" />
                                In Progress
                              </span>
                            ) : (
                              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${p.passed ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-500 border-red-100'}`}>
                                {p.passed ? 'PASS' : 'FAIL'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {p.score !== undefined ? (
                              <span className={`text-sm font-bold ${p.score >= 80 ? 'text-emerald-600' : 'text-red-500'}`}>{p.score}%</span>
                            ) : <span className="text-zinc-300">--</span>}
                          </td>
                          <td className="px-4 py-3 text-zinc-500 text-[12px] whitespace-nowrap">{elapsed(p.startedAt, p.submittedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
