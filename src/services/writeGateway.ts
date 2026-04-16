import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
  writeBatch,
  setDoc,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { assertAdminEmail, getCurrentActorEmail, getStoredAdminSession } from './authz';
import type { ExamResult, ExamSession, Preset, QuestionAdminOverride } from '../types/index';

type AuditAction =
  | 'result_submitted'
  | 'result_deleted'
  | 'results_deleted_all'
  | 'preset_created'
  | 'preset_updated'
  | 'preset_deleted'
  | 'session_created'
  | 'session_updated'
  | 'session_deleted'
  | 'question_updated'
  | 'question_status_changed';

interface AuditEntry {
  action: AuditAction;
  entityType: 'exam_results' | 'exam_presets' | 'exam_sessions' | 'session_participants' | 'question_overrides';
  entityId?: string;
  details?: Record<string, unknown>;
}

interface StartSessionAttemptInput {
  sessionId: string;
  candidateName: string;
  candidateEmail?: string;
  accessCode: string;
}

interface SubmitExamResponse {
  resultId?: string;
  id?: string;
  participantId?: string;
}

const useServerWrites = import.meta.env.VITE_ENABLE_SERVER_WRITES === 'true';
const PENDING_RESULTS_KEY = 'wc_pending_results';

const getAdminHeaders = async (): Promise<Record<string, string>> => {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error('Missing admin auth token.');
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
};

const postJson = async <TResponse>(
  url: string,
  body: unknown,
  options?: { admin?: boolean },
): Promise<TResponse> => {
  const headers = options?.admin ? await getAdminHeaders() : { 'Content-Type': 'application/json' };
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload.error === 'string' ? payload.error : `Request failed: ${response.status}`);
  }

  return payload as TResponse;
};

const logAuditEntry = async ({ action, entityType, entityId, details }: AuditEntry): Promise<void> => {
  await addDoc(collection(db, 'audit_logs'), {
    action,
    entityType,
    entityId: entityId ?? null,
    actorEmail: getCurrentActorEmail(),
    createdAt: new Date().toISOString(),
    details: details ?? {},
  });
};

const logAuditSafely = async (entry: AuditEntry): Promise<void> => {
  try {
    await logAuditEntry(entry);
  } catch (error) {
    console.error('Audit log error:', error);
  }
};

const requireAdmin = (): void => {
  assertAdminEmail(auth.currentUser?.email ?? getStoredAdminSession()?.email);
};

const normalizeEmail = (email?: string): string | undefined => {
  const trimmed = String(email ?? '').trim().toLowerCase();
  return trimmed || undefined;
};

interface PendingResultSubmission {
  key: string;
  payload: ExamResult;
  participantId?: string;
}

const readPendingResults = (): PendingResultSubmission[] => {
  try {
    const raw = window.localStorage.getItem(PENDING_RESULTS_KEY);
    return raw ? (JSON.parse(raw) as PendingResultSubmission[]) : [];
  } catch {
    return [];
  }
};

const writePendingResults = (items: PendingResultSubmission[]): void => {
  try {
    if (items.length === 0) {
      window.localStorage.removeItem(PENDING_RESULTS_KEY);
      return;
    }
    window.localStorage.setItem(PENDING_RESULTS_KEY, JSON.stringify(items));
  } catch (error) {
    console.error('Pending result cache error:', error);
  }
};

const buildPendingResultKey = (payload: ExamResult, participantId?: string): string =>
  [
    payload.attemptId ?? 'no-attempt',
    payload.sessionId ?? 'no-session',
    participantId ?? payload.participantId ?? 'no-participant',
    normalizeEmail(payload.candidateEmail) ?? payload.examineeName.trim().toLowerCase(),
    payload.examDate,
  ].join('::');

export const cachePendingExamResult = (payload: ExamResult, participantId?: string): string => {
  const normalizedPayload: ExamResult = {
    ...payload,
    ...(payload.candidateEmail ? { candidateEmail: normalizeEmail(payload.candidateEmail) } : {}),
  };
  const key = buildPendingResultKey(normalizedPayload, participantId);
  const current = readPendingResults().filter((entry) => entry.key !== key);
  current.push({ key, payload: normalizedPayload, participantId });
  writePendingResults(current);
  return key;
};

const clearPendingExamResult = (key: string): void => {
  const current = readPendingResults().filter((entry) => entry.key !== key);
  writePendingResults(current);
};

