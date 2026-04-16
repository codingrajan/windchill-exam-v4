import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import {
  fetchBuiltInPresets,
  fetchFirestorePresets,
  mergePresetCatalog,
  syncBuiltInPresetsToFirestore,
} from '../../services/presetCatalog';
import {
  fetchBuiltInSessions,
  fetchFirestoreSessions,
  mergeSessionCatalog,
  syncBuiltInSessionsToFirestore,
} from '../../services/sessionCatalog';
import {
  createExamSession,
  patchExamSession,
  removeExamSession,
  saveSessionCandidateList,
} from '../../services/writeGateway';
import type { ExamResult, ExamSession, Preset, SessionParticipant } from '../../types/index';

type CandidateImportSummary = {
  validNames: string[];
  duplicateCount: number;
  ignoredCount: number;
};

const parseCandidateList = (input: string): CandidateImportSummary => {
  const lines = input
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const validNames: string[] = [];
  let duplicateCount = 0;
  let ignoredCount = 0;

  lines.forEach((line) => {
    const firstCell = line.split(',')[0]?.trim() ?? '';
    if (!firstCell || firstCell.toLowerCase() === 'name') {
      ignoredCount += 1;
      return;
    }

    const normalized = firstCell.toLowerCase();
    if (seen.has(normalized)) {
      duplicateCount += 1;
      return;
    }

    seen.add(normalized);
    validNames.push(firstCell);
  });

  return { validNames, duplicateCount, ignoredCount };
};

