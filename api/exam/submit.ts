import { adminDb } from '../_lib/firebaseAdmin';
import type { ApiRequestLike, ApiResponseLike } from '../_lib/http';
import { readJson, sendMethodNotAllowed } from '../_lib/http';

interface ExamResultPayload {
  attemptId?: string;
  examineeName: string;
  scorePercentage: number;
  passed: boolean;
  examDate: string;
  sessionId?: string;
  candidateEmail?: string;
  participantId?: string;
  [key: string]: unknown;
}

const normalizeEmail = (email?: string): string | undefined => {
  const trimmed = String(email ?? '').trim().toLowerCase();
  return trimmed || undefined;
};

const resolveParticipantId = async (payload: ExamResultPayload): Promise<string | undefined> => {
  const directId = String(payload.participantId ?? '').trim();
  if (directId) {
    const directSnap = await adminDb.collection('session_participants').doc(directId).get();
    if (directSnap.exists) return directId;
  }

  const sessionId = String(payload.sessionId ?? '').trim();
  if (!sessionId) return undefined;

  const email = normalizeEmail(payload.candidateEmail);
  const candidateName = String(payload.examineeName ?? '').trim();

  const candidateQueries = [];
  if (email) {
    candidateQueries.push(
      adminDb
        .collection('session_participants')
        .where('sessionId', '==', sessionId)
        .where('candidateEmail', '==', email)
        .get(),
    );
  }

  if (candidateName) {
    candidateQueries.push(
      adminDb
        .collection('session_participants')
        .where('sessionId', '==', sessionId)
        .where('candidateName', '==', candidateName)
        .get(),
    );
  }

  for (const queryPromise of candidateQueries) {
    const snap = await queryPromise;
    const matches = snap.docs
      .map((entry) => ({ id: entry.id, ...(entry.data() as Record<string, unknown>) }))
      .sort((left, right) =>
        String(right.startedAt ?? '').localeCompare(String(left.startedAt ?? '')),
      );
    const inProgress = matches.find((entry) => entry.status === 'in_progress');
    if (inProgress) return String(inProgress.id);
    if (matches[0]) return String(matches[0].id);
  }

  return undefined;
};

export default async function handler(req: ApiRequestLike, res: ApiResponseLike) {
  if (req.method !== 'POST') {
    sendMethodNotAllowed(res);
    return;
  }

  try {
    const payload = await readJson<ExamResultPayload>(req);
    const normalizedEmail = normalizeEmail(payload.candidateEmail);
    const participantId = await resolveParticipantId({
      ...payload,
      ...(normalizedEmail ? { candidateEmail: normalizedEmail } : {}),
    });

    if (!payload?.examineeName || typeof payload.scorePercentage !== 'number' || typeof payload.passed !== 'boolean') {
      res.status(400).json({ error: 'Invalid exam result payload.' });
      return;
    }

    const attemptId = String(payload.attemptId ?? '').trim();

    if (attemptId) {
      const priorAttempt = await adminDb
        .collection('exam_results')
        .where('attemptId', '==', attemptId)
        .limit(1)
        .get();

      if (!priorAttempt.empty) {
        res.status(200).json({ ok: true, resultId: priorAttempt.docs[0].id, participantId: participantId ?? null });
        return;
      }
    }

    if (participantId) {
      const prior = await adminDb
        .collection('exam_results')
        .where('participantId', '==', participantId)
        .limit(1)
        .get();

      if (!prior.empty) {
        res.status(409).json({ error: 'Result already submitted for this participant.' });
        return;
      }
    }

    const storedPayload = {
      ...payload,
      ...(normalizedEmail ? { candidateEmail: normalizedEmail } : {}),
      ...(participantId ? { participantId } : {}),
    };

    const resultRef = await adminDb.collection('exam_results').add(storedPayload);

    if (participantId) {
      await adminDb.collection('session_participants').doc(participantId).set(
        {
          status: 'completed',
          submittedAt: payload.examDate,
          score: payload.scorePercentage,
          passed: payload.passed,
        },
        { merge: true },
      );
    }

    await adminDb.collection('audit_logs').add({
      action: 'result_submitted',
      entityType: 'exam_results',
      entityId: resultRef.id,
      actorEmail: normalizedEmail ?? 'candidate',
      createdAt: new Date().toISOString(),
      details: {
        examineeName: payload.examineeName,
        examTrack: payload.examTrack ?? null,
        sessionId: payload.sessionId ?? null,
        scorePercentage: payload.scorePercentage,
      },
    });

    res.status(200).json({ ok: true, resultId: resultRef.id, participantId: participantId ?? null });
  } catch (error) {
    console.error('submit exam error', error);
    res.status(500).json({ error: 'Could not submit result.' });
  }
}