const resolveParticipantRef = async (
  sessionId?: string,
  examineeName?: string,
  candidateEmail?: string,
): Promise<string | undefined> => {
  if (!sessionId) return undefined;

  const participantQueries = [];
  const normalizedEmail = normalizeEmail(candidateEmail);
  if (normalizedEmail) {
    participantQueries.push(
      query(
        collection(db, 'session_participants'),
        where('sessionId', '==', sessionId),
        where('candidateEmail', '==', normalizedEmail),
      ),
    );
  }

  if (examineeName?.trim()) {
    participantQueries.push(
      query(
        collection(db, 'session_participants'),
        where('sessionId', '==', sessionId),
        where('candidateName', '==', examineeName.trim()),
      ),
    );
  }

  for (const participantQuery of participantQueries) {
    const snap = await getDocs(participantQuery);
    const matches: CandidateMatch[] = snap.docs
      .map((entry) => ({ id: entry.id, ...(entry.data() as Omit<CandidateMatch, 'id'>) }))
      .sort((left, right) =>
        String(right.startedAt ?? '').localeCompare(String(left.startedAt ?? '')),
      );

    const inProgress = matches.find((entry) => entry.status === 'in_progress');
    if (inProgress) return String(inProgress.id);
    if (matches[0]) return String(matches[0].id);
  }

  return undefined;
};

export async function submitExamResult(payload: ExamResult, participantId?: string): Promise<string> {
  const normalizedPayload: ExamResult = {
    ...payload,
    ...(payload.candidateEmail ? { candidateEmail: normalizeEmail(payload.candidateEmail) } : {}),
  };
  const pendingKey = cachePendingExamResult(normalizedPayload, participantId);
  const resolvedParticipantId =
    participantId
    ?? normalizedPayload.participantId
    ?? await resolveParticipantRef(normalizedPayload.sessionId, normalizedPayload.examineeName, normalizedPayload.candidateEmail);

  if (normalizedPayload.attemptId) {
    const priorAttemptSnap = await getDocs(
      query(collection(db, 'exam_results'), where('attemptId', '==', normalizedPayload.attemptId)),
    );
    if (!priorAttemptSnap.empty) {
      clearPendingExamResult(pendingKey);
      return priorAttemptSnap.docs[0].id;
    }
  }

  if (useServerWrites) {
    try {
      const response = await postJson<SubmitExamResponse>('/api/exam/submit', {
        ...normalizedPayload,
        ...(resolvedParticipantId ? { participantId: resolvedParticipantId } : {}),
      });
      clearPendingExamResult(pendingKey);
      return response.resultId ?? response.id ?? '';
    } catch (error) {
      console.error('Server submit failed, falling back to Firestore:', error);
    }
  }

  const submittedAt = normalizedPayload.examDate;
  const resultRef = await addDoc(collection(db, 'exam_results'), {
    ...normalizedPayload,
    ...(resolvedParticipantId ? { participantId: resolvedParticipantId } : {}),
  });

  if (resolvedParticipantId) {
    await updateDoc(doc(db, 'session_participants', resolvedParticipantId), {
      status: 'completed',
      submittedAt,
      score: normalizedPayload.scorePercentage,
      passed: normalizedPayload.passed,
    });
  }

  await logAuditSafely({
    action: 'result_submitted',
    entityType: 'exam_results',
      entityId: resultRef.id,
      details: {
      examineeName: normalizedPayload.examineeName,
      examTrack: normalizedPayload.examTrack ?? null,
      sessionId: normalizedPayload.sessionId ?? null,
      scorePercentage: normalizedPayload.scorePercentage,
    },
  });
  clearPendingExamResult(pendingKey);
  return resultRef.id;
}

export async function flushPendingExamResults(): Promise<void> {
  const pending = readPendingResults();
  for (const entry of pending) {
    try {
      await submitExamResult(entry.payload, entry.participantId);
    } catch (error) {
      console.error('Pending result flush error:', error);
    }
  }
}

export async function startSessionAttempt(input: StartSessionAttemptInput): Promise<{ participantId: string; retakeNumber: number }> {
  if (useServerWrites) {
    return postJson<{ ok: true; participantId: string; retakeNumber: number }>('/api/exam/start', input);
  }

  throw new Error('Server write mode is required for secure session starts.');
}

