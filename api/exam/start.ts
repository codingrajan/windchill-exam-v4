import { adminDb } from '../_lib/firebaseAdmin';
import type { ApiRequestLike, ApiResponseLike } from '../_lib/http';
import { readJson, sendMethodNotAllowed } from '../_lib/http';

interface StartExamPayload {
  sessionId: string;
  candidateName: string;
  candidateEmail?: string;
  accessCode: string;
}

export default async function handler(req: ApiRequestLike, res: ApiResponseLike) {
  if (req.method !== 'POST') {
    sendMethodNotAllowed(res);
    return;
  }

  try {
    const payload = await readJson<StartExamPayload>(req);
    const sessionId = String(payload.sessionId ?? '').trim();
    const candidateName = String(payload.candidateName ?? '').trim();
    const candidateEmail = String(payload.candidateEmail ?? '').trim().toLowerCase();
    const accessCode = String(payload.accessCode ?? '').trim();

    if (!sessionId || !candidateName || !accessCode) {
      res.status(400).json({ error: 'Missing required session start fields.' });
      return;
    }

    const sessionRef = adminDb.collection('exam_sessions').doc(sessionId);
    const sessionSnap = await sessionRef.get();

    if (!sessionSnap.exists) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }

    const session = sessionSnap.data() as Record<string, unknown>;
    if (!session.isActive) {
      res.status(403).json({ error: 'This session is inactive.' });
      return;
    }

    if (typeof session.accessCode !== 'string' || session.accessCode.trim() !== accessCode) {
      res.status(403).json({ error: 'Incorrect access code.' });
      return;
    }

    if (typeof session.startsAt === 'string' && new Date(session.startsAt) > new Date()) {
      res.status(403).json({ error: 'This session is not open yet.' });
      return;
    }

    if (typeof session.expiresAt === 'string' && new Date(session.expiresAt) < new Date()) {
      res.status(403).json({ error: 'This session has expired.' });
      return;
    }

    const allowedCandidates = Array.isArray(session.allowedCandidates) ? session.allowedCandidates : [];
    if (allowedCandidates.length > 0) {
      const normalizedAllowed = allowedCandidates
        .map((entry) => String(entry).trim().toLowerCase())
        .filter(Boolean);

      if (!normalizedAllowed.includes(candidateName.toLowerCase())) {
        res.status(403).json({ error: 'You are not registered for this session.' });
        return;
      }
    }

    const participantsSnap = await adminDb
      .collection('session_participants')
      .where('sessionId', '==', sessionId)
      .where('candidateName', '==', candidateName)
      .get();

    const completedAttempts = participantsSnap.docs.filter((entry) => entry.data().status === 'completed').length;
    const maxRetakes = Number(session.maxRetakes ?? 0);

    if (maxRetakes > 0 && completedAttempts >= maxRetakes) {
      res.status(403).json({ error: `You have used all ${maxRetakes} attempt${maxRetakes > 1 ? 's' : ''} for this session.` });
      return;
    }

    const participantPayload = {
      sessionId,
      sessionName: String(session.name ?? ''),
      candidateName,
      ...(candidateEmail ? { candidateEmail } : {}),
      startedAt: new Date().toISOString(),
      status: 'in_progress',
      retakeNumber: completedAttempts + 1,
    };

    const participantRef = await adminDb.collection('session_participants').add(participantPayload);

    try {
      await adminDb.collection('audit_logs').add({
        action: 'session_updated',
        entityType: 'session_participants',
        entityId: participantRef.id,
        actorEmail: candidateEmail || 'candidate',
        createdAt: new Date().toISOString(),
        details: {
          sessionId,
          candidateName,
          retakeNumber: completedAttempts + 1,
          event: 'candidate_session_started',
        },
      });
    } catch (auditError) {
      console.error('start exam audit log error', auditError);
    }

    res.status(200).json({
      ok: true,
      participantId: participantRef.id,
      retakeNumber: completedAttempts + 1,
    });
  } catch (error) {
    console.error('start exam error', error);
    res.status(500).json({ error: 'Could not start exam session.' });
  }
}