export default function SessionsTab() {
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [candidateText, setCandidateText] = useState<Record<string, string>>({});
  const [savingCandidates, setSavingCandidates] = useState<string | null>(null);
  const [candidateWarnings, setCandidateWarnings] = useState<Record<string, string>>({});
  const [participantsBySession, setParticipantsBySession] = useState<Record<string, SessionParticipant[]>>({});
  const [resultsBySession, setResultsBySession] = useState<Record<string, ExamResult[]>>({});

  const [formName, setFormName] = useState('');
  const [formPresetId, setFormPresetId] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formExpiry, setFormExpiry] = useState('');
  const [formStartsAt, setFormStartsAt] = useState('');
  const [formMaxRetakes, setFormMaxRetakes] = useState('0');

  const fileInputRef = useRef<Record<string, HTMLInputElement | null>>({});

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const [firestoreSessions, builtInSessions] = await Promise.all([
        fetchFirestoreSessions().catch(() => [] as ExamSession[]),
        fetchBuiltInSessions().catch(() => [] as ExamSession[]),
      ]);

      if (builtInSessions.length > 0) {
        try {
          await syncBuiltInSessionsToFirestore(builtInSessions, firestoreSessions);
        } catch (error) {
          console.error('Session sync error:', error);
        }
      }

      const refreshedSessions = await fetchFirestoreSessions().catch(() => firestoreSessions);
      const list = mergeSessionCatalog(refreshedSessions, builtInSessions);
      setSessions(list);

      const initial: Record<string, string> = {};
      list.forEach((session) => {
        initial[session.id] = (session.allowedCandidates ?? []).join('\n');
      });
      setCandidateText(initial);
    } catch (error) {
      console.error('Session fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSessionActivity = async () => {
    try {
      const [participantSnap, resultSnap] = await Promise.all([
        getDocs(collection(db, 'session_participants')),
        getDocs(collection(db, 'exam_results')),
      ]);

      const nextParticipants: Record<string, SessionParticipant[]> = {};
      participantSnap.forEach((entry) => {
        const participant = { ...(entry.data() as SessionParticipant), id: entry.id };
        if (!nextParticipants[participant.sessionId]) nextParticipants[participant.sessionId] = [];
        nextParticipants[participant.sessionId].push(participant);
      });

      const nextResults: Record<string, ExamResult[]> = {};
      resultSnap.forEach((entry) => {
        const result = { ...(entry.data() as ExamResult), docId: entry.id };
        if (!result.sessionId) return;
        if (!nextResults[result.sessionId]) nextResults[result.sessionId] = [];
        nextResults[result.sessionId].push(result);
      });

      Object.entries(nextParticipants).forEach(([sessionId, participants]) => {
        const sessionResults = nextResults[sessionId] ?? [];
        const resultsByParticipantId = new Map(
          sessionResults
            .filter((result) => result.participantId)
            .map((result) => [result.participantId as string, result]),
        );

        participants.forEach((participant) => {
          const matchedResult =
            (participant.id ? resultsByParticipantId.get(participant.id) : undefined)
            ?? sessionResults.find((result) => {
              const sameEmail =
                participant.candidateEmail
                && result.candidateEmail
                && participant.candidateEmail.trim().toLowerCase() === result.candidateEmail.trim().toLowerCase();
              const sameName = participant.candidateName.trim().toLowerCase() === result.examineeName.trim().toLowerCase();
              return sameEmail || sameName;
            });

          if (!matchedResult) return;

          participant.status = 'completed';
          participant.submittedAt = matchedResult.examDate;
          participant.score = matchedResult.scorePercentage;
          participant.passed = matchedResult.passed;
        });
      });

      Object.values(nextParticipants).forEach((list) => list.sort((left, right) => right.startedAt.localeCompare(left.startedAt)));
      Object.values(nextResults).forEach((list) => list.sort((left, right) => right.examDate.localeCompare(left.examDate)));

      setParticipantsBySession(nextParticipants);
      setResultsBySession(nextResults);
    } catch (error) {
      console.error('Session activity fetch error:', error);
    }
  };

  const loadPresets = async (seedBuiltIns = false) => {
    try {
      const [firestorePresets, builtInPresets] = await Promise.all([
        fetchFirestorePresets().catch(() => [] as Preset[]),
        fetchBuiltInPresets().catch(() => [] as Preset[]),
      ]);

      if (seedBuiltIns && builtInPresets.length > 0) {
        try {
          await syncBuiltInPresetsToFirestore(builtInPresets, firestorePresets);
        } catch (error) {
          console.error('Session preset sync error:', error);
        }
      }

      const refreshedFirestorePresets = await fetchFirestorePresets().catch(() => firestorePresets);
      const merged = mergePresetCatalog(refreshedFirestorePresets, builtInPresets);
      setPresets(merged);
      setFormPresetId((current) => current || merged[0]?.id || '');
    } catch (error) {
      console.error('Session preset load error:', error);
      setPresets([]);
    }
  };

  useEffect(() => {
    void fetchSessions();
    void loadPresets(true);
    void fetchSessionActivity();
  }, []);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!formName.trim() || !formPresetId || !formCode.trim()) return;

    setCreating(true);
    setMessage('');

    try {
      const selectedPreset = presets.find((preset) => preset.id === formPresetId);
      const payload: Omit<ExamSession, 'id'> = {
        name: formName.trim(),
        presetId: formPresetId,
        presetName: selectedPreset?.name ?? formPresetId,
        accessCode: formCode.trim(),
        isActive: true,
        createdAt: new Date().toISOString(),
        maxRetakes: parseInt(formMaxRetakes, 10) || 0,
        ...(formExpiry ? { expiresAt: new Date(formExpiry).toISOString() } : {}),
        ...(formStartsAt ? { startsAt: new Date(formStartsAt).toISOString() } : {}),
      };

      const newSession = await createExamSession(payload);
      setSessions((prev) => [newSession, ...prev]);
      setCandidateText((prev) => ({ ...prev, [newSession.id]: '' }));
      setFormName('');
      setFormPresetId(presets[0]?.id ?? '');
      setFormCode('');
      setFormExpiry('');
      setFormStartsAt('');
      setFormMaxRetakes('0');
      setMessage('Session created successfully.');
      void fetchSessionActivity();
    } catch (error) {
      console.error('Create session error:', error);
      setMessage('Error creating session.');
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (session: ExamSession) => {
    setToggling(session.id);
    try {
      await patchExamSession(session.id, { isActive: !session.isActive }, { isActive: !session.isActive, name: session.name });
      setSessions((prev) => prev.map((entry) => (entry.id === session.id ? { ...entry, isActive: !entry.isActive } : entry)));
    } finally {
      setToggling(null);
    }
  };

  const deleteSession = async (session: ExamSession) => {
    if (!window.confirm('Permanently delete this session?')) return;
    setDeleting(session.id);
    try {
      await removeExamSession(session);
      setSessions((prev) => prev.filter((entry) => entry.id !== session.id));
    } finally {
      setDeleting(null);
    }
  };

  const copyLink = (id: string) => {
    void navigator.clipboard.writeText(`${window.location.origin}/session/${id}`).then(() => {
      setCopied(id);
      window.setTimeout(() => setCopied(null), 2000);
    });
  };

  const handleCsvUpload = (sessionId: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const text = String(loadEvent.target?.result ?? '');
      const parsed = parseCandidateList(text);
      setCandidateText((prev) => ({ ...prev, [sessionId]: parsed.validNames.join('\n') }));
      setCandidateWarnings((prev) => ({
        ...prev,
        [sessionId]:
          parsed.duplicateCount > 0 || parsed.ignoredCount > 0
            ? `${parsed.duplicateCount} duplicate entr${parsed.duplicateCount === 1 ? 'y was' : 'ies were'} removed, ${parsed.ignoredCount} line${parsed.ignoredCount === 1 ? ' was' : 's were'} ignored.`
            : '',
      }));
    };
    reader.readAsText(file);
  };

  const saveCandidates = async (session: ExamSession) => {
    setSavingCandidates(session.id);
    try {
      const parsed = parseCandidateList(candidateText[session.id] ?? '');
      const names = parsed.validNames;
      await saveSessionCandidateList(session.id, names);
      setSessions((prev) => prev.map((entry) => (entry.id === session.id ? { ...entry, allowedCandidates: names } : entry)));
      setCandidateText((prev) => ({ ...prev, [session.id]: names.join('\n') }));
      setCandidateWarnings((prev) => ({
        ...prev,
        [session.id]:
          parsed.duplicateCount > 0 || parsed.ignoredCount > 0
            ? `${parsed.duplicateCount} duplicate entr${parsed.duplicateCount === 1 ? 'y was' : 'ies were'} removed, ${parsed.ignoredCount} line${parsed.ignoredCount === 1 ? ' was' : 's were'} ignored.`
            : '',
      }));
      void fetchSessionActivity();
    } catch (error) {
      console.error('Save candidates error:', error);
    } finally {
      setSavingCandidates(null);
    }
  };

  const getSessionStats = (sessionId: string) => {
    const participants = participantsBySession[sessionId] ?? [];
    const results = resultsBySession[sessionId] ?? [];
    const completed = participants.filter((participant) => participant.status === 'completed').length;
    const inProgress = Math.max(0, participants.length - completed);
    const passed = results.filter((result) => result.passed).length;
    return { participants, results, completed, inProgress, passed };
  };

  const getLeaderboard = (sessionId: string) => {
    const participants = participantsBySession[sessionId] ?? [];
    return participants
      .filter((participant) => participant.status === 'completed' && typeof participant.score === 'number')
      .sort((left, right) => {
        if ((right.score ?? -1) !== (left.score ?? -1)) {
          return (right.score ?? -1) - (left.score ?? -1);
        }
        return String(left.submittedAt ?? left.startedAt).localeCompare(String(right.submittedAt ?? right.startedAt));
      })
      .map((participant, index) => ({ ...participant, rank: index + 1 }));
  };

  const downloadCsv = (filename: string, rows: Array<Array<string | number>>) => {
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportLeaderboard = (session: ExamSession) => {
    const leaderboard = getLeaderboard(session.id);
    if (leaderboard.length === 0) return;
    downloadCsv(`${session.id}_leaderboard.csv`, [
      ['Rank', 'Candidate', 'Email', 'Score', 'Passed', 'Submitted At'],
      ...leaderboard.map((participant) => [
        participant.rank,
        participant.candidateName,
        participant.candidateEmail ?? '',
        participant.score ?? '',
        participant.passed ? 'Yes' : 'No',
        participant.submittedAt ?? '',
      ]),
    ]);
  };

  const exportActivity = (session: ExamSession) => {
    const stats = getSessionStats(session.id);
    if (stats.participants.length === 0) return;
    downloadCsv(`${session.id}_activity.csv`, [
      ['Candidate', 'Email', 'Status', 'Score', 'Passed', 'Started At', 'Submitted At'],
      ...stats.participants.map((participant) => [
        participant.candidateName,
        participant.candidateEmail ?? '',
        participant.status,
        participant.score ?? '',
        participant.passed ? 'Yes' : participant.passed === false ? 'No' : '',
        participant.startedAt,
        participant.submittedAt ?? '',
      ]),
    ]);
  };

  const fmtDate = (iso?: string) =>
    iso
      ? new Date(iso).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '--';

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      <div className="xl:col-span-1">
        <div className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-4">Create Session</p>
          <form onSubmit={handleCreate} className="space-y-3">
            <input
              type="text"
              placeholder="Session name, e.g. Batch Jan 2025 - A"
              value={formName}
              onChange={(event) => setFormName(event.target.value)}
              required
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-zinc-300"
            />
            <select
              value={formPresetId}
              onChange={(event) => setFormPresetId(event.target.value)}
              required
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 transition-all"
            >
              <option value="">Select a preset exam...</option>
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.assessmentType === 'interview' ? '[Interview] ' : ''}{preset.name} ({preset.targetCount}Q)
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Access code (shared with candidates)"
              value={formCode}
              onChange={(event) => setFormCode(event.target.value)}
              required
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-zinc-300"
            />
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Max Attempts (0 = unlimited)</label>
              <input
                type="number"
                min="0"
                value={formMaxRetakes}
                onChange={(event) => setFormMaxRetakes(event.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 transition-all"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Opens At (optional)</label>
              <input
                type="datetime-local"
                value={formStartsAt}
                onChange={(event) => setFormStartsAt(event.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 transition-all"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Expires At (optional)</label>
              <input
                type="datetime-local"
                value={formExpiry}
                onChange={(event) => setFormExpiry(event.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="w-full py-3 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Session'}
            </button>
            {message && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`text-[12px] font-medium text-center ${message.includes('Error') ? 'text-red-500' : 'text-emerald-600'}`}
              >
                {message}
              </motion.p>
            )}
          </form>
        </div>
      </div>

      <div className="xl:col-span-2">
        <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 bg-zinc-50">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Exam Sessions ({sessions.length})</p>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-16 text-zinc-400 text-sm font-medium">No sessions yet.</div>
          ) : (
            <div className="divide-y divide-zinc-50">
              {sessions.map((session) => (
                <div key={session.id}>
                  {(() => {
                    const stats = getSessionStats(session.id);
                    return (
                  <div className="px-5 py-4 hover:bg-zinc-50/60 transition-colors">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-semibold text-zinc-800">{session.name}</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${session.isActive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-zinc-100 text-zinc-400 border-zinc-200'}`}>
                            {session.isActive ? 'Active' : 'Inactive'}
                          </span>
                          {session.isBuiltIn && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-100">
                              Scheduled
                            </span>
                          )}
                          {(session.allowedCandidates?.length ?? 0) > 0 && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-blue-50 text-blue-600 border-blue-100">
                              {session.allowedCandidates!.length} registered
                            </span>
                          )}
                          {stats.inProgress > 0 && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-600 border-indigo-100">
                              {stats.inProgress} in progress
                            </span>
                          )}
                          {stats.completed > 0 && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-600 border-emerald-100">
                              {stats.completed} completed
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                          <p className="text-[12px] text-zinc-400">Preset: <span className="text-zinc-600">{session.presetName}</span></p>
                          <p className="text-[12px] text-zinc-400">Code: <span className="text-zinc-600 font-mono">{session.accessCode}</span></p>
                          {(session.maxRetakes ?? 0) > 0 && <p className="text-[12px] text-zinc-400">Max retakes: <span className="text-zinc-600">{session.maxRetakes}</span></p>}
                          {session.startsAt && <p className="text-[12px] text-zinc-400">Opens: <span className="text-zinc-600">{fmtDate(session.startsAt)}</span></p>}
                          {session.expiresAt && <p className="text-[12px] text-zinc-400">Expires: <span className="text-zinc-600">{fmtDate(session.expiresAt)}</span></p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                        <button onClick={() => setExpandedId(expandedId === session.id ? null : session.id)} className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 transition-all">
                          {expandedId === session.id ? 'Collapse' : 'Manage'}
                        </button>
                        <button onClick={() => copyLink(session.id)} className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all ${copied === session.id ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-indigo-50 border-indigo-100 text-indigo-600 hover:bg-indigo-100'}`}>
                          {copied === session.id ? 'Copied!' : 'Copy Link'}
                        </button>
                        <button onClick={() => void toggleActive(session)} disabled={toggling === session.id} className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 transition-all disabled:opacity-50">
                          {toggling === session.id ? '...' : session.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button onClick={() => void deleteSession(session)} disabled={deleting === session.id} className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-red-100 bg-red-50 text-red-500 hover:bg-red-100 transition-all disabled:opacity-50">
                          {deleting === session.id ? '...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                    );
                  })()}

                  <AnimatePresence>
                    {expandedId === session.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-t border-zinc-100"
                      >
                        <div className="px-5 py-4 bg-zinc-50/60">
                          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">Registered Candidates (Bulk Import)</p>
                          <p className="text-[11px] text-zinc-500 mb-3">Enter one name per line, or upload a CSV/TXT file. If this list is non-empty, only these candidates can take the exam.</p>
                          <textarea
                            rows={6}
                            value={candidateText[session.id] ?? ''}
                            onChange={(event) => setCandidateText((prev) => ({ ...prev, [session.id]: event.target.value }))}
                            placeholder={'John Smith\nJane Doe\n...'}
                            className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 transition-all placeholder:text-zinc-300 resize-none"
                          />
                          <div className="flex items-center gap-3 mt-3 flex-wrap">
                            <button onClick={() => fileInputRef.current[session.id]?.click()} className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:border-indigo-300 transition-all">
                              Upload CSV / TXT
                            </button>
                            <input
                              ref={(element) => {
                                fileInputRef.current[session.id] = element;
                              }}
                              type="file"
                              accept=".csv,.txt"
                              className="hidden"
                              onChange={(event) => handleCsvUpload(session.id, event)}
                            />
                            <button onClick={() => void saveCandidates(session)} disabled={savingCandidates === session.id} className="text-[11px] font-semibold px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-all disabled:opacity-50">
                              {savingCandidates === session.id ? 'Saving...' : 'Save List'}
                            </button>
                            {(candidateText[session.id] ?? '').split('\n').filter(Boolean).length > 0 && (
                              <span className="text-[11px] text-zinc-400">
                                {(candidateText[session.id] ?? '').split('\n').filter(Boolean).length} candidate{(candidateText[session.id] ?? '').split('\n').filter(Boolean).length !== 1 ? 's' : ''}
                              </span>
                            )}
                            {candidateWarnings[session.id] && (
                              <span className="text-[11px] text-amber-600">
                                {candidateWarnings[session.id]}
                              </span>
                            )}
                          </div>
                          {(() => {
                            const stats = getSessionStats(session.id);
                            const leaderboard = getLeaderboard(session.id);
                            const averageScore = leaderboard.length
                              ? Math.round(leaderboard.reduce((sum, participant) => sum + (participant.score ?? 0), 0) / leaderboard.length)
                              : null;
                            const passRate = leaderboard.length ? Math.round((stats.passed / leaderboard.length) * 100) : null;
                            const topScore = leaderboard.length > 0 ? leaderboard[0].score ?? null : null;
                            return (
                              <div className="mt-5">
                                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">Session Activity</p>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                                  <div className="bg-white border border-zinc-100 rounded-xl px-4 py-3">
                                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Registered</p>
                                    <p className="text-lg font-bold text-zinc-900">{session.allowedCandidates?.length ?? 0}</p>
                                  </div>
                                  <div className="bg-white border border-zinc-100 rounded-xl px-4 py-3">
                                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Started</p>
                                    <p className="text-lg font-bold text-zinc-900">{stats.participants.length}</p>
                                  </div>
                                  <div className="bg-white border border-zinc-100 rounded-xl px-4 py-3">
                                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">In Progress</p>
                                    <p className="text-lg font-bold text-indigo-600">{stats.inProgress}</p>
                                  </div>
                                  <div className="bg-white border border-zinc-100 rounded-xl px-4 py-3">
                                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Completed</p>
                                    <p className="text-lg font-bold text-emerald-600">{stats.completed}</p>
                                  </div>
                                  <div className="bg-white border border-zinc-100 rounded-xl px-4 py-3">
                                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Pass Rate</p>
                                    <p className="text-lg font-bold text-blue-600">{passRate ?? 0}%</p>
                                  </div>
                                  <div className="bg-white border border-zinc-100 rounded-xl px-4 py-3">
                                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Top Score</p>
                                    <p className="text-lg font-bold text-zinc-900">{topScore ?? '--'}{topScore !== null ? '%' : ''}</p>
                                  </div>
                                </div>
                                {leaderboard.length > 0 && (
                                  <div className="mb-5">
                                    <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                                      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Session Leaderboard</p>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <button
                                          onClick={() => exportLeaderboard(session)}
                                          className="text-[10px] font-semibold px-2.5 py-1 rounded-full border bg-white text-indigo-600 border-indigo-100 hover:bg-indigo-50"
                                        >
                                          Export Leaderboard
                                        </button>
                                        {averageScore !== null && (
                                          <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full border bg-blue-50 text-blue-600 border-blue-100">
                                            Avg {averageScore}%
                                          </span>
                                        )}
                                        <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-600 border-emerald-100">
                                          {stats.passed} passed
                                        </span>
                                      </div>
                                    </div>
                                    <div className="overflow-x-auto bg-white border border-zinc-100 rounded-xl">
                                      <table className="w-full text-sm">
                                        <thead>
                                          <tr className="bg-zinc-50 border-b border-zinc-100">
                                            {['Rank', 'Candidate', 'Score', 'Result', 'Submitted'].map((header) => (
                                              <th key={header} className="px-4 py-3 text-left text-[10px] font-semibold text-zinc-400 uppercase tracking-wider whitespace-nowrap">{header}</th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {leaderboard.map((participant, index) => (
                                            <tr key={`leader-${participant.id ?? `${participant.sessionId}-${participant.candidateName}-${index}`}`} className={`border-b border-zinc-50 ${index % 2 === 0 ? 'bg-white' : 'bg-zinc-50/30'}`}>
                                              <td className="px-4 py-3">
                                                <span className={`inline-flex min-w-8 items-center justify-center rounded-full px-2 py-1 text-[11px] font-bold ${
                                                  participant.rank === 1
                                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                    : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                                                }`}>
                                                  #{participant.rank}
                                                </span>
                                              </td>
                                              <td className="px-4 py-3 font-semibold text-zinc-800 whitespace-nowrap">{participant.candidateName}</td>
                                              <td className="px-4 py-3 text-sm font-bold text-zinc-800">{participant.score}%</td>
                                              <td className="px-4 py-3">
                                                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                                                  participant.passed
                                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                    : 'bg-red-50 text-red-500 border-red-100'
                                                }`}>
                                                  {participant.passed ? 'PASS' : 'FAIL'}
                                                </span>
                                              </td>
                                              <td className="px-4 py-3 text-zinc-500 text-[12px] whitespace-nowrap">{fmtDate(participant.submittedAt)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                                {stats.participants.length > 0 ? (
                                  <div className="overflow-x-auto bg-white border border-zinc-100 rounded-xl">
                                    <div className="flex items-center justify-end px-4 pt-3">
                                      <button
                                        onClick={() => exportActivity(session)}
                                        className="text-[10px] font-semibold px-2.5 py-1 rounded-full border bg-white text-indigo-600 border-indigo-100 hover:bg-indigo-50"
                                      >
                                        Export Activity
                                      </button>
                                    </div>
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="bg-zinc-50 border-b border-zinc-100">
                                          {['Candidate', 'Email', 'Status', 'Score', 'Started', 'Submitted'].map((header) => (
                                            <th key={header} className="px-4 py-3 text-left text-[10px] font-semibold text-zinc-400 uppercase tracking-wider whitespace-nowrap">{header}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {stats.participants.map((participant, index) => (
                                          <tr key={participant.id ?? `${participant.sessionId}-${participant.candidateName}-${index}`} className={`border-b border-zinc-50 ${index % 2 === 0 ? 'bg-white' : 'bg-zinc-50/30'}`}>
                                            <td className="px-4 py-3 font-semibold text-zinc-800 whitespace-nowrap">{participant.candidateName}</td>
                                            <td className="px-4 py-3 text-zinc-500 text-[12px]">{participant.candidateEmail ?? '--'}</td>
                                            <td className="px-4 py-3">
                                              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${participant.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                                                {participant.status === 'completed' ? 'Completed' : 'In Progress'}
                                              </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm font-bold text-zinc-800">{participant.score ?? '--'}{participant.score !== undefined ? '%' : ''}</td>
                                            <td className="px-4 py-3 text-zinc-500 text-[12px] whitespace-nowrap">{fmtDate(participant.startedAt)}</td>
                                            <td className="px-4 py-3 text-zinc-500 text-[12px] whitespace-nowrap">{fmtDate(participant.submittedAt)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <p className="text-sm text-zinc-400">No candidates have started this session yet.</p>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