export async function upsertPreset(
  payload: Omit<Preset, 'id'>,
  existingId?: string,
): Promise<Preset> {
  if (useServerWrites) {
    const response = await postJson<{ ok: true; preset: Preset }>(
      '/api/admin/write',
      { action: 'preset_upsert', data: { ...payload, ...(existingId ? { id: existingId } : {}) } },
      { admin: true },
    );
    return response.preset;
  }

  requireAdmin();

  if (existingId) {
    await setDoc(doc(db, 'exam_presets', existingId), { ...payload, id: existingId });
    await logAuditSafely({
      action: 'preset_updated',
      entityType: 'exam_presets',
      entityId: existingId,
      details: { name: payload.name, targetCount: payload.targetCount },
    });
    return { ...payload, id: existingId };
  }

  const ref = await addDoc(collection(db, 'exam_presets'), payload);
  await setDoc(doc(db, 'exam_presets', ref.id), { ...payload, id: ref.id });
  await logAuditSafely({
    action: 'preset_created',
    entityType: 'exam_presets',
    entityId: ref.id,
    details: { name: payload.name, targetCount: payload.targetCount },
  });
  return { ...payload, id: ref.id };
}

export async function removePreset(preset: Pick<Preset, 'id' | 'name'>): Promise<void> {
  if (useServerWrites) {
    await postJson('/api/admin/write', { action: 'preset_delete', data: preset }, { admin: true });
    return;
  }

  requireAdmin();
  await deleteDoc(doc(db, 'exam_presets', preset.id));
  await logAuditSafely({
    action: 'preset_deleted',
    entityType: 'exam_presets',
    entityId: preset.id,
    details: { name: preset.name },
  });
}

export async function createExamSession(payload: Omit<ExamSession, 'id'>): Promise<ExamSession> {
  if (useServerWrites) {
    const response = await postJson<{ ok: true; session: ExamSession }>(
      '/api/admin/write',
      { action: 'session_create', data: payload },
      { admin: true },
    );
    return response.session;
  }

  requireAdmin();
  const ref = await addDoc(collection(db, 'exam_sessions'), payload);
  await logAuditSafely({
    action: 'session_created',
    entityType: 'exam_sessions',
    entityId: ref.id,
    details: { name: payload.name, presetId: payload.presetId },
  });
  return { ...payload, id: ref.id };
}

export async function patchExamSession(
  sessionId: string,
  changes: Partial<ExamSession>,
  details?: Record<string, unknown>,
): Promise<void> {
  if (useServerWrites) {
    await postJson(
      '/api/admin/write',
      { action: 'session_patch', data: { id: sessionId, changes, details: details ?? changes } },
      { admin: true },
    );
    return;
  }

  requireAdmin();
  await updateDoc(doc(db, 'exam_sessions', sessionId), changes);
  await logAuditSafely({
    action: 'session_updated',
    entityType: 'exam_sessions',
    entityId: sessionId,
    details: details ?? changes,
  });
}

export async function removeExamSession(session: Pick<ExamSession, 'id' | 'name'>): Promise<void> {
  if (useServerWrites) {
    await postJson('/api/admin/write', { action: 'session_delete', data: session }, { admin: true });
    return;
  }

  requireAdmin();
  await deleteDoc(doc(db, 'exam_sessions', session.id));
  await logAuditSafely({
    action: 'session_deleted',
    entityType: 'exam_sessions',
    entityId: session.id,
    details: { name: session.name },
  });
}

export async function deleteExamResults(ids: string[]): Promise<void> {
  if (useServerWrites) {
    await postJson('/api/admin/write', { action: 'results_delete', data: { ids } }, { admin: true });
    return;
  }

  requireAdmin();
  if (ids.length === 0) return;

  const batch = writeBatch(db);
  ids.forEach((id) => batch.delete(doc(db, 'exam_results', id)));
  await batch.commit();

  await logAuditSafely({
    action: 'result_deleted',
    entityType: 'exam_results',
    details: { deletedCount: ids.length, ids },
  });
}

export async function deleteAllExamResults(): Promise<void> {
  if (useServerWrites) {
    await postJson('/api/admin/write', { action: 'results_delete_all', data: {} }, { admin: true });
    return;
  }

  requireAdmin();
  const snap = await getDocs(collection(db, 'exam_results'));
  if (snap.empty) return;

  const batch = writeBatch(db);
  snap.docs.forEach((entry) => batch.delete(entry.ref));
  await batch.commit();

  await logAuditSafely({
    action: 'results_deleted_all',
    entityType: 'exam_results',
    details: { deletedCount: snap.size },
  });
}

export async function saveSessionCandidateList(
  sessionId: string,
  allowedCandidates: string[],
): Promise<void> {
  if (useServerWrites) {
    await postJson(
      '/api/admin/write',
      { action: 'session_candidates', data: { id: sessionId, allowedCandidates } },
      { admin: true },
    );
    return;
  }

  requireAdmin();
  await updateDoc(doc(db, 'exam_sessions', sessionId), { allowedCandidates });
  await logAuditSafely({
    action: 'session_updated',
    entityType: 'exam_sessions',
    entityId: sessionId,
    details: { allowedCandidatesCount: allowedCandidates.length },
  });
}

export async function deleteResultsForSession(sessionId: string): Promise<number> {
  requireAdmin();
  const snap = await getDocs(query(collection(db, 'exam_results'), where('sessionId', '==', sessionId)));
  if (snap.empty) return 0;
  const batch = writeBatch(db);
  snap.docs.forEach((entry) => batch.delete(entry.ref));
  await batch.commit();
  await logAuditEntry({
    action: 'result_deleted',
    entityType: 'exam_results',
    details: { sessionId, deletedCount: snap.size },
  });
  return snap.size;
}

export async function deleteSpecificResultsByIds(ids: string[]): Promise<number> {
  requireAdmin();
  if (ids.length === 0) return 0;
  const uniqueIds = [...new Set(ids)];
  const batch = writeBatch(db);
  uniqueIds.forEach((id) => batch.delete(doc(db, 'exam_results', id)));
  await batch.commit();
  await logAuditEntry({
    action: 'result_deleted',
    entityType: 'exam_results',
    details: { deletedCount: uniqueIds.length, ids: uniqueIds },
  });
  return uniqueIds.length;
}

export async function upsertQuestionOverride(
  payload: Omit<QuestionAdminOverride, 'id' | 'updatedAt' | 'updatedBy' | 'createdAt' | 'createdBy'>,
  existingId?: string,
): Promise<QuestionAdminOverride> {
  const actorEmail = getCurrentActorEmail();
  const nextPayload = {
    ...payload,
    updatedAt: new Date().toISOString(),
    updatedBy: actorEmail,
  };

  if (useServerWrites) {
    const response = await postJson<{ ok: true; questionOverride: QuestionAdminOverride }>(
      '/api/admin/write',
      { action: 'question_upsert', data: { ...nextPayload, ...(existingId ? { id: existingId } : {}) } },
      { admin: true },
    );
    return response.questionOverride;
  }

  requireAdmin();

  if (existingId) {
    await setDoc(doc(db, 'question_overrides', existingId), { ...nextPayload, id: existingId }, { merge: true });
    await logAuditSafely({
      action: 'question_updated',
      entityType: 'question_overrides',
      entityId: existingId,
      details: { questionId: payload.questionId, status: payload.status ?? null },
    });
    return { ...nextPayload, id: existingId };
  }

  const ref = await addDoc(collection(db, 'question_overrides'), {
    ...nextPayload,
    createdAt: nextPayload.updatedAt,
    createdBy: actorEmail,
  });
  const created = { ...nextPayload, createdAt: nextPayload.updatedAt, createdBy: actorEmail, id: ref.id };
  await setDoc(doc(db, 'question_overrides', ref.id), created, { merge: true });
  await logAuditSafely({
    action: 'question_updated',
    entityType: 'question_overrides',
    entityId: ref.id,
    details: { questionId: payload.questionId, status: payload.status ?? null },
  });
  return created;
}

export async function setQuestionStatus(
  questionId: number,
  status: 'active' | 'skipped' | 'deleted',
  existingOverride?: QuestionAdminOverride | null,
): Promise<QuestionAdminOverride> {
  const payload: Omit<QuestionAdminOverride, 'id' | 'updatedAt' | 'updatedBy' | 'createdAt' | 'createdBy'> = {
    ...(existingOverride ?? {}),
    questionId,
    status,
  };

  const saved = await upsertQuestionOverride(payload, existingOverride?.id);
  await logAuditSafely({
    action: 'question_status_changed',
    entityType: 'question_overrides',
    entityId: saved.id,
    details: { questionId, status },
  });
  return saved;
}
interface CandidateMatch {
  id: string;
  startedAt?: string;
  status?: string;
}
